"""Feed cooling and phrase fatigue policy tests."""

from __future__ import annotations

import pytest

from app.forecasting.services.feed_cooling_policy import (
    HEAT_COOLDOWN_THRESHOLD,
    MAX_AUTONOMOUS_RECEIPTS_24H,
    THREAD_COOLDOWN_THRESHOLD,
    CoolingState,
    compute_cooling_state,
    resolve_cooled_slot_plan,
    should_suppress_receipt_generation,
    should_suppress_rivalry_cascade,
)
from app.forecasting.services.phrase_fatigue import (
    PHRASE_FATIGUE_MAX_USES,
    is_phrase_fatigued,
    normalize_phrase,
    pick_alternate_signature_phrase,
    reset_phrase_fatigue_hits,
    rewrite_fatigued_phrases,
)


def test_normalize_phrase_strips_punctuation():
    assert normalize_phrase("The dip is still there.") == "the dip is still there"


def test_phrase_fatigued_after_two_uses():
    usage = {("bullbot", "still buying"): 2}
    assert is_phrase_fatigued("bullbot", "Still buying", usage, max_uses=PHRASE_FATIGUE_MAX_USES)
    assert not is_phrase_fatigued("bullbot", "Still buying", {("bullbot", "still buying"): 1}, max_uses=PHRASE_FATIGUE_MAX_USES)


def test_rewrite_fatigued_phrases_swaps_signature():
    reset_phrase_fatigue_hits()
    phrase = "Consensus is usually late."
    usage = {("doombot", normalize_phrase(phrase)): 2}
    title = "Consensus is usually late on this read"
    body = "Rates still mispriced."
    new_title, new_body, did = rewrite_fatigued_phrases(
        "doombot",
        title,
        body,
        usage=usage,
        seed=42,
    )
    assert did is True
    assert normalize_phrase("consensus is usually late") not in normalize_phrase(new_title)


def test_pick_alternate_signature_phrase_skips_fatigued():
    usage = {("doombot", normalize_phrase("the dip is still there")): 2}
    alt = pick_alternate_signature_phrase("doombot", seed=7, usage=usage)
    assert alt
    assert normalize_phrase(alt) != normalize_phrase("the dip is still there")


def test_calm_cooldown_slot_mix_targets():
    cooling = CoolingState(heat_cooldown_active=True, thread_cooldown_active=True)
    counts = {"continue_thread": 0, "continue_narrative": 0, "receipt_moment": 0, "new_root": 0}
    for seed in range(1000):
        counts[
            resolve_cooled_slot_plan(
                seed,
                has_active_threads=True,
                thread_bootstrap_needed=False,
                cooling=cooling,
            )
        ] += 1
    assert 400 <= counts["continue_thread"] <= 530
    assert 250 <= counts["continue_narrative"] <= 350
    assert 130 <= counts["new_root"] <= 170
    assert counts["receipt_moment"] == 0


def test_heat_cooldown_halves_thread_slots():
    hot = CoolingState(heat_cooldown_active=True, thread_cooldown_active=False)
    cool = CoolingState()
    hot_counts = {"continue_thread": 0, "continue_narrative": 0, "receipt_moment": 0, "new_root": 0}
    cool_counts = dict(hot_counts)
    for seed in range(1000):
        hot_counts[
            resolve_cooled_slot_plan(
                seed, has_active_threads=True, thread_bootstrap_needed=False, cooling=hot
            )
        ] += 1
        cool_counts[
            resolve_cooled_slot_plan(
                seed, has_active_threads=True, thread_bootstrap_needed=False, cooling=cool
            )
        ] += 1
    assert hot_counts["continue_thread"] >= 400
    assert hot_counts["new_root"] <= 170


def test_receipt_cap_suppresses_opportunistic_receipts():
    capped = CoolingState(receipt_cap_active=True, has_pending_resolution=False)
    assert should_suppress_receipt_generation(capped)
    pending = CoolingState(receipt_cap_active=True, has_pending_resolution=True)
    assert not should_suppress_receipt_generation(pending)


def test_thread_cooldown_suppresses_rivalry_cascade():
    cooling = CoolingState(thread_cooldown_active=True)
    assert should_suppress_rivalry_cascade(cooling)


def test_cooling_state_thresholds():
    assert HEAT_COOLDOWN_THRESHOLD == 85.0
    assert THREAD_COOLDOWN_THRESHOLD == 50
    assert MAX_AUTONOMOUS_RECEIPTS_24H == 5


@pytest.fixture
def db():
    from app.database import SessionLocal

    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


def test_compute_cooling_state_shape(db):
    state = compute_cooling_state(db, network_heat=90.0, active_thread_count=60)
    assert state.heat_cooldown_active is True
    assert state.thread_cooldown_active is True
    debug = state.to_debug()
    assert set(debug.keys()) >= {
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
    }
