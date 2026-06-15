"""Thread continuation dominance — slot routing, preemption guards, debug metrics."""

from __future__ import annotations

import re
import zlib
from datetime import datetime, timedelta, timezone
from typing import Any, Literal

from sqlalchemy.orm import Session

from collections import defaultdict

from app.forecasting.models import Agent, AgentGeneratedActivity, NetworkNarrative
from app.forecasting.services.activity_generation_sources import ACTIVITY_SOURCE_AUTONOMOUS
from app.forecasting.services.conversation_threads import thread_root_id
from app.forecasting.services.utils import hash_seed

ACTIVE_THREAD_HOURS = 72
THREAD_CONTINUE_CHANCE = 0.55
NARRATIVE_CONTINUE_CHANCE = 0.25
RECEIPT_MOMENT_CHANCE = 0.10
NEW_ROOT_CHANCE = 0.10

NARRATIVE_CONTINUE_THRESHOLD = THREAD_CONTINUE_CHANCE + NARRATIVE_CONTINUE_CHANCE
RECEIPT_MOMENT_THRESHOLD = NARRATIVE_CONTINUE_THRESHOLD + RECEIPT_MOMENT_CHANCE

SlotPlan = Literal["continue_thread", "continue_narrative", "receipt_moment", "new_root"]

ROOT_ACTIVITY_TYPES = frozenset({"agent_post", "conviction_update"})
RIVALRY_REPLY_TYPES = frozenset({"rival_reply", "battle_response"})
THREAD_REPLY_TYPES = frozenset(
    {"rival_reply", "battle_response", "receipt_reaction", "receipt_challenge"}
)

TARGET_MIX = {
    "thread_continuation": THREAD_CONTINUE_CHANCE,
    "narrative_reinforce": NARRATIVE_CONTINUE_CHANCE,
    "receipt_moment": RECEIPT_MOMENT_CHANCE,
    "new_root_post": NEW_ROOT_CHANCE,
}


