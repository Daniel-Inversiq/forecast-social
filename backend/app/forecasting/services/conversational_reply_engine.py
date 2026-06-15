"""Conversational voice layer — personality-driven rival replies, not market summaries."""

from __future__ import annotations

import random
import re
from dataclasses import dataclass
from typing import Any

from app.forecasting.agent_status import CORE_AGENT_SLUGS
from app.forecasting.services.character_fingerprints import identify_author

# Hard-reject analytical-summary templates (claim / counterclaim / market explanation voice).
ANALYTICAL_BANNED_PHRASES: tuple[str, ...] = (
    "the data on",
    "may be right, but",
    "is consistent with",
    "the conclusion assumes",
    "pricing what he is describing",
)

MAX_REPLY_SENTENCES = 3

# ---------------------------------------------------------------------------
# Disagreement styles — speaker personality drives tone, not market templates.
# ---------------------------------------------------------------------------

DISAGREEMENT_STYLES: dict[str, dict[str, Any]] = {
    "bullbot": {
        "traits": ("dismissive", "momentum-focused", "confident", "short"),
        "default_type": "momentum_dismissal",
    },
    "doombot": {
        "traits": ("cynical", "blunt", "fragility-focused"),
        "default_type": "fragility_warning",
    },
    "fed-watcher": {
        "traits": ("technical", "curve-focused", "data-first"),
        "default_type": "curve_disagreement",
    },
    "macro-oracle": {
        "traits": ("reflective", "regime-focused"),
        "default_type": "regime_horizon",
    },
    "sports-chaos": {
        "traits": ("contrarian", "crowd psychology"),
        "default_type": "crowd_overpriced",
    },
}

# Pair-specific disagreement types — derived from speaker × target worldview clash.
PAIR_DISAGREEMENT_TYPES: dict[tuple[str, str], str] = {
    ("bullbot", "doombot"): "momentum_vs_fragility",
    ("doombot", "bullbot"): "fragility_vs_momentum",
    ("bullbot", "fed-watcher"): "bid_vs_rates_path",
    ("fed-watcher", "bullbot"): "rates_path_vs_bid",
    ("bullbot", "macro-oracle"): "timing_vs_patience",
    ("macro-oracle", "bullbot"): "patience_vs_timing",
    ("doombot", "fed-watcher"): "credit_vs_curve",
    ("fed-watcher", "doombot"): "curve_vs_credit",
    ("doombot", "macro-oracle"): "fragility_vs_regime",
    ("macro-oracle", "doombot"): "regime_vs_fragility",
    ("fed-watcher", "macro-oracle"): "path_vs_regime",
    ("macro-oracle", "fed-watcher"): "regime_vs_path",
    ("sports-chaos", "doombot"): "chaos_vs_macro_funeral",
    ("doombot", "sports-chaos"): "macro_vs_noise",
    ("sports-chaos", "bullbot"): "upset_vs_macro_bid",
    ("bullbot", "sports-chaos"): "macro_bid_vs_chaos",
    ("sports-chaos", "fed-watcher"): "line_vs_curve",
    ("fed-watcher", "sports-chaos"): "curve_vs_line",
    ("sports-chaos", "macro-oracle"): "upset_vs_regime_poetry",
    ("macro-oracle", "sports-chaos"): "regime_vs_upset",
}

# Step 1 — disagreement sentences (required). Indexed by speaker slug.
_DISAGREEMENT: dict[str, list[str]] = {
    "bullbot": [
        "You're fighting the tape.",
        "Buyers keep showing up.",
        "Still too bearish.",
        "The bid didn't leave.",
        "Momentum hasn't broken.",
        "Crowd still scared — tape isn't.",
        "That's a fade setup, not a thesis.",
        "Risk-on didn't capitulate.",
        "The dip is still there.",
        "Still buying the bid.",
    ],
    "doombot": [
        "That's late-cycle thinking.",
        "Everyone believes that right before it breaks.",
        "Fragility doesn't disappear.",
        "Soft landing is cope.",
        "Consensus is usually late.",
        "The tape lies less than the narrative.",
        "Priced for perfection.",
        "Credit impulse already rolled.",
        "Mechanism intact — timing isn't.",
        "The crowd bought the narrative.",
    ],
    "fed-watcher": [
        "The curve disagrees.",
        "Front-end moved first.",
        "Rates saw it already.",
        "2s10s says path first.",
        "Dot plot and market diverge.",
        "Front-end leads — drama lags.",
        "September modal repriced.",
        "The curve is the signal.",
        "Desk literal — path repriced.",
        "Basis points moved before the headline.",
    ],
    "macro-oracle": [
        "You're focused on the headline.",
        "My horizon is longer.",
        "The cycle matters more.",
        "Narrative overshot the data.",
        "Timing and regime are different questions.",
        "My read: probability, not certainty.",
        "Liquidity impulse still matters.",
        "Regime clock advanced.",
        "Data over narratives.",
        "What moved is not what matters.",
    ],
    "sports-chaos": [
        "The crowd loves that story.",
        "Favorites get overpriced.",
        "Chaos still pays.",
        "Public money on the favourite.",
        "Line still wrong.",
        "Upset probability underpriced.",
        "Momentum beats sentiment.",
        "Taking the underdog side.",
        "Chaos is the model.",
        "Not a fan of the favourite price.",
    ],
}

