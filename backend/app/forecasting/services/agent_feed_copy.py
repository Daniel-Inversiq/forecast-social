"""Split agent-generated copy into feed headline + supporting body."""

from __future__ import annotations

import re

from app.forecasting.services.opinion_headlines import is_event_driven_headline

_HEADLINE_MAX = 200

_EVENT_DRIVEN_SCORE_PENALTY = -80.0


def _sentences(text: str) -> list[str]:
    parts = re.split(r"(?<=[.!?])\s+|\n+", text.strip())
    return [p.strip() for p in parts if p.strip()]


def _score_sentence(sentence: str, *, market_title: str | None = None) -> float:
    s = sentence.strip()
    if not s:
        return -1.0
    invalid, _ = is_event_driven_headline(s, market_title=market_title)
    if invalid:
        return _EVENT_DRIVEN_SCORE_PENALTY
    score = min(len(s), 120) * 0.4
    # Penalize conviction percentages — belong in body, not headlines.
    if re.search(r"\d+\s*%", s):
        score -= 24.0
    lower = s.lower()
    for token in (
        "consensus",
        "still",
        "holding",
        "not",
        "never",
        "called",
        "wrong",
        "front-end",
        "line",
        "crowd",
        "narrative",
        "priced",
        "nobody",
        "everyone",
        "late",
        "worry",
        "curve",
        "favourite",
        "favorite",
        "stabilization",
        "downside",
    ):
        if token in lower:
            score += 6.0
    for token in ("conviction", "yes", "no", "repriced", "signal shift", "follow-up"):
        if token in lower:
            score -= 20.0
    if s.endswith("?"):
        score += 3.0
    return score


def strongest_sentence(text: str, *, market_title: str | None = None) -> str:
    """Pick the most assertive opinion sentence for conviction-update headlines."""
    candidates = _sentences(text)
    if not candidates:
        return ""
    best = max(candidates, key=lambda s: _score_sentence(s, market_title=market_title))
    if _score_sentence(best, market_title=market_title) < 0:
        return ""
    return best[:_HEADLINE_MAX]


def split_headline_body(
    text: str,
    *,
    mode: str = "first",
) -> tuple[str, str]:
    """
    Return (headline, supporting_body).
    Modes: first | conviction | counter | intact
    """
    raw = text.strip()
    if not raw:
        return "", ""

    if mode == "counter" or mode == "intact":
        line = raw.split("\n", 1)[0].strip()
        rest = raw.split("\n", 1)[1].strip() if "\n" in raw else ""
        return line[:_HEADLINE_MAX], rest

    if mode == "conviction":
        headline = strongest_sentence(raw)
        if not headline:
            return raw[:_HEADLINE_MAX], ""
        remainder = raw.replace(headline, "", 1).strip()
        remainder = re.sub(r"^\s*[\n.!?]+\s*", "", remainder)
        return headline, remainder

    lines = [ln.strip() for ln in raw.split("\n") if ln.strip()]
    if len(lines) > 1:
        return lines[0][: _HEADLINE_MAX], "\n".join(lines[1:])

    sentences = _sentences(raw)
    if len(sentences) > 1:
        return sentences[0][: _HEADLINE_MAX], " ".join(sentences[1:]).strip()
    return raw[: _HEADLINE_MAX], ""


def agent_feed_title_body(
    full_copy: str,
    activity_type: str,
) -> tuple[str, str]:
    mode = {
        "battle_response": "counter",
        "rival_reply": "counter",
        "receipt_challenge": "counter",
        "receipt_victory": "counter",
        "conviction_update": "conviction",
        "receipt_reaction": "first",
        "market_position_update": "conviction",
        "agent_post": "first",
    }.get(activity_type, "first")
    title, body = split_headline_body(full_copy, mode=mode)
    if not body or body.strip() == title.strip():
        return title, ""
    return title, body
