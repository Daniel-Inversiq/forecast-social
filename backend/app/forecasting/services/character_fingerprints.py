"""Linguistic fingerprints for Season 1 core agents — blind-identification scoring."""

from __future__ import annotations

import random
import re
from dataclasses import dataclass
from typing import Any

from app.forecasting.agent_status import CORE_AGENT_SLUGS
from app.forecasting.character_bibles import character_bible_for, voice_rules_for
from app.forecasting.services.copy_sanitize import safe_signature_phrases

# (pattern, weight) — higher = stronger signal for this agent
_MARKER: dict[str, list[tuple[str, float]]] = {
    "doombot": [
        (r"consensus is (usually )?late", 4.0),
        (r"soft landing.{0,20}cope|cope.{0,20}soft landing", 3.5),
        (r"that's late[- ]cycle thinking", 4.5),
        (r"everyone believes that right before it breaks", 4.5),
        (r"fragility doesn't disappear", 4.0),
        (r"\b(recession|fragility|credit impulse|bear market rally)\b", 2.5),
        (r"priced for perfection", 2.5),
        (r"\bthe tape\b", 2.0),
        (r"early, not wrong", 2.5),
        (r"not a pivot|a hold is not", 2.0),
        (r"consensus is priced", 2.0),
        (r"mechanism (remains|intact)", 1.8),
        (r"the crowd bought the narrative", 2.0),
        (r"wrong domain|injury rumor is not a credit", 3.0),
    ],
    "bullbot": [
        (r"you're fighting the tape", 4.5),
        (r"buyers keep showing up", 4.5),
        (r"still too bearish", 4.0),
        (r"the dip is still there", 4.0),
        (r"still buying", 3.5),
        (r"crowd (is |still )?(scared|underpositioned)", 3.0),
        (r"\b(momentum|reflexivity|rip|risk.on)\b", 2.5),
        (r"timing is the job", 2.5),
        (r"the bid is (still )?there|the bid didn't leave", 3.0),
        (r"entry level|next setup|next rip loading", 2.0),
        (r"sold the news", 2.0),
        (r"upside", 1.5),
        (r"fade setup, not a thesis", 3.0),
    ],
    "fed-watcher": [
        (r"the curve disagrees", 4.5),
        (r"front[- ]end moved first", 4.5),
        (r"rates saw it already", 4.0),
        (r"\b2s10s\b", 4.0),
        (r"front[- ]end", 3.5),
        (r"\b(dot plot|fomc|september modal)\b", 3.0),
        (r"yield curve", 3.0),
        (r"\b(bps|basis point)\b", 2.5),
        (r"curve (steepen|flatten|invert)", 2.5),
        (r"market pricing.{0,30}cut|cut.{0,30}priced", 2.0),
        (r"the curve is the signal", 3.5),
        (r"cpi|nfp|statement language", 2.0),
        (r"desk literal|path repriced|path first", 2.0),
        (r"dot plot and market diverge", 3.5),
    ],
    "macro-oracle": [
        (r"you're focused on the headline", 4.5),
        (r"my horizon is longer", 4.5),
        (r"the cycle matters more", 4.0),
        (r"\bmy read:", 3.5),
        (r"\bthe data suggests:", 3.0),
        (r"\b(regime|horizon|liquidity impulse)\b", 2.5),
        (r"probability.{0,20}\d+%", 2.5),
        (r"narrative.{0,20}overshoot", 2.5),
        (r"cycle read|not moving off", 2.0),
        (r"updating the model|model updated", 2.0),
        (r"what (moved|did not move)", 2.0),
        (r"data over narratives", 2.5),
        (r"wait for the revision", 2.0),
        (r"timing and regime are different", 3.0),
    ],
    "sports-chaos": [
        (r"the crowd loves that story", 4.5),
        (r"favorites get overpriced", 4.5),
        (r"chaos still pays", 4.0),
        (r"\b(line|spread|cover|underdog)\b", 3.0),
        (r"upset probability", 3.5),
        (r"\bchaos\b", 2.5),
        (r"public (favourite|favorite|money|sentiment)", 3.0),
        (r"market pricing.{0,20}\d+%", 2.5),
        (r"taking the (underdog|other side)", 3.0),
        (r"injury|late scratch|line moved", 2.5),
        (r"momentum beats sentiment", 3.0),
        (r"not a fan", 2.0),
        (r"champions league|sunday|different sport", 2.0),
        (r"line still wrong", 3.5),
    ],
}

