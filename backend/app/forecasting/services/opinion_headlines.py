"""Opinion-driven feed headlines — agent voice first; market context stays in the body."""

from __future__ import annotations

import random
import re
from typing import Callable

from app.forecasting.character_bibles import character_bible_for
from app.forecasting.services.utils import hash_seed
from app.forecasting.services.voice_engine import GENERIC_WARNING_PHRASES, display_name

HEADLINE_MAX = 200

# Curated opinion headlines per core agent — recognizable without market/event labels.
OPINION_HEADLINES: dict[str, tuple[str, ...]] = {
    "doombot": (
        "Consensus is late again.",
        "Nobody is pricing the downside.",
        "Every cycle ends the same way.",
        "The crowd bought the narrative.",
        "Priced for perfection.",
        "The tape does not lie. The narrative does.",
        "Soft landing is cope.",
        "Not a prediction. A pattern.",
        "The bid is narrative, not macro.",
        "Fragility still compounds.",
    ),
    "bullbot": (
        "Everyone wants the dip. Nobody buys it.",
        "The wall of worry is still fuel.",
        "The dip is still there.",
        "Still buying.",
        "Momentum does not care about valuation.",
        "The long side wins. It always does.",
        "Sold the news? Good. That is where the next leg starts.",
        "The crowd is scared. The bid is still there.",
        "Timing is the job.",
        "Risk is the opportunity.",
    ),
    "fed-watcher": (
        "The curve moved first.",
        "Markets are running ahead of policy.",
        "The curve is the signal.",
        "Front-end leads. Drama lags.",
        "The dot plot says one thing. The market prices another.",
        "Watching the statement language, not the decision.",
        "Path first. Narrative second.",
        "The 2-year is the tell.",
        "One of them is wrong.",
    ),
    "macro-oracle": (
        "The narrative changed before the data.",
        "Stabilization is not growth.",
        "Data over narratives.",
        "The gap between narrative and data is where the trade lives.",
        "Probability, not certainty.",
        "The first read was wrong. Revision changes the picture.",
        "Liquidity still drives the cycle.",
        "Horizon matters more than the tick.",
        "Credit leads headlines.",
    ),
    "sports-chaos": (
        "Public money is never free money.",
        "The favourite is getting too much love.",
        "Momentum beats sentiment. Always.",
        "The market is wrong.",
        "Taking the other side.",
        "Not a fan. A forecaster.",
        "The model holds.",
        "The line is still wrong.",
        "Chaos is the model.",
    ),
}

# Event-driven / system headline prefixes that must never ship.
SYSTEM_TITLE_PATTERNS = re.compile(
    r"(?i)^(counter:|receipt verified|post-mortem posted|rates conviction posted|"
    r"network briefing|fomc path update|macro model update|line moved — holding conviction|"
    r"position update|conviction update|battle response|agent post|signal shift|"
    r"follow-up|verified|rivalry|narrative surge|narrative accelerating|flow —|"
    r"new take|quiet pulse|reputation breakout|repriced|market move)",
)

EVENT_LABEL_PATTERNS = re.compile(
    r"(?i)\b(september modal|fomc day|cpi print|jobs strength|pre-match|"
    r"ai breakthrough|us recession|champions league|nvidia|fed cut)\b",
)

CONVICTION_LABEL_PATTERNS = re.compile(
    r"(?i)\b(conviction|confidence:|yes\s*\d|no\s*\d|\d+\s*%\s*yes|\d+\s*%\s*no|"
    r"conviction\s+\d|holding\s+\d+%)\b",
)

GENERIC_HEADLINE_PATTERNS = re.compile(
    r"(?i)\b(market participants|it is important to note|this suggests that|"
    r"on the other hand|remains to be seen|balanced view|several factors)\b",
)

# Headlines that read like database rows, not human views.
DATABASE_ROW_PATTERNS = re.compile(
    r"(?i)( — | vs | on [A-Z]|\brepriced\b|\btake —\b|\bpulse\b|\bupdate\b.*\bposted\b)",
)


