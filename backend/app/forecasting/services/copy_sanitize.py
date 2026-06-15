"""Final gate: block prompt instructions and unresolved template placeholders from feed copy."""

from __future__ import annotations

import re
from difflib import SequenceMatcher
from functools import lru_cache
from typing import Any, Callable

from app.forecasting.agent_status import CORE_AGENT_SLUGS
from app.forecasting.character_bibles import character_bible_for
from app.forecasting.services.utils import hash_seed

BRACKET_PLACEHOLDER = re.compile(r"\[[^\]]+\]")

INSTRUCTION_SUBSTRINGS: tuple[str, ...] = (
    "interpret fed data bullishly",
    "draw the optimistic conclusion from neutral data",
    "draw the optimistic conclusion",
    "do not copy verbatim",
    "do not include confidence line",
    "match this style",
    "output only the post body",
    "generate a counter for",
    "generate a post for",
    "rivalry behavior toward",
    "relationship dynamic with",
    "your core beliefs to defend",
)

INSTRUCTION_LINE_PATTERNS: tuple[re.Pattern[str], ...] = (
    re.compile(r"(?i)^template:\s"),
    re.compile(r"(?i)^use this\b"),
    re.compile(r"(?i)^do not\b"),
    re.compile(r"(?i)^never post about:"),
    re.compile(r"(?i)^format:\s"),
    re.compile(r"(?i)^example \d+:"),
    re.compile(r"(?i)^## (voice examples|relationship context|memory guidance)"),
)

HEADLINE_INSTRUCTION_MARKERS = re.compile(
    r"(?i)(^|\b)(interpret|draw the|template:|use this|do not)\b"
)

PLACEHOLDER_UPDATING_MODEL = re.compile(
    r"(?i)my read:\s*(\[\s*\]|\[\w+\]|\.?\s*)?\s*updating the model\.?\s*$"
)

REPEATED_SENTENCE_SIMILARITY = 0.85
_SENTENCE_SPLIT = re.compile(r"(?<=[.!?])\s+")
_WORD_KEY = re.compile(r"\w+")


def has_bracket_placeholder(text: str) -> bool:
    return bool(BRACKET_PLACEHOLDER.search(text or ""))


def strip_bracket_placeholders(text: str) -> str:
    if not text:
        return ""
    out = BRACKET_PLACEHOLDER.sub("", text)
    out = re.sub(r"\s{2,}", " ", out)
    out = re.sub(r"\s+([,.!?])", r"\1", out)
    out = re.sub(r":\s*\.", ":", out)
    out = re.sub(r"\.\s*\.", ".", out)
    return out.strip()


def safe_signature_phrases(slug: str) -> list[str]:
    bible = character_bible_for(slug)
    out: list[str] = []
    for phrase in bible.get("signature_phrases") or []:
        p = str(phrase).strip()
        if not p or has_bracket_placeholder(p):
            continue
        if HEADLINE_INSTRUCTION_MARKERS.search(p):
            continue
        out.append(p)
    return out


def is_headline_pool_candidate(phrase: str) -> bool:
    p = str(phrase).strip()
    if not p or len(p) < 8:
        return False
    if has_bracket_placeholder(p):
        return False
    if HEADLINE_INSTRUCTION_MARKERS.search(p):
        return False
    return True


@lru_cache(maxsize=1)
def _forbidden_instruction_corpus() -> frozenset[str]:
    corpus: set[str] = set(INSTRUCTION_SUBSTRINGS)
    for slug in CORE_AGENT_SLUGS:
        bible = character_bible_for(slug)
        rivalry = bible.get("rivalry_behavior") or {}
        if isinstance(rivalry, dict):
            for val in rivalry.values():
                text = str(val).strip()
                if text:
                    corpus.add(text.lower())
                    for sentence in re.split(r"(?<=[.!?])\s+", text):
                        s = sentence.strip().lower()
                        if len(s) >= 24:
                            corpus.add(s)
        receipt = bible.get("receipt_behavior") or {}
        if isinstance(receipt, dict):
            for key in ("on_miss", "reference_receipts"):
                block = str(receipt.get(key) or "")
                for line in block.splitlines():
                    line = line.strip()
                    if line.lower().startswith("template:"):
                        corpus.add(line[9:].strip().strip('"').lower())
                    if has_bracket_placeholder(line) and len(line) >= 20:
                        corpus.add(re.sub(r"\[[^\]]+\]", "", line).strip().lower())
        for ex in bible.get("example_good_posts") or []:
            ex_text = str(ex).strip()
            if len(ex_text) >= 80:
                corpus.add(ex_text.lower())
    return frozenset(corpus)


def split_sentences(text: str) -> list[str]:
    parts = _SENTENCE_SPLIT.split(text.strip())
    return [p.strip() for p in parts if p.strip()]


def _sentence_key(sentence: str) -> str:
    return " ".join(_WORD_KEY.findall(sentence.lower()))


def has_repeated_sentence(text: str, *, threshold: float = REPEATED_SENTENCE_SIMILARITY) -> bool:
    """True when the same sentence appears twice or intra-reply similarity exceeds threshold."""
    sentences = split_sentences(text)
    if len(sentences) < 2:
        return False
    keys: list[str] = []
    for sentence in sentences:
        key = _sentence_key(sentence)
        if not key:
            continue
        if key in keys:
            return True
        if any(SequenceMatcher(None, key, prev).ratio() >= threshold for prev in keys):
            return True
        keys.append(key)
    return False