# Signals that strongly suggest a *different* agent wrote this
_CROSS_CONTAMINATION: dict[str, list[tuple[str, float]]] = {
    "doombot": [
        (r"still buying|the dip is still there", -4.0),
        (r"\b2s10s\b|dot plot|front[- ]end", -2.5),
        (r"upset probability|the line is|cover -", -3.0),
    ],
    "bullbot": [
        (r"consensus is usually late|soft landing is cope", -4.0),
        (r"\b2s10s\b|september modal", -2.5),
        (r"upset probability|chiefs cover", -3.0),
    ],
    "fed-watcher": [
        (r"still buying|soft landing is cope", -3.0),
        (r"upset probability|chiefs|underdog side", -4.0),
        (r"chaos is the model", -2.5),
    ],
    "macro-oracle": [
        (r"still buying|chiefs cover", -3.0),
        (r"\b2s10s\b.{0,10}unchanged", -1.5),
    ],
    "sports-chaos": [
        (r"\b2s10s\b|dot plot|fomc", -4.0),
        (r"soft landing is cope|recession window", -3.5),
        (r"liquidity impulse|credit impulse", -2.5),
    ],
}

_HEDGE_WORDS = re.compile(
    r"\b(perhaps|might|could|maybe|potentially|i think|in my view|i believe)\b",
    re.I,
)

_STAMP_OPENERS: dict[str, list[str]] = {
    "doombot": [
        "Consensus is usually late.",
        "Soft landing is cope.",
        "The tape does not lie. The narrative does.",
        "Priced for perfection.",
    ],
    "bullbot": [
        "The dip is still there. Still buying.",
        "Crowd is scared. Momentum persists.",
        "The bid is still there.",
        "Timing is the job.",
    ],
    "fed-watcher": [
        "Front-end leads. Drama lags.",
        "2s10s unchanged. Curve is the signal.",
        "September modal repriced.",
        "Dot plot says one thing. Market prices another.",
    ],
    "macro-oracle": [
        "My read: the narrative overshot the data.",
        "Regime clock advanced — horizon matters more than the headline.",
        "Probability updated. Data over narratives.",
        "The gap between what moved and what matters is widening.",
    ],
    "sports-chaos": [
        "Line still wrong. Chaos is the model.",
        "Upset probability underpriced. Public money on the favourite.",
        "Momentum beats sentiment.",
        "Taking the underdog side.",
    ],
}

_MIN_FINGERPRINT_SCORE = 2.0
_MIN_IDENTIFICATION_MARGIN = 0.8


@dataclass(frozen=True)
class FingerprintScore:
    slug: str
    score: float
    marker_hits: int
    contamination: float

    @property
    def passes(self) -> bool:
        return self.score >= _MIN_FINGERPRINT_SCORE


@dataclass(frozen=True)
class IdentificationResult:
    predicted_slug: str
    confidence: float
    scores: dict[str, float]
    correct: bool | None = None


def _compile_markers(slug: str) -> list[tuple[re.Pattern[str], float]]:
    out: list[tuple[re.Pattern[str], float]] = []
    for pattern, weight in _MARKER.get(slug, []):
        out.append((re.compile(pattern, re.I), weight))
    for pattern, weight in _CROSS_CONTAMINATION.get(slug, []):
        out.append((re.compile(pattern, re.I), weight))
    bible = character_bible_for(slug)
    for phrase in bible.get("signature_phrases") or []:
        if phrase and len(str(phrase)) > 8:
            out.append((re.compile(re.escape(str(phrase)), re.I), 2.5))
    return out


_CACHED_MARKERS: dict[str, list[tuple[re.Pattern[str], float]]] = {
    slug: _compile_markers(slug) for slug in CORE_AGENT_SLUGS
}


def score_fingerprint(slug: str, text: str) -> FingerprintScore:
    lower = text.lower().strip()
    if not lower:
        return FingerprintScore(slug, 0.0, 0, 0.0)

    total = 0.0
    hits = 0
    contamination = 0.0
    for pattern, weight in _CACHED_MARKERS.get(slug, []):
        if pattern.search(lower):
            total += weight
            if weight > 0:
                hits += 1
            else:
                contamination += abs(weight)

    rules = voice_rules_for(slug)
    max_s = int(rules.get("max_sentences") or 3)
    sentence_count = len(re.split(r"(?<=[.!?])\s+", text.strip()))
    if slug == "doombot" and sentence_count <= 2:
        total += 1.0
    elif slug == "macro-oracle" and sentence_count >= 3:
        total += 0.8
    elif sentence_count <= max_s:
        total += 0.5

    if slug == "doombot" and not _HEDGE_WORDS.search(lower):
        total += 1.0
    elif slug != "doombot" and _HEDGE_WORDS.search(lower) and slug in ("bullbot", "fed-watcher", "sports-chaos"):
        total -= 1.5

    if slug == "fed-watcher" and re.search(r"\d", lower):
        total += 0.8

    return FingerprintScore(slug, round(total, 3), hits, contamination)


def fingerprint_passes(slug: str, text: str) -> bool:
    return score_fingerprint(slug, text).passes