# Step 2 — optional evidence sentences.
_EVIDENCE: dict[str, list[str]] = {
    "bullbot": [
        "Flows still risk-on.",
        "Breadth held on the dip.",
        "Positioning still light.",
        "The bid is still there.",
        "Crowd still underpositioned.",
    ],
    "doombot": [
        "Credit impulse already negative.",
        "Funding stress is compounding.",
        "Bear market rally, not a turn.",
        "Recession window still live.",
        "Fragility compounds on the lag.",
    ],
    "fed-watcher": [
        "2s10s unchanged — path repriced.",
        "Front-end leads the statement.",
        "Cut timing priced before the headline.",
        "Curve steepened into the print.",
        "Dot plot says one thing — market another.",
    ],
    "macro-oracle": [
        "Liquidity impulse still drives the cycle.",
        "Probability updated — patience.",
        "What did not move matters more.",
        "Cycle read unchanged.",
        "Wait for the revision.",
    ],
    "sports-chaos": [
        "Late scratch changes everything.",
        "Line moved — public didn't.",
        "Injury rumor repriced the upset.",
        "Spread still off fair value.",
        "Sunday chaos premium underpriced.",
    ],
}

# Step 3 — optional closing jabs.
_CLOSING_JABS: dict[str, list[str]] = {
    "bullbot": [
        "Still buying.",
        "Timing is the job.",
        "Next rip loading.",
        "Risk is the opportunity.",
        "Entry level found.",
    ],
    "doombot": [
        "Early, not wrong.",
        "Mechanism intact.",
        "Consensus is priced.",
        "Not a pivot.",
        "Credit breaks on the lag.",
    ],
    "fed-watcher": [
        "Curve is the signal.",
        "Desk literal.",
        "Path first.",
        "Front-end leads.",
        "September modal matters.",
    ],
    "macro-oracle": [
        "Data over narratives.",
        "Horizon matters.",
        "Regime over tick.",
        "Model updated.",
        "Probability, not drama.",
    ],
    "sports-chaos": [
        "Chaos is the model.",
        "Taking the underdog side.",
        "Line still wrong.",
        "Upset probability wins.",
        "Public asleep.",
    ],
}

# Pair-flavored disagreement overrides — target personality shapes the opening clash.
_PAIR_DISAGREEMENT: dict[tuple[str, str], list[str]] = {
    ("bullbot", "doombot"): [
        "You're fighting the tape.",
        "Cliff-call every time the chart breathes.",
        "Credit impulse lagged — momentum didn't.",
        "Still too bearish.",
    ],
    ("doombot", "bullbot"): [
        "That's late-cycle thinking.",
        "Pricing hope again.",
        "Everyone believes that right before it breaks.",
        "Fragility doesn't disappear.",
    ],
    ("fed-watcher", "macro-oracle"): [
        "The curve disagrees.",
        "Front-end moved first.",
        "Regime poetry is not September.",
        "Path first — horizon second.",
    ],
    ("macro-oracle", "fed-watcher"): [
        "You're focused on the headline.",
        "My horizon is longer.",
        "Dot plot is one input.",
        "The cycle matters more.",
    ],
    ("sports-chaos", "doombot"): [
        "Macro funeral planner meet Sunday injury report.",
        "Different sport.",
        "Credit impulse does not cover a late scratch.",
    ],
    ("doombot", "sports-chaos"): [
        "Injury rumor is not a credit cycle.",
        "Noise.",
        "Wrong domain.",
    ],
    ("sports-chaos", "bullbot"): [
        "The crowd loves that story.",
        "Macro bull meet Sunday line move.",
        "Favorites get overpriced.",
    ],
    ("bullbot", "sports-chaos"): [
        "Buyers keep showing up.",
        "Chaos premium — macro bid is still there.",
        "Different sport, same bid.",
    ],
}


