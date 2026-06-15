"""Agent activity engine — generation, voice guardrails, deduplication."""

from __future__ import annotations

import re
from datetime import datetime, timezone

import pytest

from app.database import SessionLocal
from app.forecasting.agent_status import CORE_AGENT_SLUGS
from app.forecasting.models import Agent
from app.forecasting.services.agent_activity_engine import (
    ACTIVITY_TYPES,
    body_hash,
    generate_agent_activity_batch,
    list_generated_activity,
    summarize_network_briefing,
    violates_forbidden_topics,
)

CORE_SLUGS = tuple(sorted(CORE_AGENT_SLUGS))


@pytest.fixture
def db():
    session = SessionLocal()
    try:
        agents = (
            session.query(Agent)
            .filter(Agent.slug.in_(CORE_SLUGS))
            .all()
        )
        if len(agents) < 5:
            pytest.skip("Core agents not seeded in database")
        yield session
    finally:
        session.close()


def test_activity_types_defined():
    assert "agent_post" in ACTIVITY_TYPES
    assert "network_briefing_item" in ACTIVITY_TYPES
    assert "receipt_challenge" in ACTIVITY_TYPES
    assert "receipt_victory" in ACTIVITY_TYPES


def test_body_hash_stable():
    assert body_hash("Hello  world") == body_hash("hello world")


def test_forbidden_topic_rules():
    assert violates_forbidden_topics("doombot", "The dip is still there. Still buying.")
    assert violates_forbidden_topics("bullbot", "Soft landing is cope. Recession window live.")
    assert not violates_forbidden_topics("doombot", "Consensus is usually late. Credit impulse negative.")


def test_all_core_agents_generate_activity(db):
    created = generate_agent_activity_batch(db, count=8, seed=9001)
    assert len(created) >= 5
    slugs = {r.agent_slug for r in created}
    assert slugs >= set(CORE_SLUGS)


def test_generated_items_have_timestamps(db):
    created = generate_agent_activity_batch(db, count=6, seed=9002)
    assert created
    for row in created:
        assert row.created_at is not None
        assert row.activity_id
        assert row.activity_type in ACTIVITY_TYPES
        assert row.title.strip()
        assert row.body.strip()
        iso = row.created_at.replace(tzinfo=timezone.utc).isoformat()
        assert re.match(r"\d{4}-\d{2}-\d{2}T", iso)


def test_duplicate_prevention(db):
    first = generate_agent_activity_batch(db, count=8, seed=4242)
    first_hashes = {r.body_hash for r in first}
    assert len(first_hashes) == len(first)

    second = generate_agent_activity_batch(db, count=8, seed=5252)
    overlap = {r.body_hash for r in second} & first_hashes
    assert len(overlap) == 0


def test_list_generated_feed_shape(db):
    generate_agent_activity_batch(db, count=5, seed=9003)
    items = list_generated_activity(db, limit=10)
    assert items
    item = items[0]
    for key in (
        "created_at",
        "agent_slug",
        "activity_type",
        "title",
        "body",
        "thread_id",
        "parent_activity_id",
    ):
        assert key in item


def test_network_briefing_summarizes_activity(db):
    generate_agent_activity_batch(db, count=8, seed=9004)
    lines = summarize_network_briefing(db, since_hours=48)
    assert isinstance(lines, list)
    assert lines
    assert all(isinstance(line, str) and line.strip() for line in lines)


def test_no_forbidden_topics_in_batch(db):
    created = generate_agent_activity_batch(db, count=10, seed=9005)
    for row in created:
        assert not violates_forbidden_topics(row.agent_slug, row.body)


def test_fedwatcher_rates_anchor_when_cpi_trigger(db):
    """FedWatcher CPI trigger should include rates vocabulary."""
    created = generate_agent_activity_batch(db, count=10, seed=7711)
    fed_rows = [r for r in created if r.agent_slug == "fed-watcher"]
    if not fed_rows:
        pytest.skip("FedWatcher not in batch for seed")
    rates_vocab = re.compile(r"\b(2s10s|bps|front-end|september|curve|cpi|fed)\b", re.I)
    assert any(rates_vocab.search(r.body) for r in fed_rows)
