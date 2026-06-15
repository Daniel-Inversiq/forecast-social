"""Thread lifecycle v1 — conservative metadata and scheduler exclusion."""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta

from app.forecasting.models import AgentGeneratedActivity
from app.forecasting.services.conversation_threads import (
    MAX_THREAD_AGENTS,
    MAX_THREAD_DEPTH,
    assign_reply_thread,
    assign_root_thread,
)
from app.forecasting.services.thread_lifecycle import (
    ARCHIVED_AFTER_DORMANT_HOURS,
    DORMANT_AFTER_HOURS,
    LIFECYCLE_ACTIVE,
    LIFECYCLE_ARCHIVED,
    LIFECYCLE_CLOSED,
    LIFECYCLE_DORMANT,
    compute_lifecycle_debug_stats,
    filter_continuation_pool,
    init_thread_lifecycle_on_root,
    mark_thread_closed,
    rank_threads_for_continuation,
    record_autonomous_thread_activity,
    resolve_thread_lifecycle,
    thread_hard_cap_reason,
)


def _row(
    *,
    activity_id: str | None = None,
    agent_slug: str = "doombot",
    parent: str | None = None,
    thread: str | None = None,
    created_at: datetime | None = None,
    metadata: dict | None = None,
) -> AgentGeneratedActivity:
    aid = activity_id or str(uuid.uuid4())
    return AgentGeneratedActivity(
        activity_id=aid,
        activity_type="agent_post",
        agent_slug=agent_slug,
        title="Test",
        body="Body",
        body_hash=f"hash-{aid}",
        thread_id=thread,
        parent_activity_id=parent,
        created_at=created_at or datetime.utcnow(),
        metadata_json=metadata,
    )


def _thread_dict(*rows: AgentGeneratedActivity) -> dict:
    ordered = sorted(rows, key=lambda row: row.created_at or datetime.min)
    root = ordered[0]
    return {
        "thread_id": root.thread_id or root.activity_id,
        "rows": ordered,
        "latest": ordered[-1],
        "root": root,
        "reply_count": max(len(ordered) - 1, 0),
    }


class _FlushDb:
    def flush(self) -> None:
        return None


def test_init_and_record_autonomous_activity():
    root = _row(activity_id="root-1")
    assign_root_thread(root)
    init_thread_lifecycle_on_root(root)
    lifecycle = (root.metadata_json or {})["thread_lifecycle"]
    assert lifecycle["status"] == LIFECYCLE_ACTIVE
    assert lifecycle["last_autonomous_reply_at"]

    thread = _thread_dict(root)
    record_autonomous_thread_activity(_FlushDb(), thread)  # type: ignore[arg-type]
    lifecycle = (root.metadata_json or {})["thread_lifecycle"]
    assert lifecycle["status"] == LIFECYCLE_ACTIVE


def test_mark_thread_closed_persists_on_root():
    root = _row(activity_id="root-1")
    assign_root_thread(root)
    init_thread_lifecycle_on_root(root)
    thread = _thread_dict(root)

    mark_thread_closed(_FlushDb(), thread, "thread_depth_limit")  # type: ignore[arg-type]
    lifecycle = (root.metadata_json or {})["thread_lifecycle"]
    assert lifecycle["status"] == LIFECYCLE_CLOSED
    assert lifecycle["close_reason"] == "thread_depth_limit"


def test_hard_cap_reports_depth_closed_at_max():
    root = _row(activity_id="root-1", agent_slug="a")
    assign_root_thread(root)
    reply1 = _row(activity_id="r1", agent_slug="b", parent="root-1", thread="root-1")
    assign_reply_thread(reply1, root)
    reply2 = _row(activity_id="r2", agent_slug="a", parent="r1", thread="root-1")
    assign_reply_thread(reply2, reply1)
    reply3 = _row(activity_id="r3", agent_slug="b", parent="r2", thread="root-1")
    assign_reply_thread(reply3, reply2)
    reply4 = _row(activity_id="r4", agent_slug="a", parent="r3", thread="root-1")
    assign_reply_thread(reply4, reply3)
    thread = _thread_dict(root, reply1, reply2, reply3, reply4)

    assert thread_hard_cap_reason(_FlushDb(), thread) == "thread_depth_limit"  # type: ignore[arg-type]
    assert resolve_thread_lifecycle(_FlushDb(), thread, persist=False) == LIFECYCLE_CLOSED  # type: ignore[arg-type]


