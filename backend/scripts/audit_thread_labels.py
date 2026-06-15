"""Audit visible thread block labels against live feed payloads."""

from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.database import SessionLocal
from app.forecasting.migrate import migrate_schema
from app.forecasting.services.feed_intelligence import build_personalized_feed
from app.forecasting.services.feed_thread_display_stats import (
    RIVAL_ACTIVITY_TYPES,
    _is_explicitly_adversarial_rival_event,
    _is_heated_thread,
    _thread_tone,
    compute_feed_thread_display_stats,
    group_conversation_display_payloads,
    resolve_thread_block_label,
    sort_feed_by_thread_block_time_desc,
)
from app.forecasting.services.thread_label_copy import (
    event_copy_text,
    has_explicit_opposition,
    is_explicitly_adversarial_rival_copy,
)


def _feed_sort_timestamp(event: dict[str, Any]) -> float:
    raw = event.get("feed_published_at") or event.get("created_at") or ""
    try:
        return datetime.fromisoformat(str(raw).replace("Z", "+00:00")).timestamp()
    except ValueError:
        return 0.0


def _adversarial_detail(event: dict[str, Any]) -> dict[str, Any]:
    activity_type = event.get("activity_type")
    if activity_type not in RIVAL_ACTIVITY_TYPES:
        return {"is_adversarial": False, "triggers": []}

    parent = event.get("parent_activity") or {}
    copy = event_copy_text(event.get("title"), event.get("body"))
    adversarial = is_explicitly_adversarial_rival_copy(
        event.get("title"),
        event.get("body"),
        opponent_name=event.get("opponent_name"),
        opponent_slug=event.get("opponent_slug"),
        parent_agent_name=parent.get("agent_name"),
        thread_tone=event.get("thread_tone"),
    )
    triggers: list[str] = []
    if event.get("thread_tone") == "calm":
        triggers.append("thread_tone=calm")
    if adversarial and has_explicit_opposition(copy):
        for phrase in ("wrong", "missed", "not pricing", "assuming", "against", "disagrees", "lags", "late"):
            if phrase in copy:
                triggers.append(f"explicit_opposition:{phrase}")
                break
    elif adversarial:
        triggers.append("named_rival_with_counter_cue")

    return {"is_adversarial": adversarial, "triggers": triggers, "copy_snippet": copy[:120]}


def explain_thread_block_label(events: list[dict[str, Any]]) -> tuple[str, str]:
    label = resolve_thread_block_label(events)

    if any(
        event.get("activity_type") in {"receipt_reaction", "receipt_victory"}
        or event.get("type") in ("receipt", "verified_call")
        for event in events
    ):
        return label, "receipt_activity"

    heated = _is_heated_thread(events)
    heated_events = [e for e in events if _thread_tone(e) == "heated"]
    if not heated and any(event.get("narrative_stage") for event in events):
        stages = sorted({str(e.get("narrative_stage")) for e in events if e.get("narrative_stage")})
        return label, f"narrative_stage:{','.join(stages)}"

    if heated:
        ids = [e.get("generated_activity_id") for e in heated_events]
        return label, f"thread_tone=heated on {ids}"

    adversarial = [
        (e.get("generated_activity_id"), _adversarial_detail(e))
        for e in events
        if e.get("activity_type") in RIVAL_ACTIVITY_TYPES
    ]
    active = [(gid, detail) for gid, detail in adversarial if detail.get("is_adversarial")]
    if active:
        gid, detail = active[0]
        trigger = detail["triggers"][0] if detail.get("triggers") else "unknown"
        return label, f"adversarial_{e.get('activity_type') if (e := next(x for x in events if x.get('generated_activity_id') == gid)) else 'rival'}:{trigger}"

    rival_types = [e.get("activity_type") for e in events if e.get("activity_type") in RIVAL_ACTIVITY_TYPES]
    if rival_types and label != "Public Clash":
        return label, f"rival_types_present_but_not_adversarial:{','.join(sorted(set(str(t) for t in rival_types)))}"

    calm_tones = [e.get("generated_activity_id") for e in events if _thread_tone(e) == "calm"]
    if calm_tones:
        return label, f"thread_tone=calm on {calm_tones}"

    if label == "Narrative Shift":
        return label, "narrative_metadata_or_event_type"
    if label == "Market Read":
        return label, "market_read_metadata"
    return label, "default_desk_note"


def _thread_tone_summary(events: list[dict[str, Any]]) -> str | None:
    tones = sorted({str(_thread_tone(e)) for e in events if _thread_tone(e)})
    if not tones:
        return None
    return ",".join(tones)


def audit(limit: int = 50, sample: int = 20) -> dict[str, Any]:
    db = SessionLocal()
    try:
        migrate_schema()
        payloads = sort_feed_by_thread_block_time_desc(
            build_personalized_feed(db, None, chip="latest", limit=limit)["events"]
        )
        stream_items = [
            {"type": "event", "event": payload, "index": index}
            for index, payload in enumerate(payloads)
        ]
        groups = group_conversation_display_payloads(stream_items)
        stats = compute_feed_thread_display_stats(groups)

        thread_groups = [g for g in groups if g.get("kind") == "thread"]
        thread_groups.sort(
            key=lambda g: max(
                _feed_sort_timestamp(item["event"])
                for item in g.get("items") or []
                if item.get("type") == "event" and item.get("event")
            ),
            reverse=True,
        )

        rows: list[dict[str, Any]] = []
        heated_count = 0
        calm_count = 0

        for group in thread_groups[:sample]:
            events = [
                item["event"]
                for item in group.get("items") or []
                if item.get("type") == "event" and item.get("event")
            ]
            label, reason = explain_thread_block_label(events)
            tone = _thread_tone_summary(events)
            if tone and "heated" in tone:
                heated_count += 1
            elif tone and "calm" in tone:
                calm_count += 1

            rows.append(
                {
                    "thread_id": group.get("thread_id"),
                    "label_selected": label,
                    "thread_tone": tone,
                    "contains_rival_reply": any(
                        e.get("activity_type") == "rival_reply" for e in events
                    ),
                    "contains_battle_response": any(
                        e.get("activity_type") == "battle_response" for e in events
                    ),
                    "contains_narrative_stage": any(e.get("narrative_stage") for e in events),
                    "selected_label_reason": reason,
                    "event_count": len(events),
                    "activity_types": sorted(
                        {str(e.get("activity_type")) for e in events if e.get("activity_type")}
                    ),
                    "adversarial_events": [
                        {
                            "generated_activity_id": e.get("generated_activity_id"),
                            "activity_type": e.get("activity_type"),
                            **_adversarial_detail(e),
                        }
                        for e in events
                        if e.get("activity_type") in RIVAL_ACTIVITY_TYPES
                    ],
                }
            )

        total = len(thread_groups)
        return {
            "visible_thread_label_counts": stats.get("visible_thread_label_counts"),
            "thread_blocks_rendered_ui": stats.get("thread_blocks_rendered_ui"),
            "heated_thread_count": heated_count,
            "calm_thread_count": calm_count,
            "neutral_thread_count": min(sample, total) - heated_count - calm_count,
            "heated_thread_percentage": round(100 * heated_count / min(sample, total), 1)
            if total
            else 0.0,
            "sample_size": min(sample, total),
            "threads": rows,
        }
    finally:
        db.close()


if __name__ == "__main__":
    print(json.dumps(audit(), indent=2, default=str))
