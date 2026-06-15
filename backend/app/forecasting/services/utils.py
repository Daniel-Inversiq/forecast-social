import re
from datetime import datetime, timezone


def hash_seed(*parts) -> int:
    return sum(ord(c) for p in parts for c in str(p))


def title_to_slug(title: str) -> str:
    slug = title.lower()
    slug = re.sub(r"[^a-z0-9]+", "-", slug)
    return slug.strip("-")


def stats_for_slug(slug: str) -> dict[str, int]:
    h = hash_seed(slug)
    return {
        "streak": 3 + h % 14,
        "accuracy_score": 78 + h % 18,
    }


def iso_dt(dt: datetime | None) -> str:
    if dt is None:
        return datetime.now(timezone.utc).isoformat()
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc).isoformat()
    return dt.isoformat()


def hours_since(dt: datetime | None) -> float:
    if dt is None:
        return 999.0
    now = datetime.utcnow()
    delta = now - dt
    return max(0.0, delta.total_seconds() / 3600.0)


def parse_spread(body: str) -> int | None:
    match = re.search(r"Spread:\s*(\d+)", body, re.IGNORECASE)
    return int(match.group(1)) if match else None


def movement_delta(event_type: str, seed: str) -> int | None:
    if event_type not in (
        "confidence_shift",
        "consensus_shift",
        "market_move",
        "signal_shift",
        "narrative_acceleration",
    ):
        return None
    h = hash_seed(seed)
    sign = 1 if h % 2 == 0 else -1
    return sign * (3 + h % 6)


def active_takes_count(seed: str) -> int:
    h = hash_seed(seed)
    return 4 + h % 18
