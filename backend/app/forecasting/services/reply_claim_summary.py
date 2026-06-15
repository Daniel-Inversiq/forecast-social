"""Clean source claims and extract short thesis phrases for rival reply templates."""

from __future__ import annotations

import re

_AGENT_READ_PREFIX = re.compile(
    r"^[A-Za-z][\w-]*'?s read(?:\s+on\s+[^:]+)?:\s*",
    re.IGNORECASE,
)
_AGENT_READ_INLINE = re.compile(
    r"[A-Za-z][\w-]*'?s read(?:\s+on\s+[^.]+)?(?:\s+is\s+consistent)?",
    re.IGNORECASE,
)

_STRIP_PREFIXES: tuple[re.Pattern[str], ...] = (
    re.compile(r"^re:\s*", re.IGNORECASE),
    re.compile(r"^the data on\s+", re.IGNORECASE),
    re.compile(r"^taking the underdog side\.?\s*", re.IGNORECASE),
    re.compile(r"^my read:\s*", re.IGNORECASE),
    re.compile(r"^updated read on\s+", re.IGNORECASE),
    re.compile(r"^watching\s+", re.IGNORECASE),
)

_NESTED_QUOTE = re.compile(r'^["\']|["\']$')

_BROKEN_REPLY_PATTERNS: tuple[re.Pattern[str], ...] = (
    re.compile(r"the data on the\b", re.IGNORECASE),
    re.compile(r"the data on watching\b", re.IGNORECASE),
    re.compile(r"read on the mechanism is consistent", re.IGNORECASE),
    re.compile(r"the data on [A-Z][a-z]+'?s read", re.IGNORECASE),
)

_FLUFF_OPENERS = frozenset(
    {
        "watching",
        "nobody",
        "everyone",
        "still",
        "just",
        "literally",
        "basically",
        "honestly",
        "clearly",
        "the",
    }
)


def clean_source_claim(text: str | None) -> str:
    """Strip agent attributions, boilerplate prefixes, and nested headline noise."""
    if not text or not str(text).strip():
        return ""

    line = str(text).split("\n", 1)[0].strip()
    line = _NESTED_QUOTE.sub("", line).strip()

    for _ in range(6):
        prev = line
        line = _AGENT_READ_INLINE.sub("", line).strip()
        line = _AGENT_READ_PREFIX.sub("", line).strip()
        for pattern in _STRIP_PREFIXES:
            line = pattern.sub("", line).strip()
        if " — " in line:
            parts = [p.strip() for p in line.split(" — ") if p.strip()]
            if len(parts) >= 2 and _looks_like_attribution(parts[0]):
                line = parts[-1]
        if ": " in line and _looks_like_attribution(line.split(":", 1)[0]):
            line = line.split(":", 1)[1].strip()
        if line == prev:
            break

    line = re.sub(r"\s+", " ", line).strip(" .,;:-")
    return line


def _looks_like_attribution(fragment: str) -> bool:
    frag = fragment.strip().lower()
    return bool(
        _AGENT_READ_PREFIX.match(fragment + ": ")
        or "'s read" in frag
        or frag.endswith(" read")
        or frag in {"re", "my read"}
    )


def _trim_to_word_range(text: str, *, min_words: int = 2, max_words: int = 8) -> str | None:
    words = re.findall(r"[a-z0-9']+", text.lower())
    words = [w for w in words if w not in {"that", "this", "with", "from", "into", "over"}]
    if len(words) < min_words:
        return None
    return " ".join(words[:max_words])


def _extract_thesis(cleaned: str) -> str | None:
    if not cleaned:
        return None

    text = cleaned.strip()

    watch_match = re.match(r"watching the (.+)", text, re.IGNORECASE)
    if watch_match:
        return _trim_to_word_range(watch_match.group(1).split(",")[0])

    pricing_match = re.search(r"pricing the (.+?)(?:\.|$)", text, re.IGNORECASE)
    if pricing_match:
        noun = pricing_match.group(1).strip(" .,;")
        if "risk" not in noun and len(noun.split()) <= 2:
            noun = f"{noun} risk"
        return _trim_to_word_range(noun)

    before_comma = text.split(",")[0].strip()
    if before_comma and before_comma != text:
        summary = _extract_thesis(before_comma)
        if summary:
            return summary

    is_match = re.match(
        r"((?:the\s+)?[\w'-]+(?:\s+[\w'-]+){0,3})\s+is\s+"
        r"(?:still\s+)?(?:there|cope|wrong|early|over|dead|priced|mispriced)",
        text,
        re.IGNORECASE,
    )
    if is_match:
        return _trim_to_word_range(is_match.group(1))

    is_simple = re.match(r"(.+?)\s+is\s+(?:cope|wrong|over|dead|mispriced)", text, re.IGNORECASE)
    if is_simple:
        return _trim_to_word_range(is_simple.group(1))

    nobody_match = re.match(r"nobody is pricing the (.+)", text, re.IGNORECASE)
    if nobody_match:
        noun = nobody_match.group(1).strip(" .,;")
        if "risk" not in noun:
            noun = f"{noun} risk"
        return _trim_to_word_range(noun)

    words = re.findall(r"[A-Za-z0-9']+", text)
    while words and words[0].lower() in _FLUFF_OPENERS:
        words.pop(0)
    if len(words) >= 2:
        return _trim_to_word_range(" ".join(words))

    return None


def claim_summary(
    source_title: str | None,
    source_body: str | None,
) -> str | None:
    """Return a 2–8 word clean thesis for reply templates, or None if unusable."""
    for part in (source_title, source_body):
        cleaned = clean_source_claim(part)
        if not cleaned:
            continue
        summary = _extract_thesis(cleaned)
        if summary:
            return summary
    return None


def is_broken_reply_grammar(
    text: str,
    *,
    source_title: str | None = None,
    source_body: str | None = None,
) -> bool:
    """Reject replies with nested headlines or malformed claim injection."""
    if not text or not text.strip():
        return True

    lower = text.lower()
    for pattern in _BROKEN_REPLY_PATTERNS:
        if pattern.search(text):
            return True

    if lower.count("may be right, but") > 1:
        return True

    if re.search(r"the data on [A-Z]", text):
        return True

    for raw in (source_title, source_body):
        if not raw:
            continue
        raw_line = str(raw).split("\n", 1)[0].strip()
        if len(raw_line.split()) > 12 and raw_line.lower() in lower:
            return True

    cleaned = clean_source_claim(source_title) or clean_source_claim(source_body)
    if cleaned and len(cleaned.split()) > 12 and cleaned.lower() in lower:
        return True

    return False
