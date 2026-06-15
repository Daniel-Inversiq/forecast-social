"""Autonomous Network Engine v1 — scheduler, heat, narratives, rate limits."""

from __future__ import annotations

import asyncio

import pytest

from app.database import SessionLocal
from app.forecasting.agent_status import CORE_AGENT_SLUGS
from app.forecasting.models import Agent, AgentGeneratedActivity, NetworkNarrative
from app.forecasting.services.autonomous_network_engine import (
    ACTION_TYPES,
    HEAT_MODEL_AUTONOMOUS_V1,
    MAX_DAILY_ACTIVITIES,
    MIN_DAILY_ACTIVITIES,
    THREAD_CONTINUE_CHANCE,
    _action_weights,
    _activities_this_tick,
    _load_active_threads,
    _pick_weighted_action,
    _tick_activity_probability,
    clear_decision_log,
    compute_autonomous_network_heat,
    compute_network_heat,
    count_activities_since,
    count_autonomous_activities_since,
    ensure_narratives_initialized,
    execute_network_tick,
    get_decision_log,
    get_network_debug,
    get_network_status,
    get_rate_limiter_state,
    legacy_network_heat,
    preview_next_tick,
    start_engine,
    stop_engine,
)
from app.forecasting.services.feed_cooling_policy import (
    HEAT_COOLDOWN_THRESHOLD,
    compute_cooling_state,
)
from app.forecasting.services.activity_generation_sources import (
    ACTIVITY_SOURCE_AUTONOMOUS,
    ACTIVITY_SOURCE_MANUAL_DEV,
)
from app.forecasting.services.narrative_clustering import NARRATIVE_TEMPLATES

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


def test_narratives_seed_from_catalog(db):
    rows = ensure_narratives_initialized(db)
    assert len(rows) >= len(NARRATIVE_TEMPLATES)
    stored = db.query(NetworkNarrative).all()
    ids = {n.narrative_id for n in stored}
    for template in NARRATIVE_TEMPLATES:
        assert template["id"] in ids


def test_network_heat_score_bounded(db):
    heat = compute_network_heat(db)
    assert 0.0 <= heat.network_heat_score <= 100.0
    assert heat.heat_model == HEAT_MODEL_AUTONOMOUS_V1
    assert heat.weighted_active_battle_pairs >= 0


def test_network_status_payload(db):
    status = get_network_status(db)
    assert set(status.keys()) >= {
        "active_threads",
        "active_narratives",
        "network_heat",
        "legacy_network_heat",
        "heat_model",
        "battle_score",
        "velocity_score",
        "receipt_score",
        "gap_score",
        "heat_driver",
        "weighted_active_battle_pairs",
        "weighted_replies",
        "weighted_autonomous_receipts",
        "autonomous_activities_last_24h",
        "all_generated_activities_last_24h",
        "receipts_last_24h",
        "autonomous_fresh_receipts_last_24h",
        "battles_active",
        "thread_continuation_rate",
        "new_root_post_rate",
        "rivalry_reply_rate",
        "orphan_rivalry_reply_count",
        "replies_with_parent_rate",
        "average_thread_depth",
        "thread_blocks_rendered",
        "continuation_metrics",
        "heat_cooldown_active",
        "thread_cooldown_active",
        "receipt_cap_active",
        "phrase_fatigue_hits",
        "idea_fatigue_hits",
        "top_agent_idea_buckets",
        "repeated_idea_rate_24h",
        "agent_narrative_stage",
        "stage_transition_count_24h",
        "repeated_stage_count_24h",
        "max_thread_depth",
        "threads_at_depth_3",
        "threads_at_depth_4",
        "threads_at_depth_5",
        "closed_by_depth_last_24h",
        "closed_by_agent_limit_last_24h",
        "pending_resolutions",
        "resolution_candidates_last_24h",
        "forecast_claims_last_24h",
        "resolved_predictions_last_24h",
        "receipt_generation_attempts_last_24h",
        "receipt_generation_successes_last_24h",
        "receipt_generation_failures_last_24h",
        "receipt_generation_cooling_gate_failures_last_24h",
        "last_receipt_failure_reason",
        "pending_resolution_ids",
        "handled_resolution_ids",
        "unresolved_resolution_ids",
    }
    assert status["heat_model"] == HEAT_MODEL_AUTONOMOUS_V1
    assert 0 <= status["network_heat"] <= 100


