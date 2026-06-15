"""Resolution-specific receipt pending detection tests."""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

import pytest

from app.database import SessionLocal
from app.forecasting.agent_status import CORE_AGENT_SLUGS
from app.forecasting.models import Agent, AgentGeneratedActivity, ForecastResolution, Market
from app.forecasting.services.activity_generation_sources import ACTIVITY_SOURCE_AUTONOMOUS
from app.forecasting.services.resolution_receipt_status import (
    count_pending_resolutions,
    has_pending_resolution,
    resolution_has_handling_receipt,
    scan_resolution_receipt_status,
)


@pytest.fixture
def db():
    from app.forecasting.migrate import migrate_schema

    migrate_schema()
    session = SessionLocal()
    try:
        agents = session.query(Agent).filter(Agent.slug.in_(CORE_AGENT_SLUGS)).all()
        if len(agents) < 5:
            pytest.skip("Core agents not seeded in database")
        yield session
    finally:
        session.close()


def _utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _resolution(
    db,
    agent: Agent,
    market: Market | None,
    *,
    correct: bool = True,
    offset_minutes: int = 0,
) -> ForecastResolution:
    now = _utcnow() - timedelta(minutes=offset_minutes)
    row = ForecastResolution(
        agent_id=agent.id,
        market_id=market.id if market else None,
        source_type="dev_resolution_simulation",
        source_id=1,
        side="YES",
        predicted_probability=55.0,
        confidence=70.0,
        outcome_yes=True,
        correct=correct,
        days_early=5,
        resolved_at=now,
    )
    db.add(row)
    db.flush()
    return row


def _receipt(
    db,
    agent: Agent,
    *,
    resolution_id: int,
    activity_type: str = "receipt_victory",
    offset_minutes: int = 0,
) -> AgentGeneratedActivity:
    now = _utcnow() - timedelta(minutes=offset_minutes)
    row = AgentGeneratedActivity(
        activity_id=str(uuid.uuid4()),
        activity_type=activity_type,
        agent_id=agent.id,
        agent_slug=agent.slug,
        title=f"Receipt for resolution {resolution_id}",
        body=f"Resolution {resolution_id} handled on the tape.",
        body_hash=f"resolution-receipt-{resolution_id}-{uuid.uuid4().hex[:8]}",
        metadata_json={
            "source": ACTIVITY_SOURCE_AUTONOMOUS,
            "resolution_id": resolution_id,
        },
        created_at=now,
    )
    db.add(row)
    db.flush()
    return row


def test_receipt_for_resolution_11_does_not_clear_resolution_13(db):
    agent = db.query(Agent).filter(Agent.slug == "doombot").first()
    market = db.query(Market).first()
    assert agent and market

    resolution_11 = _resolution(db, agent, market, offset_minutes=30)
    resolution_13 = _resolution(db, agent, market, correct=False, offset_minutes=20)
    db.commit()

    _receipt(db, agent, resolution_id=resolution_11.id, offset_minutes=10)
    db.commit()

    assert resolution_has_handling_receipt(db, resolution_11)
    assert not resolution_has_handling_receipt(db, resolution_13)
    assert has_pending_resolution(db)
    assert resolution_13.id in scan_resolution_receipt_status(db).pending_resolution_ids
    assert resolution_11.id in scan_resolution_receipt_status(db).handled_resolution_ids


def test_receipt_for_resolution_11_does_not_clear_resolution_15(db):
    agent = db.query(Agent).filter(Agent.slug == "doombot").first()
    market = db.query(Market).first()
    assert agent and market

    resolution_11 = _resolution(db, agent, market, offset_minutes=40)
    resolution_15 = _resolution(db, agent, market, offset_minutes=25)
    db.commit()

    _receipt(db, agent, resolution_id=resolution_11.id, offset_minutes=15)
    db.commit()

    assert not resolution_has_handling_receipt(db, resolution_15)
    status = scan_resolution_receipt_status(db)
    assert resolution_15.id in status.pending_resolution_ids
    assert resolution_11.id in status.handled_resolution_ids


def test_matching_resolution_id_clears_pending(db):
    agent = db.query(Agent).filter(Agent.slug == "bullbot").first()
    market = db.query(Market).first()
    assert agent and market

    resolution = _resolution(db, agent, market, offset_minutes=15)
    db.commit()
    assert count_pending_resolutions(db) >= 1

    _receipt(db, agent, resolution_id=resolution.id, activity_type="receipt_victory")
    db.commit()

    assert resolution_has_handling_receipt(db, resolution)
    assert resolution.id not in scan_resolution_receipt_status(db).pending_resolution_ids
    assert resolution.id in scan_resolution_receipt_status(db).handled_resolution_ids


def test_receipt_challenge_clears_pending_for_incorrect_resolution(db):
    agent = db.query(Agent).filter(Agent.slug == "macro-oracle").first()
    market = db.query(Market).first()
    assert agent and market

    resolution = _resolution(db, agent, market, correct=False, offset_minutes=10)
    db.commit()
    assert has_pending_resolution(db)

    _receipt(db, agent, resolution_id=resolution.id, activity_type="receipt_challenge")
    db.commit()

    assert resolution_has_handling_receipt(db, resolution)
    assert resolution.id in scan_resolution_receipt_status(db).handled_resolution_ids


def test_unrelated_agent_receipt_without_resolution_id_does_not_clear(db):
    agent = db.query(Agent).filter(Agent.slug == "doombot").first()
    other = db.query(Agent).filter(Agent.slug == "bullbot").first()
    market = db.query(Market).first()
    assert agent and other and market

    resolution = _resolution(db, agent, market, offset_minutes=5)
    db.commit()

    unrelated = AgentGeneratedActivity(
        activity_id=str(uuid.uuid4()),
        activity_type="receipt_victory",
        agent_id=agent.id,
        agent_slug=agent.slug,
        title="Unrelated victory",
        body="No resolution_id on this row.",
        body_hash=f"unrelated-{uuid.uuid4().hex[:8]}",
        metadata_json={"source": ACTIVITY_SOURCE_AUTONOMOUS},
        created_at=_utcnow(),
    )
    db.add(unrelated)
    db.commit()

    assert not resolution_has_handling_receipt(db, resolution)
    assert resolution.id in scan_resolution_receipt_status(db).pending_resolution_ids


def test_wrong_resolution_id_on_same_agent_does_not_clear(db):
    agent = db.query(Agent).filter(Agent.slug == "doombot").first()
    market = db.query(Market).first()
    assert agent and market

    resolution = _resolution(db, agent, market, offset_minutes=8)
    db.commit()

    _receipt(db, agent, resolution_id=999_999, offset_minutes=1)
    db.commit()

    assert not resolution_has_handling_receipt(db, resolution)
    assert has_pending_resolution(db)
