"""Server-sent events for live feed, pulse, and network motion."""

from __future__ import annotations

import asyncio
import json
import random
from collections import deque
from datetime import datetime, timezone
from collections.abc import Awaitable, Callable
from typing import AsyncIterator

MAX_SEEN_FEED_IDS = 400
MAX_SEEN_BATTLE_IDS = 120
MAX_SEEN_REP_SLUGS = 120

from sqlalchemy.orm import Session

from app.forecasting.models import FeedEvent, User
from app.forecasting.services.feed_intelligence import build_personalized_feed


def _sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data, default=str)}\n\n"


def _lightweight_payload(full: dict) -> dict:
    agent = full.get("agent") or {}
    return {
        "title": full.get("title"),
        "body": full.get("body"),
        "probability": full.get("probability"),
        "confidence": full.get("confidence"),
        "market_title": full.get("market_title"),
        "movement_delta": full.get("movement_delta"),
        "disagreement_spread": full.get("disagreement_spread"),
        "reputation_delta": full.get("reputation_delta"),
        "live": full.get("live"),
        "intelligence_tags": full.get("intelligence_tags"),
        "continuity_label": full.get("continuity_label"),
        "arc_progression": full.get("arc_progression"),
        "market_narrative_state": full.get("market_narrative_state"),
        "action_state": full.get("action_state"),
        "action_state_label": full.get("action_state_label"),
        "agent": {
            "name": agent.get("name"),
            "slug": agent.get("slug"),
            "avatar_color": agent.get("avatar_color"),
            "tier_label": agent.get("tier_label"),
        },
    }


def _feed_stream_message(event_id: int, full: dict) -> dict:
    agent = full.get("agent") or {}
    return {
        "id": event_id,
        "type": full.get("type"),
        "created_at": full.get("created_at"),
        "payload": _lightweight_payload(full),
        "reputation_movement": full.get("reputation_delta"),
        "market_slug": full.get("market_slug"),
        "agent_slug": agent.get("slug"),
        "event": full,
    }


def _payload_by_id(db: Session, user: User | None, chip: str | None) -> dict[int, dict]:
    result = build_personalized_feed(db, user, chip=chip, limit=80)
    return {e["id"]: e for e in result["events"] if e.get("id") is not None}


def _load_newest_unseen_ids(db: Session, seen_feed: set[int], limit: int = 50) -> list[int]:
    """Newest DB rows first — avoids re-streaming the ranked top card."""
    rows = (
        db.query(FeedEvent.id)
        .order_by(FeedEvent.id.desc())
        .limit(limit * 2)
        .all()
    )
    out: list[int] = []
    for (eid,) in rows:
        if eid in seen_feed:
            continue
        out.append(eid)
        if len(out) >= limit:
            break
    return out


def _load_stream_snapshot(db, user: User | None, chip: str | None, seen_feed: set[int]) -> dict:
    result = build_personalized_feed(db, user, chip=chip, limit=80)
    payloads = _payload_by_id(db, user, chip)
    newest_ids = _load_newest_unseen_ids(db, seen_feed)
    meta = result["meta"]
    return {
        "payloads": payloads,
        "newest_ids": newest_ids,
        "meta": meta,
        "pulse": {
            "live_count": meta.get("live_count"),
            "pulse_headlines": meta.get("pulse_headlines", []),
            "narrative_labels": meta.get("narrative_labels", []),
        },
        "battles": meta.get("battles") or [],
        "reputation_movements": meta.get("reputation_movements") or [],
    }


def _trim_seen_set(seen: set, max_size: int) -> None:
    if len(seen) <= max_size:
        return
    drop = len(seen) - max_size
    for _ in range(drop):
        seen.pop()


