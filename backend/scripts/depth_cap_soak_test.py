"""30-minute autonomous soak for MAX_THREAD_DEPTH experiment."""

from __future__ import annotations

import json
import random
import sys
import time
from collections import Counter
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.database import SessionLocal
from app.forecasting.migrate import migrate_schema
from app.forecasting.models import AgentGeneratedActivity
from app.forecasting.services.autonomous_network_engine import (
    MAX_CADENCE_SECONDS,
    MIN_CADENCE_SECONDS,
    execute_network_tick,
    get_network_status,
)
from app.forecasting.services.conversation_threads import MAX_THREAD_DEPTH
from app.forecasting.services.thread_continuation_policy import _is_autonomous_row

BASELINE = {
    "max_thread_depth": 3,
    "network_heat": 56,
    "lifecycle_active_threads": 2,
    "average_thread_depth": 3.25,
    "thread_continuation_rate": 0.66,
    "replies_with_parent_rate": 1.0,
    "thread_blocks_rendered_ui": 22,
}

DURATION_SECONDS = 30 * 60


def _repetition_stats(db) -> dict[str, int | float]:
    cutoff = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(minutes=30)
    rows = (
        db.query(AgentGeneratedActivity)
        .filter(AgentGeneratedActivity.created_at >= cutoff)
        .all()
    )
    autonomous = [r for r in rows if _is_autonomous_row(r)]
    bodies = [((r.body or "").strip().lower()[:120]) for r in autonomous if r.body]
    titles = [((r.title or "").strip().lower()[:80]) for r in autonomous if r.title]
    body_dupes = sum(1 for _, count in Counter(bodies).items() if count > 1)
    title_dupes = sum(1 for _, count in Counter(titles).items() if count > 1)
    return {
        "autonomous_posts_last_30m": len(autonomous),
        "duplicate_body_phrases": body_dupes,
        "duplicate_title_phrases": title_dupes,
        "repetition_rate": round(body_dupes / max(len(bodies), 1), 3),
    }


def _snapshot(db) -> dict:
    status = get_network_status(db)
    rep = _repetition_stats(db)
    return {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "max_thread_depth_config": MAX_THREAD_DEPTH,
        "network_heat": status.get("network_heat"),
        "lifecycle_active_threads": status.get("lifecycle_active_threads"),
        "average_thread_depth": status.get("average_thread_depth"),
        "thread_continuation_rate": status.get("thread_continuation_rate"),
        "replies_with_parent_rate": status.get("replies_with_parent_rate"),
        "thread_blocks_rendered_ui": status.get("thread_blocks_rendered_ui"),
        "thread_blocks_rendered": status.get("thread_blocks_rendered"),
        "new_root_post_rate": status.get("new_root_post_rate"),
        "phrase_fatigue_hits": status.get("phrase_fatigue_hits"),
        "max_thread_depth": status.get("max_thread_depth"),
        "threads_at_depth_3": status.get("threads_at_depth_3"),
        "threads_at_depth_4": status.get("threads_at_depth_4"),
        "threads_at_depth_5": status.get("threads_at_depth_5"),
        "closed_by_depth_last_24h": status.get("closed_by_depth_last_24h"),
        "closed_by_agent_limit_last_24h": status.get("closed_by_agent_limit_last_24h"),
        **rep,
    }


def main() -> None:
    migrate_schema()
    db = SessionLocal()
    seed = int(time.time()) % 1_000_000
    start = time.monotonic()
    deadline = start + DURATION_SECONDS
    tick_count = 0
    activities_created = 0

    try:
        before = _snapshot(db)
        print("=== DEPTH CAP SOAK: baseline (depth=3 reference) ===", flush=True)
        print(json.dumps(BASELINE, indent=2), flush=True)
        print("\n=== START SNAPSHOT ===", flush=True)
        print(json.dumps(before, indent=2), flush=True)

        while time.monotonic() < deadline:
            result = execute_network_tick(db, seed=seed + tick_count, mirror_to_feed=True)
            tick_count += 1
            activities_created += len(result.activities_created)
            delay = random.randint(MIN_CADENCE_SECONDS, MAX_CADENCE_SECONDS)
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                break
            time.sleep(min(delay, remaining))

        after = _snapshot(db)
        elapsed_min = round((time.monotonic() - start) / 60, 1)

        comparison = {
            "elapsed_minutes": elapsed_min,
            "ticks_executed": tick_count,
            "activities_created": activities_created,
            "baseline_depth_3": BASELINE,
            "start": before,
            "end": after,
            "delta_vs_baseline": {
                k: round((after.get(k) or 0) - (BASELINE.get(k) or 0), 3)
                if isinstance(BASELINE.get(k), (int, float))
                else None
                for k in BASELINE
            },
            "delta_start_to_end": {
                k: round((after.get(k) or 0) - (before.get(k) or 0), 3)
                if isinstance(before.get(k), (int, float))
                else None
                for k in before
                if k not in ("timestamp", "max_thread_depth_config")
            },
        }

        print("\n=== END SNAPSHOT ===", flush=True)
        print(json.dumps(after, indent=2), flush=True)
        print("\n=== COMPARISON ===", flush=True)
        print(json.dumps(comparison, indent=2), flush=True)

        out = Path(__file__).with_name("depth_cap_soak_results.json")
        out.write_text(json.dumps(comparison, indent=2), encoding="utf-8")
        print(f"\nWrote {out}", flush=True)
    finally:
        db.close()


if __name__ == "__main__":
    main()
