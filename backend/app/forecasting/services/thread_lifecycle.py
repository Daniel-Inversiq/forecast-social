"""Conservative thread lifecycle v1 — metadata on root activities only."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy.orm import Session

from app.forecasting.models import AgentGeneratedActivity
from app.forecasting.services.conversation_threads import (
    MAX_THREAD_AGENTS,
    MAX_THREAD_DEPTH,
    activity_depth,
    thread_agent_slugs,
    thread_root_id,
)
from app.forecasting.services.thread_continuation_policy import _is_autonomous_row

LIFECYCLE_ACTIVE = "active"
LIFECYCLE_DORMANT = "dormant"
LIFECYCLE_CLOSED = "closed"
LIFECYCLE_ARCHIVED = "archived"

LIFECYCLE_STATUSES = (
    LIFECYCLE_ACTIVE,
    LIFECYCLE_DORMANT,
    LIFECYCLE_CLOSED,
    LIFECYCLE_ARCHIVED,
)

DORMANT_AFTER_HOURS = 24
ARCHIVED_AFTER_DORMANT_HOURS = 72

TERMINAL_LIFECYCLE_STATUSES = frozenset({LIFECYCLE_CLOSED, LIFECYCLE_ARCHIVED})
CONTINUATION_EXCLUDED_STATUSES = TERMINAL_LIFECYCLE_STATUSES


def _utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _parse_dt(value: object | None) -> datetime | None:
    if not isinstance(value, str) or not value.strip():
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        if parsed.tzinfo is not None:
            return parsed.replace(tzinfo=None)
        return parsed
    except ValueError:
        return None


def _lifecycle_meta(root: AgentGeneratedActivity) -> dict[str, Any]:
    meta = root.metadata_json or {}
    raw = meta.get("thread_lifecycle")
    return dict(raw) if isinstance(raw, dict) else {}


def _write_lifecycle_meta(root: AgentGeneratedActivity, lifecycle: dict[str, Any]) -> None:
    meta = dict(root.metadata_json or {})
    meta["thread_lifecycle"] = lifecycle
    root.metadata_json = meta


def init_thread_lifecycle_on_root(
    root: AgentGeneratedActivity,
    *,
    now: datetime | None = None,
) -> None:
    """Initialize lifecycle tracking on a new autonomous root."""
    now = now or _utcnow()
    lifecycle = _lifecycle_meta(root)
    if lifecycle:
        return
    stamp = now.isoformat()
    _write_lifecycle_meta(
        root,
        {
            "status": LIFECYCLE_ACTIVE,
            "status_since": stamp,
            "last_autonomous_reply_at": stamp,
        },
    )


def mark_thread_closed(
    db: Session,
    thread: dict[str, Any],
    reason: str,
    *,
    now: datetime | None = None,
) -> None:
    """Persist closed lifecycle on the thread root."""
    now = now or _utcnow()
    root: AgentGeneratedActivity = thread["root"]
    lifecycle = _lifecycle_meta(root)
    if lifecycle.get("status") in TERMINAL_LIFECYCLE_STATUSES:
        return
    stamp = now.isoformat()
    lifecycle.update(
        {
            "status": LIFECYCLE_CLOSED,
            "status_since": stamp,
            "closed_at": stamp,
            "close_reason": reason,
        }
    )
    lifecycle.pop("dormant_since", None)
    _write_lifecycle_meta(root, lifecycle)
    db.flush()


def record_autonomous_thread_activity(
    db: Session,
    thread: dict[str, Any],
    *,
    now: datetime | None = None,
) -> None:
    """Mark a thread active after an autonomous continuation reply."""
    now = now or _utcnow()
    root: AgentGeneratedActivity = thread["root"]
    lifecycle = _lifecycle_meta(root)
    stamp = now.isoformat()
    if not lifecycle:
        init_thread_lifecycle_on_root(root, now=now)
        return
    if lifecycle.get("status") in TERMINAL_LIFECYCLE_STATUSES:
        return
    lifecycle.update(
        {
            "status": LIFECYCLE_ACTIVE,
            "status_since": stamp,
            "last_autonomous_reply_at": stamp,
        }
    )
    lifecycle.pop("dormant_since", None)
    lifecycle.pop("archived_at", None)
    _write_lifecycle_meta(root, lifecycle)
    db.flush()


def latest_autonomous_activity_at(
    rows: list[AgentGeneratedActivity],
) -> datetime | None:
    latest: datetime | None = None
    for row in rows:
        if not _is_autonomous_row(row):
            continue
        created = row.created_at
        if created and (latest is None or created > latest):
            latest = created
    return latest


def thread_hard_cap_reason(
    db: Session,
    thread: dict[str, Any],
    *,
    by_id: dict[str, AgentGeneratedActivity] | None = None,
) -> str | None:
    """Return close reason when depth or participant count is at the cap."""
    rows: list[AgentGeneratedActivity] = thread["rows"]
    if not rows:
        return None
    if by_id is None:
        by_id = {row.activity_id: row for row in rows}

    max_depth = max(activity_depth(row, by_id) for row in rows)
    if max_depth >= MAX_THREAD_DEPTH:
        return "thread_depth_limit"

    participants = thread_agent_slugs(
        db,
        thread["thread_id"],
        by_id=by_id,
    )
    if len(participants) >= MAX_THREAD_AGENTS:
        return "thread_agent_limit"
    return None


def _advance_tracked_lifecycle(
    root: AgentGeneratedActivity,
    rows: list[AgentGeneratedActivity],
    *,
    now: datetime,
    persist: bool,
) -> str:
    lifecycle = _lifecycle_meta(root)
    if not lifecycle:
        return LIFECYCLE_ACTIVE

    current = lifecycle.get("status")
    if current in TERMINAL_LIFECYCLE_STATUSES:
        return str(current)

    last_auto = (
        _parse_dt(lifecycle.get("last_autonomous_reply_at"))
        or latest_autonomous_activity_at(rows)
        or root.created_at
        or now
    )
    idle_hours = (now - last_auto).total_seconds() / 3600.0

    if idle_hours < DORMANT_AFTER_HOURS:
        next_status = LIFECYCLE_ACTIVE
    elif current == LIFECYCLE_DORMANT:
        dormant_since = _parse_dt(lifecycle.get("dormant_since")) or last_auto + timedelta(
            hours=DORMANT_AFTER_HOURS
        )
        dormant_hours = (now - dormant_since).total_seconds() / 3600.0
        next_status = (
            LIFECYCLE_ARCHIVED
            if dormant_hours >= ARCHIVED_AFTER_DORMANT_HOURS
            else LIFECYCLE_DORMANT
        )
    elif idle_hours >= DORMANT_AFTER_HOURS + ARCHIVED_AFTER_DORMANT_HOURS:
        next_status = LIFECYCLE_ARCHIVED
    else:
        next_status = LIFECYCLE_DORMANT

    if persist and next_status != current:
        stamp = now.isoformat()
        lifecycle["status"] = next_status
        lifecycle["status_since"] = stamp
        if next_status == LIFECYCLE_DORMANT and not lifecycle.get("dormant_since"):
            lifecycle["dormant_since"] = stamp
        if next_status == LIFECYCLE_ARCHIVED:
            lifecycle["archived_at"] = stamp
        _write_lifecycle_meta(root, lifecycle)

    return str(next_status)


def resolve_thread_lifecycle(
    db: Session,
    thread: dict[str, Any],
    *,
    now: datetime | None = None,
    persist: bool = False,
) -> str:
    """Resolve lifecycle for observability and scheduler exclusion."""
    now = now or _utcnow()
    root: AgentGeneratedActivity = thread["root"]
    rows: list[AgentGeneratedActivity] = thread["rows"]
    lifecycle = _lifecycle_meta(root)

    hard_cap = thread_hard_cap_reason(db, thread)
    if hard_cap:
        if persist and lifecycle and lifecycle.get("status") not in TERMINAL_LIFECYCLE_STATUSES:
            mark_thread_closed(db, thread, hard_cap, now=now)
        return LIFECYCLE_CLOSED

    if not lifecycle:
        return LIFECYCLE_ACTIVE

    stored = lifecycle.get("status")
    if stored in TERMINAL_LIFECYCLE_STATUSES:
        return str(stored)

    return _advance_tracked_lifecycle(root, rows, now=now, persist=persist)


def enrich_threads_with_lifecycle(
    db: Session,
    threads: list[dict[str, Any]],
    *,
    persist: bool = True,
) -> list[dict[str, Any]]:
    now = _utcnow()
    for thread in threads:
        status = resolve_thread_lifecycle(db, thread, now=now, persist=persist)
        thread["thread_lifecycle"] = status
        thread["thread_lifecycle_meta"] = _lifecycle_meta(thread["root"])
    return threads


def filter_continuation_pool(threads: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Exclude closed/archived threads from autonomous continuation."""
    return [
        thread
        for thread in threads
        if thread.get("thread_lifecycle", LIFECYCLE_ACTIVE)
        not in CONTINUATION_EXCLUDED_STATUSES
    ]


