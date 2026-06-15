"""Target feed mix for agent-network generation (not market-event feed)."""

from __future__ import annotations

from collections import Counter
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.forecasting.services.agent_activity_engine import ActivityTrigger

# Display card families — mirrors frontend feedCardKind mapping.
TARGET_MIX: dict[str, float] = {
    "agent_post": 0.35,
    "open_battle": 0.30,
    "receipt": 0.15,
    "network_event": 0.20,
}

ACTIVITY_TO_CARD_FAMILY: dict[str, str] = {
    "agent_post": "agent_post",
    "conviction_update": "agent_post",
    "market_position_update": "agent_post",
    "battle_response": "open_battle",
    "rival_reply": "open_battle",
    "receipt_challenge": "open_battle",
    "receipt_reaction": "receipt",
    "receipt_victory": "receipt",
    "network_pulse": "network_event",
    "network_briefing_item": "network_event",
}

ORIGINAL_PRIMARY_TYPES = frozenset({"agent_post", "conviction_update"})
RIVAL_PRIMARY_TYPES = frozenset({"battle_response"})
RECEIPT_PRIMARY_TYPES = frozenset({"receipt_reaction", "receipt_victory"})
NETWORK_PRIMARY_TYPES = frozenset({"network_pulse"})

MAX_BATCH_SIZE = 100
DEFAULT_NETWORK_BATCH = 100


def card_family(activity_type: str) -> str:
    return ACTIVITY_TO_CARD_FAMILY.get(activity_type, "agent_post")


def family_counts(rows: list) -> Counter[str]:
    return Counter(card_family(r.activity_type) for r in rows)


def target_for_family(family: str, total: int) -> int:
    return max(0, int(round(total * TARGET_MIX.get(family, 0))))


def family_deficit(counts: Counter[str], family: str, total: int) -> int:
    return max(0, target_for_family(family, total) - counts.get(family, 0))


def pick_family_with_largest_deficit(counts: Counter[str], total: int) -> str:
    """Choose the card family furthest below its target share."""
    best_family = "agent_post"
    best_gap = -1.0
    for family, share in TARGET_MIX.items():
        want = target_for_family(family, total)
        have = counts.get(family, 0)
        if want <= 0:
            continue
        gap = (want - have) / max(want, 1)
        if gap > best_gap:
            best_gap = gap
            best_family = family
    return best_family


def mix_report(rows: list) -> dict[str, float]:
    if not rows:
        return {k: 0.0 for k in TARGET_MIX}
    counts = family_counts(rows)
    total = len(rows)
    return {family: counts.get(family, 0) / total for family in TARGET_MIX}


def triggers_for_family(
    family: str,
    catalog: tuple[ActivityTrigger, ...],
) -> list[ActivityTrigger]:
    if family == "agent_post":
        types = ORIGINAL_PRIMARY_TYPES
    elif family == "open_battle":
        types = RIVAL_PRIMARY_TYPES
    elif family == "receipt":
        types = RECEIPT_PRIMARY_TYPES
    elif family == "network_event":
        types = NETWORK_PRIMARY_TYPES
    else:
        types = frozenset()
    return [t for t in catalog if t.activity_type in types]


def within_mix_tolerance(rows: list, total: int, tolerance: float = 0.08) -> bool:
    """True when every family is within tolerance of target share."""
    if len(rows) < max(20, total // 2):
        return False
    report = mix_report(rows)
    return all(abs(report[f] - TARGET_MIX[f]) <= tolerance for f in TARGET_MIX)
