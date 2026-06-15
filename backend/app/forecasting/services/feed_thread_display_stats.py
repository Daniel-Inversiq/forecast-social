"""UI-equivalent thread block counters for feed/debug observability."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from app.forecasting.services.thread_label_copy import is_explicitly_adversarial_rival_copy


def _feed_sort_timestamp(event: dict[str, Any]) -> float:
    raw = event.get("feed_published_at") or event.get("created_at") or ""
    try:
        return datetime.fromisoformat(str(raw).replace("Z", "+00:00")).timestamp()
    except ValueError:
        return 0.0


def group_threaded_feed_payloads(events: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Mirror frontend groupThreadedFeedEvents — roots then replies, oldest first."""
    children_by_thread: dict[str, list[dict[str, Any]]] = {}
    consumed: set[int] = set()
    grouped: list[dict[str, Any]] = []

    for event in events:
        if not event.get("thread_id") or not event.get("generated_activity_id"):
            continue
        if event.get("parent_activity_id"):
            children_by_thread.setdefault(str(event["thread_id"]), []).append(event)

    def emit_thread(root: dict[str, Any]) -> None:
        key = id(root)
        if key in consumed:
            return
        consumed.add(key)
        grouped.append(root)
        replies = sorted(
            children_by_thread.get(str(root.get("thread_id")), []),
            key=lambda row: str(row.get("created_at") or ""),
        )
        for reply in replies:
            reply_key = id(reply)
            if reply_key in consumed:
                continue
            consumed.add(reply_key)
            grouped.append(reply)

    for event in events:
        if (
            event.get("thread_id")
            and event.get("generated_activity_id") == event.get("thread_id")
        ):
            emit_thread(event)

    for event in events:
        if id(event) not in consumed:
            grouped.append(event)

    return grouped if grouped else events


