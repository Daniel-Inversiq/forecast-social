"""Narrative progression memory — evolving theses per agent+narrative."""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

import pytest

from app.database import SessionLocal
from app.forecasting.models import Agent, AgentGeneratedActivity, AgentNarrativeState
from app.forecasting.agent_status import CORE_AGENT_SLUGS
from app.forecasting.services.character_fingerprints import fingerprint_passes
from app.forecasting.services.narrative_progression import (
    MAX_CONSECUTIVE_SAME_STAGE,
    NARRATIVE_STAGES,
    commit_narrative_stage,
    compose_narrative_stage_copy,
    compute_narrative_progression_debug_stats,
    headline_pattern_key,
    is_generic_signature_only,
    matches_stage_voice,
    next_narrative_stage,
    pick_narrative_stage,
    reset_narrative_progression_adjustments,
    stage_progression_meta,
    would_exceed_consecutive_limit,
)

NARRATIVE_LABEL = "EU carbon policy shift"


@pytest.fixture
def db():
    from app.forecasting.migrate import migrate_schema

    migrate_schema()
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


def _add_activity(
    db,
    *,
    agent_slug: str,
    narrative_id: str,
    stage: str,
    offset_minutes: int = 0,
) -> None:
    agent = db.query(Agent).filter(Agent.slug == agent_slug).first()
    assert agent
    now = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(minutes=offset_minutes)
    row = AgentGeneratedActivity(
        activity_id=f"test-narrative-{uuid.uuid4().hex}",
        activity_type="agent_post",
        agent_id=agent.id,
        agent_slug=agent_slug,
        title=f"{narrative_id} — {stage}",
        body=f"Body for {stage}",
        body_hash=f"hash-{uuid.uuid4().hex}",
        metadata_json={
            "narrative_id": narrative_id,
            "narrative_label": narrative_id,
            "narrative_stage": stage,
        },
        created_at=now,
    )
    db.add(row)
    db.commit()


def test_next_stage_advances_through_arc():
    assert next_narrative_stage(None) == "initial_call"
    assert next_narrative_stage("initial_call") == "early_confirmation"
    assert next_narrative_stage("early_confirmation") == "consensus_shift"
    assert next_narrative_stage("consensus_shift") == "resolution"
    assert next_narrative_stage("resolution") == "initial_call"


def test_resolution_resets_state(db):
    commit_narrative_stage(db, "bullbot", "climate-policy", "resolution")
    db.commit()

    stored = (
        db.query(AgentNarrativeState)
        .filter(
            AgentNarrativeState.agent_slug == "bullbot",
            AgentNarrativeState.narrative_id == "climate-policy",
        )
        .first()
    )
    assert stored
    assert stored.stage == "resolution"

    picked = pick_narrative_stage(db, "bullbot", "climate-policy", seed=1)
    assert picked == "initial_call"


def test_progression_prefers_next_stage(db):
    reset_narrative_progression_adjustments()
    commit_narrative_stage(db, "bullbot", "eu-carbon", "initial_call")
    db.commit()

    picked = pick_narrative_stage(db, "bullbot", "eu-carbon", seed=42)
    assert picked == "early_confirmation"


def test_same_stage_cannot_exceed_two_consecutive(db):
    reset_narrative_progression_adjustments()
    narrative_id = "climate-policy"
    agent_slug = "bullbot"

    _add_activity(db, agent_slug=agent_slug, narrative_id=narrative_id, stage="consensus_shift", offset_minutes=20)
    _add_activity(db, agent_slug=agent_slug, narrative_id=narrative_id, stage="consensus_shift", offset_minutes=10)
    commit_narrative_stage(db, agent_slug, narrative_id, "consensus_shift")
    db.commit()

    picked = pick_narrative_stage(db, agent_slug, narrative_id, seed=99)
    assert picked != "consensus_shift"
    assert picked in NARRATIVE_STAGES


