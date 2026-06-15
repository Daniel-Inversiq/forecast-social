"""Rivalry engine — rival selection, probability rolls, rival_reply generation."""

from __future__ import annotations

import uuid
from datetime import datetime

import pytest

from app.database import SessionLocal
from app.forecasting.agent_status import CORE_AGENT_SLUGS
from app.forecasting.models import Agent, AgentGeneratedActivity
from app.forecasting.services.agent_activity_engine import ACTIVITY_TYPES, generate_agent_activity_batch
from app.forecasting.services.rivalry_engine import (
    AGENT_POST_RIVAL_CHANCE,
    SECOND_ORDER_CHANCE,
    THIRD_PARTICIPANT_CHANCE,
    build_rival_context,
    eligible_rivals,
    maybe_generate_rival_responses,
    pick_rival_responder,
)
from app.forecasting.services.utils import hash_seed
from app.forecasting.services.voice_engine import generate_rival_reply, is_generic_agreement

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


def test_rival_reply_in_activity_types():
    assert "rival_reply" in ACTIVITY_TYPES


def test_doombot_bullbot_are_eligible_rivals():
    rivals = eligible_rivals("doombot")
    slugs = [r[0] for r in rivals]
    assert "bullbot" in slugs


def test_pick_rival_responder_deterministic():
    a = pick_rival_responder("doombot", 4242)
    b = pick_rival_responder("doombot", 4242)
    assert a == b
    assert a in CORE_AGENT_SLUGS


def test_build_rival_context_includes_source_post():
    source = AgentGeneratedActivity(
        activity_id="test-id",
        activity_type="agent_post",
        agent_slug="doombot",
        title="AI capex is pricing perfection.",
        body="Momentum is not a valuation model.",
        metadata_json={"trigger_id": "ai_consensus_challenge"},
    )
    ctx = build_rival_context("bullbot", "doombot", source)
    assert ctx["source_post_title"] == source.title
    assert ctx["source_post_body"] == source.body
    assert ctx["in_reply_to_activity_id"] == "test-id"
    assert ctx["core_beliefs"]
    assert ctx.get("rivalry_behavior")
    assert ctx.get("typical_response")
    assert ctx.get("relationship_dynamic")


def test_is_generic_agreement_rejects_agreeable_copy():
    assert is_generic_agreement("Fair point — momentum can persist.")
    assert is_generic_agreement("I agree the tape is strong.")
    assert not is_generic_agreement("Perfection has been expensive to fade.")


def test_generate_rival_reply_template_is_adversarial():
    counter = generate_rival_reply(
        "bullbot",
        "doombot",
        market_title="AI capex",
        source_context={
            "source_post_title": "AI capex is pricing perfection.",
            "source_post_body": "Momentum is not a valuation model.",
            "source_agent_slug": "doombot",
        },
        seed=9001,
    )
    assert counter.line.strip()
    assert not is_generic_agreement(counter.line)
    assert counter.target_slug == "doombot"
    lower = counter.line.lower()
    assert (
        "tape" in lower
        or "bearish" in lower
        or "buyers" in lower
        or "bid" in lower
        or "momentum" in lower
    )


def test_generate_rival_reply_reflects_pair_worldview():
    bull_vs_doom = generate_rival_reply("bullbot", "doombot", seed=42)
    doom_vs_bull = generate_rival_reply("doombot", "bullbot", seed=42)
    assert not is_generic_agreement(bull_vs_doom.line)
    assert not is_generic_agreement(doom_vs_bull.line)
    assert bull_vs_doom.line != doom_vs_bull.line

    oracle_vs_fed = generate_rival_reply("macro-oracle", "fed-watcher", seed=7)
    fed_vs_oracle = generate_rival_reply("fed-watcher", "macro-oracle", seed=7)
    oracle_lower = oracle_vs_fed.line.lower()
    fed_lower = fed_vs_oracle.line.lower()
    assert (
        "liquidity" in oracle_lower
        or "regime" in oracle_lower
        or "horizon" in oracle_lower
        or "front-end" in oracle_lower
        or "leading" in oracle_lower
    )
    assert (
        "curve" in fed_lower
        or "front-end" in fed_lower
        or "2s10s" in fed_lower
        or "rates" in fed_lower
        or "dot" in fed_lower
        or "fedwatcher" in fed_lower.replace(" ", "")
        or "macro oracle" in fed_lower
    )


