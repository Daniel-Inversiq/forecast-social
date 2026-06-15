"""Heat, thread, and receipt cooling for autonomous feed pacing."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy.orm import Session

from app.forecasting.models import AgentGeneratedActivity
from app.forecasting.services.activity_generation_sources import ACTIVITY_SOURCE_AUTONOMOUS
from app.forecasting.services.resolution_receipt_status import has_pending_resolution
from app.forecasting.services.thread_continuation_policy import (
    NARRATIVE_CONTINUE_CHANCE,
    NEW_ROOT_CHANCE,
    RECEIPT_MOMENT_CHANCE,
    THREAD_CONTINUE_CHANCE,
    SlotPlan,
    slot_outcome_bucket,
)

HEAT_COOLDOWN_THRESHOLD = 85.0
THREAD_COOLDOWN_THRESHOLD = 50
MAX_AUTONOMOUS_RECEIPTS_24H = 5
TOP_HOT_THREADS = 5

COOLDOWN_SLOT_CALM_THREAD = 0.45
COOLDOWN_SLOT_NARRATIVE_THREAD = 0.30
COOLDOWN_SLOT_DESK_ROOT = 0.15
COOLDOWN_SLOT_RECEIPT = 0.10

COOLDOWN_SLOT_MIX = {
    "calm_thread": COOLDOWN_SLOT_CALM_THREAD,
    "narrative_thread": COOLDOWN_SLOT_NARRATIVE_THREAD,
    "desk_root": COOLDOWN_SLOT_DESK_ROOT,
    "receipt": COOLDOWN_SLOT_RECEIPT,
}


RECEIPT_ACTIVITY_TYPES = ("receipt_reaction", "receipt_challenge", "receipt_victory")


def is_calm_cooldown(cooling: "CoolingState") -> bool:
    """Heat or thread overload — keep threads, reduce clash tone."""
    return cooling.heat_cooldown_active or cooling.thread_cooldown_active


def _utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _activity_source_expr(source: str):
    return AgentGeneratedActivity.metadata_json["source"].as_string() == source


@dataclass(frozen=True)
class CoolingState:
    heat_cooldown_active: bool = False
    thread_cooldown_active: bool = False
    receipt_cap_active: bool = False
    has_pending_resolution: bool = False
    autonomous_receipts_last_24h: int = 0
    phrase_fatigue_hits: int = 0
    idea_fatigue_hits: int = 0
    top_agent_idea_buckets: dict[str, dict[str, int]] | None = None
    repeated_idea_rate_24h: float = 0.0
    agent_narrative_stage: dict[str, dict[str, str]] | None = None
    stage_transition_count_24h: int = 0
    repeated_stage_count_24h: int = 0

    def to_debug(self) -> dict[str, Any]:
        out: dict[str, Any] = {
            "heat_cooldown_active": self.heat_cooldown_active,
            "thread_cooldown_active": self.thread_cooldown_active,
            "receipt_cap_active": self.receipt_cap_active,
            "phrase_fatigue_hits": self.phrase_fatigue_hits,
            "idea_fatigue_hits": self.idea_fatigue_hits,
            "repeated_idea_rate_24h": self.repeated_idea_rate_24h,
            "stage_transition_count_24h": self.stage_transition_count_24h,
            "repeated_stage_count_24h": self.repeated_stage_count_24h,
            "autonomous_receipts_last_24h": self.autonomous_receipts_last_24h,
            "has_pending_resolution": self.has_pending_resolution,
        }
        if self.top_agent_idea_buckets is not None:
            out["top_agent_idea_buckets"] = self.top_agent_idea_buckets
        if self.agent_narrative_stage is not None:
            out["agent_narrative_stage"] = self.agent_narrative_stage
        return out


def count_autonomous_fresh_receipts_since(db: Session, *, hours: int = 24) -> int:
    """Autonomous-network receipts only — excludes seeded / manual dev rows."""
    cutoff = _utcnow() - timedelta(hours=hours)
    return (
        db.query(AgentGeneratedActivity)
        .filter(
            AgentGeneratedActivity.created_at >= cutoff,
            AgentGeneratedActivity.activity_type.in_(RECEIPT_ACTIVITY_TYPES),
            _activity_source_expr(ACTIVITY_SOURCE_AUTONOMOUS),
        )
        .count()
    )


def compute_cooling_state(
    db: Session,
    *,
    network_heat: float,
    active_thread_count: int,
) -> CoolingState:
    from app.forecasting.services.idea_fatigue import compute_idea_debug_stats, idea_fatigue_hits
    from app.forecasting.services.narrative_progression import (
        compute_narrative_progression_debug_stats,
    )
    from app.forecasting.services.phrase_fatigue import phrase_fatigue_hits

    autonomous_receipts = count_autonomous_fresh_receipts_since(db, hours=24)
    pending = has_pending_resolution(db)
    idea_stats = compute_idea_debug_stats(db)
    narrative_stats = compute_narrative_progression_debug_stats(db)
    return CoolingState(
        heat_cooldown_active=network_heat > HEAT_COOLDOWN_THRESHOLD,
        thread_cooldown_active=active_thread_count > THREAD_COOLDOWN_THRESHOLD,
        receipt_cap_active=autonomous_receipts >= MAX_AUTONOMOUS_RECEIPTS_24H,
        has_pending_resolution=pending,
        autonomous_receipts_last_24h=autonomous_receipts,
        phrase_fatigue_hits=phrase_fatigue_hits(),
        idea_fatigue_hits=idea_fatigue_hits(),
        top_agent_idea_buckets=idea_stats["top_agent_idea_buckets"],
        repeated_idea_rate_24h=float(idea_stats["repeated_idea_rate_24h"]),
        agent_narrative_stage=narrative_stats["agent_narrative_stage"],
        stage_transition_count_24h=int(narrative_stats["stage_transition_count_24h"]),
        repeated_stage_count_24h=int(narrative_stats["repeated_stage_count_24h"]),
    )


def resolve_cooled_slot_plan(
    slot_seed: int,
    *,
    has_active_threads: bool,
    thread_bootstrap_needed: bool,
    cooling: CoolingState,
) -> SlotPlan:
    """
    Slot routing with heat/thread/receipt cooling.

    During calm cooldown (heat or thread overload):
      45% calm thread continuation, 30% narrative thread, 15% desk root, 10% receipt.
    Otherwise use the standard mix with receipt-cap guards.
    """
    if is_calm_cooldown(cooling):
        allow_receipt = (
            cooling.has_pending_resolution
            and not cooling.receipt_cap_active
            and not (
                cooling.heat_cooldown_active and not cooling.has_pending_resolution
            )
        )
        calm = COOLDOWN_SLOT_CALM_THREAD
        narrative = COOLDOWN_SLOT_NARRATIVE_THREAD
        desk_root = COOLDOWN_SLOT_DESK_ROOT
        receipt = COOLDOWN_SLOT_RECEIPT if allow_receipt else 0.0
        if not allow_receipt:
            narrative += COOLDOWN_SLOT_RECEIPT * 0.55
            calm += COOLDOWN_SLOT_RECEIPT * 0.45

        bucket = slot_outcome_bucket(slot_seed)
        t_calm = calm
        t_narrative = t_calm + narrative
        t_desk = t_narrative + desk_root
        t_receipt = t_desk + receipt

        if bucket < t_calm and has_active_threads:
            return "continue_thread"
        if bucket < t_narrative:
            return "continue_narrative"
        if bucket < t_desk:
            return "new_root"
        if bucket < t_receipt:
            return "receipt_moment"
        return "new_root"

    thread_chance = THREAD_CONTINUE_CHANCE
    narrative_chance = NARRATIVE_CONTINUE_CHANCE
    receipt_chance = RECEIPT_MOMENT_CHANCE
    new_root_chance = NEW_ROOT_CHANCE

    allow_receipt = cooling.has_pending_resolution and not cooling.receipt_cap_active
    if cooling.receipt_cap_active and not cooling.has_pending_resolution:
        allow_receipt = False

    if not allow_receipt:
        narrative_chance += receipt_chance * 0.55
        new_root_chance += receipt_chance * 0.45
        receipt_chance = 0.0

    bucket = slot_outcome_bucket(slot_seed)
    t_thread = thread_chance
    t_narrative = t_thread + narrative_chance
    t_receipt = t_narrative + receipt_chance

    bootstrap_ok = thread_bootstrap_needed and not cooling.thread_cooldown_active
    if bucket < t_thread and (has_active_threads or bootstrap_ok):
        return "continue_thread"
    if bucket < t_narrative:
        return "continue_narrative"
    if bucket < t_receipt:
        return "receipt_moment"
    return "new_root"


def rank_hot_threads(threads: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Order threads by reply depth then recency."""

    def score(thread: dict[str, Any]) -> tuple[int, float]:
        latest = thread.get("latest")
        ts = 0.0
        if latest is not None and getattr(latest, "created_at", None):
            ts = latest.created_at.timestamp()
        return (int(thread.get("reply_count") or 0), ts)

    return sorted(threads, key=score, reverse=True)


def select_thread_pool(
    threads: list[dict[str, Any]],
    cooling: CoolingState,
) -> list[dict[str, Any]]:
    """During thread cooldown, only the top hot threads may continue."""
    if not threads:
        return []
    if cooling.thread_cooldown_active:
        return rank_hot_threads(threads)[:TOP_HOT_THREADS]
    return threads


def should_suppress_rivalry_cascade(cooling: CoolingState) -> bool:
    """Skip heated Public Clash cascades; calm threads use a separate path."""
    return is_calm_cooldown(cooling)


def should_suppress_receipt_generation(cooling: CoolingState) -> bool:
    """Block opportunistic receipts; resolution-driven receipts use a separate gate."""
    if cooling.receipt_cap_active and not cooling.has_pending_resolution:
        return True
    if cooling.heat_cooldown_active and not cooling.has_pending_resolution:
        return True
    return False


def should_allow_resolution_receipt(cooling: CoolingState) -> bool:
    """Resolution reactions are allowed when cap is not hit or a resolution is pending."""
    if cooling.receipt_cap_active and not cooling.has_pending_resolution:
        return False
    return cooling.has_pending_resolution or not cooling.heat_cooldown_active
