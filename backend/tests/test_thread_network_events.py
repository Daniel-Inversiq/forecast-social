"""Unit tests for thread network events (no DB)."""

from __future__ import annotations

import uuid
from datetime import datetime

from app.forecasting.models import AgentGeneratedActivity
from app.forecasting.services.conversation_metrics import batch_conversation_metrics
from app.forecasting.services.conversation_threads import assign_reply_thread, assign_root_thread
from app.forecasting.services.thread_network_events import analyze_thread_heat


def _row(
    *,
    activity_id: str,
    agent_slug: str,
    parent: str | None = None,
    thread: str | None = None,
    delta: int = 0,
) -> AgentGeneratedActivity:
    return AgentGeneratedActivity(
        activity_id=activity_id,
        activity_type="rival_reply" if parent else "agent_post",
        agent_slug=agent_slug,
        title=f"{agent_slug} on thread",
        body="Body",
        body_hash=f"hash-{activity_id}",
        thread_id=thread,
        parent_activity_id=parent,
        metadata_json={"credibility_delta": delta},
        created_at=datetime.utcnow(),
    )


def test_analyze_thread_heat_requires_three_replies_and_gap():
    root_id = str(uuid.uuid4())
    root = _row(activity_id=root_id, agent_slug="bullbot", thread=root_id, delta=6)
    assign_root_thread(root)
    reply1 = _row(activity_id=str(uuid.uuid4()), agent_slug="doombot", parent=root_id, thread=root_id, delta=-5)
    assign_reply_thread(reply1, root)
    reply2 = _row(activity_id=str(uuid.uuid4()), agent_slug="bullbot", parent=reply1.activity_id, thread=root_id, delta=7)
    assign_reply_thread(reply2, reply1)
    reply3 = _row(activity_id=str(uuid.uuid4()), agent_slug="macro-oracle", parent=reply2.activity_id, thread=root_id, delta=-6)
    assign_reply_thread(reply3, reply2)

    session = {root.activity_id: root, reply1.activity_id: reply1, reply2.activity_id: reply2, reply3.activity_id: reply3}
    metrics = analyze_thread_heat(root_id, session)
    assert metrics is not None
    assert metrics.reply_count == 3
    assert metrics.conviction_gap >= 8
    assert metrics.credibility_mismatch is True


def test_batch_conversation_metrics_counts_multi_agent_threads():
    root_id = "root-1"
    root = _row(activity_id=root_id, agent_slug="bullbot", thread=root_id)
    assign_root_thread(root)
    reply = _row(activity_id="reply-1", agent_slug="doombot", parent=root_id, thread=root_id)
    assign_reply_thread(reply, root)
    solo_id = "solo-1"
    solo = _row(activity_id=solo_id, agent_slug="fed-watcher", thread=solo_id)
    assign_root_thread(solo)

    stats = batch_conversation_metrics([root, reply, solo])
    assert stats["in_conversation_rate"] == 2 / 3
    assert stats["roots_with_reply_rate"] == 0.5
    assert stats["multi_agent_threads"] == 1