def contains_instruction_leak(text: str) -> bool:
    if not text:
        return False
    lower = text.lower()
    for forbidden in _forbidden_instruction_corpus():
        if len(forbidden) >= 20 and forbidden in lower:
            return True
    for pat in INSTRUCTION_LINE_PATTERNS:
        if pat.search(text):
            return True
    for sub in INSTRUCTION_SUBSTRINGS:
        if sub in lower:
            return True
    if PLACEHOLDER_UPDATING_MODEL.search(text.strip()):
        return True
    if re.match(r"(?i)^updating the model\.?\s*$", text.strip()):
        return True
    return False


def detect_copy_leak(slug: str, text: str) -> list[str]:
    reasons: list[str] = []
    if not text or not text.strip():
        return reasons
    if has_bracket_placeholder(text):
        reasons.append("bracket_placeholder")
    if contains_instruction_leak(text):
        reasons.append("instruction_leak")
    return reasons


def detect_copy_quality_issues(text: str) -> list[str]:
    reasons: list[str] = []
    if not text or not text.strip():
        return reasons
    if has_repeated_sentence(text):
        reasons.append("repeated_sentence")
    return reasons


def copy_needs_sanitize(slug: str, text: str) -> bool:
    return bool(detect_copy_leak(slug, text) or detect_copy_quality_issues(text))


def safe_agent_headline(slug: str, *, seed: int | None = None) -> str:
    from app.forecasting.services.opinion_headlines import OPINION_HEADLINES

    pool = list(OPINION_HEADLINES.get(slug, ()))
    pool = [p for p in pool if is_headline_pool_candidate(p)]
    if not pool:
        pool = ["Timing edge still intact."]
    idx = hash_seed(slug, str(seed or 0)) % len(pool)
    return pool[idx]


def safe_agent_body(slug: str, *, seed: int | None = None) -> str:
    from app.forecasting.services.opinion_headlines import OPINION_HEADLINES

    headlines = OPINION_HEADLINES.get(slug, ())
    if headlines:
        idx = (hash_seed(slug, str(seed or 0), "body") + 1) % len(headlines)
        return str(headlines[idx])
    return ""


def safe_conversational_line(slug: str, *, seed: int | None = None) -> str:
    """Deterministic short line when reply copy fails quality gates."""
    from app.forecasting.services.voice_engine import agent_specific_opener

    line = agent_specific_opener(slug, seed=seed or 0)
    if has_repeated_sentence(line):
        line = safe_agent_headline(slug, seed=seed)
    return line[:255]


def _rewrite_copy(slug: str, title: str, body: str, *, seed: int | None) -> tuple[str, str]:
    t = strip_bracket_placeholders(title)
    b = strip_bracket_placeholders(body)
    if not t and b:
        lines = [ln.strip() for ln in b.splitlines() if ln.strip()]
        t = lines[0] if lines else b[:200]
        b = "\n".join(lines[1:]) if len(lines) > 1 else ""
    if detect_copy_leak(slug, f"{t}\n{b}".strip()):
        t = safe_agent_headline(slug, seed=seed)
        if detect_copy_leak(slug, b):
            b = ""
    return t[:255], b


def finalize_persisted_copy(
    slug: str,
    title: str,
    body: str,
    *,
    seed: int | None = None,
    regenerate: Callable[[], tuple[str, str]] | None = None,
    db: Any | None = None,
) -> tuple[str, str, dict[str, Any]]:
    """
    Sanitize title/body before persistence.
    On leak: rewrite → optional regenerate once → safe agent fallback.
    """
    from app.forecasting.services.idea_fatigue import apply_idea_fatigue
    from app.forecasting.services.phrase_fatigue import apply_phrase_fatigue

    meta: dict[str, Any] = {}
    t, b = title, body
    if db is not None:
        t, b, fatigue_meta = apply_phrase_fatigue(db, slug, t, b, seed=seed)
        if fatigue_meta:
            meta.update(fatigue_meta)
    t, b, idea_meta = apply_idea_fatigue(db, slug, t, b, seed=seed)
    if idea_meta:
        meta.update(idea_meta)
    combined = f"{t}\n{b}".strip()

    if not copy_needs_sanitize(slug, combined):
        return t[:255], b, meta

    meta["copy_sanitize"] = "rewrite"
    t, b = _rewrite_copy(slug, t, b, seed=seed)
    combined = f"{t}\n{b}".strip()
    if not copy_needs_sanitize(slug, combined):
        return t[:255], b, meta

    if regenerate is not None:
        meta["copy_sanitize"] = "regenerate"
        try:
            rt, rb = regenerate()
            t, b = _rewrite_copy(slug, rt, rb, seed=(seed or 0) + 7919)
            combined = f"{t}\n{b}".strip()
            if not copy_needs_sanitize(slug, combined):
                return t[:255], b, meta
        except Exception:  # noqa: BLE001 — fall through to safe line
            pass

    meta["copy_sanitize"] = "safe_fallback"
    t = safe_conversational_line(slug, seed=seed)
    b = safe_agent_body(slug, seed=seed)
    combined = f"{t}\n{b}".strip()
    if copy_needs_sanitize(slug, combined):
        t = safe_agent_headline(slug, seed=(seed or 0) + 17)
        b = ""
    return t[:255], b, meta


def assert_clean_copy(slug: str, title: str, body: str) -> None:
    """Test helper — raises AssertionError on any leak."""
    reasons = detect_copy_leak(slug, f"{title}\n{body}".strip())
    if reasons:
        raise AssertionError(
            f"{slug} copy leak {reasons}: title={title!r} body={body!r}"
        )
