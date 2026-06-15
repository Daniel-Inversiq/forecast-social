"""Autonomous failure recovery — degrade to safer alternatives."""

from __future__ import annotations

from unittest.mock import patch

import pytest

from app.database import SessionLocal
from app.forecasting.agent_status import CORE_AGENT_SLUGS
from app.forecasting.models import Agent, AgentGeneratedActivity
from app.forecasting.services.activity_failure import ActivityFailure
from app.forecasting.services.autonomous_network_engine import (
    clear_decision_log,
    execute_network_tick,
)
from app.forecasting.services.autonomous_recovery import tick_has_visible_activity
from app.forecasting.services.voice_engine import is_generic_agreement

CORE_SLUGS = tuple(sorted(CORE_AGENT_SLUGS))


@pytest.fixture
def db():
    from app.forecasting.migrate import migrate_schema

    migrate_schema()
    session = SessionLocal()
    try:
        agents = session.query(Agent).filter(Agent.slug.in_(CORE_SLUGS)).all()
        if len(agents) < 5:
            pytest.skip("Core agents not seeded in database")
        yield session
    finally:
        session.close()


def test_new_root_failure_recovers_to_continue_narrative(db):
    clear_decision_log()
    from app.forecasting.services.agent_activity_engine import (
        _persist_trigger_activity as real_persist,
    )

    attempts = {"count": 0}

    def _fail_root_once(*args, **kwargs):
        attempts["count"] += 1
        if attempts["count"] == 1:
            failure_out = kwargs.get("failure_out")
            if failure_out is not None:
                failure_out.update(
                    ActivityFailure(
                        code="fingerprint_rejected",
                        source="agent_activity_engine._persist_trigger_activity",
                        missing_prerequisite="character_fingerprint",
                        recoverable=True,
                    ).as_decision_log()
                )
            return None
        return real_persist(*args, **kwargs)

    with patch(
        "app.forecasting.services.autonomous_network_engine._activities_this_tick",
        return_value=1,
    ), patch(
        "app.forecasting.services.autonomous_network_engine._load_active_threads",
        return_value=[],
    ), patch(
        "app.forecasting.services.autonomous_network_engine.resolve_slot_plan",
        return_value="new_root",
    ), patch(
        "app.forecasting.services.autonomous_network_engine._persist_trigger_activity",
        side_effect=_fail_root_once,
    ):
        result = execute_network_tick(db, seed=707070, mirror_to_feed=False)

    recovered = [
        d
        for d in result.decisions
        if d.get("action") == "create_forecast" and d.get("outcome") == "recovered"
    ]
    assert recovered, "expected recovered new_root decision"
    assert recovered[0]["recovery_action"] in {
        "reinforce_narrative",
        "reply_to_rival",
        "bootstrap_thread",
    }
    assert recovered[0]["original_failure_reason"]["recoverable"] is True
    assert result.activities_created


def test_thread_limit_failure_recovers(db):
    clear_decision_log()
    agents = {
        a.slug: a
        for a in db.query(Agent).filter(Agent.slug.in_(CORE_SLUGS)).all()
    }
    root = AgentGeneratedActivity(
        activity_id="recovery-thread-root",
        activity_type="agent_post",
        agent_id=agents["doombot"].id,
        agent_slug="doombot",
        title="Fed pause priced too early",
        body="Front-end is still mispriced.",
        body_hash="recovery-root-hash",
        thread_id="recovery-thread-root",
        metadata_json={"narrative_id": "fed-pause", "credibility_delta": 2},
    )
    latest = AgentGeneratedActivity(
        activity_id="recovery-thread-latest",
        activity_type="rival_reply",
        agent_id=agents["bullbot"].id,
        agent_slug="bullbot",
        title="Counter on Fed pause",
        body="Curve disagrees with your read.",
        body_hash="recovery-latest-hash",
        thread_id="recovery-thread-root",
        parent_activity_id="recovery-thread-root",
        metadata_json={"credibility_delta": -3},
    )
    thread = {
        "thread_id": "recovery-thread-root",
        "rows": [root, latest],
        "latest": latest,
        "root": root,
    }

    def _fail_thread_limit(*args, **kwargs):
        failure_out = kwargs.get("failure_out")
        if failure_out is not None:
            failure_out.update(
                ActivityFailure(
                    code="thread_depth_limit",
                    source="conversation_threads.can_extend_thread",
                    missing_prerequisite="thread_depth_headroom",
                    recoverable=True,
                ).as_decision_log()
            )
        return None

    with patch(
        "app.forecasting.services.autonomous_network_engine._activities_this_tick",
        return_value=1,
    ), patch(
        "app.forecasting.services.autonomous_network_engine._load_active_threads",
        return_value=[thread],
    ), patch(
        "app.forecasting.services.autonomous_network_engine.resolve_slot_plan",
        return_value="continue_thread",
    ), patch(
        "app.forecasting.services.autonomous_network_engine._continue_thread",
        side_effect=_fail_thread_limit,
    ):
        result = execute_network_tick(db, seed=808080, mirror_to_feed=False)

    recovered = [
        d
        for d in result.decisions
        if d.get("action") == "continue_thread" and d.get("outcome") == "recovered"
    ]
    assert recovered, "expected recovered continue_thread decision"
    assert recovered[0]["recovery_action"] in {
        "created_network_pulse",
        "started_new_thread",
    }
    assert result.activities_created


def test_recovered_activity_passes_quality_gates(db):
    clear_decision_log()
    visible_bodies: list[str] = []

    with patch(
        "app.forecasting.services.autonomous_network_engine._activities_this_tick",
        return_value=1,
    ):
        for i in range(12):
            result = execute_network_tick(db, seed=900000 + i * 131, mirror_to_feed=False)
            for row in result.activities_created:
                visible_bodies.append(row.body)
                assert row.body.strip()
                assert not is_generic_agreement(row.body)

    assert visible_bodies


def test_autonomous_tick_visible_activity_rate(db):
    """At least 70% of ticks with a planned slot produce visible activity."""
    clear_decision_log()
    visible = 0
    trials = 100

    with patch(
        "app.forecasting.services.autonomous_network_engine._activities_this_tick",
        return_value=1,
    ):
        for i in range(trials):
            result = execute_network_tick(db, seed=1_000_000 + i * 17, mirror_to_feed=False)
            if tick_has_visible_activity(result):
                visible += 1

    rate = visible / trials
    assert rate >= 0.70, f"visible activity rate {rate:.1%} below 70% target"