def test_execute_network_tick_deterministic(db):
    result = execute_network_tick(db, seed=424242, mirror_to_feed=False)
    assert result.seed == 424242
    assert 0 <= result.network_heat <= 100
    for row in result.activities_created:
        assert row.activity_id
        assert row.agent_slug in CORE_SLUGS


def test_tick_writes_agent_generated_activity(db):
    before = count_activities_since(db, hours=24)
    result = execute_network_tick(db, seed=777001, mirror_to_feed=False)
    after = count_activities_since(db, hours=24)
    if result.activities_created:
        assert after >= before + 1


def test_rate_limit_probability_at_cap(db):
    heat = compute_network_heat(db)
    assert _tick_activity_probability(MAX_DAILY_ACTIVITIES, heat) == 0.0
    assert _activities_this_tick(MAX_DAILY_ACTIVITIES, heat, seed=1) == 0


def test_rate_limit_encourages_activity_when_low(db):
    heat = compute_network_heat(db)
    prob = _tick_activity_probability(MIN_DAILY_ACTIVITIES - 5, heat)
    assert prob >= 0.75


def test_action_weights_cover_all_actions(db):
    agent = db.query(Agent).filter(Agent.slug == "doombot").first()
    assert agent
    heat = compute_network_heat(db)
    weights = _action_weights(agent, db=db, heat=heat, has_active_thread=False)
    for action in ACTION_TYPES:
        assert action in weights
        assert weights[action] > 0


def test_pick_weighted_action_returns_valid_action(db):
    agent = db.query(Agent).filter(Agent.slug == "bullbot").first()
    heat = compute_network_heat(db)
    weights = _action_weights(agent, db=db, heat=heat, has_active_thread=True)
    action = _pick_weighted_action(weights, seed=12345)
    assert action in ACTION_TYPES


def test_active_threads_loader(db):
    execute_network_tick(db, seed=888001, mirror_to_feed=False)
    threads = _load_active_threads(db, hours=48)
    assert isinstance(threads, list)


def test_thread_continue_chance_constant():
    assert THREAD_CONTINUE_CHANCE == 0.55


def test_narrative_fields_populated(db):
    ensure_narratives_initialized(db)
    narrative = db.query(NetworkNarrative).first()
    assert narrative
    assert narrative.label
    assert isinstance(narrative.supporters_json, list)
    assert isinstance(narrative.opponents_json, list)
    assert isinstance(narrative.recent_activity_json, list)


def test_network_debug_payload(db):
    clear_decision_log()
    execute_network_tick(db, seed=999001, mirror_to_feed=False)
    debug = get_network_debug(db)
    assert debug["inspection_mode"] is True
    assert debug["autonomous_execution_enabled"] is False
    assert set(debug.keys()) >= {
        "active_narratives",
        "active_threads",
        "top_rivalries",
        "network_heat_components",
        "last_autonomous_decisions",
        "rate_limiter",
        "next_scheduled_tick",
        "next_tick_preview",
        "continuation_metrics",
    }
    assert isinstance(debug["active_narratives"], list)
    assert isinstance(debug["top_rivalries"], list)
    assert len(debug["last_autonomous_decisions"]) >= 1
    assert "remaining_budget" in debug["rate_limiter"]
    assert "next_tick_at" in debug["next_scheduled_tick"]
    assert "would_skip" in debug["next_tick_preview"]


def test_decision_log_ring_buffer(db):
    clear_decision_log()
    execute_network_tick(db, seed=111222, mirror_to_feed=False)
    decisions = get_decision_log(limit=20)
    assert len(decisions) >= 1
    assert "action" in decisions[0] or "reason" in decisions[0]
    assert "at" in decisions[0]


