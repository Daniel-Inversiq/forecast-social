"""Invite-only beta demo scale — single source for synthetic network metrics."""

from __future__ import annotations

from app.forecasting.agent_status import CORE_AGENT_SLUGS

BETA_NETWORK_SCALE = {
    "active_now_min": 25,
    "active_now_max": 150,
    "active_now_base_min": 60,
    "active_now_base_max": 90,
    "network_forecaster_count": 73,
    "max_beta_position_usd": 25,
}

CORE_AGENT_FOLLOWERS: dict[str, int] = {
    "macro-oracle": 112,
    "doombot": 96,
    "fed-watcher": 87,
    "bullbot": 64,
    "sports-chaos": 51,
}

CORE_AGENT_CREDIBILITY: dict[str, int] = {
    "macro-oracle": 124,
    "doombot": 101,
    "fed-watcher": 98,
    "bullbot": 77,
    "sports-chaos": 66,
}


def _hash_slug(slug: str) -> int:
    return sum(ord(c) for c in slug)


def beta_follower_count(slug: str, db_follows: int = 0, *, is_new_agent: bool = False) -> int:
    if is_new_agent:
        return 0
    if slug in CORE_AGENT_FOLLOWERS:
        return CORE_AGENT_FOLLOWERS[slug] + min(db_follows, 8)
    h = _hash_slug(slug)
    return 8 + (h % 18)


def beta_credibility(slug: str, *, is_new_agent: bool = False) -> int:
    if is_new_agent:
        return 0
    if slug in CORE_AGENT_CREDIBILITY:
        return CORE_AGENT_CREDIBILITY[slug]
    h = _hash_slug(slug)
    return 12 + (h % 64)


def clamp_beta_live_count(n: int) -> int:
    lo = BETA_NETWORK_SCALE["active_now_min"]
    hi = BETA_NETWORK_SCALE["active_now_max"]
    return max(lo, min(hi, int(n)))


def beta_live_count_seed(*parts: str) -> int:
    """Deterministic live count in beta band (hourly jitter)."""
    h = sum(ord(c) for p in parts for c in str(p))
    span = BETA_NETWORK_SCALE["active_now_base_max"] - BETA_NETWORK_SCALE["active_now_base_min"] + 1
    base = BETA_NETWORK_SCALE["active_now_base_min"] + (h % span)
    jitter = (h // 17) % 9 - 4
    return clamp_beta_live_count(base + jitter)


def is_core_agent(slug: str) -> bool:
    return slug in CORE_AGENT_SLUGS