async def feed_event_generator(
    db_factory,
    user: User | None,
    chip: str | None = None,
    is_disconnected: Callable[[], Awaitable[bool]] | None = None,
) -> AsyncIterator[str]:
    """Natural-paced SSE: quiet stretches, occasional bursts, heartbeats."""
    seen_feed: set[int] = set()
    seen_battle: set[str] = set()
    seen_rep: set[str] = set()
    event_queue: deque[int] = deque()
    payloads: dict[int, dict] = {}
    battle_queue: deque[dict] = deque()
    rep_queue: deque[dict] = deque()
    last_refresh = 0.0
    last_heartbeat = asyncio.get_event_loop().time()
    heartbeat_interval = random.uniform(18, 26)

    yield _sse("connected", {"ts": datetime.now(timezone.utc).isoformat(), "chip": chip or "for_you"})

    while True:
        if is_disconnected is not None and await is_disconnected():
            break

        loop = asyncio.get_event_loop()
        now = loop.time()

        if now - last_heartbeat >= heartbeat_interval:
            yield _sse("heartbeat", {"ts": datetime.now(timezone.utc).isoformat()})
            last_heartbeat = now
            heartbeat_interval = random.uniform(15, 28)

        if now - last_refresh > random.uniform(45, 90) or not event_queue:
            db = db_factory()
            try:
                snap = _load_stream_snapshot(db, user, chip, seen_feed)
            finally:
                db.close()

            last_refresh = now
            payloads.update(snap["payloads"])
            fresh_ids = [i for i in snap["newest_ids"] if i not in seen_feed]
            random.shuffle(fresh_ids)
            event_queue.extend(fresh_ids)

            for b in snap["battles"]:
                bid = b.get("id") or f"{b.get('agent_a', {}).get('slug')}-{b.get('agent_b', {}).get('slug')}"
                if bid not in seen_battle:
                    battle_queue.append(b)
            for m in snap["reputation_movements"]:
                slug = (m.get("agent") or {}).get("slug", "")
                if slug and slug not in seen_rep:
                    rep_queue.append(m)

            yield _sse(
                "pulse",
                {
                    "live_count": snap["pulse"]["live_count"],
                    "pulse_headlines": snap["pulse"]["pulse_headlines"][:6],
                    "narrative_labels": snap["pulse"]["narrative_labels"][:8],
                },
            )

        burst = 1
        roll = random.random()
        if roll < 0.12 and event_queue:
            burst = random.randint(2, min(4, len(event_queue)))
        elif roll < 0.35:
            await asyncio.sleep(random.uniform(8, 22))
            continue

        emitted = 0
        while emitted < burst:
            if not event_queue and not battle_queue and not rep_queue:
                break

            kind_roll = random.random()
            if kind_roll < 0.55 and event_queue:
                eid = event_queue.popleft()
                if eid in seen_feed:
                    continue
                full = payloads.get(eid)
                if not full:
                    continue
                seen_feed.add(eid)
                _trim_seen_set(seen_feed, MAX_SEEN_FEED_IDS)
                msg = _feed_stream_message(eid, full)
                event_name = full.get("type", "feed_event")
                if event_name in ("battle_escalation", "rivalry"):
                    yield _sse("battle_escalation", msg)
                elif event_name in ("receipt", "verified_call"):
                    yield _sse("verified_call", msg)
                else:
                    yield _sse("feed_event", msg)
                emitted += 1
            elif kind_roll < 0.72 and battle_queue:
                battle = battle_queue.popleft()
                bid = battle.get("id") or str(len(seen_battle))
                if bid in seen_battle:
                    continue
                seen_battle.add(bid)
                _trim_seen_set(seen_battle, MAX_SEEN_BATTLE_IDS)
                yield _sse(
                    "battle_escalation",
                    {
                        "id": bid,
                        "type": "battle_escalation",
                        "created_at": datetime.now(timezone.utc).isoformat(),
                        "battle": battle,
                        "market_slug": battle.get("market_slug"),
                        "agent_slug": battle.get("agent_a", {}).get("slug"),
                    },
                )
                emitted += 1
            elif rep_queue:
                move = rep_queue.popleft()
                slug = (move.get("agent") or {}).get("slug", "")
                if slug in seen_rep:
                    continue
                seen_rep.add(slug)
                _trim_seen_set(seen_rep, MAX_SEEN_REP_SLUGS)
                yield _sse(
                    "reputation_movement",
                    {
                        "id": f"rep-{slug}",
                        "type": "reputation_movement",
                        "created_at": datetime.now(timezone.utc).isoformat(),
                        "movement": move,
                        "reputation_movement": move.get("reputation_delta"),
                        "agent_slug": slug,
                        "market_slug": None,
                    },
                )
                emitted += 1
            elif event_queue:
                eid = event_queue.popleft()
                if eid in seen_feed:
                    continue
                full = payloads.get(eid)
                if not full:
                    continue
                seen_feed.add(eid)
                _trim_seen_set(seen_feed, MAX_SEEN_FEED_IDS)
                yield _sse("feed_event", _feed_stream_message(eid, full))
                emitted += 1
            else:
                break

        if emitted == 0:
            await asyncio.sleep(random.uniform(6, 18))
        elif burst > 1 and emitted > 1:
            await asyncio.sleep(random.uniform(0.25, 0.9))
        else:
            await asyncio.sleep(random.uniform(3.5, 14))
