"""Audit feed inventory mix for first N visible For You items."""
from __future__ import annotations

import json
import sys
from collections import Counter
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.database import SessionLocal
from app.forecasting.services.agent_activity_engine import activity_to_dict, list_generated_activity
from app.forecasting.services.feed_intelligence import build_personalized_feed
from app.forecasting.services.feed_variety import resolve_card_kind

INVENTORY_TYPES = (
    "agent_post",
    "receipt",
    "battle",
    "rivalry_reply",
    "conviction_update",
    "synthetic_milestone",
    "season_arc",
    "status_card",
    "ranking_injection",
    "network_briefing",
    "other",
)

AGENT_POST_TYPES = frozenset(
    {
        "new_take",
        "position_update",
        "stance_followup",
        "quiet_pulse",
        "market_move",
        "signal_shift",
        "market_position_update",
    }
)

SEASON_TYPES = frozenset({"season_shift", "season_lead", "season_arc", "season_collapse"})

RANKING_TYPES = frozenset({"leaderboard_move", "reputation_move", "calibration_jump"})

RECEIPT_TYPES = frozenset({"receipt", "verified_call"})

BATTLE_TYPES = frozenset({"rivalry", "battle_escalation"})

SYNTHETIC_INVENTORY = frozenset(
    {
        "synthetic_milestone",
        "season_arc",
        "status_card",
        "ranking_injection",
        "network_briefing",
    }
)

RECEIPT_RELATED = frozenset({"receipt"})

RIVALRY_RELATED = frozenset({"battle", "rivalry_reply"})


def classify_inventory_item(item: dict[str, Any]) -> str:
    """Mutually exclusive primary bucket (most specific wins)."""
    event_type = str(item.get("type") or "")
    activity_type = str(item.get("activity_type") or "")
    item_id = item.get("id")

    if item.get("status_moment") or event_type == "public_status" or (
        isinstance(item_id, str) and str(item_id).startswith("status")
    ):
        return "status_card"

    if event_type == "milestone_unlock" or item.get("milestone"):
        return "synthetic_milestone"

    if event_type in SEASON_TYPES or item.get("season_slug") or item.get("season_title"):
        return "season_arc"

    if activity_type == "network_briefing_item":
        return "network_briefing"

    if activity_type == "rival_reply":
        return "rivalry_reply"

    if activity_type == "conviction_update":
        return "conviction_update"

    if activity_type in ("receipt_reaction", "receipt_victory") or event_type in RECEIPT_TYPES:
        return "receipt"

    if (
        activity_type in ("battle_response", "receipt_challenge")
        or event_type in BATTLE_TYPES
    ):
        return "battle"

    if event_type in RANKING_TYPES or activity_type == "network_pulse":
        return "ranking_injection"

    if (
        activity_type == "agent_post"
        or event_type in AGENT_POST_TYPES
        or event_type == "confidence_shift"
    ):
        return "agent_post"

    kind = item.get("card_kind") or resolve_card_kind(item)
    if kind == "receipt":
        return "receipt"
    if kind == "open_battle":
        return "battle"
    if kind == "network_event":
        return "ranking_injection"

    return "other"


def is_synthetic_item(item: dict[str, Any], bucket: str) -> bool:
    """System-injected cards — not autonomous agent voice activity."""
    if bucket in SYNTHETIC_INVENTORY:
        return True
    item_id = item.get("id")
    if isinstance(item_id, int) and item_id < 0:
        return True
    if item_id is None and bucket in ("synthetic_milestone", "status_card", "season_arc"):
        return True
    return False


def map_generated_to_feed_shape(row: dict[str, Any]) -> dict[str, Any]:
    """Minimal feed-event shape for classification."""
    activity_type = row.get("activity_type") or ""
    type_map = {
        "agent_post": "new_take",
        "conviction_update": "confidence_shift",
        "battle_response": "rivalry",
        "rival_reply": "rivalry",
        "receipt_reaction": "receipt",
        "receipt_challenge": "rivalry",
        "receipt_victory": "receipt",
        "market_position_update": "stance_followup",
        "network_pulse": "reputation_move",
        "network_briefing_item": "narrative_acceleration",
    }
    mirrored = row.get("mirrored_feed_event_id")
    return {
        "id": mirrored if mirrored is not None else None,
        "generated_activity_id": row.get("activity_id"),
        "activity_type": activity_type,
        "type": type_map.get(activity_type, "new_take"),
        "title": row.get("title"),
        "is_generated_activity": True,
        "created_at": row.get("created_at"),
        "feed_published_at": row.get("created_at"),
    }


