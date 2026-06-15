"""User-facing resolution horizon labels from time-to-outcome (not admin duration buckets)."""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any, Literal

from app.forecasting.market_resolution import is_market_resolved
from app.forecasting.models import Market
from app.forecasting.services.event_duration import suggested_resolution_date


def _parse_datetime(value: object | None) -> datetime | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value
    if isinstance(value, str):
        raw = value.strip()
        if not raw:
            return None
        if raw.endswith("Z"):
            raw = f"{raw[:-1]}+00:00"
        try:
            return datetime.fromisoformat(raw)
        except ValueError:
            return None
    return None

HorizonBucket = Literal[
    "resolved",
    "tonight",
    "soon",
    "this_week",
    "this_month",
    "long_term",
]

FilterBucket = Literal[
    "resolves_soon",
    "this_week",
    "this_month",
    "long_term",
    "recently_resolved",
]


def _effective_resolution_at(
    market: Market | None,
    *,
    expected_at: datetime | None = None,
) -> datetime | None:
    if market is not None:
        if market.expected_resolution_at:
            return market.expected_resolution_at
        if market.horizon_type and market.created_at:
            return suggested_resolution_date(
                market.horizon_type,
                now=market.created_at,
            )
    return expected_at


def _hours_until(target: datetime, *, now: datetime) -> float:
    return (target - now).total_seconds() / 3600.0


def resolution_horizon(
    *,
    expected_resolution_at: datetime | None,
    resolved: bool = False,
    now: datetime | None = None,
) -> dict[str, Any] | None:
    current = now or datetime.utcnow()
    if resolved:
        return {
            "bucket": "resolved",
            "filter_bucket": "recently_resolved",
            "label": "✓ Resolved",
            "emoji": "✓",
            "short_label": "Resolved",
            "open_loop": None,
            "hours_remaining": 0.0,
        }

    if expected_resolution_at is None:
        return None

    hours = _hours_until(expected_resolution_at, now=current)
    if hours <= 0:
        return {
            "bucket": "tonight",
            "filter_bucket": "resolves_soon",
            "label": "⚡ Resolves tonight",
            "emoji": "⚡",
            "short_label": "Tonight",
            "open_loop": "Outcome expected tonight",
            "hours_remaining": max(0.0, hours),
        }

    if hours < 24:
        return {
            "bucket": "tonight",
            "filter_bucket": "resolves_soon",
            "label": "⚡ Resolves tonight",
            "emoji": "⚡",
            "short_label": "Tonight",
            "open_loop": "Outcome expected tonight",
            "hours_remaining": hours,
        }

    if hours < 72:
        days = max(1, min(3, int(round(hours / 24))))
        label = f"⏳ Resolves in {days} day{'s' if days != 1 else ''}"
        open_loop = "Resolution approaching" if hours < 48 else "Consensus about to be tested"
        return {
            "bucket": "soon",
            "filter_bucket": "resolves_soon",
            "label": label,
            "emoji": "⏳",
            "short_label": f"{days}d",
            "open_loop": open_loop,
            "hours_remaining": hours,
        }

    if hours < 14 * 24:
        return {
            "bucket": "this_week",
            "filter_bucket": "this_week",
            "label": "📅 Resolves this week",
            "emoji": "📅",
            "short_label": "This week",
            "open_loop": None,
            "hours_remaining": hours,
        }

    if hours < 60 * 24:
        return {
            "bucket": "this_month",
            "filter_bucket": "this_month",
            "label": "🗓 Resolves this month",
            "emoji": "🗓",
            "short_label": "This month",
            "open_loop": None,
            "hours_remaining": hours,
        }

    return {
        "bucket": "long_term",
        "filter_bucket": "long_term",
        "label": "🔮 Long-term",
        "emoji": "🔮",
        "short_label": "Long-term",
        "open_loop": None,
        "hours_remaining": hours,
    }


def resolution_horizon_for_market(market: Market | None, *, now: datetime | None = None) -> dict[str, Any] | None:
    if market is None:
        return None
    expected = _effective_resolution_at(market)
    return resolution_horizon(
        expected_resolution_at=expected,
        resolved=is_market_resolved(market),
        now=now,
    )


def resolution_horizon_from_meta(
    meta: dict | None,
    *,
    market: Market | None = None,
    now: datetime | None = None,
) -> dict[str, Any] | None:
    if market is not None:
        return resolution_horizon_for_market(market, now=now)
    if not meta:
        return None
    expected = _parse_datetime(meta.get("world_event_expected_resolution_date"))
    return resolution_horizon(expected_resolution_at=expected, now=now)


def feed_resolution_boost(market: Market | None, *, now: datetime | None = None) -> tuple[float, str | None]:
    """Small score boost + reason for events on soon-resolving markets."""
    rh = resolution_horizon_for_market(market, now=now)
    if not rh or rh.get("bucket") == "resolved":
        return 0.0, None
    hours = float(rh.get("hours_remaining") or 0)
    if hours < 24:
        return 6.0, rh.get("open_loop") or "Outcome expected tonight"
    if hours < 48:
        return 4.0, "Resolution approaching"
    if hours < 72:
        return 2.5, "Consensus about to be tested"
    return 0.0, None
