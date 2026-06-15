"""Clean RSS/article text into editorial event-candidate summaries."""

from __future__ import annotations

import html
import re
from difflib import SequenceMatcher

# Strip script/style blocks before tag removal.
_SCRIPT_STYLE_RE = re.compile(r"<(script|style)[^>]*>.*?</\1>", re.IGNORECASE | re.DOTALL)
_TAG_RE = re.compile(r"<[^>]+>")
_CDATA_RE = re.compile(r"<!\[CDATA\[(.*?)\]\]>", re.DOTALL | re.IGNORECASE)

# Residual markup / feed artifacts.
_MALFORMED_MARKUP_RE = re.compile(
    r"(?:</?\s*[a-z][a-z0-9]*\s*>|<\s*/\s*>|&lt;/?[a-z][^&]*&gt;)",
    re.IGNORECASE,
)
_BROKEN_ENTITY_RE = re.compile(r"&(?:amp;)?#x?[0-9a-f]+;?", re.IGNORECASE)

_URL_RE = re.compile(r"https?://[^\s<>\]\)\"']+|www\.[^\s<>\]\)\"']+", re.IGNORECASE)
_EMAIL_RE = re.compile(r"\b[\w.+-]+@[\w-]+\.[\w.-]+\b")

_BOILERPLATE_PATTERNS: tuple[re.Pattern[str], ...] = tuple(
    re.compile(pattern, re.IGNORECASE | re.DOTALL)
    for pattern in (
        r"the post .+? appeared first on .+?\.?",
        r"appeared first on .+?\.?",
        r"\bcontinue reading\b.*$",
        r"\bread more\b.*$",
        r"\bview (?:in browser|on .+?)\b.*$",
        r"\bsubscribe to (?:our )?.+?newsletter\b.*$",
        r"\bsign up for .+? alerts\b.*$",
        r"^\s*image credit:.*$",
        r"^\s*photo:.*$",
        r"^\s*\[?\s*related:.*$",
    )
)

_READ_MORE_LINE_RE = re.compile(
    r"^\s*(\[?\s*)?(read more|continue reading|full story|see also|source:)\b.*$",
    re.IGNORECASE | re.MULTILINE,
)

_SENTENCE_SPLIT_RE = re.compile(r"(?<=[.!?])\s+")
_WORD_RE = re.compile(r"[a-z0-9]+", re.IGNORECASE)

_CATEGORY_LEADS: dict[str, str] = {
    "macro": "Markets are repricing",
    "geopolitics": "Geopolitical risk is shifting",
    "crypto": "Crypto markets are reacting",
    "ai": "The AI narrative is moving",
    "sports": "Sports markets are reacting",
    "climate": "Climate-policy risk is shifting",
    "politics": "Political odds are shifting",
}

_DEFAULT_SUMMARY_MAX = 480
_TITLE_MAX = 255


def decode_entities(text: str, *, rounds: int = 3) -> str:
    """Decode HTML entities, including double-encoded feeds."""
    value = text or ""
    for _ in range(rounds):
        decoded = html.unescape(value)
        if decoded == value:
            break
        value = decoded
    return value


def strip_html(raw: str) -> str:
    """Remove HTML tags and CDATA wrappers."""
    if not raw:
        return ""
    text = raw
    text = _CDATA_RE.sub(r"\1", text)
    text = _SCRIPT_STYLE_RE.sub(" ", text)
    text = re.sub(r"<br\s*/?>", " ", text, flags=re.IGNORECASE)
    text = re.sub(r"</p\s*>", ". ", text, flags=re.IGNORECASE)
    text = re.sub(r"</(?:div|li|h[1-6]|tr)>", " ", text, flags=re.IGNORECASE)
    text = _TAG_RE.sub(" ", text)
    return text


def remove_malformed_markup(text: str) -> str:
    text = _MALFORMED_MARKUP_RE.sub(" ", text)
    text = _BROKEN_ENTITY_RE.sub(" ", text)
    return text