def _utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def normalize_activity_title(title: str | None) -> str:
    if not title or not str(title).strip():
        return ""
    text = str(title).lower()
    text = re.sub(r"[^\w\s]", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def slot_outcome_bucket(slot_seed: int) -> float:
    bucket = zlib.crc32(f"slot_outcome:{slot_seed}".encode()) % 10_000
    return bucket / 10_000.0


def resolve_slot_plan(
    slot_seed: int,
    *,
    has_active_threads: bool,
    thread_bootstrap_needed: bool = False,
) -> SlotPlan:
    """Target mix: 55% thread, 25% narrative, 10% receipt, 10% new root."""
    bucket = slot_outcome_bucket(slot_seed)
    if bucket < THREAD_CONTINUE_CHANCE and (has_active_threads or thread_bootstrap_needed):
        return "continue_thread"
    if bucket < NARRATIVE_CONTINUE_THRESHOLD:
        return "continue_narrative"
    if bucket < RECEIPT_MOMENT_THRESHOLD:
        return "receipt_moment"
    return "new_root"


def narrative_is_contested(narrative: NetworkNarrative) -> bool:
    supporters = narrative.supporters_json or []
    opponents = narrative.opponents_json or []
    return bool(supporters and opponents)


def narrative_has_participants(narrative: NetworkNarrative) -> bool:
    supporters = narrative.supporters_json or []
    opponents = narrative.opponents_json or []
    return bool(supporters or opponents)


def score_narrative_for_agent(
    narrative: NetworkNarrative,
    agent: Agent,
    *,
    seed: int,
    bible_favorites: set[str],
    bible_hated: set[str],
) -> float:
    label_lower = narrative.label.lower()
    keywords_blob = " ".join(narrative.keywords_json or []).lower()
    score = float(narrative.heat)

    if narrative_is_contested(narrative):
        score += 40
    elif narrative_has_participants(narrative):
        score += 22

    recent = narrative.recent_activity_json or []
    if recent:
        score += min(18, len(recent) * 3)

    if any(f in label_lower or f in keywords_blob for f in bible_favorites):
        score += 18
    if any(h in label_lower for h in bible_hated):
        score += 12

    if agent.slug in (narrative.opponents_json or []):
        score += 14
    elif agent.slug in (narrative.supporters_json or []):
        score += 8

    score += hash_seed(agent.slug, narrative.narrative_id, str(seed)) % 10
    return score


def find_reply_source_for_narrative(
    db: Session,
    narrative: NetworkNarrative,
    agent: Agent,
    *,
    session_by_id: dict[str, AgentGeneratedActivity],
    hours: int = ACTIVE_THREAD_HOURS,
) -> AgentGeneratedActivity | None:
    cutoff = _utcnow() - timedelta(hours=hours)
    opponents = [s for s in (narrative.opponents_json or []) if s != agent.slug]
    supporters = [s for s in (narrative.supporters_json or []) if s != agent.slug]
    pool = opponents or supporters
    if not pool:
        recent = narrative.recent_activity_json or []
        pool = [r["agent_slug"] for r in recent if r.get("agent_slug") != agent.slug]

    for slug in pool:
        for row in session_by_id.values():
            if row.agent_slug == slug:
                return row
        row = (
            db.query(AgentGeneratedActivity)
            .filter(
                AgentGeneratedActivity.agent_slug == slug,
                AgentGeneratedActivity.created_at >= cutoff,
            )
            .order_by(AgentGeneratedActivity.created_at.desc())
            .first()
        )
        if row:
            return row
    return None


def target_owns_thesis(
    db: Session,
    target_slug: str,
    normalized_title: str,
    *,
    session_by_id: dict[str, AgentGeneratedActivity] | None = None,
    hours: int = ACTIVE_THREAD_HOURS,
) -> bool:
    if not normalized_title:
        return False
    if session_by_id:
        for row in session_by_id.values():
            if row.agent_slug == target_slug and not row.parent_activity_id:
                if normalize_activity_title(row.title) == normalized_title:
                    return True
    cutoff = _utcnow() - timedelta(hours=hours)
    rows = (
        db.query(AgentGeneratedActivity)
        .filter(
            AgentGeneratedActivity.agent_slug == target_slug,
            AgentGeneratedActivity.created_at >= cutoff,
            AgentGeneratedActivity.parent_activity_id.is_(None),
        )
        .order_by(AgentGeneratedActivity.created_at.desc())
        .limit(40)
        .all()
    )
    return any(normalize_activity_title(row.title) == normalized_title for row in rows)


def _recent_quote_rows(
    db: Session,
    *,
    quoted_agent_slug: str,
    hours: int = 2,
) -> list[AgentGeneratedActivity]:
    cutoff = _utcnow() - timedelta(hours=hours)
    rows = (
        db.query(AgentGeneratedActivity)
        .filter(AgentGeneratedActivity.created_at >= cutoff)
        .order_by(AgentGeneratedActivity.created_at.desc())
        .limit(200)
        .all()
    )
    out: list[AgentGeneratedActivity] = []
    for row in rows:
        meta = row.metadata_json or {}
        target = meta.get("counter_target") or meta.get("in_reply_to_agent_slug") or meta.get(
            "opponent_slug"
        )
        if target == quoted_agent_slug:
            out.append(row)
    return out


def blocks_preemptive_quote(
    db: Session,
    *,
    speaker_slug: str,
    target_slug: str | None,
    title: str,
    session_by_id: dict[str, AgentGeneratedActivity] | None = None,
) -> bool:
    """Block quoting agent B on a thesis B has not published yet."""
    if not target_slug or speaker_slug == target_slug:
        return False
    norm = normalize_activity_title(title)
    if not norm:
        return False
    if target_owns_thesis(db, target_slug, norm, session_by_id=session_by_id):
        return False
    for row in _recent_quote_rows(db, quoted_agent_slug=target_slug, hours=2):
        if row.agent_slug == speaker_slug and normalize_activity_title(row.title) == norm:
            return True
    return False


def blocks_late_root_after_quote(
    db: Session,
    *,
    agent_slug: str,
    title: str,
    session_by_id: dict[str, AgentGeneratedActivity] | None = None,
    hours: int = 2,
) -> bool:
    """Block B posting a root thesis others already attributed to B via quote."""
    norm = normalize_activity_title(title)
    if not norm:
        return False
    if target_owns_thesis(db, agent_slug, norm, session_by_id=session_by_id):
        return False
    if session_by_id:
        for row in session_by_id.values():
            if row.agent_slug != agent_slug:
                meta = row.metadata_json or {}
                target = meta.get("counter_target") or meta.get("in_reply_to_agent_slug")
                if target == agent_slug and normalize_activity_title(row.title) == norm:
                    return True
    for row in _recent_quote_rows(db, quoted_agent_slug=agent_slug, hours=hours):
        if row.agent_slug != agent_slug and normalize_activity_title(row.title) == norm:
            return True
    return False


def stamp_continuation_kind(row: AgentGeneratedActivity, kind: str) -> None:
    meta = dict(row.metadata_json or {})
    meta["continuation_kind"] = kind
    row.metadata_json = meta


def _is_autonomous_row(row: AgentGeneratedActivity) -> bool:
    meta = row.metadata_json or {}
    return meta.get("source") == ACTIVITY_SOURCE_AUTONOMOUS or meta.get("continuation_kind") is not None


def is_actual_thread_continuation(row: AgentGeneratedActivity) -> bool:
    """Reply that continues an existing thread (parent + inherited thread_id)."""
    return bool(row.parent_activity_id and row.thread_id)


def is_rivalry_reply(row: AgentGeneratedActivity) -> bool:
    if row.activity_type in RIVALRY_REPLY_TYPES:
        return True
    kind = (row.metadata_json or {}).get("continuation_kind")
    return kind == "rivalry_reply"


def is_orphan_rivalry_reply(row: AgentGeneratedActivity) -> bool:
    return is_rivalry_reply(row) and not row.parent_activity_id


def classify_activity_row(row: AgentGeneratedActivity) -> str:
    meta = row.metadata_json or {}
    kind = meta.get("continuation_kind")
    if isinstance(kind, str) and kind:
        if kind.startswith("calm_thread_"):
            return "thread_continuation"
        return kind

    if is_actual_thread_continuation(row):
        return "thread_continuation"
    if is_rivalry_reply(row):
        return "rivalry_reply"
    if meta.get("event_kind") == "narrative_reinforce" or meta.get("recovery_safe_post"):
        return "narrative_reinforce"
    if kind == "receipt_moment" or row.activity_type in ("receipt_reaction", "receipt_victory"):
        return "receipt_moment"
    if row.activity_type in ROOT_ACTIVITY_TYPES and not row.parent_activity_id:
        return "new_root_post"
    if row.activity_type == "conviction_update":
        return "narrative_reinforce"
    return "other"


def _thread_depth_stats(rows: list[AgentGeneratedActivity]) -> tuple[float, int]:
    by_thread: dict[str, list[AgentGeneratedActivity]] = defaultdict(list)
    for row in rows:
        if row.thread_id:
            by_thread[thread_root_id(row)].append(row)

    depths: list[int] = []
    blocks = 0
    for members in by_thread.values():
        if len(members) < 2:
            continue
        blocks += 1
        depths.append(len(members))
    avg_depth = round(sum(depths) / len(depths), 2) if depths else 0.0
    return avg_depth, blocks


def compute_continuation_metrics(db: Session, *, hours: int = 24) -> dict[str, Any]:
    cutoff = _utcnow() - timedelta(hours=hours)
    rows = (
        db.query(AgentGeneratedActivity)
        .filter(AgentGeneratedActivity.created_at >= cutoff)
        .order_by(AgentGeneratedActivity.created_at.desc())
        .limit(500)
        .all()
    )
    autonomous = [r for r in rows if _is_autonomous_row(r)]
    if not autonomous:
        autonomous = rows

    total = len(autonomous)
    counts = {
        "thread_continuation": 0,
        "narrative_reinforce": 0,
        "receipt_moment": 0,
        "new_root_post": 0,
        "rivalry_reply": 0,
        "other": 0,
    }
    thread_continuations = 0
    rivalry_replies = 0
    orphan_rivalry = 0
    reply_rows = 0
    replies_with_parent = 0

    for row in autonomous:
        bucket = classify_activity_row(row)
        if bucket in counts:
            counts[bucket] += 1
        else:
            counts["other"] += 1
        if is_actual_thread_continuation(row):
            thread_continuations += 1
        if is_rivalry_reply(row):
            rivalry_replies += 1
        if is_orphan_rivalry_reply(row):
            orphan_rivalry += 1
        if row.parent_activity_id or row.activity_type in THREAD_REPLY_TYPES:
            reply_rows += 1
            if row.parent_activity_id:
                replies_with_parent += 1

    average_thread_depth, thread_blocks_rendered = _thread_depth_stats(autonomous)

    def rate(numerator: int) -> float:
        return round(numerator / total, 4) if total else 0.0

    return {
        "window_hours": hours,
        "sample_size": total,
        "counts": counts,
        "thread_continuation_rate": rate(thread_continuations),
        "new_root_post_rate": rate(counts["new_root_post"]),
        "rivalry_reply_rate": rate(rivalry_replies),
        "narrative_reinforce_rate": rate(counts["narrative_reinforce"]),
        "receipt_moment_rate": rate(counts["receipt_moment"]),
        "orphan_rivalry_reply_count": orphan_rivalry,
        "replies_with_parent_rate": (
            round(replies_with_parent / reply_rows, 4) if reply_rows else 0.0
        ),
        "average_thread_depth": average_thread_depth,
        "thread_blocks_rendered": thread_blocks_rendered,
        "target_mix": TARGET_MIX,
        "active_thread_hours": ACTIVE_THREAD_HOURS,
        "slot_plan_thresholds": {
            "thread_continue_chance": THREAD_CONTINUE_CHANCE,
            "narrative_continue_chance": NARRATIVE_CONTINUE_CHANCE,
            "receipt_moment_chance": RECEIPT_MOMENT_CHANCE,
            "new_root_chance": NEW_ROOT_CHANCE,
        },
    }