def test_hard_cap_reports_agent_limit_independently():
    root = _row(activity_id="root-1", agent_slug="a")
    assign_root_thread(root)
    reply1 = _row(activity_id="r1", agent_slug="b", parent="root-1", thread="root-1")
    assign_reply_thread(reply1, root)
    reply2 = _row(activity_id="r2", agent_slug="c", parent="r1", thread="root-1")
    assign_reply_thread(reply2, reply1)
    thread = _thread_dict(root, reply1, reply2)

    assert thread_hard_cap_reason(_FlushDb(), thread) == "thread_agent_limit"  # type: ignore[arg-type]
    assert resolve_thread_lifecycle(_FlushDb(), thread, persist=False) == LIFECYCLE_CLOSED  # type: ignore[arg-type]


def test_untracked_thread_stays_active_without_backfill():
    root = _row(activity_id="root-1")
    assign_root_thread(root)
    old = datetime.utcnow() - timedelta(hours=DORMANT_AFTER_HOURS + 5)
    root.created_at = old
    thread = _thread_dict(root)

    assert resolve_thread_lifecycle(_FlushDb(), thread, persist=False) == LIFECYCLE_ACTIVE  # type: ignore[arg-type]


def test_tracked_thread_becomes_dormant_then_archived():
    root = _row(activity_id="root-1")
    assign_root_thread(root)
    now = datetime.utcnow()
    init_thread_lifecycle_on_root(root, now=now - timedelta(hours=DORMANT_AFTER_HOURS + 1))
    thread = _thread_dict(root)

    status = resolve_thread_lifecycle(
        _FlushDb(),  # type: ignore[arg-type]
        thread,
        now=now,
        persist=True,
    )
    assert status == LIFECYCLE_DORMANT

    archived_at = now + timedelta(hours=ARCHIVED_AFTER_DORMANT_HOURS + 1)
    status = resolve_thread_lifecycle(
        _FlushDb(),  # type: ignore[arg-type]
        thread,
        now=archived_at,
        persist=True,
    )
    assert status == LIFECYCLE_ARCHIVED


def test_filter_continuation_pool_excludes_closed_and_archived():
    active = {"thread_id": "a", "thread_lifecycle": LIFECYCLE_ACTIVE}
    dormant = {"thread_id": "b", "thread_lifecycle": LIFECYCLE_DORMANT}
    closed = {"thread_id": "c", "thread_lifecycle": LIFECYCLE_CLOSED}
    archived = {"thread_id": "d", "thread_lifecycle": LIFECYCLE_ARCHIVED}
    pool = filter_continuation_pool([active, dormant, closed, archived])
    assert {t["thread_id"] for t in pool} == {"a", "b"}


def test_rank_threads_for_continuation_prefers_active():
    dormant = {
        "thread_id": "d",
        "thread_lifecycle": LIFECYCLE_DORMANT,
        "reply_count": 9,
        "latest": _row(created_at=datetime.utcnow()),
    }
    active = {
        "thread_id": "a",
        "thread_lifecycle": LIFECYCLE_ACTIVE,
        "reply_count": 1,
        "latest": _row(created_at=datetime.utcnow() - timedelta(hours=1)),
    }
    ranked = rank_threads_for_continuation([dormant, active])
    assert ranked[0]["thread_id"] == "a"


def test_compute_lifecycle_debug_stats_includes_depth_metrics():
    root = _row(activity_id="root-1")
    assign_root_thread(root)
    init_thread_lifecycle_on_root(root)
    thread = _thread_dict(root)
    thread["thread_lifecycle"] = LIFECYCLE_ACTIVE
    stats = compute_lifecycle_debug_stats([thread])
    assert stats["lifecycle_active_threads"] == 1
    assert stats["thread_lifecycle_counts"][LIFECYCLE_ACTIVE] == 1
    assert stats["max_thread_depth"] == 1
    assert stats["threads_at_depth_3"] == 0
    assert stats["threads_at_depth_4"] == 0
    assert stats["threads_at_depth_5"] == 0
    assert stats["closed_by_depth_last_24h"] == 0
    assert stats["closed_by_agent_limit_last_24h"] == 0


def test_depth_cap_experiment_constants():
    assert MAX_THREAD_DEPTH == 5
    assert MAX_THREAD_AGENTS == 3