def merge_generated(main: list[dict], generated: list[dict]) -> list[dict]:
    """Mirror frontend mergeGeneratedIntoFeed (For You path, simplified)."""
    by_mirrored: dict[int, dict] = {}
    mapped: list[dict] = []
    for row in generated:
        if row.get("activity_type") == "network_briefing_item":
            continue
        shaped = map_generated_to_feed_shape(row)
        if shaped.get("id") is not None:
            by_mirrored[int(shaped["id"])] = row
        mapped.append({**shaped, **{k: v for k, v in row.items() if k not in shaped}})

    main_ids = {p["id"] for p in main if p.get("id") is not None}
    enriched = []
    for item in main:
        mid = item.get("id")
        mid_int: int | None = None
        if isinstance(mid, int):
            mid_int = mid
        elif isinstance(mid, str) and mid.lstrip("-").isdigit():
            mid_int = int(mid)
        if mid_int is not None and mid_int in by_mirrored:
            src = by_mirrored[mid_int]
            patch = map_generated_to_feed_shape(src)
            enriched.append({**item, **patch, "is_generated_activity": True})
        else:
            enriched.append(item)

    additions = [
        m
        for m in mapped
        if not (m.get("id") is not None and m["id"] in main_ids)
        and m.get("generated_activity_id")
        not in {e.get("generated_activity_id") for e in enriched if e.get("generated_activity_id")}
    ]

    merged = additions + enriched
    seen_keys: set[str] = set()
    seen_gen: set[str] = set()
    deduped: list[dict] = []
    for item in merged:
        eid = item.get("id")
        gid = item.get("generated_activity_id")
        id_key = f"id:{eid}" if eid is not None else None
        if id_key and id_key in seen_keys:
            continue
        if gid and gid in seen_gen:
            continue
        if id_key:
            seen_keys.add(id_key)
        if gid:
            seen_gen.add(str(gid))
        deduped.append(item)

    def publish_ts(p: dict) -> str:
        return str(p.get("feed_published_at") or p.get("created_at") or "")

    return sorted(deduped, key=publish_ts, reverse=True)


def summarize(items: list[dict], label: str) -> dict[str, Any]:
    buckets = [classify_inventory_item(i) for i in items]
    counts = Counter(buckets)
    n = len(items) or 1
    synthetic = sum(1 for i, b in zip(items, buckets) if is_synthetic_item(i, b))
    receipt_related = sum(
        1
        for i, b in zip(items, buckets)
        if b in RECEIPT_RELATED
        or str(i.get("activity_type") or "") in ("receipt_reaction", "receipt_victory")
    )
    rivalry_related = sum(1 for b in buckets if b in RIVALRY_RELATED)

    agent_activity = n - synthetic

    return {
        "pipeline": label,
        "sample_size": len(items),
        "counts": {k: counts.get(k, 0) for k in INVENTORY_TYPES if counts.get(k, 0)},
        "percentages": {
            k: round(100.0 * counts.get(k, 0) / n, 1) for k in INVENTORY_TYPES if counts.get(k, 0)
        },
        "synthetic_count": synthetic,
        "synthetic_pct": round(100.0 * synthetic / n, 1),
        "agent_activity_count": agent_activity,
        "agent_activity_pct": round(100.0 * agent_activity / n, 1),
        "receipt_related_pct": round(100.0 * receipt_related / n, 1),
        "rivalry_related_pct": round(100.0 * rivalry_related / n, 1),
        "items_sample": [
            {
                "rank": idx + 1,
                "bucket": b,
                "type": items[idx].get("type"),
                "activity_type": items[idx].get("activity_type"),
                "id": items[idx].get("id"),
                "synthetic": is_synthetic_item(items[idx], b),
                "title": (items[idx].get("title") or "")[:70],
            }
            for idx, b in enumerate(buckets)
        ],
    }


def main() -> None:
    limit = 100
    db = SessionLocal()
    try:
        feed = build_personalized_feed(db, None, chip=None, limit=limit)
        backend_items = feed["events"][:limit]

        gen_rows = list_generated_activity(db, limit=limit)
        merged_items = merge_generated(backend_items, gen_rows)[:limit]

        report = {
            "audit_date": "2026-06-12",
            "chip": "for_you",
            "requested_sample": limit,
            "frontend_initial_render_cap": 50,
            "note": (
                "Backend API order (variety-mixed). Merged view re-sorts chronologically "
                "like frontend mergeGeneratedIntoFeed before client variety mix."
            ),
            "classification_rules": {
                "agent_post": "agent_post activity, new_take, stance_followup, market/signal moves",
                "receipt": "receipt/verified_call, receipt_reaction, receipt_victory",
                "battle": "rivalry/battle_escalation, battle_response, receipt_challenge",
                "rivalry_reply": "activity_type rival_reply",
                "conviction_update": "activity_type conviction_update",
                "synthetic_milestone": "milestone_unlock or milestone payload",
                "season_arc": "season_* types or season_slug",
                "status_card": "public_status or status_moment",
                "ranking_injection": "leaderboard/reputation/calibration moves, network_pulse",
                "network_briefing": "network_briefing_item (excluded from home merge)",
            },
            "backend_api_final": summarize(backend_items, "backend_build_personalized_feed"),
            "after_generated_merge": summarize(merged_items, "backend_plus_generated_merge"),
        }
        print(json.dumps(report, indent=2))
    finally:
        db.close()


if __name__ == "__main__":
    main()
