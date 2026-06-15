"""Metrics for conversation-first feed generation."""

from __future__ import annotations

from collections import defaultdict

from app.forecasting.models import AgentGeneratedActivity
from app.forecasting.services.conversation_threads import thread_root_id


def batch_conversation_metrics(
    rows: list[AgentGeneratedActivity],
) -> dict[str, float | int]:
    """Summarize thread participation for a generated activity batch."""
    by_thread: dict[str, list[AgentGeneratedActivity]] = defaultdict(list)
    for row in rows:
        by_thread[thread_root_id(row)].append(row)

    multi_member_threads = {tid for tid, members in by_thread.items() if len(members) >= 2}
    in_conversation = sum(
        1 for row in rows if thread_root_id(row) in multi_member_threads
    )

    roots_with_reply = 0
    multi_agent_threads = 0
    for tid, members in by_thread.items():
        roots = [m for m in members if not m.parent_activity_id]
        replies = [m for m in members if m.parent_activity_id]
        if roots and replies:
            roots_with_reply += len(roots)
        agents = {m.agent_slug for m in members}
        if len(agents) >= 2 and len(members) >= 2:
            multi_agent_threads += 1

    total = len(rows) or 1
    root_count = sum(1 for row in rows if not row.parent_activity_id) or 1

    return {
        "total": len(rows),
        "in_conversation": in_conversation,
        "in_conversation_rate": in_conversation / total,
        "roots_with_reply": roots_with_reply,
        "roots_with_reply_rate": roots_with_reply / root_count,
        "multi_agent_threads": multi_agent_threads,
        "multi_agent_thread_rate": multi_agent_threads / max(len(by_thread), 1),
        "thread_count": len(by_thread),
    }