def _normalize(text: str) -> str:
    return re.sub(r"\s+", " ", text.strip())


def _headline_pool(slug: str) -> list[str]:
    from app.forecasting.services.copy_sanitize import is_headline_pool_candidate

    bible = character_bible_for(slug)
    pool = [p for p in OPINION_HEADLINES.get(slug, ()) if is_headline_pool_candidate(p)]
    for phrase in bible.get("signature_phrases") or []:
        p = str(phrase).strip()
        if p and p not in pool and is_headline_pool_candidate(p):
            pool.append(p)
    if pool:
        return pool
    return [
        "The crowd is misreading the tape.",
        "Consensus is comfortable. That is the risk.",
        "Timing edge still intact.",
    ]


def _market_tokens(market_title: str | None) -> list[str]:
    if not market_title:
        return []
    title = market_title.strip()
    if not title:
        return []
    tokens: list[str] = [title.lower()]
    # Drop trailing question marks and split on common forecast delimiters.
    clean = re.sub(r"[?!.]+$", "", title)
    tokens.append(clean.lower())
    for part in re.split(r"[\s—–-]+", clean):
        if len(part) >= 4:
            tokens.append(part.lower())
    return tokens


def _contains_market_reference(headline: str, market_title: str | None) -> bool:
    if not market_title:
        return False
    lower = headline.lower()
    for token in _market_tokens(market_title):
        if len(token) >= 5 and token in lower:
            return True
    return False


def is_event_driven_headline(
    headline: str,
    *,
    slug: str | None = None,
    market_title: str | None = None,
    body: str | None = None,
) -> tuple[bool, str]:
    """
    Return (is_invalid, reason).
    Invalid headlines are event-driven, generic, or contain forbidden labels.
    """
    text = _normalize(headline)
    if not text:
        return True, "empty"
    if len(text) < 8:
        return True, "too_short"

    lower = text.lower()

    if SYSTEM_TITLE_PATTERNS.match(text):
        return True, "system_prefix"
    if CONVICTION_LABEL_PATTERNS.search(text):
        return True, "conviction_label"
    if EVENT_LABEL_PATTERNS.search(text):
        return True, "event_label"
    if GENERIC_HEADLINE_PATTERNS.search(text):
        return True, "generic_phrase"
    if any(p in lower for p in GENERIC_WARNING_PHRASES):
        return True, "generic_warning"

    if _contains_market_reference(text, market_title):
        return True, "market_name"

    # Agent name + market/event framing (e.g. "DoomBot on US recession by Q4").
    if slug:
        agent_name = display_name(slug).lower()
        if agent_name in lower and re.search(r"\bon\b", lower):
            return True, "agent_on_market"

    # Percentages in headlines usually mean conviction labels slipped through.
    if re.search(r"\d+\s*%", text):
        return True, "percentage"

    if re.search(r"(?i)(?:^|\s)(yes|no)(?:\s|$|[,.])", text):
        return True, "yes_no_label"

    # "Agent vs Agent — Market" battle titles.
    if re.search(r"(?i)\bvs\b", text) and _contains_market_reference(text, market_title):
        return True, "battle_event_title"
    if re.search(r"(?i)\bvs\b", text) and DATABASE_ROW_PATTERNS.search(text):
        return True, "battle_event_title"

    if DATABASE_ROW_PATTERNS.search(text) and _contains_market_reference(text, market_title):
        return True, "database_row"

    # Forecast-shaped titles: "X by Q4", "before December", year/quarter hooks.
    if re.search(
        r"(?i)\b("
        r"by q[1-4]|by year.?end|by \w+ \d{4}|"
        r"before (?:january|february|march|april|may|june|july|august|"
        r"september|october|november|december|year.?end)"
        r")\b",
        text,
    ):
        return True, "forecast_title"

    # Headline equals body opening with market context — not a real headline.
    if body:
        body_open = _normalize(body)[: min(len(text) + 20, 120)].lower()
        if text.lower() in body_open and _contains_market_reference(body_open, market_title):
            return True, "body_echo"

    return False, ""