def test_pick_never_allows_three_consecutive_in_simulation(db):
    """Walk the picker across stored state — no >2 consecutive same stage."""
    reset_narrative_progression_adjustments()
    agent_slug = "fed-watcher"
    narrative_id = "rates-repricing"
    stages: list[str] = []

    for tick in range(12):
        stage = pick_narrative_stage(db, agent_slug, narrative_id, seed=tick)
        stages.append(stage)
        commit_narrative_stage(db, agent_slug, narrative_id, stage)
        _add_activity(
            db,
            agent_slug=agent_slug,
            narrative_id=narrative_id,
            stage=stage,
            offset_minutes=100 - tick,
        )
        db.commit()

    for index in range(2, len(stages)):
        window = stages[index - 2 : index + 1]
        assert not (window[0] == window[1] == window[2])


def test_would_exceed_consecutive_limit():
    assert would_exceed_consecutive_limit([], "initial_call") is False
    assert would_exceed_consecutive_limit(["initial_call"], "initial_call") is False
    assert would_exceed_consecutive_limit(["initial_call", "initial_call"], "initial_call") is True


@pytest.mark.parametrize("slug", sorted(CORE_AGENT_SLUGS))
def test_stages_produce_visibly_different_headlines(slug):
    headlines: list[str] = []
    patterns: list[str] = []
    for stage in NARRATIVE_STAGES:
        title, body = compose_narrative_stage_copy(
            slug,
            NARRATIVE_LABEL,
            stage,
            seed=101,
        )
        headlines.append(title)
        patterns.append(headline_pattern_key(title, stage=stage))
        assert not is_generic_signature_only(slug, title)
        assert not is_generic_signature_only(slug, body)
        assert matches_stage_voice(stage, title, body)
        assert fingerprint_passes(slug, f"{title}\n{body}")
    assert len(set(headlines)) == len(NARRATIVE_STAGES)
    assert len(set(patterns)) == len(NARRATIVE_STAGES)


def test_early_confirmation_references_prior_read():
    title, body = compose_narrative_stage_copy(
        "bullbot",
        NARRATIVE_LABEL,
        "early_confirmation",
        seed=7,
    )
    blob = f"{title}\n{body}".lower()
    assert any(
        phrase in blob
        for phrase in (
            "first read",
            "prior call",
            "early tape",
            "moving my way",
            "holding",
        )
    )


def test_consensus_shift_references_repricing():
    title, body = compose_narrative_stage_copy(
        "fed-watcher",
        NARRATIVE_LABEL,
        "consensus_shift",
        seed=8,
    )
    blob = f"{title}\n{body}".lower()
    assert any(
        phrase in blob
        for phrase in (
            "consensus",
            "desk is moving",
            "crowd moved",
            "repric",
            "catching up",
        )
    )


def test_resolution_sounds_conclusive():
    title, body = compose_narrative_stage_copy(
        "macro-oracle",
        NARRATIVE_LABEL,
        "resolution",
        seed=9,
    )
    blob = f"{title}\n{body}".lower()
    assert any(
        phrase in blob
        for phrase in (
            "that was the read",
            "call held",
            "marked",
            "thesis resolved",
            "closing",
        )
    )


def test_initial_call_is_assertive_thesis():
    title, body = compose_narrative_stage_copy(
        "doombot",
        NARRATIVE_LABEL,
        "initial_call",
        seed=3,
    )
    blob = f"{title}\n{body}".lower()
    assert any(phrase in blob for phrase in ("my read", "this starts with", "opening call"))


def test_stage_meta_includes_display_label():
    meta = stage_progression_meta(
        "early_confirmation",
        narrative_id="climate-policy",
        narrative_label=NARRATIVE_LABEL,
    )
    assert meta["narrative_stage"] == "early_confirmation"
    assert meta["narrative_stage_label"] == "Early confirmation"


def test_debug_stats_expose_progression_fields(db):
    _add_activity(
        db,
        agent_slug="bullbot",
        narrative_id="climate-policy",
        stage="early_confirmation",
        offset_minutes=5,
    )
    commit_narrative_stage(db, "bullbot", "climate-policy", "early_confirmation")
    db.commit()

    stats = compute_narrative_progression_debug_stats(db)
    assert "agent_narrative_stage" in stats
    assert stats["agent_narrative_stage"]["bullbot"]["climate-policy"] == "early_confirmation"
    assert "stage_transition_count_24h" in stats
    assert "repeated_stage_count_24h" in stats