def identify_author(text: str) -> IdentificationResult:
    """Blind-classify text to the most likely core agent."""
    scores = {slug: score_fingerprint(slug, text).score for slug in CORE_AGENT_SLUGS}
    ranked = sorted(scores.items(), key=lambda x: (-x[1], x[0]))
    best_slug, best_score = ranked[0]
    second_score = ranked[1][1] if len(ranked) > 1 else 0.0
    margin = best_score - second_score
    confidence = min(1.0, max(0.0, (best_score / 6.0) * 0.6 + (margin / 3.0) * 0.4))
    if best_score < 1.0:
        confidence *= 0.5
    return IdentificationResult(
        predicted_slug=best_slug,
        confidence=round(confidence, 3),
        scores=scores,
    )


def blind_identify_correct(actual_slug: str, text: str) -> bool:
    result = identify_author(text)
    if result.predicted_slug == actual_slug:
        return True
    # Macro/bull both macro — require stronger margin to count as wrong
    macro_pair = {"doombot", "bullbot", "macro-oracle", "fed-watcher"}
    if actual_slug in macro_pair and result.predicted_slug in macro_pair:
        actual_score = result.scores.get(actual_slug, 0.0)
        predicted_score = result.scores.get(result.predicted_slug, 0.0)
        return actual_score >= predicted_score - 0.5
    return False


def _dedupe_sentences(text: str) -> str:
    sentences = [s.strip() for s in re.split(r"(?<=[.!?])\s+", text.strip()) if s.strip()]
    seen: set[str] = set()
    out: list[str] = []
    for s in sentences:
        key = re.sub(r"\s+", " ", s.lower())
        if key in seen:
            continue
        seen.add(key)
        out.append(s)
    return " ".join(out)


def stamp_fingerprint(slug: str, text: str, *, seed: int | None = None) -> str:
    """Inject agent-specific linguistic markers when copy is too generic."""
    cleaned = _dedupe_sentences(text.strip())
    if fingerprint_passes(slug, cleaned):
        return cleaned

    rng = random.Random(seed)
    opener = rng.choice(_STAMP_OPENERS.get(slug, [""]))
    if not opener:
        return cleaned

    lower = cleaned.lower()
    if opener.lower().rstrip(".") in lower:
        return cleaned

    sig = safe_signature_phrases(slug)
    if sig and rng.random() < 0.4:
        extra = rng.choice(sig)
        if extra.lower() not in lower:
            if slug == "macro-oracle":
                return f"{opener}\n{extra}\n{cleaned}"
            return f"{opener} {cleaned}"

    if slug == "macro-oracle":
        return f"{opener}\n{cleaned}"
    if slug == "doombot":
        return f"{opener}\n{cleaned}"
    return f"{opener} {cleaned}"


def blind_review_batch(
    rows: list[Any],
    *,
    text_fn: Any | None = None,
) -> dict[str, Any]:
    """
    Blind-classify a batch of generated activities.
    Returns accuracy and per-agent breakdown.
    """
    if text_fn is None:
        text_fn = lambda r: f"{getattr(r, 'title', '')} {getattr(r, 'body', '')}".strip()

    results: list[dict[str, Any]] = []
    correct = 0
    by_agent: dict[str, dict[str, int]] = {}

    for row in rows:
        actual = getattr(row, "agent_slug", None) or row.get("agent_slug")
        text = text_fn(row)
        predicted = identify_author(text)
        ok = predicted.predicted_slug == str(actual)
        if ok:
            correct += 1
        bucket = by_agent.setdefault(
            str(actual),
            {"total": 0, "correct": 0, "misidentified_as": {}},
        )
        bucket["total"] += 1
        if ok:
            bucket["correct"] += 1
        else:
            mis = predicted.predicted_slug
            bucket["misidentified_as"][mis] = bucket["misidentified_as"].get(mis, 0) + 1
        results.append(
            {
                "actual_slug": actual,
                "predicted_slug": predicted.predicted_slug,
                "correct": ok,
                "confidence": predicted.confidence,
                "scores": predicted.scores,
                "text_preview": text[:160],
            }
        )

    total = len(rows)
    return {
        "total": total,
        "correct": correct,
        "accuracy": round(correct / total, 4) if total else 0.0,
        "accuracy_pct": round(100 * correct / total, 1) if total else 0.0,
        "by_agent": by_agent,
        "samples": results[:20],
    }


def enforce_character_dominance(
    slug: str,
    text: str,
    *,
    seed: int | None = None,
) -> tuple[str, dict[str, Any]]:
    """Polish + stamp until fingerprint passes (max 3 attempts)."""
    meta: dict[str, Any] = {}
    current = _dedupe_sentences(text)
    for attempt in range(3):
        fp = score_fingerprint(slug, current)
        meta["fingerprint_score"] = fp.score
        meta["fingerprint_hits"] = fp.marker_hits
        if fp.passes:
            meta["fingerprint_stamped"] = attempt > 0
            return current, meta
        current = stamp_fingerprint(slug, current, seed=(seed or 0) + attempt * 313)
    meta["fingerprint_stamped"] = True
    meta["fingerprint_weak"] = True
    return current, meta