@dataclass(frozen=True)
class ConversationalReply:
    speaker_slug: str
    target_slug: str
    disagreement_type: str
    line: str
    sentences: tuple[str, ...]
    generation_meta: dict[str, Any]


def resolve_disagreement_type(speaker_slug: str, target_slug: str) -> str:
    """Derive disagreement type from speaker personality × target worldview."""
    pair = PAIR_DISAGREEMENT_TYPES.get((speaker_slug, target_slug))
    if pair:
        return pair
    style = DISAGREEMENT_STYLES.get(speaker_slug, {})
    return str(style.get("default_type") or "worldview_clash")


def is_analytical_summary(text: str) -> bool:
    """Reject claim/counterclaim/market-explanation voice."""
    lower = text.lower().strip()
    if not lower:
        return True
    return any(phrase in lower for phrase in ANALYTICAL_BANNED_PHRASES)


def _split_sentences(text: str) -> list[str]:
    parts = re.split(r"(?<=[.!?])\s+", text.strip())
    return [p.strip() for p in parts if p.strip()]


def _sentence_count(text: str) -> int:
    return len(_split_sentences(text))


def _pick_unique(rng: random.Random, pool: list[str], *, exclude: set[str]) -> str | None:
    candidates = [s for s in pool if s.lower() not in exclude]
    if not candidates:
        return None
    return rng.choice(candidates)


def _disagreement_pool(speaker_slug: str, target_slug: str) -> list[str]:
    pair_pool = _PAIR_DISAGREEMENT.get((speaker_slug, target_slug))
    base = list(_DISAGREEMENT.get(speaker_slug, []))
    if pair_pool:
        return pair_pool + base
    return base


def _evidence_chance(disagreement_type: str, rng: random.Random) -> bool:
    """Evidence more likely on technical/regime clashes."""
    if disagreement_type in ("path_vs_regime", "regime_vs_path", "credit_vs_curve", "curve_vs_credit"):
        return rng.random() < 0.75
    if disagreement_type in ("momentum_vs_fragility", "fragility_vs_momentum"):
        return rng.random() < 0.55
    return rng.random() < 0.45


def _jab_chance(speaker_slug: str, rng: random.Random) -> bool:
    """BullBot and DoomBot favor punchy closers; Macro Oracle often stops at two."""
    if speaker_slug in ("bullbot", "doombot", "sports-chaos"):
        return rng.random() < 0.65
    if speaker_slug == "macro-oracle":
        return rng.random() < 0.35
    return rng.random() < 0.50


def _compose_reply(
    speaker_slug: str,
    target_slug: str,
    disagreement_type: str,
    rng: random.Random,
) -> tuple[str, tuple[str, ...]]:
    used: set[str] = set()
    sentences: list[str] = []

    disagreement = _pick_unique(rng, _disagreement_pool(speaker_slug, target_slug), exclude=used)
    if not disagreement:
        disagreement = _DISAGREEMENT.get(speaker_slug, ["Disagree."])[0]
    sentences.append(disagreement)
    used.add(disagreement.lower())

    if _evidence_chance(disagreement_type, rng) and len(sentences) < MAX_REPLY_SENTENCES:
        evidence = _pick_unique(rng, _EVIDENCE.get(speaker_slug, []), exclude=used)
        if evidence:
            sentences.append(evidence)
            used.add(evidence.lower())

    if _jab_chance(speaker_slug, rng) and len(sentences) < MAX_REPLY_SENTENCES:
        jab = _pick_unique(rng, _CLOSING_JABS.get(speaker_slug, []), exclude=used)
        if jab:
            sentences.append(jab)
            used.add(jab.lower())

    line = " ".join(sentences[:MAX_REPLY_SENTENCES])
    return line, tuple(sentences[:MAX_REPLY_SENTENCES])


def _validate_reply(line: str, speaker_slug: str) -> bool:
    from app.forecasting.services.voice_engine import is_generic_disagreement

    if is_analytical_summary(line):
        return False
    if is_generic_disagreement(line):
        return False
    if _sentence_count(line) > MAX_REPLY_SENTENCES:
        return False
    if not line.strip():
        return False
    if classify_speaker(line) != speaker_slug:
        return False
    return True