def rank_threads_for_continuation(threads: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Prefer active lifecycle threads over dormant ones."""

    def sort_key(thread: dict[str, Any]) -> tuple[int, int, float]:
        lifecycle = thread.get("thread_lifecycle", LIFECYCLE_ACTIVE)
        pref = 0 if lifecycle == LIFECYCLE_ACTIVE else 1
        reply_count = int(thread.get("reply_count") or 0)
        latest = thread.get("latest")
        ts = 0.0
        if latest is not None and getattr(latest, "created_at", None):
            ts = latest.created_at.timestamp()
        return (pref, -reply_count, -ts)

    return sorted(threads, key=sort_key)


def prepare_lifecycle_thread_context(
    db: Session,
    threads: list[dict[str, Any]],
    *,
    persist: bool = True,
) -> dict[str, Any]:
    enriched = enrich_threads_with_lifecycle(db, threads, persist=persist)
    stats = compute_lifecycle_debug_stats(enriched)
    continuation_pool = rank_threads_for_continuation(filter_continuation_pool(enriched))
    return {
        "threads": enriched,
        "legacy_active_threads": len(threads),
        "lifecycle_active_threads": stats["lifecycle_active_threads"],
        "continuation_pool": continuation_pool,
        **stats,
    }


def _thread_max_depth(thread: dict[str, Any]) -> int:
    rows: list[AgentGeneratedActivity] = thread["rows"]
    if not rows:
        return 1
    by_id = {row.activity_id: row for row in rows}
    return max(activity_depth(row, by_id) for row in rows)


def compute_lifecycle_debug_stats(
    threads: list[dict[str, Any]],
    *,
    now: datetime | None = None,
) -> dict[str, Any]:
    now = now or _utcnow()
    cutoff = now - timedelta(hours=24)
    counts = {status: 0 for status in LIFECYCLE_STATUSES}
    closed_last_24h = 0
    archived_last_24h = 0
    closed_by_depth_last_24h = 0
    closed_by_agent_limit_last_24h = 0
    threads_at_depth_3 = 0
    threads_at_depth_4 = 0
    threads_at_depth_5 = 0
    max_thread_depth = 0

    for thread in threads:
        status = thread.get("thread_lifecycle", LIFECYCLE_ACTIVE)
        if status not in counts:
            status = LIFECYCLE_ACTIVE
        counts[status] += 1

        depth = _thread_max_depth(thread)
        max_thread_depth = max(max_thread_depth, depth)
        if depth == 3:
            threads_at_depth_3 += 1
        elif depth == 4:
            threads_at_depth_4 += 1
        elif depth == 5:
            threads_at_depth_5 += 1

        root: AgentGeneratedActivity = thread["root"]
        lifecycle = _lifecycle_meta(root)
        if status == LIFECYCLE_CLOSED:
            since = _parse_dt(lifecycle.get("closed_at") or lifecycle.get("status_since"))
            if since and since >= cutoff:
                closed_last_24h += 1
                reason = lifecycle.get("close_reason")
                if reason == "thread_depth_limit":
                    closed_by_depth_last_24h += 1
                elif reason == "thread_agent_limit":
                    closed_by_agent_limit_last_24h += 1
        if status == LIFECYCLE_ARCHIVED:
            since = _parse_dt(lifecycle.get("archived_at") or lifecycle.get("status_since"))
            if since and since >= cutoff:
                archived_last_24h += 1

    return {
        "thread_lifecycle_counts": counts,
        "thread_lifecycle_active": counts[LIFECYCLE_ACTIVE],
        "thread_lifecycle_dormant": counts[LIFECYCLE_DORMANT],
        "thread_lifecycle_closed": counts[LIFECYCLE_CLOSED],
        "thread_lifecycle_archived": counts[LIFECYCLE_ARCHIVED],
        "lifecycle_active_threads": counts[LIFECYCLE_ACTIVE],
        "closed_last_24h": closed_last_24h,
        "archived_last_24h": archived_last_24h,
        "max_thread_depth": max_thread_depth,
        "threads_at_depth_3": threads_at_depth_3,
        "threads_at_depth_4": threads_at_depth_4,
        "threads_at_depth_5": threads_at_depth_5,
        "closed_by_depth_last_24h": closed_by_depth_last_24h,
        "closed_by_agent_limit_last_24h": closed_by_agent_limit_last_24h,
    }


def lifecycle_meta_for_feed(root: AgentGeneratedActivity | None) -> str | None:
    if root is None:
        return None
    lifecycle = _lifecycle_meta(root)
    status = lifecycle.get("status")
    return str(status) if isinstance(status, str) and status else None


def thread_dict_from_activity(
    db: Session,
    source: AgentGeneratedActivity,
    *,
    by_id: dict[str, AgentGeneratedActivity] | None = None,
) -> dict[str, Any]:
    """Build a minimal thread dict for lifecycle updates from a reply source."""
    thread_id = thread_root_id(source)
    if by_id:
        rows = [row for row in by_id.values() if thread_root_id(row) == thread_id]
    else:
        rows = (
            db.query(AgentGeneratedActivity)
            .filter(AgentGeneratedActivity.thread_id == thread_id)
            .order_by(AgentGeneratedActivity.created_at.asc())
            .all()
        )
    if not rows:
        rows = [source]
    rows.sort(key=lambda row: row.created_at or datetime.min)
    return {
        "thread_id": thread_id,
        "rows": rows,
        "latest": rows[-1],
        "root": rows[0],
        "reply_count": max(len(rows) - 1, 0),
    }
