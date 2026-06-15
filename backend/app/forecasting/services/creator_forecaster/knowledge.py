"""PDF knowledge extraction and compact context for creator forecasters."""

from __future__ import annotations

import os
import re
import unicodedata
from io import BytesIO
from typing import Any

from app.settings import knowledge_extract_max_chars

PDF_PROCESSING_UNAVAILABLE_MSG = "PDF processing dependency not installed."
PDF_PARSE_FAILED_MSG = "PDF could not be parsed"

CLAIM_MIN_LEN = 24
CLAIM_MAX_LEN = 220
SUMMARY_MAX_LEN = 480
THEME_MAX = 5


def _import_pdf_reader():
    """
    Import pypdf on demand so installs after process start are picked up on the next call.
    Returns (PdfReader class, None) or (None, exception).
    """
    try:
        from pypdf import PdfReader

        return PdfReader, None
    except Exception as exc:  # ImportError and any broken install
        return None, exc


def pdf_processing_available() -> bool:
    """True when pypdf can be imported."""
    reader, _err = _import_pdf_reader()
    return reader is not None


def pdf_processing_import_error() -> Exception | None:
    """Last import failure, if any (for logging/diagnostics)."""
    _reader, err = _import_pdf_reader()
    return err


def log_pdf_processing_status() -> None:
    """Startup log — whether PDF text extraction is available."""
    reader, err = _import_pdf_reader()
    available = reader is not None
    print(f"PDF processing available: {available}")
    if err is not None:
        print(f"PDF processing import error: {type(err).__name__}: {err}")


def _require_pdf_processing():
    reader, err = _import_pdf_reader()
    if reader is None:
        raise RuntimeError(PDF_PROCESSING_UNAVAILABLE_MSG) from err
    return reader


def sanitize_filename(name: str) -> str:
    """Strip path components and unsafe characters from upload filenames."""
    base = os.path.basename(name or "document.pdf").strip()
    base = unicodedata.normalize("NFKD", base)
    base = re.sub(r"[^\w.\- ]+", "", base, flags=re.UNICODE)
    base = re.sub(r"\s+", " ", base).strip()
    if not base.lower().endswith(".pdf"):
        base = f"{base}.pdf" if base else "document.pdf"
    return base[:200] or "document.pdf"


def extract_pdf_text(content: bytes) -> str:
    """Extract plain text from a PDF byte stream. No OCR."""
    PdfReader = _require_pdf_processing()
    try:
        reader = PdfReader(BytesIO(content))
        parts: list[str] = []
        for page in reader.pages:
            try:
                text = page.extract_text() or ""
            except Exception:
                text = ""
            if text.strip():
                parts.append(text.strip())
        return "\n\n".join(parts)
    except RuntimeError:
        raise
    except Exception as exc:
        raise ValueError(PDF_PARSE_FAILED_MSG) from exc


