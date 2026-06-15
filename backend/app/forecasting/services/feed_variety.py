"""Feed variety mix — cap open battles and surface receipts / network proof."""

from __future__ import annotations

from collections import deque
from typing import Any

OPEN_BATTLE_MAX_SHARE = 0.40

OPEN_BATTLE_TYPES = frozenset({"rivalry", "battle_escalation"})
RECEIPT_TYPES = frozenset({"receipt", "verified_call"})
FAILED_TYPES = frozenset({"failed_high_conviction_call"})
AGENT_POST_TYPES = frozenset({
    "new_take",
    "position_update",
    "stance_followup",
    "quiet_pulse",
    "confidence_shift",
    "market_move",
    "signal_shift",
})
NETWORK_EVENT_TYPES = frozenset({
    "leaderboard_move",
    "reputation_move",
    "milestone_unlock",
    "consensus_shift",
    "narrative_acceleration",
    "calibration_jump",
    "season_shift",
    "season_lead",
    "season_arc",
    "season_collapse",
})

SLOT_CYCLE = (
    "agent_post",
    "open_battle",
    "agent_post",
    "open_battle",
    "receipt",
    "network_event",
    "agent_post",
    "open_battle",
    "agent_post",
    "open_battle",
)


def resolve_card_kind(payload: dict[str, Any]) -> str:
    existing = payload.get("card_kind")
    if existing:
        return str(existing)

    event_type = str(payload.get("type") or "")
    if event_type in FAILED_TYPES:
        return "failed_call"
    if event_type in RECEIPT_TYPES:
        delta = float(payload.get("reputation_delta") or 0)
        if delta < 0 or payload.get("failed_call_memory"):
            return "failed_call"
        return "receipt"
    if event_type in OPEN_BATTLE_TYPES:
        return "open_battle"
    if event_type in NETWORK_EVENT_TYPES:
        return "network_event"
    if event_type in AGENT_POST_TYPES:
        return "agent_post"
    if int(payload.get("disagreement_spread") or 0) >= 28 and payload.get("opponent_name"):
        return "open_battle"
    return "agent_post"


def _dedupe_key(payload: dict[str, Any]) -> str:
    eid = payload.get("id")
    if eid is not None:
        return f"id:{eid}"
    agent = payload.get("agent") or {}
    slug = agent.get("slug", "")
    return f"{slug}-{payload.get('created_at')}-{payload.get('title')}"


def _score(payload: dict[str, Any], kind: str) -> float:
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
    return score


def apply_feed_variety_mix(payloads: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Reorder ranked feed: agent-network rhythm — 40% posts, 40% rivalries."""
    if len(payloads) < 4:
        for p in payloads:
            p["card_kind"] = resolve_card_kind(p)
        return payloads

    buckets: dict[str, deque[dict[str, Any]]] = {
        "open_battle": deque(),
        "receipt": deque(),
        "failed_call": deque(),
        "agent_post": deque(),
        "network_event": deque(),
    }

    for raw in payloads:
        p = dict(raw)
        kind = resolve_card_kind(p)
        p["card_kind"] = kind
        buckets[kind].append(p)

    for kind in buckets:
        sorted_items = sorted(buckets[kind], key=lambda p: _score(p, kind), reverse=True)
        buckets[kind] = deque(sorted_items)

    max_battles = max(1, int(len(payloads) * OPEN_BATTLE_MAX_SHARE))
    battle_count = 0
    result: list[dict[str, Any]] = []
    used: set[str] = set()
    slot = 0
    guard = 0

    def pull(kind: str) -> dict[str, Any] | None:
        bucket = buckets.get(kind)
        if not bucket:
            return None
        return bucket.popleft()

    while len(result) < len(payloads) and guard < len(payloads) * 4:
        guard += 1
        kind = SLOT_CYCLE[slot % len(SLOT_CYCLE)]
        slot += 1

        if kind == "open_battle" and battle_count >= max_battles:
            for alt in ("receipt", "network_event", "agent_post", "failed_call"):
                if buckets[alt]:
                    kind = alt
                    break

        candidate = pull(kind)
        if candidate is None and kind == "open_battle":
            for alt in ("receipt", "network_event", "agent_post"):
                candidate = pull(alt)
                if candidate:
                    break

        if candidate is None:
            for alt in SLOT_CYCLE:
                if alt == "open_battle" and battle_count >= max_battles:
                    continue
                candidate = pull(alt)
                if candidate:
                    break

        if candidate is None:
            break

        key = _dedupe_key(candidate)
        if key in used:
            continue

        ckind = str(candidate.get("card_kind") or "")
        if ckind == "open_battle":
            if battle_count >= max_battles:
                buckets["open_battle"].appendleft(candidate)
                continue
            battle_count += 1

        used.add(key)
        result.append(candidate)

    tail: list[dict[str, Any]] = []
    for kind, bucket in buckets.items():
        while bucket:
            item = bucket.popleft()
            key = _dedupe_key(item)
            if key in used:
                continue
            if kind == "open_battle" and battle_count >= max_battles:
                tail.append(item)
                used.add(key)
                continue
            if kind == "open_battle":
                battle_count += 1
            used.add(key)
            result.append(item)

    for item in tail:
        result.append(item)

    if len(result) < len(payloads):
        for raw in payloads:
            key = _dedupe_key(raw)
            if key not in used:
                p = dict(raw)
                p["card_kind"] = resolve_card_kind(p)
                result.append(p)

    if not result:
        for p in payloads:
            p["card_kind"] = resolve_card_kind(p)
        return payloads

    return result