def normalize_whitespace(text: str) -> str:
    text = text.replace("\u00a0", " ").replace("\u200b", "")
    text = re.sub(r"[\r\n\t]+", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def remove_boilerplate(text: str) -> str:
    cleaned = text
    for pattern in _BOILERPLATE_PATTERNS:
        cleaned = pattern.sub(" ", cleaned)
    cleaned = _READ_MORE_LINE_RE.sub(" ", cleaned)
    return normalize_whitespace(cleaned)


def remove_duplicate_urls(text: str) -> str:
    """Drop repeated URLs and lines that are only link clutter."""
    if not text:
        return ""
    seen: set[str] = set()
    parts: list[str] = []
    for chunk in re.split(r"(\s+)", text):
        if _URL_RE.fullmatch(chunk) or _URL_RE.match(chunk):
            key = chunk.rstrip(".,);]").lower()
            if key in seen:
                continue
            seen.add(key)
        parts.append(chunk)
    merged = "".join(parts)
    # Remove parenthetical blocks that are only URLs.
    merged = re.sub(r"\(\s*https?://[^)]+\)", " ", merged, flags=re.IGNORECASE)
    merged = re.sub(r"\[\s*https?://[^\]]+\]", " ", merged, flags=re.IGNORECASE)
    return normalize_whitespace(merged)


def _sentence_key(sentence: str) -> str:
    return " ".join(_WORD_RE.findall(sentence.lower()))


def dedupe_sentences(text: str) -> str:
    sentences = [s.strip() for s in _SENTENCE_SPLIT_RE.split(text) if s.strip()]
    if not sentences:
        return text.strip()
    kept: list[str] = []
    keys: list[str] = []
    for sentence in sentences:
        key = _sentence_key(sentence)
        if not key:
            continue
        if any(SequenceMatcher(None, key, prev).ratio() >= 0.88 for prev in keys):
            continue
        kept.append(sentence)
        keys.append(key)
    return " ".join(kept)


def truncate_at_sentence(text: str, max_len: int = _DEFAULT_SUMMARY_MAX) -> str:
    text = normalize_whitespace(text)
    if len(text) <= max_len:
        return text
    sentences = [s.strip() for s in _SENTENCE_SPLIT_RE.split(text) if s.strip()]
    if not sentences:
        cut = text[: max_len - 1].rsplit(" ", 1)[0]
        return (cut or text[:max_len]).rstrip(" ,;:") + "…"
    out: list[str] = []
    total = 0
    for sentence in sentences:
        next_len = total + len(sentence) + (1 if out else 0)
        if next_len > max_len and out:
            break
        out.append(sentence)
        total = next_len
    if not out:
        cut = text[: max_len - 1].rsplit(" ", 1)[0]
        return (cut or text[:max_len]).rstrip(" ,;:") + "…"
    return " ".join(out)


def clean_plaintext(raw: str) -> str:
    """Full cleaning pipeline for scraped article/RSS text."""
    text = decode_entities(raw or "")
    text = strip_html(text)
    text = decode_entities(text)
    text = remove_malformed_markup(text)
    text = remove_boilerplate(text)
    text = remove_duplicate_urls(text)
    text = _EMAIL_RE.sub("", text)
    text = dedupe_sentences(text)
    return normalize_whitespace(text)


def clean_event_title(raw: str) -> str:
    title = clean_plaintext(raw)
    title = re.sub(r"\s*[-|•]\s*$", "", title).strip()
    if len(title) > _TITLE_MAX:
        title = truncate_at_sentence(title, max_len=_TITLE_MAX - 1)
    return title or "Untitled event"


def _title_overlap_ratio(title: str, body: str) -> float:
    title_words = set(_WORD_RE.findall(title.lower()))
    body_words = set(_WORD_RE.findall(body.lower()))
    if not title_words or not body_words:
        return 0.0
    return len(title_words & body_words) / len(title_words)


def _compose_narrative(title: str, body: str, *, category: str | None) -> str:
    lead = _CATEGORY_LEADS.get((category or "macro").lower(), "The network is tracking")
    first_sentence = body.split(". ")[0].strip()
    if first_sentence and not first_sentence.endswith((".", "!", "?")):
        first_sentence += "."
    if len(first_sentence) < 40:
        return f"{title}. {lead} after fresh reporting hit the wire."
    return f"{title}. {lead} as {first_sentence[0].lower()}{first_sentence[1:]}"


def build_narrative_summary(
    title: str,
    raw_body: str,
    *,
    source_name: str | None = None,
    category: str | None = None,
    max_len: int = _DEFAULT_SUMMARY_MAX,
) -> str:
    """
    Turn cleaned excerpt + headline into an editorial candidate summary.
    """
    body = clean_plaintext(raw_body)
    title_clean = clean_event_title(title)

    if source_name:
        source_token = source_name.strip()
        body = re.sub(re.escape(source_token) + r"\s*[:|-]?\s*", "", body, flags=re.IGNORECASE)

    if not body:
        summary = _compose_narrative(title_clean, "", category=category)
        return truncate_at_sentence(summary, max_len=max_len)

    overlap = _title_overlap_ratio(title_clean, body)
    if overlap >= 0.92 and len(body) < 120:
        summary = _compose_narrative(title_clean, body, category=category)
    elif overlap >= 0.75:
        # Body mostly repeats title — keep title once and add the non-overlapping tail.
        tail = body
        if body.lower().startswith(title_clean.lower()):
            tail = body[len(title_clean) :].lstrip(" .:-")
        if len(tail) < 30:
            summary = _compose_narrative(title_clean, body, category=category)
        else:
            summary = f"{title_clean}. {tail}"
    else:
        summary = f"{title_clean}. {body}"

    summary = dedupe_sentences(summary)
    summary = remove_duplicate_urls(summary)
    summary = normalize_whitespace(summary)
    return truncate_at_sentence(summary, max_len=max_len)


def _looks_like_html_or_feed_clutter(text: str) -> bool:
    if not text:
        return False
    if "<" in text and ">" in text:
        return True
    if re.search(r"&(?:[a-z]{2,}|#x?[0-9a-f]+);", text, re.IGNORECASE):
        return True
    lowered = text.lower()
    if "read more" in lowered or "continue reading" in lowered or "appeared first on" in lowered:
        return True
    if len(_URL_RE.findall(text)) >= 2:
        return True
    return False


def prepare_candidate_text(
    *,
    title: str,
    summary: str,
    source_name: str | None = None,
    category: str | None = None,
) -> tuple[str, str, bool]:
    """
    Returns (clean_title, clean_summary, was_transformed).
    """
    raw_title = title or ""
    raw_summary = summary or ""
    clean_title = clean_event_title(raw_title)

    needs_narrative = (
        _looks_like_html_or_feed_clutter(raw_summary)
        or _looks_like_html_or_feed_clutter(raw_title)
        or not raw_summary.strip()
    )
    if needs_narrative:
        clean_summary = build_narrative_summary(
            clean_title,
            raw_summary or raw_title,
            source_name=source_name,
            category=category,
        )
    else:
        clean_summary = truncate_at_sentence(clean_plaintext(raw_summary))
        if len(clean_summary) < 40:
            clean_summary = build_narrative_summary(
                clean_title,
                raw_summary,
                source_name=source_name,
                category=category,
            )

    transformed = (
        clean_title != normalize_whitespace(decode_entities(raw_title))
        or clean_summary != normalize_whitespace(decode_entities(raw_summary))
    )
    return clean_title, clean_summary, transformed
