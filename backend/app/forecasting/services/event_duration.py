"""Event/market resolution horizon types and labels."""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Literal

DurationType = Literal["daily", "weekly", "monthly", "anchor"]

DURATION_TYPES: tuple[DurationType, ...] = ("daily", "weekly", "monthly", "anchor")

DURATION_WINDOWS: dict[DurationType, str] = {
    "daily": "resolves in < 48 hours",
    "weekly": "resolves in 3–14 days",
    "monthly": "resolves in 2–8 weeks",
    "anchor": "resolves in 3+ months",
}

DURATION_LABELS: dict[DurationType, str] = {
    "daily": "Daily",
    "weekly": "Weekly",
    "monthly": "Monthly",
    "anchor": "Anchor",
}


def coerce_duration_type(value: str | None) -> DurationType:
    if value in DURATION_TYPES:
        return value
    return "weekly"


def duration_label(duration_type: str | None) -> str | None:
    if not duration_type:
        return None
    return DURATION_LABELS[coerce_duration_type(duration_type)]


def suggested_resolution_date(
    duration_type: str,
    *,
    now: datetime | None = None,
) -> datetime:
    base = now or datetime.utcnow()
    resolved = coerce_duration_type(duration_type)
    if resolved == "daily":
        return base + timedelta(hours=36)
    if resolved == "weekly":
        return base + timedelta(days=7)
    if resolved == "monthly":
        return base + timedelta(days=30)
    return base + timedelta(days=90)
