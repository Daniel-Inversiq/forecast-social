"""Activity failure metadata and autonomous decision log observability."""

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
    get_decision_log,
)
from app.forecasting.services.rivalry_engine import (
    create_rival_reply_activity,
    rival_pick_failure,
)

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


def test_activity_failure_decision_log_shape():
    failure = ActivityFailure(
        code="thread_depth_limit",
        source="conversation_threads.can_extend_thread",
        missing_prerequisite="thread_depth_headroom",
        recoverable=False,
    )
    payload = failure.as_decision_log()
    assert payload == {
        "code": "thread_depth_limit",
        "source": "conversation_threads.can_extend_thread",
        "missing_prerequisite": "thread_depth_headroom",
        "recoverable": False,
    }


def test_rival_pick_failure_no_eligible_rivals():
    failure = rival_pick_failure(
        "nonexistent-agent",
        seed=1,
        exclude=set(CORE_SLUGS),
    )
    assert failure is not None
    assert failure.code == "no_eligible_rivals"
    assert failure.recoverable is True


def test_create_rival_reply_unknown_responder(db):
    agents = {
        a.slug: a
        for a in db.query(Agent).filter(Agent.slug.in_(CORE_SLUGS)).all()
    }
    source = AgentGeneratedActivity(
        activity_id="failure-test-source",
        activity_type="agent_post",
        agent_id=agents["doombot"].id,
        agent_slug="doombot",
        title="Test post",
        body="Test body for rival reply failure.",
        body_hash="failure-test-source-hash",
    )
    failure_out: dict = {}
    row = create_rival_reply_activity(
        db,
        responder_slug="missing-agent",
        target_slug="doombot",
        source=source,
        order=1,
        seed=999,
        mirror_to_feed=False,
        recent_hashes=set(),
        agents=agents,
        markets=[],
        failure_out=failure_out,
    )
    assert row is None
    assert failure_out["code"] == "unknown_responder"
    assert failure_out["source"] == "rivalry_engine.create_rival_reply_activity"
    assert failure_out["missing_prerequisite"] == "core_agent"
    assert failure_out["recoverable"] is False


def test_failed_decisions_include_failure_reason(db, monkeypatch):
    clear_decision_log()

    root = AgentGeneratedActivity(
        activity_id="failure-thread-root",
        activity_type="agent_post",
        agent_slug="doombot",
        title="Thread root",
        body="Root body",
        metadata_json={"credibility_delta": 1},
    )
    latest = AgentGeneratedActivity(
        activity_id="failure-thread-latest",
        activity_type="rival_reply",
        agent_slug="bullbot",
        title="Thread reply",
        body="Reply body",
        thread_id="failure-thread-root",
        parent_activity_id="failure-thread-root",
        metadata_json={"credibility_delta": 3},
    )
    active_thread = {
        "thread_id": "failure-thread-root",
        "rows": [root, latest],
        "latest": latest,
        "root": root,
    }

    def _force_continue_thread(*args, **kwargs):
        failure_out = kwargs.get("failure_out")
        if failure_out is not None:
            failure_out.update(
                ActivityFailure(
                    code="quality_gate_exhausted",
                    source="rivalry_engine.create_rival_reply_activity",
                    missing_prerequisite="quality_reply",
                    recoverable=True,
                ).as_decision_log()
            )
        return None

    with patch(
        "app.forecasting.services.autonomous_network_engine._activities_this_tick",
        return_value=1,
    ), patch(
        "app.forecasting.services.autonomous_network_engine._load_active_threads",
        return_value=[active_thread],
    ), patch(
        "app.forecasting.services.autonomous_network_engine._roll",
        return_value=True,
    ), patch(
        "app.forecasting.services.autonomous_network_engine._continue_thread",
        side_effect=_force_continue_thread,
    ), patch(
        "app.forecasting.services.autonomous_network_engine.recover_continue_thread_failure",
        return_value=(None, None),
    ):
        result = execute_network_tick(db, seed=505050, mirror_to_feed=False)

    failed = [
        d
        for d in result.decisions
        if d.get("action") == "continue_thread" and d.get("outcome") == "failed"
    ]
    assert failed, "expected a failed continue_thread decision"
    reason = failed[0]["failure_reason"]
    assert reason["code"] == "quality_gate_exhausted"
    assert reason["source"] == "rivalry_engine.create_rival_reply_activity"
    assert reason["missing_prerequisite"] == "quality_reply"
    assert reason["recoverable"] is True

    logged = get_decision_log(limit=5)
    assert any(
        d.get("action") == "continue_thread" and "failure_reason" in d for d in logged
    )


def test_failed_start_battle_records_failure_reason(db, monkeypatch):
    clear_decision_log()

    def _force_start_battle(*args, **kwargs):
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

    with patch(
        "app.forecasting.services.autonomous_network_engine._activities_this_tick",
        return_value=1,
    ), patch(
        "app.forecasting.services.autonomous_network_engine._load_active_threads",
        return_value=[],
    ), patch(
        "app.forecasting.services.autonomous_network_engine._pick_weighted_action",
        return_value="start_battle",
    ), patch(
        "app.forecasting.services.autonomous_network_engine._persist_trigger_activity",
        side_effect=_force_start_battle,
    ), patch(
        "app.forecasting.services.autonomous_network_engine.recover_weighted_action_failure",
        return_value=(None, None),
    ):
        result = execute_network_tick(db, seed=606060, mirror_to_feed=False)

    failed = [
        d
        for d in result.decisions
        if d.get("action") == "start_battle" and d.get("outcome") == "failed"
    ]
    assert failed, "expected a failed start_battle decision"
    reason = failed[0]["failure_reason"]
    assert reason["code"] == "fingerprint_rejected"
    assert reason["source"] == "agent_activity_engine._persist_trigger_activity"
    assert reason["recoverable"] is True
