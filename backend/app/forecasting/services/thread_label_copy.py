"""Shared rival-thread copy signals for labels and generation metadata."""

from __future__ import annotations

import re
from typing import Any

CALM_AGREEMENT_PHRASES: tuple[str, ...] = (
    "fair point",
    "good point",
    "valid point",
    "well said",
    "i agree",
    "agree with",
    "same page",
    "couldn't agree",
    "could not agree",
    "spot on",
    "exactly right",
    "great point",
    "momentum can persist",
    "tape is strong",
)

EXPLICIT_OPPOSITION_PHRASES: tuple[str, ...] = (
    "wrong",
    "missed",
    "not pricing",
    "assuming",
    "against",
    "disagrees",
    "disagree",
    "lags",
    "late",
    "you're wrong",
    "you are wrong",
    "that's wrong",
    "that is wrong",
    "i disagree",
    "hard disagree",
    "strongly disagree",
    "won't concede",
    "refuse to concede",
    "counterpoint",
    "push back",
    "pushback",
    "overstated",
    "understated",
    "too bullish",
    "too bearish",
    "misses the",
    "ignores the",
)

MIRROR_FEED_META_KEYS: tuple[str, ...] = (
    "narrative_stage",
    "narrative_stage_label",
    "thread_tone",
    "continuation_kind",
    "idea_bucket",
    "thread_lifecycle",
    "narrative_id",
    "narrative_label",
)


def event_copy_text(title: str | None, body: str | None) -> str:
    return f"{title or ''} {body or ''}".strip().lower()


def is_calm_continuation_copy(copy: str) -> bool:
    if not copy:
        return True
    if any(phrase in copy for phrase in CALM_AGREEMENT_PHRASES):
        return True
    if re.search(r"\b(agree|agreed)\b", copy) and not re.search(
        r"\b(disagree|don't agree|do not agree)\b", copy
    ):
        return True
    return False


def _rival_name_tokens(
    *,
    opponent_name: str | None = None,
    opponent_slug: str | None = None,
    parent_agent_name: str | None = None,
) -> set[str]:
    tokens: set[str] = set()
    for raw in (opponent_name, parent_agent_name):
        if raw:
            lower = raw.lower().strip()
            tokens.add(lower)
            if " " in lower:
                tokens.add(lower.split()[0])
    if opponent_slug:
        slug = opponent_slug.lower().strip()
        tokens.add(slug.replace("-", " "))
        tokens.add(slug.replace("-", ""))
    return {token for token in tokens if token}


def names_rival_in_copy(
    copy: str,
    *,
    opponent_name: str | None = None,
    opponent_slug: str | None = None,
    parent_agent_name: str | None = None,
) -> bool:
    return any(token in copy for token in _rival_name_tokens(
        opponent_name=opponent_name,
        opponent_slug=opponent_slug,
        parent_agent_name=parent_agent_name,
    ))


def has_explicit_opposition(copy: str) -> bool:
    return any(phrase in copy for phrase in EXPLICIT_OPPOSITION_PHRASES)


def is_explicitly_adversarial_rival_copy(
    title: str | None,
    body: str | None,
    *,
    opponent_name: str | None = None,
    opponent_slug: str | None = None,
    parent_agent_name: str | None = None,
    thread_tone: str | None = None,
) -> bool:
    if thread_tone == "calm":
        return False
    copy = event_copy_text(title, body)
    if is_calm_continuation_copy(copy):
        return False
    if has_explicit_opposition(copy):
        return True
    return names_rival_in_copy(
        copy,
        opponent_name=opponent_name,
        opponent_slug=opponent_slug,
        parent_agent_name=parent_agent_name,
    ) and any(
        cue in copy
        for cue in (
            "wrong",
            "missed",
            "not pricing",
            "assuming",
            "against",
            "disagrees",
            "disagree",
            "lags",
            "late",
        )
    )


def classify_rival_thread_tone(
    title: str | None,
    body: str | None,
    *,
    opponent_name: str | None = None,
    opponent_slug: str | None = None,
    parent_agent_name: str | None = None,
) -> str:
    if is_explicitly_adversarial_rival_copy(
        title,
        body,
        opponent_name=opponent_name,
        opponent_slug=opponent_slug,
        parent_agent_name=parent_agent_name,
    ):
        return "heated"
    return "calm"


def mirror_activity_meta_fields(meta: dict[str, Any]) -> dict[str, Any]:
    """Subset of activity metadata to persist on mirrored FeedEvent rows."""
    out: dict[str, Any] = {}
    for key in MIRROR_FEED_META_KEYS:
        if meta.get(key) is not None:
            out[key] = meta[key]
    return out