def _normalize_whitespace(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def _split_sentences(text: str) -> list[str]:
    chunks = re.split(r"(?<=[.!?])\s+", text)
    return [c.strip() for c in chunks if len(c.strip()) >= CLAIM_MIN_LEN]


def _score_sentence(sentence: str) -> float:
    score = min(len(sentence) / 120.0, 1.5)
    if re.search(
        r"\b(therefore|because|likely|expect|forecast|predict|suggest|indicate|trend|risk|growth|decline|increase|decrease)\b",
        sentence,
        re.I,
    ):
        score += 0.6
    if re.search(r"\b\d+(?:\.\d+)?%|\$\d", sentence):
        score += 0.4
    return score


def _extract_key_claims(text: str, *, min_claims: int = 5, max_claims: int = 12) -> list[str]:
    sentences = _split_sentences(text)
    if not sentences:
        return []

    ranked = sorted(sentences, key=_score_sentence, reverse=True)
    claims: list[str] = []
    seen: set[str] = set()
    for sentence in ranked:
        norm = _normalize_whitespace(sentence.lower())[:80]
        if norm in seen:
            continue
        seen.add(norm)
        claim = sentence[:CLAIM_MAX_LEN].strip()
        if len(claim) >= CLAIM_MIN_LEN:
            claims.append(claim)
        if len(claims) >= max_claims:
            break

    if len(claims) < min_claims:
        for sentence in sentences:
            norm = _normalize_whitespace(sentence.lower())[:80]
            if norm in seen:
                continue
            seen.add(norm)
            claims.append(sentence[:CLAIM_MAX_LEN].strip())
            if len(claims) >= min_claims:
                break
    return claims[:max_claims]


def _build_summary(text: str, claims: list[str]) -> str:
    if claims:
        lead = claims[0]
        if len(lead) > 180:
            lead = lead[:177].rstrip() + "..."
        extra = ""
        if len(claims) > 1:
            extra = f" Also covers: {claims[1][:100].rstrip('.')}."
        summary = f"{lead}{extra}"
    else:
        summary = text[:SUMMARY_MAX_LEN]
    return summary[:SUMMARY_MAX_LEN]


def _recurring_themes(claims: list[str]) -> list[str]:
    stop = {
        "the", "and", "for", "that", "with", "this", "from", "will", "have", "been",
        "their", "they", "are", "was", "but", "not", "can", "may", "more", "than",
    }
    freq: dict[str, int] = {}
    for claim in claims:
        for word in re.findall(r"[a-zA-Z]{4,}", claim.lower()):
            if word in stop:
                continue
            freq[word] = freq.get(word, 0) + 1
    ranked = sorted(freq.items(), key=lambda x: (-x[1], x[0]))
    return [w for w, _ in ranked[:THEME_MAX]]


def process_pdf_content(content: bytes) -> dict[str, Any]:
    """
    Extract text, summary, and key claims from PDF bytes.
    Returns dict with extracted_text, summary, key_claims, themes.
    Raises ValueError when text cannot be extracted or parsed.
    Raises RuntimeError when pypdf is not installed.
    """
    raw = extract_pdf_text(content)
    text = _normalize_whitespace(raw)
    if not text:
        raise ValueError("No extractable text in PDF")

    max_chars = knowledge_extract_max_chars()
    if len(text) > max_chars:
        text = text[:max_chars].rsplit(" ", 1)[0] + "..."

    claims = _extract_key_claims(text)
    summary = _build_summary(text, claims)
    themes = _recurring_themes(claims)

    return {
        "extracted_text": text,
        "summary": summary,
        "key_claims": claims,
        "themes": themes,
    }


def build_compact_context(sources: list[Any]) -> dict[str, Any] | None:
    """
    Merge ready knowledge sources into a compact generation context.
    Does not include full raw extracted text.
    """
    ready = [s for s in sources if getattr(s, "status", None) == "ready"]
    if not ready:
        return None

    summaries: list[str] = []
    claims: list[str] = []
    themes: list[str] = []
    filenames: list[str] = []

    for src in ready:
        if src.summary:
            summaries.append(src.summary.strip())
        if src.key_claims_json:
            claims.extend(src.key_claims_json)
        if src.filename:
            filenames.append(src.filename)
        theme_data = (src.key_claims_json or []) + ([src.summary] if src.summary else [])
        themes.extend(_recurring_themes([str(x) for x in theme_data if x]))

    unique_claims: list[str] = []
    seen: set[str] = set()
    for claim in claims:
        key = claim.lower()[:60]
        if key not in seen:
            seen.add(key)
            unique_claims.append(claim)

    unique_themes: list[str] = []
    seen_themes: set[str] = set()
    for theme in themes:
        if theme not in seen_themes:
            seen_themes.add(theme)
            unique_themes.append(theme)

    combined_summary = " ".join(summaries)[:SUMMARY_MAX_LEN] if summaries else ""

    return {
        "summary": combined_summary,
        "key_claims": unique_claims[:12],
        "themes": unique_themes[:THEME_MAX],
        "source_count": len(ready),
        "source_filenames": filenames,
    }


def knowledge_flavor_phrase(knowledge: dict[str, Any] | None, rng: Any) -> str:
    """Pick a short phrase from knowledge context for template weaving."""
    if not knowledge:
        return ""
    pool: list[str] = []
    pool.extend(knowledge.get("key_claims") or [])
    themes = knowledge.get("themes") or []
    pool.extend(f"{t} dynamics" for t in themes[:3])
    if knowledge.get("summary"):
        pool.append(knowledge["summary"][:120])
    pool = [p.strip() for p in pool if p and len(p.strip()) >= 12]
    if not pool:
        return ""
    phrase = rng.choice(pool)
    if len(phrase) > 100:
        phrase = phrase[:97].rsplit(" ", 1)[0] + "..."
    return phrase


def serialize_source_public(source: Any) -> dict[str, Any]:
    """Public-safe serialization — no raw extracted text."""
    return {
        "id": source.id,
        "source_type": source.source_type,
        "filename": source.filename,
        "status": source.status,
        "summary": source.summary,
        "key_claims": source.key_claims_json or [],
        "created_at": source.created_at.isoformat(),
        "updated_at": source.updated_at.isoformat(),
    }