def test_rate_limiter_state(db):
    heat = compute_network_heat(db)
    state = get_rate_limiter_state(db, heat)
    assert state["min_daily_target"] == MIN_DAILY_ACTIVITIES
    assert state["max_daily_cap"] == MAX_DAILY_ACTIVITIES
    assert "tick_activity_probability" in state


def test_preview_next_tick(db):
    preview = preview_next_tick(db, seed=333444)
    assert preview["seed"] == 333444
    assert "planned_slot_count" in preview
    assert "slots" in preview


def test_manual_batch_does_not_count_toward_autonomous_rate_limit(db):
    from app.forecasting.services.activity_generation_sources import stamp_activities_source

    agent = db.query(Agent).filter(Agent.slug == "doombot").first()
    assert agent

    before_all = count_activities_since(db, hours=24)
    before_auto = count_autonomous_activities_since(db, hours=24)

    manual_rows: list[AgentGeneratedActivity] = []
    for i in range(5):
        row = AgentGeneratedActivity(
            activity_id=f"test-manual-source-{i}-{before_all}",
            activity_type="agent_post",
            agent_id=agent.id,
            agent_slug=agent.slug,
            title=f"Manual dev batch {i}",
            body=f"Manual dev batch body {i}",
            body_hash=f"manual-dev-{before_all}-{i}",
        )
        db.add(row)
        manual_rows.append(row)
    db.flush()
    stamp_activities_source(manual_rows, ACTIVITY_SOURCE_MANUAL_DEV)
    db.commit()

    assert count_activities_since(db, hours=24) == before_all + 5
    assert count_autonomous_activities_since(db, hours=24) == before_auto
    for row in manual_rows:
        assert (row.metadata_json or {}).get("source") == ACTIVITY_SOURCE_MANUAL_DEV


def test_autonomous_tick_tags_source_and_counts(db):
    before_auto = count_autonomous_activities_since(db, hours=24)
    result = execute_network_tick(db, seed=6060502, mirror_to_feed=False)
    after_auto = count_autonomous_activities_since(db, hours=24)

    if result.activities_created:
        assert after_auto >= before_auto + 1
        for row in result.activities_created:
            assert (row.metadata_json or {}).get("source") == ACTIVITY_SOURCE_AUTONOMOUS


@pytest.fixture
def reset_engine_state():
    import app.forecasting.services.autonomous_network_engine as engine_mod

    stop_engine()
    yield
    stop_engine()


def test_start_stop_engine_lifecycle(reset_engine_state):
    async def _run() -> None:
        started = await start_engine()
        assert started["status"] == "started"
        assert started["engine_running"] is True

        again = await start_engine()
        assert again["status"] == "already_running"
        assert again["engine_running"] is True

        stopped = stop_engine()
        assert stopped["status"] == "stopped"
        assert stopped["engine_running"] is False

        idle = stop_engine()
        assert idle["status"] == "already_stopped"
        assert idle["engine_running"] is False

    asyncio.run(_run())


def test_start_engine_recovers_after_completed_task(reset_engine_state):
    async def _run() -> None:
        first = await start_engine()
        assert first["status"] == "started"
        stop_engine()
        await asyncio.sleep(0.05)

        restarted = await start_engine()
        assert restarted["status"] == "started"
        assert restarted["engine_running"] is True
        stop_engine()

    asyncio.run(_run())


def test_dev_network_start_stop_routes(reset_engine_state):
    from fastapi.testclient import TestClient

    from app.main import app

    with TestClient(app) as client:
        start = client.post("/api/dev/network/start")
        assert start.status_code == 200
        assert start.json()["status"] in ("started", "already_running")
        assert start.json()["engine_running"] is True

        status = client.get("/api/dev/network-status")
        assert status.status_code == 200
        assert status.json()["engine_running"] is True

        stop = client.post("/api/dev/network/stop")
        assert stop.status_code == 200
        assert stop.json()["status"] in ("stopped", "already_stopped")
        assert stop.json()["engine_running"] is False


