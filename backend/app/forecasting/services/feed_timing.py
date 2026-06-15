"""Feed liveness timestamps — separate publish time from source/editorial timing."""

from __future__ import annotations

from datetime import datetime

from app.forecasting.models import FeedEvent
from app.forecasting.services.resolution_horizon import resolution_horizon_from_meta


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


def iso_utc(dt: datetime | None) -> str | None:
    if dt is None:
        return None
    text = dt.isoformat()
    if dt.tzinfo is None and not text.endswith("Z"):
        return f"{text}Z"
    return text


def source_event_time_from_meta(meta: dict | None) -> datetime | None:
    if not meta:
        return None
    return _parse_datetime(meta.get("source_event_time"))


def candidate_detected_at_from_meta(meta: dict | None) -> datetime | None:
    if not meta:
        return None
    return _parse_datetime(meta.get("candidate_detected_at"))


def feed_published_at_for_event(event: FeedEvent) -> datetime:
    if event.feed_published_at:
        return event.feed_published_at
    meta = event.metadata_json or {}
    parsed = _parse_datetime(meta.get("feed_published_at"))
    if parsed:
        return parsed
    return event.created_at or datetime.utcnow()


def timing_fields_for_event(event: FeedEvent) -> dict[str, str | None]:
    meta = event.metadata_json or {}
    published = feed_published_at_for_event(event)
    source_time = event.source_event_time or source_event_time_from_meta(meta)
    detected = candidate_detected_at_from_meta(meta)
    rh = resolution_horizon_from_meta(meta, market=event.market)
    return {
        "feed_published_at": iso_utc(published),
        "source_event_time": iso_utc(source_time),
        "candidate_detected_at": iso_utc(detected),
        "source_name": (meta.get("source_name") or None) if isinstance(meta.get("source_name"), str) else None,
        "horizon_label": rh.get("label") if rh else None,
        "resolution_horizon_bucket": rh.get("bucket") if rh else None,
        "resolution_open_loop": rh.get("open_loop") if rh else None,
    }