def _pick_from_body(body: str, *, market_title: str | None) -> str | None:
    """Extract the best opinion sentence from body copy."""
    from app.forecasting.services.agent_feed_copy import strongest_sentence

    candidate = strongest_sentence(body, market_title=market_title)
    if not candidate:
        return None
    invalid, _ = is_event_driven_headline(candidate, market_title=market_title, body=body)
    if invalid:
        return None
    return candidate[:HEADLINE_MAX]


def generate_opinion_headline(
    slug: str,
    *,
    rng: random.Random | None = None,
    seed: int | None = None,
    body: str | None = None,
    market_title: str | None = None,
    event_type: str | None = None,
    exclude: set[str] | None = None,
) -> str:
    """Pick an agent-voiced opinion headline."""
    r = rng or random.Random(seed if seed is not None else hash_seed(slug, body or "", event_type or ""))
    blocked = {e.lower() for e in (exclude or set())}

    if body:
        extracted = _pick_from_body(body, market_title=market_title)
        if extracted and extracted.lower() not in blocked:
            invalid, _ = is_event_driven_headline(
                extracted, slug=slug, market_title=market_title, body=body
            )
            if not invalid:
                return extracted

    pool = [h for h in _headline_pool(slug) if h.lower() not in blocked]
    if not pool:
        pool = list(_headline_pool(slug))
    return r.choice(pool)[:HEADLINE_MAX]


def ensure_opinion_headline(
    slug: str,
    proposed: str,
    *,
    body: str = "",
    market_title: str | None = None,
    event_type: str | None = None,
    seed: int | None = None,
    rng: random.Random | None = None,
    max_attempts: int = 6,
) -> str:
    """
    Validate a proposed headline; regenerate from body or agent pool when rejected.
    """
    r = rng or random.Random(seed if seed is not None else hash_seed(slug, proposed, body))
    invalid, _ = is_event_driven_headline(
        proposed, slug=slug, market_title=market_title, body=body or None
    )
    if not invalid:
        return _normalize(proposed)[:HEADLINE_MAX]

    tried: set[str] = {proposed.lower()}
    for attempt in range(max_attempts):
        candidate = generate_opinion_headline(
            slug,
            rng=r,
            seed=(seed or 0) + attempt * 31,
            body=body or None,
            market_title=market_title,
            event_type=event_type,
            exclude=tried,
        )
        tried.add(candidate.lower())
        bad, _ = is_event_driven_headline(
            candidate, slug=slug, market_title=market_title, body=body or None
        )
        if not bad:
            return candidate

    # Last resort: first pool entry for core agents.
    pool = _headline_pool(slug)
    return pool[0][:HEADLINE_MAX]


def resolve_opinion_headline(
    slug: str,
    *,
    proposed_title: str,
    body: str,
    market_title: str | None = None,
    event_type: str | None = None,
    seed: int | None = None,
    rng: random.Random | None = None,
) -> str:
    """Public entry point for conviction + activity pipelines."""
    return ensure_opinion_headline(
        slug,
        proposed_title,
        body=body,
        market_title=market_title,
        event_type=event_type,
        seed=seed,
        rng=rng,
    )


def validate_and_regenerate(
    slug: str,
    title: str,
    body: str,
    *,
    market_title: str | None = None,
    generator: Callable[[], str] | None = None,
    seed: int | None = None,
) -> tuple[str, bool]:
    """
    Return (final_title, was_regenerated).
    Optional generator supplies alternate candidates before falling back to pools.
    """
    invalid, _ = is_event_driven_headline(title, slug=slug, market_title=market_title, body=body)
    if not invalid:
        return _normalize(title)[:HEADLINE_MAX], False

    if generator:
        for i in range(3):
            alt = generator()
            bad, _ = is_event_driven_headline(alt, slug=slug, market_title=market_title, body=body)
            if not bad:
                return _normalize(alt)[:HEADLINE_MAX], True

    final = ensure_opinion_headline(
        slug,
        title,
        body=body,
        market_title=market_title,
        seed=seed,
    )
    return final, True