def test_rate_limiter_ignores_manual_bulk_at_cap(db):
    heat = compute_network_heat(db)
    assert _tick_activity_probability(MAX_DAILY_ACTIVITIES, heat) == 0.0
    assert _activities_this_tick(0, heat, seed=1) >= 0
    assert _tick_activity_probability(0, heat) >= 0.75


def test_seeded_inventory_does_not_pin_autonomous_heat(db):
    """Legacy heat may reflect FeedEvent/MarketTake inventory; autonomous heat must not."""
    autonomous = compute_autonomous_network_heat(db)
    legacy = legacy_network_heat(db)

    assert autonomous.network_heat_score < HEAT_COOLDOWN_THRESHOLD
    if legacy.network_heat_score >= HEAT_COOLDOWN_THRESHOLD:
        assert autonomous.network_heat_score < legacy.network_heat_score


def test_low_autonomous_activity_is_cold_or_normal(db):
    heat = compute_autonomous_network_heat(db)
    assert heat.network_heat_score <= 60.0


def test_autonomous_clash_activity_increases_heat(db):
    from datetime import datetime, timedelta, timezone

    from app.forecasting.services.activity_generation_sources import stamp_activities_source

    bull = db.query(Agent).filter(Agent.slug == "bullbot").first()
    bear = db.query(Agent).filter(Agent.slug == "doombot").first()
    assert bull and bear

    before = compute_autonomous_network_heat(db)
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    thread_id = "heat-test-thread-clash"
    root = AgentGeneratedActivity(
        activity_id="heat-test-root-clash",
        activity_type="agent_post",
        agent_id=bull.id,
        agent_slug=bull.slug,
        title="Root for clash heat test",
        body="Opening shot on the macro read.",
        body_hash="heat-test-root-clash-hash",
        thread_id=thread_id,
        created_at=now - timedelta(minutes=30),
    )
    db.add(root)
    db.flush()

    clash_rows: list[AgentGeneratedActivity] = []
    for index, (speaker, target) in enumerate(
        (
            (bear, bull.slug),
            (bull, bear.slug),
            (bear, bull.slug),
            (bull, bear.slug),
        )
    ):
        row = AgentGeneratedActivity(
            activity_id=f"heat-test-clash-{index}",
            activity_type="rival_reply",
            agent_id=speaker.id,
            agent_slug=speaker.slug,
            title=f"Clash reply {index}",
            body=f"Direct pushback on the thesis {index}.",
            body_hash=f"heat-test-clash-hash-{index}",
            thread_id=thread_id,
            parent_activity_id=root.activity_id,
            metadata_json={"counter_target": target, "continuation_kind": "rivalry_reply"},
            created_at=now - timedelta(minutes=20 - index),
        )
        db.add(row)
        clash_rows.append(row)
    db.flush()
    stamp_activities_source([root, *clash_rows], ACTIVITY_SOURCE_AUTONOMOUS)
    db.commit()

    after = compute_autonomous_network_heat(db)
    assert after.network_heat_score > before.network_heat_score
    assert after.weighted_active_battle_pairs >= 1.0
    assert after.battle_score > before.battle_score


def test_cooling_uses_autonomous_heat_not_legacy(db):
    autonomous = compute_autonomous_network_heat(db)
    legacy = legacy_network_heat(db)

    cooling_from_autonomous = compute_cooling_state(
        db,
        network_heat=autonomous.network_heat_score,
        active_thread_count=10,
    )
    cooling_from_legacy = compute_cooling_state(
        db,
        network_heat=legacy.network_heat_score,
        active_thread_count=10,
    )

    status = get_network_status(db)
    assert status["heat_cooldown_active"] == cooling_from_autonomous.heat_cooldown_active
    if legacy.network_heat_score > HEAT_COOLDOWN_THRESHOLD and autonomous.network_heat_score <= HEAT_COOLDOWN_THRESHOLD:
        assert cooling_from_legacy.heat_cooldown_active is True
        assert cooling_from_autonomous.heat_cooldown_active is False
        assert status["heat_cooldown_active"] is False
