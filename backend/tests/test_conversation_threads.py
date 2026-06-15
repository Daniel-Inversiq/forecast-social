"""Conversation thread assignment and limits."""

from __future__ import annotations

import uuid
from datetime import datetime

import pytest

from app.database import SessionLocal
from app.forecasting.models import AgentGeneratedActivity
from app.forecasting.services.conversation_threads import (
    MAX_THREAD_AGENTS,
    MAX_THREAD_DEPTH,
    activity_depth,
    assign_reply_thread,
    assign_root_thread,
    can_extend_thread,
    thread_root_id,
)


def _row(
    *,
    activity_id: str | None = None,
    agent_slug: str = "doombot",
    parent: str | None = None,
    thread: str | None = None,
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
        created_at=datetime.utcnow(),
    )


def test_assign_root_thread():
    row = _row()
    assign_root_thread(row)
    assert row.thread_id == row.activity_id
    assert row.parent_activity_id is None


def test_assign_reply_thread():
    root = _row(activity_id="root-1")
    assign_root_thread(root)
    reply = _row(activity_id="reply-1", agent_slug="bullbot")
    assign_reply_thread(reply, root)
    assert reply.thread_id == "root-1"
    assert reply.parent_activity_id == "root-1"


def test_counter_reply_same_thread():
    root = _row(activity_id="root-1")
    assign_root_thread(root)
    reply = _row(activity_id="reply-1", agent_slug="bullbot")
    assign_reply_thread(reply, root)
    counter = _row(activity_id="reply-2")
    assign_reply_thread(counter, reply)
    assert counter.thread_id == "root-1"
    assert counter.parent_activity_id == "reply-1"


def test_activity_depth_in_memory_chain():
    root = _row(activity_id="root-1")
    assign_root_thread(root)
    reply = _row(activity_id="reply-1", agent_slug="bullbot")
    assign_reply_thread(reply, root)
    counter = _row(activity_id="reply-2")
    assign_reply_thread(counter, reply)
    by_id = {root.activity_id: root, reply.activity_id: reply, counter.activity_id: counter}
    assert activity_depth(root, by_id) == 1
    assert activity_depth(reply, by_id) == 2
    assert activity_depth(counter, by_id) == 3


def test_can_extend_thread_depth_4_allowed():
    root = _row(activity_id="root-1", agent_slug="doombot")
    assign_root_thread(root)
    reply1 = _row(activity_id="reply-1", agent_slug="bullbot")
    assign_reply_thread(reply1, root)
    reply2 = _row(activity_id="reply-2", agent_slug="doombot")
    assign_reply_thread(reply2, reply1)
    by_id = {
        root.activity_id: root,
        reply1.activity_id: reply1,
        reply2.activity_id: reply2,
    }
    db = SessionLocal()
    try:
        assert can_extend_thread(db, reply2, "fed-watcher", by_id=by_id)
        assert activity_depth(reply2, by_id) == 3
    finally:
        db.close()


def test_can_extend_thread_depth_5_closes():
    root = _row(activity_id="root-1", agent_slug="doombot")
    assign_root_thread(root)
    reply1 = _row(activity_id="reply-1", agent_slug="bullbot")
    assign_reply_thread(reply1, root)
    reply2 = _row(activity_id="reply-2", agent_slug="doombot")
    assign_reply_thread(reply2, reply1)
    reply3 = _row(activity_id="reply-3", agent_slug="bullbot")
    assign_reply_thread(reply3, reply2)
    reply4 = _row(activity_id="reply-4", agent_slug="doombot")
    assign_reply_thread(reply4, reply3)
    by_id = {
        root.activity_id: root,
        reply1.activity_id: reply1,
        reply2.activity_id: reply2,
        reply3.activity_id: reply3,
        reply4.activity_id: reply4,
    }
    db = SessionLocal()
    try:
        assert not can_extend_thread(db, reply4, "bullbot", by_id=by_id)
        assert activity_depth(reply4, by_id) == MAX_THREAD_DEPTH
    finally:
        db.close()


def test_can_extend_thread_agent_limit():
    root = _row(activity_id="root-1", agent_slug="doombot")
    assign_root_thread(root)
    reply = _row(activity_id="reply-1", agent_slug="bullbot")
    assign_reply_thread(reply, root)
    counter = _row(activity_id="reply-2", agent_slug="fed-watcher")
    assign_reply_thread(counter, reply)
    by_id = {root.activity_id: root, reply.activity_id: reply, counter.activity_id: counter}
    db = SessionLocal()
    try:
        assert can_extend_thread(db, reply, "macro-oracle", by_id={root.activity_id: root, reply.activity_id: reply})
        assert not can_extend_thread(db, counter, "macro-oracle", by_id=by_id)
        assert MAX_THREAD_AGENTS == 3
    finally:
        db.close()


def test_thread_root_id_fallback():
    row = _row(activity_id="only-1")
    assert thread_root_id(row) == "only-1"
