"""Thread continuation dominance — slot routing, preemption, metrics."""

from __future__ import annotations

import pytest

from app.database import SessionLocal
from app.forecasting.agent_status import CORE_AGENT_SLUGS
from app.forecasting.models import Agent, AgentGeneratedActivity
from app.forecasting.services.thread_continuation_policy import (
    ACTIVE_THREAD_HOURS,
    NARRATIVE_CONTINUE_CHANCE,
    NEW_ROOT_CHANCE,
    RECEIPT_MOMENT_CHANCE,
    THREAD_CONTINUE_CHANCE,
    blocks_late_root_after_quote,
    blocks_preemptive_quote,
    compute_continuation_metrics,
    normalize_activity_title,
    resolve_slot_plan,
    stamp_continuation_kind,
)


@pytest.fixture
def db():
    session = SessionLocal()
    try:
        agents = session.query(Agent).filter(Agent.slug.in_(CORE_AGENT_SLUGS)).all()
        if len(agents) < 5:
            pytest.skip("Core agents not seeded in database")
        yield session
    finally:
        session.close()


def test_target_mix_constants():
    assert THREAD_CONTINUE_CHANCE == 0.55
    assert NARRATIVE_CONTINUE_CHANCE == 0.25
    assert RECEIPT_MOMENT_CHANCE == 0.10
    assert NEW_ROOT_CHANCE == 0.10
    assert ACTIVE_THREAD_HOURS == 72


def test_resolve_slot_plan_distribution():
    with_threads = {
        "continue_thread": 0,
        "continue_narrative": 0,
        "receipt_moment": 0,
        "new_root": 0,
    }
    without_threads = {
        "continue_thread": 0,
        "continue_narrative": 0,
        "receipt_moment": 0,
        "new_root": 0,
    }
    for seed in range(500):
        with_threads[resolve_slot_plan(seed, has_active_threads=True)] += 1
        without_threads[resolve_slot_plan(seed, has_active_threads=False)] += 1

    assert 230 <= with_threads["continue_thread"] <= 330
    assert 100 <= with_threads["continue_narrative"] <= 160
    assert 30 <= with_threads["receipt_moment"] <= 80
    assert 30 <= with_threads["new_root"] <= 80

    assert with_threads["continue_thread"] == 0 or with_threads["continue_thread"] > with_threads["new_root"]
    assert without_threads["new_root"] < without_threads["continue_narrative"]


def test_normalize_activity_title_strips_punctuation():
    assert normalize_activity_title("The Long Side Wins.") == "the long side wins"


def test_compute_continuation_metrics_shape(db):
    metrics = compute_continuation_metrics(db, hours=24)
    assert "thread_continuation_rate" in metrics
    assert "new_root_post_rate" in metrics
    assert "rivalry_reply_rate" in metrics
    assert "orphan_rivalry_reply_count" in metrics
    assert "replies_with_parent_rate" in metrics
    assert "average_thread_depth" in metrics
    assert "thread_blocks_rendered" in metrics
    assert metrics["target_mix"]["thread_continuation"] == 0.55


def test_resolve_slot_plan_bootstraps_when_threads_are_sparse():
    plans = {
        "continue_thread": 0,
        "continue_narrative": 0,
        "receipt_moment": 0,
        "new_root": 0,
    }
    for seed in range(500):
        plans[
            resolve_slot_plan(seed, has_active_threads=False, thread_bootstrap_needed=True)
        ] += 1
    assert plans["continue_thread"] >= 230


def test_preemptive_quote_and_late_root_guard(db):
    agent_a = db.query(Agent).filter(Agent.slug == "bullbot").first()
    agent_b = db.query(Agent).filter(Agent.slug == "doombot").first()
    assert agent_a and agent_b

    thesis = "Unique preempt thesis for policy test"
    norm = normalize_activity_title(thesis)
    session_by_id: dict[str, AgentGeneratedActivity] = {}

    assert not blocks_preemptive_quote(
        db,
        speaker_slug=agent_a.slug,
        target_slug=agent_b.slug,
        title=thesis,
        session_by_id=session_by_id,
    )

    quote_row = AgentGeneratedActivity(
        activity_id="test-preempt-quote",
        activity_type="battle_response",
        agent_id=agent_a.id,
        agent_slug=agent_a.slug,
        title=thesis,
        body=thesis,
        body_hash="test-preempt-quote-hash",
        metadata_json={"counter_target": agent_b.slug},
    )
    db.add(quote_row)
    db.flush()
    session_by_id[quote_row.activity_id] = quote_row

    assert blocks_late_root_after_quote(
        db,
        agent_slug=agent_b.slug,
        title=thesis,
        session_by_id=session_by_id,
    )
    assert blocks_preemptive_quote(
        db,
        speaker_slug=agent_a.slug,
        target_slug=agent_b.slug,
        title=thesis,
        session_by_id=session_by_id,
    )

    db.delete(quote_row)
    db.commit()


def test_stamp_continuation_kind():
    row = AgentGeneratedActivity(
        activity_id="test-kind",
        activity_type="rival_reply",
        agent_id=1,
        agent_slug="bullbot",
        title="t",
        body="b",
        body_hash="h",
    )
    stamp_continuation_kind(row, "thread_continuation")
    assert row.metadata_json["continuation_kind"] == "thread_continuation"
