"""Idea-level fatigue — semantic bucket rotation."""

from __future__ import annotations

from app.forecasting.services.character_fingerprints import fingerprint_passes
from app.forecasting.services.copy_sanitize import finalize_persisted_copy
from app.forecasting.services.idea_fatigue import (
    IDEA_FATIGUE_MAX_USES,
    classify_idea_bucket,
    is_idea_fatigued,
    reset_idea_fatigue_hits,
    rewrite_fatigued_idea,
)


def test_paraphrases_map_to_same_bucket():
    assert classify_idea_bucket("bullbot", "Still buying the bid.") == "dip_buying"
    assert classify_idea_bucket("bullbot", "The dip is still there.") == "dip_buying"
    assert classify_idea_bucket("bullbot", "Crowd is scared — still underpositioned.") == "crowd_underpositioned"
    assert classify_idea_bucket("fed-watcher", "The curve is the signal.") == "curve_signal"
    assert classify_idea_bucket("fed-watcher", "Front-end leads. Drama lags.") == "front_end_leads"
    assert classify_idea_bucket("doombot", "Soft landing is cope.") == "soft_landing_cope"
    assert classify_idea_bucket("doombot", "Credit impulse already negative.") == "credit_fragility"


def test_fatigue_rotates_to_alternate_bucket():
    reset_idea_fatigue_hits()
    usage = {("bullbot", "dip_buying"): IDEA_FATIGUE_MAX_USES}
    title = "Still buying."
    body = "The dip is still there."
    new_title, new_body, did, bucket = rewrite_fatigued_idea(
        "bullbot",
        title,
        body,
        usage=usage,
        seed=99,
    )
    assert did is True
    assert bucket != "dip_buying"
    assert classify_idea_bucket("bullbot", new_title) != "dip_buying"
    assert fingerprint_passes("bullbot", f"{new_title}\n{new_body}")


def test_rotated_copy_passes_fingerprint_via_finalize():
    reset_idea_fatigue_hits()
    usage = {("doombot", "soft_landing_cope"): IDEA_FATIGUE_MAX_USES}
    title = "Soft landing is cope."
    body = "Consensus still asleep."
    new_title, new_body, did, bucket = rewrite_fatigued_idea(
        "doombot",
        title,
        body,
        usage=usage,
        seed=7,
    )
    assert did is True
    assert bucket != "soft_landing_cope"
    assert fingerprint_passes("doombot", f"{new_title}\n{new_body}")


def test_finalize_persisted_copy_tags_idea_bucket():
    title, body, meta = finalize_persisted_copy(
        "fed-watcher",
        "The curve is the signal.",
        "Front-end moved first.",
        seed=1,
        db=None,
    )
    assert meta.get("idea_bucket") in {"curve_signal", "front_end_leads"}
    assert fingerprint_passes("fed-watcher", f"{title}\n{body}")


def test_is_idea_fatigued_after_two_uses():
    usage = {("bullbot", "dip_buying"): 2}
    assert is_idea_fatigued("bullbot", "dip_buying", usage)
    assert not is_idea_fatigued("bullbot", "momentum_tape", usage)
