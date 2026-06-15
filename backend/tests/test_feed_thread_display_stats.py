"""UI thread display stats mirror frontend Latest grouping."""

from app.forecasting.services.feed_thread_display_stats import (
    compute_feed_thread_display_stats,
    group_conversation_display_payloads,
    resolve_thread_block_label,
    sort_feed_by_thread_block_time_desc,
)


def test_latest_thread_block_sort_groups_root_and_reply():
    root_id = "thread-root"
    reply_id = "thread-reply"
    events = [
        {
            "generated_activity_id": reply_id,
            "thread_id": root_id,
            "parent_activity_id": root_id,
            "activity_type": "rival_reply",
            "created_at": "2026-06-08T12:00:00Z",
            "feed_published_at": "2026-06-08T12:00:00Z",
        },
        {
            "generated_activity_id": root_id,
            "thread_id": root_id,
            "parent_activity_id": None,
            "activity_type": "agent_post",
            "created_at": "2026-06-08T10:00:00Z",
            "feed_published_at": "2026-06-08T10:00:00Z",
        },
    ]
    ordered = sort_feed_by_thread_block_time_desc(events)
    assert [e["generated_activity_id"] for e in ordered] == [root_id, reply_id]

    stream_items = [
        {"type": "event", "event": payload, "index": index}
        for index, payload in enumerate(ordered)
    ]
    stats = compute_feed_thread_display_stats(
        group_conversation_display_payloads(stream_items)
    )
    assert stats["thread_blocks_rendered_ui"] == 1
    assert stats["standalone_thread_candidates"] == 0
    assert stats["visible_thread_label_counts"]["Desk Note"] == 1


def test_calm_rival_reply_is_not_public_clash():
    label = resolve_thread_block_label(
        [
            {"activity_type": "agent_post", "parent_activity_id": None},
            {
                "activity_type": "rival_reply",
                "parent_activity_id": "root",
                "title": "momentum persists. the long side wins.",
                "body": "timing is the job.",
                "thread_tone": "calm",
            },
        ]
    )
    assert label == "Desk Note"


def test_heated_rival_reply_stays_public_clash():
    label = resolve_thread_block_label(
        [
            {"activity_type": "agent_post", "parent_activity_id": None},
            {
                "activity_type": "rival_reply",
                "parent_activity_id": "root",
                "thread_tone": "heated",
                "title": "Fair point — momentum can persist.",
            },
        ]
    )
    assert label == "Public Clash"


def test_narrative_stage_thread_is_narrative_shift():
    label = resolve_thread_block_label(
        [
            {
                "activity_type": "agent_post",
                "narrative_stage": "early_confirmation",
            }
        ]
    )
    assert label == "Narrative Shift"