def sort_feed_by_thread_block_time_desc(events: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Mirror frontend sortFeedByThreadBlockTimeDesc for Latest-mode display stats."""
    grouped = group_threaded_feed_payloads(events)
    blocks: list[list[dict[str, Any]]] = []
    index = 0
    while index < len(grouped):
        current = grouped[index]
        is_thread_root = (
            bool(current.get("thread_id"))
            and bool(current.get("generated_activity_id"))
            and current.get("thread_id") == current.get("generated_activity_id")
        )
        if not is_thread_root:
            blocks.append([current])
            index += 1
            continue
        block = [current]
        index += 1
        while index < len(grouped) and grouped[index].get("thread_id") == current.get(
            "thread_id"
        ):
            block.append(grouped[index])
            index += 1
        has_reply = any(
            event.get("parent_activity_id")
            and event.get("generated_activity_id") != event.get("thread_id")
            for event in block
        )
        if len(block) > 1 or has_reply:
            blocks.append(block)
        else:
            blocks.append([current])

    blocks.sort(
        key=lambda block: max(_feed_sort_timestamp(event) for event in block),
        reverse=True,
    )
    flattened: list[dict[str, Any]] = []
    for block in blocks:
        flattened.extend(block)
    return flattened

CONVERSATION_REPLY_TYPES = frozenset(
    {"rival_reply", "battle_response", "receipt_reaction", "receipt_challenge"}
)


def _event_belongs_to_conversation_thread(event: dict[str, Any]) -> bool:
    thread_id = event.get("thread_id")
    generated_activity_id = event.get("generated_activity_id")
    if not thread_id or not generated_activity_id:
        return False
    if event.get("parent_activity_id"):
        return True
    if (event.get("thread_depth") or 1) > 1:
        return True
    activity_type = event.get("activity_type")
    if (
        activity_type in CONVERSATION_REPLY_TYPES
        and thread_id != generated_activity_id
    ):
        return True
    return thread_id == generated_activity_id


def _is_conversation_reply(event: dict[str, Any]) -> bool:
    if event.get("parent_activity_id"):
        return True
    if (event.get("thread_depth") or 1) > 1:
        return True
    activity_type = event.get("activity_type")
    thread_id = event.get("thread_id")
    generated_activity_id = event.get("generated_activity_id")
    if (
        activity_type in CONVERSATION_REPLY_TYPES
        and thread_id
        and generated_activity_id
        and thread_id != generated_activity_id
    ):
        return True
    return False


def _is_standalone_thread_candidate(event: dict[str, Any]) -> bool:
    if not event.get("generated_activity_id") and not event.get("thread_id"):
        return False
    return (
        _event_belongs_to_conversation_thread(event)
        or _is_conversation_reply(event)
        or bool(event.get("parent_activity_id"))
    )


def group_conversation_display_payloads(
    stream_items: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """Mirror frontend groupConversationDisplayItems for debug counters."""
    result: list[dict[str, Any]] = []
    index = 0

    while index < len(stream_items):
        current = stream_items[index]
        event = current.get("event") if current.get("type") == "event" else None
        if not event or not _event_belongs_to_conversation_thread(event):
            result.append({"kind": "single", "item": current})
            index += 1
            continue

        thread_id = event["thread_id"]
        batch: list[dict[str, Any]] = []
        while index < len(stream_items):
            item = stream_items[index]
            item_event = item.get("event") if item.get("type") == "event" else None
            if item.get("type") != "event" or item_event.get("thread_id") != thread_id:
                break
            batch.append(item)
            index += 1

        has_reply = any(
            item.get("type") == "event"
            and item["event"].get("parent_activity_id")
            and item["event"].get("generated_activity_id") != thread_id
            for item in batch
        )
        if len(batch) > 1 or has_reply:
            result.append({"kind": "thread", "thread_id": thread_id, "items": batch})
        else:
            for item in batch:
                result.append({"kind": "single", "item": item})

    return result


RECEIPT_ACTIVITY_TYPES = frozenset({"receipt_reaction", "receipt_victory"})
RIVAL_ACTIVITY_TYPES = frozenset({"rival_reply", "battle_response"})
NARRATIVE_ACTIVITY_TYPES = frozenset(
    {"conviction_update", "network_pulse", "network_briefing_item"}
)
NARRATIVE_EVENT_TYPES = frozenset(
    {
        "consensus_shift",
        "narrative_acceleration",
        "signal_shift",
        "confidence_shift",
        "market_move",
    }
)
CALM_NARRATIVE_KINDS = frozenset({"calm_thread_narrative"})
CALM_MARKET_KINDS = frozenset({"calm_thread_market_read"})
THREAD_BLOCK_LABELS = (
    "Public Clash",
    "Narrative Shift",
    "Receipt Locked",
    "Desk Note",
    "Market Read",
)

def _thread_tone(event: dict[str, Any]) -> str | None:
    tone = event.get("thread_tone")
    return str(tone) if tone else None


def _continuation_kind(event: dict[str, Any]) -> str | None:
    kind = event.get("continuation_kind")
    return str(kind) if kind else None


def _is_calm_thread_event(event: dict[str, Any]) -> bool:
    if _thread_tone(event) == "calm":
        return True
    kind = _continuation_kind(event)
    return bool(kind and kind.startswith("calm_thread_"))


def _is_heated_thread(events: list[dict[str, Any]]) -> bool:
    return any(_thread_tone(event) == "heated" for event in events)


def _is_explicitly_adversarial_rival_event(event: dict[str, Any]) -> bool:
    activity_type = event.get("activity_type")
    if activity_type not in RIVAL_ACTIVITY_TYPES:
        return False
    parent = event.get("parent_activity") or {}
    return is_explicitly_adversarial_rival_copy(
        event.get("title"),
        event.get("body"),
        opponent_name=event.get("opponent_name"),
        opponent_slug=event.get("opponent_slug"),
        parent_agent_name=parent.get("agent_name"),
        thread_tone=_thread_tone(event),
    )


def _is_public_clash_thread(events: list[dict[str, Any]]) -> bool:
    if _is_heated_thread(events):
        return True
    return any(_is_explicitly_adversarial_rival_event(event) for event in events)


def resolve_thread_block_label(events: list[dict[str, Any]]) -> str:
    """Mirror frontend resolveThreadBlockLabel for debug observability."""
    if any(
        (event.get("activity_type") in RECEIPT_ACTIVITY_TYPES)
        or event.get("type") in ("receipt", "verified_call")
        for event in events
    ):
        return "Receipt Locked"

    if not _is_heated_thread(events) and any(event.get("narrative_stage") for event in events):
        return "Narrative Shift"

    if _is_public_clash_thread(events):
        return "Public Clash"

    if any(
        (_continuation_kind(event) in CALM_NARRATIVE_KINDS)
        or (
            _is_calm_thread_event(event)
            and (
                event.get("activity_type") in NARRATIVE_ACTIVITY_TYPES
                or event.get("narrative_id")
                or event.get("narrative_label")
            )
        )
        for event in events
    ):
        return "Narrative Shift"

    if any(
        (_continuation_kind(event) in CALM_MARKET_KINDS)
        or (_is_calm_thread_event(event) and event.get("related_market_slug"))
        for event in events
    ):
        return "Market Read"

    if any(
        (event.get("activity_type") in NARRATIVE_ACTIVITY_TYPES)
        or event.get("type") in NARRATIVE_EVENT_TYPES
        or event.get("narrative_id")
        or event.get("narrative_label")
        for event in events
    ):
        return "Narrative Shift"

    if any(
        event.get("activity_type") in RIVAL_ACTIVITY_TYPES
        and event.get("related_market_slug")
        for event in events
    ):
        return "Market Read"

    return "Desk Note"


def _empty_thread_label_counts() -> dict[str, int]:
    return {label: 0 for label in THREAD_BLOCK_LABELS}


def _thread_events_from_group(group: dict[str, Any]) -> list[dict[str, Any]]:
    if group.get("kind") != "thread":
        return []
    return [
        item["event"]
        for item in group.get("items") or []
        if item.get("type") == "event" and item.get("event")
    ]


def compute_visible_thread_label_counts(
    groups: list[dict[str, Any]],
) -> dict[str, int]:
    counts = _empty_thread_label_counts()
    for group in groups:
        if group.get("kind") != "thread":
            continue
        label = resolve_thread_block_label(_thread_events_from_group(group))
        counts[label] = counts.get(label, 0) + 1
    return counts


def compute_feed_thread_display_stats(
    groups: list[dict[str, Any]],
) -> dict[str, Any]:
    thread_blocks_rendered_ui = 0
    standalone_thread_candidates = 0
    for group in groups:
        if group.get("kind") == "thread":
            thread_blocks_rendered_ui += 1
            continue
        item = group.get("item") or {}
        if item.get("type") == "event":
            event = item.get("event") or {}
            if _is_standalone_thread_candidate(event):
                standalone_thread_candidates += 1
    return {
        "thread_blocks_rendered_ui": thread_blocks_rendered_ui,
        "standalone_thread_candidates": standalone_thread_candidates,
        "visible_thread_label_counts": compute_visible_thread_label_counts(groups),
    }
