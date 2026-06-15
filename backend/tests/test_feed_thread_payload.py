"""Thread linkage fields on /feed payloads."""

from __future__ import annotations

from datetime import datetime

import pytest

from app.database import SessionLocal
from app.forecasting.models import Agent, AgentGeneratedActivity, FeedEvent
from app.forecasting.services.conversation_threads import assign_reply_thread, assign_root_thread
from app.forecasting.services.feed_intelligence import build_personalized_feed
from app.forecasting.services.feed_thread_display_stats import (
    compute_feed_thread_display_stats,
    group_conversation_display_payloads,
)


@pytest.fixture
def db():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


def test_event_payload_forwards_thread_fields(db):
    agent = db.query(Agent).first()
    if not agent:
        pytest.skip("No agents seeded")

    root_id = "test-thread-root-forward"
    reply_id = "test-thread-reply-forward"
    root = AgentGeneratedActivity(
        activity_id=root_id,
        activity_type="agent_post",
        agent_id=agent.id,
        agent_slug=agent.slug,
        title="Thread root forward probe",
        body="Root body",
        body_hash="root-forward-hash",
        created_at=datetime.utcnow(),
    )
    assign_root_thread(root)
    reply = AgentGeneratedActivity(
        activity_id=reply_id,
        activity_type="rival_reply",
        agent_id=agent.id,
        agent_slug=agent.slug,
        title="Thread reply forward probe",
        body="Reply body",
        body_hash="reply-forward-hash",
        created_at=datetime.utcnow(),
    )
    assign_reply_thread(reply, root)

    feed_root = FeedEvent(
        type="new_take",
        agent_id=agent.id,
        title=root.title,
        body=root.body,
        created_at=datetime.utcnow(),
        feed_published_at=datetime.utcnow(),
        metadata_json={
            "source": "agent_activity_engine",
            "activity_type": "agent_post",
            "generated_activity_id": root_id,
            "thread_id": root_id,
            "parent_activity_id": None,
        },
    )
    feed_reply = FeedEvent(
        type="rivalry",
        agent_id=agent.id,
        title=reply.title,
        body=reply.body,
        created_at=datetime.utcnow(),
        feed_published_at=datetime.utcnow(),
        metadata_json={
            "source": "agent_activity_engine",
            "activity_type": "rival_reply",
            "generated_activity_id": reply_id,
            "thread_id": root_id,
            "parent_activity_id": root_id,
        },
    )
    root.mirrored_feed_event_id = None
    reply.mirrored_feed_event_id = None
    db.add_all([root, reply, feed_root, feed_reply])
    db.flush()
    root.mirrored_feed_event_id = feed_root.id
    reply.mirrored_feed_event_id = feed_reply.id
    db.commit()

    result = build_personalized_feed(db, None, chip="latest", limit=50)
    by_gen = {
        item.get("generated_activity_id"): item
        for item in result["events"]
        if item.get("generated_activity_id")
    }

    assert root_id in by_gen
    assert reply_id in by_gen
    assert by_gen[root_id].get("thread_id") == root_id
    assert by_gen[reply_id].get("parent_activity_id") == root_id

    stream_items = [
        {"type": "event", "event": payload, "index": index}
        for index, payload in enumerate(result["events"])
    ]
    stats = compute_feed_thread_display_stats(
        group_conversation_display_payloads(stream_items)
    )
    assert stats["thread_blocks_rendered_ui"] >= 1

    for feed_id in (feed_root.id, feed_reply.id):
        row = db.query(FeedEvent).filter(FeedEvent.id == feed_id).first()
        if row:
            db.delete(row)
    db.query(AgentGeneratedActivity).filter(
        AgentGeneratedActivity.activity_id.in_([root_id, reply_id])
    ).delete(synchronize_session=False)
    db.commit()
