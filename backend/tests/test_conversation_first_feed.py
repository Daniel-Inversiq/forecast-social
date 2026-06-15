"""Conversation-first feed — thread density and reply quality targets."""

from __future__ import annotations

import pytest

from app.database import SessionLocal
from app.forecasting.agent_status import CORE_AGENT_SLUGS
from app.forecasting.models import Agent
from app.forecasting.services.agent_activity_engine import generate_agent_activity_batch
from app.forecasting.services.conversation_metrics import batch_conversation_metrics
from app.forecasting.services.rivalry_engine import (
    AGENT_POST_RIVAL_CHANCE,
    SECOND_ORDER_CHANCE,
    THIRD_PARTICIPANT_CHANCE,
)
from app.forecasting.services.conversational_reply_engine import (
    is_analytical_summary,
    passes_conversational_reply_quality,
)
from app.forecasting.services.voice_engine import (
    anchor_rival_reply_to_claim,
    is_generic_disagreement,
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


def test_conversation_probability_constants():
    assert AGENT_POST_RIVAL_CHANCE == 0.60
    assert SECOND_ORDER_CHANCE == 0.25
    assert THIRD_PARTICIPANT_CHANCE == 0.10


def test_generic_disagreement_rejects_empty_pushback():
    assert is_generic_disagreement("You're wrong.")
    assert is_generic_disagreement("I disagree.")
    assert not is_generic_disagreement(
        "The data may be right, but you're assuming the market hasn't already repriced it."
    )


def test_anchor_rival_reply_references_claim_and_rival():
    line = anchor_rival_reply_to_claim(
        "macro-oracle",
        "bullbot",
        "You're wrong.",
        source_title="The dip is still there.",
        source_body="Pullback — dip still there",
        seed=42,
    )
    assert not is_analytical_summary(line)
    assert passes_conversational_reply_quality("macro-oracle", line)
    assert "horizon" in line.lower() or "headline" in line.lower() or "cycle" in line.lower()


def test_generate_100_activities_conversation_first_targets(db):
    created = generate_agent_activity_batch(db, count=100, seed=8675309)
    assert len(created) >= 65

    metrics = batch_conversation_metrics(created)
    assert metrics["in_conversation_rate"] > 0.50, (
        f"expected >50% in threads, got {metrics['in_conversation_rate']:.2f}"
    )
    assert metrics["roots_with_reply_rate"] > 0.25, (
        f"expected >25% roots with replies, got {metrics['roots_with_reply_rate']:.2f}"
    )
    assert metrics["multi_agent_thread_rate"] > 0.10, (
        f"expected >10% multi-agent threads, got {metrics['multi_agent_thread_rate']:.2f}"
    )

    threaded = [r for r in created if r.parent_activity_id]
    assert threaded, "expected rival replies in batch"
    for row in threaded[:12]:
        meta = row.metadata_json or {}
        assert row.thread_id
        assert row.parent_activity_id
        assert meta.get("counter_target") or meta.get("in_reply_to_agent_slug")

    db.rollback()