def test_maybe_generate_rival_responses_respects_probability(db):
    from app.forecasting.models import Market

    agents = {a.slug: a for a in db.query(Agent).filter(Agent.slug.in_(CORE_SLUGS)).all()}
    markets = db.query(Market).all()
    recent_hashes: set[str] = set()

    triggered = 0
    trials = 80
    for i in range(trials):
        source_id = str(uuid.uuid4())
        source = AgentGeneratedActivity(
            activity_id=source_id,
            activity_type="agent_post",
            agent_id=agents["doombot"].id,
            agent_slug="doombot",
            title=f"Test post {i}",
            body=f"Consensus is late on cycle {i}.",
            body_hash=f"hash-{i}",
            thread_id=source_id,
            parent_activity_id=None,
            created_at=datetime.utcnow(),
        )
        session_by_id = {source.activity_id: source}
        rows = maybe_generate_rival_responses(
            db,
            source,
            seed=1000 + i,
            mirror_to_feed=False,
            recent_hashes=recent_hashes,
            agents=agents,
            markets=markets,
            session_by_id=session_by_id,
        )
        if rows:
            triggered += 1
            assert all(r.activity_type == "rival_reply" for r in rows)
            assert rows[0].metadata_json.get("in_reply_to_activity_id") == source.activity_id
            second_order = [r for r in rows if r.metadata_json.get("rivalry_order") == 2]
            if second_order:
                assert second_order[0].agent_slug == source.agent_slug
            if len(rows) >= 3:
                assert len({r.agent_slug for r in rows}) >= 2

    rate = triggered / trials
    assert 0.08 <= rate <= 0.92, f"rival trigger rate {rate:.2f} outside expected band"
    assert AGENT_POST_RIVAL_CHANCE == 0.60
    assert SECOND_ORDER_CHANCE == 0.25
    assert THIRD_PARTICIPANT_CHANCE == 0.10
    db.rollback()


def test_create_rival_reply_activity_persists(db, monkeypatch):
    from app.forecasting.models import Market
    from app.forecasting.services.rivalry_engine import create_rival_reply_activity

    monkeypatch.setattr(
        "app.forecasting.services.rivalry_engine._roll",
        lambda seed, threshold: True,
    )

    agents = {a.slug: a for a in db.query(Agent).filter(Agent.slug.in_(CORE_SLUGS)).all()}
    markets = db.query(Market).all()
    source_id = str(uuid.uuid4())
    source = AgentGeneratedActivity(
        activity_id=source_id,
        activity_type="agent_post",
        agent_id=agents["doombot"].id,
        agent_slug="doombot",
        title="AI capex is pricing perfection.",
        body="Momentum is not a valuation model.",
        body_hash=f"source-{uuid.uuid4()}",
        thread_id=source_id,
        parent_activity_id=None,
        created_at=datetime.utcnow(),
    )
    session_by_id = {source.activity_id: source}
    row = create_rival_reply_activity(
        db,
        responder_slug="bullbot",
        target_slug="doombot",
        source=source,
        order=1,
        seed=88001,
        mirror_to_feed=False,
        recent_hashes=set(),
        agents=agents,
        markets=markets,
        session_by_id=session_by_id,
    )
    assert row is not None
    assert row.activity_type == "rival_reply"
    assert row.agent_slug == "bullbot"
    assert row.thread_id == source.activity_id
    assert row.parent_activity_id == source.activity_id
    meta = row.metadata_json or {}
    assert meta.get("counter_target") == "doombot"
    assert meta.get("in_reply_to_activity_id") == source.activity_id
    assert meta.get("thread_id") == source.activity_id
    assert not is_generic_agreement(row.body)
    db.rollback()


def test_rival_reply_probability_roll_is_deterministic():
    from app.forecasting.services.rivalry_engine import _roll

    assert _roll(4242, AGENT_POST_RIVAL_CHANCE) == _roll(4242, AGENT_POST_RIVAL_CHANCE)
    seed = hash_seed("activity-1", "batch-seed")
    assert _roll(seed, SECOND_ORDER_CHANCE) == _roll(seed, SECOND_ORDER_CHANCE)


def test_roll_distribution_near_target():
    from app.forecasting.services.rivalry_engine import _roll

    hits = sum(_roll(i * 7919 + 104729, AGENT_POST_RIVAL_CHANCE) for i in range(500))
    rate = hits / 500
    assert 0.45 <= rate <= 0.75, f"roll rate {rate:.2f} drifted from 0.60"
