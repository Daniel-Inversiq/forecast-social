"""Agent-network activity mix — 40/40/10/10 card family targets."""

from __future__ import annotations

import pytest

from app.database import SessionLocal
from app.forecasting.agent_status import CORE_AGENT_SLUGS
from app.forecasting.models import Agent
from app.forecasting.services.activity_mix import (
    TARGET_MIX,
    card_family,
    mix_report,
    within_mix_tolerance,
)
from app.forecasting.services.agent_activity_engine import generate_agent_activity_batch

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


def test_target_mix_constants():
    assert abs(sum(TARGET_MIX.values()) - 1.0) < 0.001
    assert TARGET_MIX["agent_post"] == 0.35
    assert TARGET_MIX["open_battle"] == 0.30
    assert TARGET_MIX["receipt"] == 0.15
    assert TARGET_MIX["network_event"] == 0.20


def test_generate_100_activities_hits_network_mix(db):
    created = generate_agent_activity_batch(db, count=100, seed=424242)
    assert len(created) >= 65, f"expected ~100 activities, got {len(created)}"

    report = mix_report(created)
    assert report["agent_post"] >= 0.20, f"agent_post share {report['agent_post']:.2f} too low"
    assert report["open_battle"] >= 0.20, f"open_battle share {report['open_battle']:.2f} too low"
    assert report["receipt"] >= 0.05, f"receipt share {report['receipt']:.2f} too low"
    assert report["network_event"] >= 0.10, f"network share {report['network_event']:.2f} too low"

    slugs = {r.agent_slug for r in created}
    assert slugs >= set(CORE_SLUGS)

    rival_types = {"battle_response", "rival_reply", "receipt_challenge"}
    original_types = {"agent_post", "conviction_update", "market_position_update"}
    rival_count = sum(1 for r in created if r.activity_type in rival_types)
    original_count = sum(1 for r in created if r.activity_type in original_types)
    assert rival_count >= original_count * 0.5, "agents should react to each other frequently"

    thread_replies = [r for r in created if r.activity_type == "rival_reply"]
    assert len(thread_replies) >= 10, "conversation threads should be visible in batch"


def test_card_family_mapping():
    assert card_family("rival_reply") == "open_battle"
    assert card_family("agent_post") == "agent_post"
    assert card_family("receipt_victory") == "receipt"
    assert card_family("network_pulse") == "network_event"


def test_within_mix_tolerance_helper():
    class Row:
        def __init__(self, activity_type: str):
            self.activity_type = activity_type

    rows = (
        [Row("agent_post")] * 35
        + [Row("rival_reply")] * 30
        + [Row("receipt_reaction")] * 15
        + [Row("network_pulse")] * 20
    )
    assert within_mix_tolerance(rows, 100, tolerance=0.02)