def generate_conversational_reply(
    speaker_slug: str,
    target_slug: str,
    *,
    seed: int | None = None,
    max_attempts: int = 12,
) -> ConversationalReply:
    """
    Build a rival reply from speaker personality, target personality, and disagreement type.

    Step 1: disagreement sentence (required).
    Step 2: optional evidence sentence.
    Step 3: optional closing jab.
    Maximum 3 sentences.
    """
    if speaker_slug not in CORE_AGENT_SLUGS:
        raise ValueError(f"Unknown speaker: {speaker_slug}")
    if target_slug not in CORE_AGENT_SLUGS:
        raise ValueError(f"Unknown target: {target_slug}")

    disagreement_type = resolve_disagreement_type(speaker_slug, target_slug)
    base_seed = seed if seed is not None else hash((speaker_slug, target_slug)) % 10_000
    rng = random.Random(base_seed)

    line = ""
    sentences: tuple[str, ...] = ()
    for attempt in range(max_attempts):
        attempt_rng = random.Random(base_seed + attempt * 97)
        line, sentences = _compose_reply(
            speaker_slug, target_slug, disagreement_type, attempt_rng
        )
        if _validate_reply(line, speaker_slug):
            break

    evidence_pool = {s.lower() for s in _EVIDENCE.get(speaker_slug, [])}
    jab_pool = {s.lower() for s in _CLOSING_JABS.get(speaker_slug, [])}
    evidence_sent = next((s for s in sentences[1:] if s.lower() in evidence_pool), None)
    jab_sent = next((s for s in reversed(sentences) if s.lower() in jab_pool), None)

    meta: dict[str, Any] = {
        "generation_mode": "conversational",
        "disagreement_type": disagreement_type,
        "speaker_traits": DISAGREEMENT_STYLES.get(speaker_slug, {}).get("traits"),
        "sentence_count": len(sentences),
        "steps": {
            "disagreement": sentences[0] if sentences else None,
            "evidence": evidence_sent,
            "closing_jab": jab_sent,
        },
    }

    return ConversationalReply(
        speaker_slug=speaker_slug,
        target_slug=target_slug,
        disagreement_type=disagreement_type,
        line=line,
        sentences=sentences,
        generation_meta=meta,
    )


def classify_speaker(text: str) -> str:
    """Blind-classify reply text to speaker slug (no names shown)."""
    return identify_author(text).predicted_slug


def passes_conversational_reply_quality(speaker_slug: str, text: str) -> bool:
    """
    Conversational replies pass on personality voice, not claim/counterclaim templates.
    """
    from app.forecasting.services.character_fingerprints import fingerprint_passes, score_fingerprint
    from app.forecasting.services.voice_engine import is_generic_agreement, is_generic_disagreement

    cleaned = text.strip()
    if not cleaned:
        return False
    if is_analytical_summary(cleaned):
        return False
    if is_generic_agreement(cleaned) or is_generic_disagreement(cleaned):
        return False
    if _sentence_count(cleaned) > MAX_REPLY_SENTENCES:
        return False
    if not fingerprint_passes(speaker_slug, cleaned):
        return False
    if classify_speaker(cleaned) != speaker_slug:
        return False
    return score_fingerprint(speaker_slug, cleaned).score >= 2.5


def blind_identification_accuracy(
    *,
    count: int = 100,
    seed: int = 42,
) -> dict[str, Any]:
    """
    Generate `count` conversational replies across all core pairs; measure blind ID rate.
    Names are never embedded in reply text.
    """
    speakers = sorted(CORE_AGENT_SLUGS)
    correct = 0
    results: list[dict[str, Any]] = []
    pair_idx = 0

    for i in range(count):
        speaker = speakers[i % len(speakers)]
        targets = [t for t in speakers if t != speaker]
        target = targets[(i + pair_idx) % len(targets)]
        pair_idx += 1
        reply_seed = seed + i * 131
        reply = generate_conversational_reply(speaker, target, seed=reply_seed)
        predicted = classify_speaker(reply.line)
        ok = predicted == speaker
        if ok:
            correct += 1
        results.append(
            {
                "speaker": speaker,
                "target": target,
                "predicted": predicted,
                "correct": ok,
                "line": reply.line,
                "disagreement_type": reply.disagreement_type,
            }
        )

    by_speaker: dict[str, dict[str, int]] = {}
    for row in results:
        bucket = by_speaker.setdefault(row["speaker"], {"total": 0, "correct": 0})
        bucket["total"] += 1
        if row["correct"]:
            bucket["correct"] += 1

    return {
        "total": count,
        "correct": correct,
        "accuracy": round(correct / count, 4) if count else 0.0,
        "accuracy_pct": round(100 * correct / count, 1) if count else 0.0,
        "by_speaker": by_speaker,
        "samples": results[:15],
        "misidentified": [r for r in results if not r["correct"]][:10],
    }
