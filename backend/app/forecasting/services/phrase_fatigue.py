"""Track signature-phrase reuse and rotate tired phrases across agents."""

from __future__ import annotations

import re
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy.orm import Session

from app.forecasting.models import AgentGeneratedActivity
from app.forecasting.services.copy_sanitize import safe_signature_phrases
from app.forecasting.services.utils import hash_seed

PHRASE_FATIGUE_WINDOW_HOURS = 24
PHRASE_FATIGUE_MAX_USES = 2

_phrase_fatigue_hits = 0


def phrase_fatigue_hits() -> int:
    return _phrase_fatigue_hits


def reset_phrase_fatigue_hits() -> None:
    global _phrase_fatigue_hits
    _phrase_fatigue_hits = 0


def record_phrase_fatigue_hit() -> None:
    global _phrase_fatigue_hits
    _phrase_fatigue_hits += 1


def _utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def normalize_phrase(phrase: str) -> str:
    text = str(phrase or "").lower().strip()
    text = re.sub(r"[^\w\s]", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def _phrases_for_slug(slug: str) -> list[tuple[str, str]]:
    """Return (display, normalized) pairs for an agent's signature phrases."""
    out: list[tuple[str, str]] = []
    for phrase in safe_signature_phrases(slug):
        norm = normalize_phrase(phrase)
        if len(norm) >= 6:
            out.append((phrase, norm))
    return out


def load_phrase_usage(db: Session, *, hours: int = PHRASE_FATIGUE_WINDOW_HOURS) -> dict[tuple[str, str], int]:
    """Count signature-phrase appearances per agent over the rolling window."""
    cutoff = _utcnow() - timedelta(hours=hours)
    rows = (
        db.query(AgentGeneratedActivity)
        .filter(AgentGeneratedActivity.created_at >= cutoff)
        .order_by(AgentGeneratedActivity.created_at.desc())
        .limit(800)
        .all()
    )
    usage: dict[tuple[str, str], int] = {}
    for row in rows:
        blob = f"{row.title or ''}\n{row.body or ''}".lower()
        for display, norm in _phrases_for_slug(row.agent_slug):
            if norm in blob:
                key = (row.agent_slug, norm)
                usage[key] = usage.get(key, 0) + 1
    return usage


def is_phrase_fatigued(
    slug: str,
    phrase: str,
    usage: dict[tuple[str, str], int],
    *,
    max_uses: int = PHRASE_FATIGUE_MAX_USES,
) -> bool:
    norm = normalize_phrase(phrase)
    if not norm:
        return False
    return usage.get((slug, norm), 0) >= max_uses


def find_phrases_in_text(slug: str, text: str) -> list[str]:
    """Return normalized signature phrases found in copy."""
    blob = (text or "").lower()
    found: list[str] = []
    for _display, norm in _phrases_for_slug(slug):
        if norm in blob:
            found.append(norm)
    return found


def pick_alternate_signature_phrase(
    slug: str,
    *,
    seed: int,
    usage: dict[tuple[str, str], int],
    exclude: set[str] | None = None,
) -> str | None:
    """Choose a non-fatigued signature phrase for regeneration."""
    exclude_norm = {normalize_phrase(p) for p in (exclude or set())}
    candidates: list[str] = []
    for display, norm in _phrases_for_slug(slug):
        if norm in exclude_norm:
            continue
        if is_phrase_fatigued(slug, display, usage):
            continue
        candidates.append(display)
    if not candidates:
        return None
    idx = hash_seed(slug, str(seed), "alt_phrase") % len(candidates)
    return candidates[idx]


def rewrite_fatigued_phrases(
    slug: str,
    title: str,
    body: str,
    *,
    usage: dict[tuple[str, str], int],
    seed: int,
) -> tuple[str, str, bool]:
    """
    Replace fatigued signature phrases with alternates.
    Returns (title, body, did_rewrite).
    """
    combined = f"{title}\n{body}".strip()
    fatigued = [
        norm
        for norm in find_phrases_in_text(slug, combined)
        if usage.get((slug, norm), 0) >= PHRASE_FATIGUE_MAX_USES
    ]
    if not fatigued:
        return title, body, False

    alt = pick_alternate_signature_phrase(slug, seed=seed, usage=usage, exclude=set(fatigued))
    if not alt:
        return title, body, False

    new_title = title
    new_body = body
    for norm in fatigued:
        pattern = re.compile(re.escape(norm), re.IGNORECASE)
        if pattern.search(new_title):
            new_title = pattern.sub(alt, new_title, count=1)
        elif pattern.search(new_body):
            new_body = pattern.sub(alt, new_body, count=1)
        elif pattern.search(combined):
            new_body = f"{new_body.rstrip()}\n{alt.capitalize()}.".strip()

    record_phrase_fatigue_hit()
    return new_title[:255], new_body, True


def apply_phrase_fatigue(
    db: Session | None,
    slug: str,
    title: str,
    body: str,
    *,
    seed: int | None = None,
) -> tuple[str, str, dict[str, Any]]:
    """Gate before persistence — rewrite or flag fatigued signature phrases."""
    meta: dict[str, Any] = {}
    if db is None:
        return title, body, meta

    usage = load_phrase_usage(db)
    new_title, new_body, did_rewrite = rewrite_fatigued_phrases(
        slug,
        title,
        body,
        usage=usage,
        seed=seed or 0,
    )
    if did_rewrite:
        meta["phrase_fatigue"] = "alternate_signature"
    return new_title, new_body, meta
