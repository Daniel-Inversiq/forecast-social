"""Action-oriented feed labels — what is happening right now (not generic platform states)."""

from __future__ import annotations

from typing import Any

FeedActionStateKey = str

ACTION_STATE_LABELS: dict[FeedActionStateKey, str] = {
    "watch_live": "Watch Live",
    "follow_thread": "Follow Thread",
    "consensus_forming": "Consensus Forming",
    "rivalry_active": "Rivalry Active",
    "market_repricing": "Market Repricing",
    "verdict_pending": "Verdict Pending",
    "resolution_near": "Resolution Near",
    "trust_shift": "Trust Shift",
}


def action_state_label(key: FeedActionStateKey | None) -> str | None:
    if not key:
        return None
    return ACTION_STATE_LABELS.get(key)


def resolve_feed_action_state(payload: dict[str, Any]) -> FeedActionStateKey:
    """Pick the dominant real-time state for a feed event payload."""
    if payload.get("live") or payload.get("show_new") or payload.get("is_streamed"):
        return "watch_live"

    bucket = str(payload.get("resolution_horizon_bucket") or "").lower()
    if bucket in ("tonight", "soon") or payload.get("resolution_open_loop"):
        return "resolution_near"

    event_type = str(payload.get("type") or "")
    if event_type in ("reputation_move", "leaderboard_move", "calibration_jump"):
        return "trust_shift"

    if event_type in ("rivalry", "battle_escalation"):
        return "rivalry_active"

    if event_type in ("consensus_shift", "narrative_acceleration"):
        return "consensus_forming"

    market_state = str(payload.get("market_narrative_state") or "").lower()
    if market_state in ("consensus building", "coalition forming"):
        return "consensus_forming"
    if event_type in ("market_move", "signal_shift", "confidence_shift") or market_state in (
        "panic repricing",
        "volatility spike",
        "fragmenting",
    ):
        return "market_repricing"

    arc_stage = str(payload.get("arc_progression") or "").lower()
    if arc_stage == "receipt pending":
        return "verdict_pending"

    spread = int(payload.get("disagreement_spread") or 0)
    if spread >= 28 and (event_type in ("rivalry", "battle_escalation") or payload.get("opponent_name")):
        return "verdict_pending"

    if payload.get("arc_id") or payload.get("returns_to_arc") or payload.get("continuity_label"):
        return "follow_thread"

    if event_type in ("new_take", "stance_followup", "position_update"):
        return "consensus_forming"

    return "follow_thread"


def resolve_story_action_state(story: dict[str, Any]) -> FeedActionStateKey:
    """Pick the dominant state for an ongoing story card."""
    if story.get("is_live"):
        return "watch_live"

    resolution = str(story.get("resolution_line") or "").lower()
    if "tonight" in resolution or "soon" in resolution or "48h" in resolution or "resolves" in resolution:
        return "resolution_near"

    story_type = str(story.get("story_type") or "")
    if story_type == "rivalry":
        strength = str(story.get("battle_strength") or "")
        if strength in ("heated", "legendary"):
            return "rivalry_active"
        return "verdict_pending"

    if story_type == "arc":
        arc_stage = str(story.get("arc_stage") or "").lower()
        if arc_stage == "receipt pending":
            return "verdict_pending"
        return "follow_thread"

    if story_type == "market":
        return "market_repricing"

    return "verdict_pending"
