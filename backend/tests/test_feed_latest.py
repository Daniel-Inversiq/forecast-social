"""Latest feed chip — chronological ordering."""

from __future__ import annotations

from datetime import datetime, timedelta

import pytest
from fastapi.testclient import TestClient

from app.database import SessionLocal
from app.forecasting.models import Agent, FeedEvent
from app.forecasting.services.feed_intelligence import (
    _dedupe_feed_payloads,
    _sort_payloads_by_publish_time,
    build_personalized_feed,
)
from app.main import app


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def db():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


def _publish_ts(item: dict) -> datetime:
    raw = item.get("feed_published_at") or item.get("created_at") or ""
    text = str(raw).replace("Z", "+00:00")
    return datetime.fromisoformat(text)


def _assert_descending_publish_time(items: list[dict]) -> None:
    stamps = [_publish_ts(item) for item in items if item.get("feed_published_at") or item.get("created_at")]
    for i in range(1, len(stamps)):
        assert stamps[i - 1] >= stamps[i], (
            f"Item {i - 1} ({stamps[i - 1].isoformat()}) is older than item {i} ({stamps[i].isoformat()})"
        )


def test_latest_feed_api_returns_descending_timestamps(client, db):
    res = client.get("/feed?chip=latest&limit=30")
    assert res.status_code == 200
    items = res.json()
    assert isinstance(items, list)
    assert len(items) > 0
    assert all(item.get("feed_mode") == "latest" for item in items)
    _assert_descending_publish_time(items)


def test_latest_feed_debug_has_zero_chronology_violations(client, db):
    res = client.get("/feed/debug?chip=latest&limit=30")
    assert res.status_code == 200
    data = res.json()
    assert data["feed_mode"] == "latest"
    assert data["chronological_order_expected"] is True
    assert data["chronology_violation_count"] == 0
    _assert_descending_publish_time(data["items"])


def test_for_you_feed_unchanged_feed_mode(client, db):
    res = client.get("/feed?limit=10")
    assert res.status_code == 200
    items = res.json()
    if items:
        assert all(item.get("feed_mode") == "for_you" for item in items)


def test_latest_bypasses_variety_in_service(db):
    result = build_personalized_feed(db, None, chip="latest", limit=25)
    items = result["events"]
    assert result["meta"]["feed_mode"] == "latest"
    assert len(items) > 0
    _assert_descending_publish_time(items)
    # Synthetic injections carry no numeric feed id
    assert all(item.get("id") is not None for item in items)


def test_dedupe_feed_payloads_by_id_and_generated_id():
    payloads = [
        {"id": 1, "created_at": "2026-06-08T10:00:00Z", "feed_published_at": "2026-06-08T10:00:00Z"},
        {"id": 1, "created_at": "2026-06-08T09:00:00Z", "feed_published_at": "2026-06-08T09:00:00Z"},
        {
            "id": 2,
            "generated_activity_id": "act-a",
            "created_at": "2026-06-08T08:00:00Z",
            "feed_published_at": "2026-06-08T08:00:00Z",
        },
        {
            "id": 3,
            "generated_activity_id": "act-a",
            "created_at": "2026-06-08T07:00:00Z",
            "feed_published_at": "2026-06-08T07:00:00Z",
        },
    ]
    deduped = _dedupe_feed_payloads(_sort_payloads_by_publish_time(payloads))
    assert len(deduped) == 2
    assert deduped[0]["id"] == 1
    assert deduped[1]["id"] == 2


def test_latest_feed_recent_events_near_top(db):
    agent = db.query(Agent).first()
    if not agent:
        pytest.skip("No agents seeded")
    now = datetime.utcnow()
    recent = FeedEvent(
        type="new_take",
        agent_id=agent.id,
        title="Latest chip probe — recent autonomous signal",
        body="Probe body for latest ordering",
        created_at=now,
        feed_published_at=now,
        metadata_json={"source": "agent_activity_engine", "activity_type": "agent_post"},
    )
    old = FeedEvent(
        type="new_take",
        agent_id=agent.id,
        title="Latest chip probe — stale signal",
        body="Old probe body",
        created_at=now - timedelta(days=4),
        feed_published_at=now - timedelta(days=4),
    )
    db.add(recent)
    db.add(old)
    db.commit()

    result = build_personalized_feed(db, None, chip="latest", limit=50)
    items = result["events"]
    recent_idx = next(
        (i for i, item in enumerate(items) if item.get("title") == recent.title),
        None,
    )
    old_idx = next(
        (i for i, item in enumerate(items) if item.get("title") == old.title),
        None,
    )
    assert recent_idx is not None
    if old_idx is not None:
        assert recent_idx < old_idx

    db.delete(recent)
    db.delete(old)
    db.commit()
