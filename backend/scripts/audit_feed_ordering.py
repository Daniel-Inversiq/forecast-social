"""Snapshot first N feed items for ordering audit."""
from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.database import SessionLocal
from app.forecasting.services.feed_debug import build_feed_debug_report
from app.forecasting.services.feed_intelligence import build_personalized_feed
from app.forecasting.services.feed_variety import resolve_card_kind


def age_label(ts: str | None) -> str:
    if not ts:
        return "?"
    try:
        dt = datetime.fromisoformat(str(ts).replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        secs = (datetime.now(timezone.utc) - dt).total_seconds()
        if secs < 120:
            return f"{int(secs)}s"
        if secs < 7200:
            return f"{int(secs / 60)}m"
        if secs < 172800:
            return f"{int(secs / 3600)}h"
        return f"{int(secs / 86400)}d"
    except ValueError:
        return "?"


def bucket_score(payload: dict, kind: str) -> float:
    score = float(payload.get("feed_score") or 0)
    if payload.get("following_agent"):
        score += 12
    if payload.get("anchor_agent"):
        score += 8
    if kind == "receipt":
        score += 10
    if kind == "failed_call":
        score += 6
    if kind == "network_event" and float(payload.get("reputation_delta") or 0) > 0:
        score += 5
    if kind == "open_battle":
        score -= 4
    return round(score, 2)


def infer_order_reason(payload: dict, rank: int, prev_ts: str | None) -> str:
    ts = payload.get("feed_published_at") or payload.get("created_at")
    kind = payload.get("card_kind") or resolve_card_kind(payload)
    reasons = list(payload.get("rank_reasons") or [])
    parts: list[str] = []

    if payload.get("id") is None or str(payload.get("type", "")).startswith("season"):
        parts.append("synthetic_injection")
    if payload.get("milestone"):
        parts.append("milestone_injection")
    if payload.get("status_moment"):
        parts.append("status_moment_injection")

    if kind == "open_battle":
        parts.append("variety_slot:open_battle")
    elif kind == "receipt":
        parts.append("variety_slot:receipt")
    elif kind == "network_event":
        parts.append("variety_slot:network_event")
    else:
        parts.append("variety_slot:agent_post")

    if prev_ts and ts and ts > prev_ts:
        parts.append("chrono_inversion_vs_above")

    if reasons:
        parts.append(f"rank_hint:{reasons[0][:60]}")
    else:
        parts.append("rank_hint:none")

    return " | ".join(parts)


def main() -> None:
    limit = 30
    db = SessionLocal()
    try:
        report = build_feed_debug_report(db, None, chip=None, limit=limit)
        feed = build_personalized_feed(db, None, chip=None, limit=limit)
        payloads = feed["events"][:limit]

        stage_deltas = report.get("stage_position_deltas") or {}
        rows = []
        prev_ts = None
        for rank, payload in enumerate(payloads, 1):
            ts = payload.get("feed_published_at") or payload.get("created_at")
            kind = payload.get("card_kind") or resolve_card_kind(payload)
            eid = payload.get("id")
            delta = stage_deltas.get(str(eid), {}) if eid is not None else {}

            row = {
                "rank": rank,
                "id": eid,
                "timestamp": ts,
                "age": age_label(ts),
                "feed_score": payload.get("feed_score"),
                "thread_score": None,
                "receipt_score": bucket_score(payload, "receipt") if kind == "receipt" else None,
                "battle_score": (
                    float(payload.get("disagreement_spread") or 0)
                    if kind == "open_battle"
                    else None
                ),
                "card_kind": kind,
                "type": payload.get("type"),
                "thread_id": payload.get("thread_id"),
                "stage_after_rank": delta.get("after_payload"),
                "stage_after_arc": delta.get("after_arc_coherence"),
                "stage_after_variety": delta.get("after_variety_mix"),
                "stage_after_liveness": delta.get("after_liveness"),
                "stage_final": delta.get("final"),
                "final_order_reason": infer_order_reason(payload, rank, prev_ts),
            }
            rows.append(row)
            prev_ts = ts

        out = {
            "feed_mode": report.get("feed_mode"),
            "ranking_mode": report.get("ranking_mode"),
            "chronology_violation_count": report.get("chronology_violation_count"),
            "for_you_intentionally_ranked": report.get("for_you_intentionally_ranked"),
            "items": rows,
            "after_rank_top10": (report.get("after_rank") or [])[:10],
        }
        print(json.dumps(out, indent=2))
    finally:
        db.close()


if __name__ == "__main__":
    main()
