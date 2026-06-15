"""Receipt Warfare — historical forecast ammunition against rivals."""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta

import pytest

from app.database import SessionLocal
from app.forecasting.agent_status import CORE_AGENT_SLUGS
from app.forecasting.models import (
    Agent,
    AgentGeneratedActivity,
    FeedEvent,
    ForecastResolution,
    Market,
)
from app.forecasting.services.agent_activity_engine import ACTIVITY_TYPES
from app.forecasting.services.receipt_warfare import (
    RECEIPT_CHALLENGE_CHANCE,
    gather_receipt_ammunition,
    generate_receipt_warfare_copy,
    maybe_generate_receipt_warfare,
)

CORE_SLUGS = tuple(sorted(CORE_AGENT_SLUGS))


@pytest.fixture
def db():
    session = SessionLocal()
    try:
        agents = session.query(Agent).filter(Agent.slug.in_(CORE_SLUGS)).all()
        if len(agents) < 5:
            pytest.skip("Core agents not seeded in database")
        yield session
    finally:
        session.close()


def test_receipt_warfare_activity_types():
    assert "receipt_challenge" in ACTIVITY_TYPES
    assert "receipt_victory" in ACTIVITY_TYPES


def test_gather_receipt_ammunition_from_history(db):
    doombot = db.query(Agent).filter(Agent.slug == "doombot").first()
    market = db.query(Market).first()
    assert doombot and market

    now = datetime.utcnow()
    for i in range(3):
        db.add(
            ForecastResolution(
                agent_id=doombot.id,
                market_id=market.id,
                source_type="test",
                source_id=i,
                side="NO",
                predicted_probability=72.0,
                confidence=72.0,
                outcome_yes=True,
                correct=False,
                days_early=0,
                resolved_at=now - timedelta(days=10 + i),
            )
        )
    db.add(
        FeedEvent(
            type="new_take",
            agent_id=doombot.id,
            market_id=market.id,
            title="Recession window live",
            body="Soft landing is cope. Recession odds climbing.",
            probability=35.0,
            confidence=70.0,
            created_at=now - timedelta(days=5),
        )
    )
    db.flush()

    ammo = gather_receipt_ammunition(db, "bullbot", "doombot", since_days=90)
    assert ammo.count >= 3
    assert ammo.evidence
    assert ammo.kind == "recession_calls"


def test_generate_bullbot_challenge_line(db):
    doombot = db.query(Agent).filter(Agent.slug == "doombot").first()
    market = db.query(Market).filter(Market.title.ilike("%recession%")).first()
    if not market:
        market = db.query(Market).first()
    assert doombot and market

    now = datetime.utcnow()
    for i in range(6):
        db.add(
            ForecastResolution(
                agent_id=doombot.id,
                market_id=market.id,
                source_type="test",
                source_id=100 + i,
                side="NO",
                predicted_probability=78.0,
                confidence=78.0,
                outcome_yes=False,
                correct=False,
                days_early=0,
                resolved_at=now - timedelta(days=20 + i),
            )
        )
    db.flush()

    line, meta = generate_receipt_warfare_copy(
        db, "bullbot", "doombot", "receipt_challenge", seed=42
    )
    assert line
    assert "DoomBot" in line
    assert "6" in line or "recession" in line.lower()
    assert meta.get("receipt_ammunition", {}).get("count", 0) >= 6


def test_generate_doombot_drawdown_challenge(db):
    bullbot = db.query(Agent).filter(Agent.slug == "bullbot").first()
    market = db.query(Market).first()
    assert bullbot and market

    now = datetime.utcnow()
    db.add(
        ForecastResolution(
            agent_id=bullbot.id,
            market_id=market.id,
            source_type="test",
            source_id=200,
            side="YES",
            predicted_probability=68.0,
            confidence=68.0,
            outcome_yes=False,
            correct=False,
            days_early=0,
            resolved_at=now - timedelta(days=3),
        )
    )
    db.add(
        AgentGeneratedActivity(
            activity_id=str(uuid.uuid4()),
            activity_type="agent_post",
            agent_id=bullbot.id,
            agent_slug="bullbot",
            title="Pullback — dip still there",
            body="Down 3%. The crowd is scared.\nThe dip is still there.\nStill buying.",
            body_hash=f"hash-{uuid.uuid4()}",
            created_at=now - timedelta(days=2),
        )
    )
    db.flush()

    line, meta = generate_receipt_warfare_copy(
        db, "doombot", "bullbot", "receipt_challenge", seed=7
    )
    assert line
    assert "BullBot" in line
    assert "drawdown" in line.lower() or meta["receipt_ammunition"]["count"] >= 1


def test_maybe_generate_receipt_challenge_after_rivalry(db, monkeypatch):
    from app.forecasting.models import Market as MarketModel

    monkeypatch.setattr(
        "app.forecasting.services.receipt_warfare._roll",
        lambda seed, threshold: True,
    )

    agents = {a.slug: a for a in db.query(Agent).filter(Agent.slug.in_(CORE_SLUGS)).all()}
    markets = db.query(MarketModel).all()
    doombot = agents["doombot"]
    bullbot = agents["bullbot"]
    market = markets[0] if markets else None

    now = datetime.utcnow()
    for i in range(4):
        db.add(
            ForecastResolution(
                agent_id=doombot.id,
                market_id=market.id if market else None,
                source_type="test",
                source_id=300 + i,
                side="NO",
                predicted_probability=80.0,
                confidence=80.0,
                outcome_yes=True,
                correct=False,
                days_early=0,
                resolved_at=now - timedelta(days=8 + i),
            )
        )
    db.flush()

    source_id = str(uuid.uuid4())
    source = AgentGeneratedActivity(
        activity_id=source_id,
        activity_type="rival_reply",
        agent_id=bullbot.id,
        agent_slug="bullbot",
        title="Timing is the job",
        body="DoomBot is right about the mechanism. Timing is the job.",
        body_hash=f"source-{uuid.uuid4()}",
        thread_id=source_id,
        metadata_json={
            "counter_target": "doombot",
            "in_reply_to_agent_slug": "doombot",
            "event_kind": "rivalry",
        },
        created_at=now,
    )
    session_by_id = {source.activity_id: source}
    rows = maybe_generate_receipt_warfare(
        db,
        source,
        seed=8800,
        mirror_to_feed=False,
        recent_hashes=set(),
        agents=agents,
        markets=markets,
        session_by_id=session_by_id,
    )
    assert rows
    assert rows[0].activity_type == "receipt_challenge"
    assert rows[0].agent_slug == "bullbot"
    assert "DoomBot" in rows[0].body
    assert RECEIPT_CHALLENGE_CHANCE == 0.12
    db.rollback()
