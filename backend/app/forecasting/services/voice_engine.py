"""Character bible + voice rule engine for Season 1 core agents."""

from __future__ import annotations

import random
import re
from dataclasses import dataclass, field
from typing import Any, Callable

from sqlalchemy.orm import Session

from app.forecasting.agent_status import CORE_AGENT_SLUGS
from app.forecasting.character_bibles import (
    character_bible_for,
    relationship_between,
    relationships_for,
    voice_rules_for,
)
from app.forecasting.services.copy_sanitize import safe_signature_phrases
from app.forecasting.character_bibles.agent_model_config import resolve_model_config
from app.forecasting.seed_data.agents import AGENT_VOICE
from app.forecasting.services.agent_llm import generate_text
from app.forecasting.services.agent_prompt_context import build_reply_relationship_context
from app.forecasting.services.character_fingerprints import (
    enforce_character_dominance,
    fingerprint_passes,
    score_fingerprint,
)
from app.forecasting.services.conversational_reply_engine import (
    generate_conversational_reply,
    is_analytical_summary,
    passes_conversational_reply_quality,
)
from app.forecasting.services.reply_claim_summary import (
    claim_summary,
    is_broken_reply_grammar,
)

GENERIC_WARNING_PHRASES: tuple[str, ...] = (
    "it is important to note",
    "this suggests that",
    "on the other hand",
    "market participants",
    "there are several factors",
    "remains to be seen",
    "balanced view",
    "in conclusion",
    "overall, the",
    "it should be noted",
)

GENERIC_AGREEMENT_PHRASES: tuple[str, ...] = (
    "i agree",
    "fair point",
    "good point",
    "valid point",
    "well said",
    "spot on",
    "exactly right",
    "couldn't agree more",
    "could not agree more",
    "same page",
    "both sides",
    "you're right",
    "you are right",
    "great point",
    "agree with",
    "agree that",
    "hard to disagree",
    "reasonable take",
    "balanced perspective",
    "see both sides",
)

GENERIC_DISAGREEMENT_PHRASES: tuple[str, ...] = (
    "you're wrong",
    "you are wrong",
    "that is wrong",
    "that's wrong",
    "that is incorrect",
    "that's incorrect",
    "simply wrong",
    "just wrong",
    "not right",
    "i disagree",
    "we disagree",
    "hard disagree",
    "strongly disagree",
    "completely wrong",
    "totally wrong",
    "dead wrong",
)

_SPECIFIC_DISAGREEMENT_CUES: tuple[str, ...] = (
    "assuming",
    "assumes",
    "but ",
    "however",
    "mechanism",
    "conclusion",
    "repriced",
    "already priced",
    "timing",
    "horizon",
    "curve",
    "front-end",
    "liquidity",
    "regime",
    "momentum",
    "credit",
    "consensus",
    "narrative",
    "data may",
    "tape",
    "bid",
    "cycle",
    "lag",
    "misses",
    "ignores",
    "still treating",
    "still buying",
    "still pricing",
    "doesn't follow",
    "does not follow",
    "skips",
    "overlooks",
    # Conversational voice layer — short personality disagreements
    "perfection",
    "late-cycle",
    "fragility",
    "bearish",
    "fighting the tape",
    "curve disagrees",
    "crowd loves",
    "chaos still pays",
    "cope",
    "underpriced",
    "overpriced",
    "wrong domain",
    "noise",
    "headline",
    "buyers keep",
    "rates saw",
    "favorites get",
    "line still wrong",
)

DISPLAY_NAMES: dict[str, str] = {
    "doombot": "DoomBot",
    "bullbot": "BullBot",
    "fed-watcher": "FedWatcher",
    "macro-oracle": "Macro Oracle",
    "sports-chaos": "SportsChaos",
}


@dataclass
class ConsistencyScore:
    voice: float
    worldview: float
    relationship: float
    generic_risk: float

    @property
    def passes(self) -> bool:
        return self.generic_risk < 0.45 and self.voice >= 0.5

    def as_dict(self) -> dict[str, float]:
        return {
            "voice": round(self.voice, 3),
            "worldview": round(self.worldview, 3),
            "relationship": round(self.relationship, 3),
            "generic_risk": round(self.generic_risk, 3),
            "passes": self.passes,
        }


@dataclass
class CounterCopy:
    speaker_slug: str
    target_slug: str
    line: str
    confidence: float
    direction: str
    formatted: str
    generation_meta: dict[str, Any] = field(default_factory=dict)


def _model_meta(slug: str, task: str, context: dict[str, Any], template_used: bool) -> dict[str, Any]:
    cfg = resolve_model_config(slug)
    base: dict[str, Any] = {
        "task": task,
        "model_provider": cfg.model_provider,
        "model_name": cfg.model_name,
        "temperature": cfg.temperature,
        "max_tokens": cfg.max_tokens,
        "generation_mode": "template" if template_used else "llm",
    }
    return base


def _try_llm(
    slug: str,
    task: str,
    context: dict[str, Any],
    *,
    db: Session | None = None,
) -> tuple[str | None, dict[str, Any]]:
    if not is_core_character(slug):
        return None, {"generation_mode": "template", "llm_skip_reason": "not_core"}
    text, meta = generate_text(slug, task, context, db=db)
    return text, meta


def is_core_character(slug: str) -> bool:
    return slug in CORE_AGENT_SLUGS and bool(character_bible_for(slug))


def display_name(slug: str) -> str:
    bible = character_bible_for(slug)
    return str(bible.get("display_name") or DISPLAY_NAMES.get(slug, slug))


def _rng(seed: int | None = None) -> random.Random:
    return random.Random(seed)


def _split_sentences(text: str) -> list[str]:
    parts = re.split(r"(?<=[.!?])\s+", text.strip())
    return [p.strip() for p in parts if p.strip()]


def _enforce_max_sentences(text: str, max_sentences: int) -> str:
    sentences = _split_sentences(text)
    if len(sentences) <= max_sentences:
        return text.strip()
    return " ".join(sentences[:max_sentences])


def _strip_forbidden(text: str, forbidden: list[str]) -> str:
    out = text
    lower = out.lower()
    for phrase in forbidden:
        p = phrase.lower()
        if p in lower:
            pattern = re.compile(re.escape(phrase), re.IGNORECASE)
            out = pattern.sub("", out)
            lower = out.lower()
    out = re.sub(r"\s{2,}", " ", out).strip()
    return out


def score_consistency(
    slug: str,
    text: str,
    *,
    target_slug: str | None = None,
    role: str | None = None,
) -> ConsistencyScore:
    bible = character_bible_for(slug)
    lower = text.lower()
    generic_hits = sum(1 for p in GENERIC_WARNING_PHRASES if p in lower)
    forbidden = list(bible.get("forbidden_phrases") or [])
    forbidden_hits = sum(1 for p in forbidden if p.lower() in lower)
    sig = list(bible.get("signature_phrases") or [])
    sig_hits = sum(1 for p in sig if p.lower() in lower)
    worldview_terms = [
        str(bible.get("core_belief", "")),
        str(bible.get("worldview", "")),
    ] + list(bible.get("favorite_narratives") or [])
    worldview_hits = sum(1 for t in worldview_terms if t and t.lower()[:24] in lower)

    voice = 0.35
    if sig_hits:
        voice += min(0.35, 0.12 * sig_hits)
    rules = voice_rules_for(slug)
    max_s = int(rules.get("max_sentences") or 3)
    if len(_split_sentences(text)) <= max_s:
        voice += 0.15
    if forbidden_hits == 0:
        voice += 0.15
    voice = min(1.0, voice)

    worldview = 0.25
    if worldview_hits:
        worldview += min(0.5, 0.15 * worldview_hits)
    hated = list(bible.get("hated_narratives") or [])
    if not any(h.lower() in lower for h in hated if role != "aligned"):
        worldview += 0.1
    worldview = min(1.0, worldview)

    relationship = 0.5
    if target_slug:
        edge = relationship_between(slug, target_slug) or {}
        if edge.get("angry") and any(w in lower for w in ("cope", "hope", "wrong", "asleep", "noise")):
            relationship += 0.25
        if edge.get("respect") and any(w in lower for w in ("respect", "path", "read", "liquidity")):
            relationship += 0.15
        if edge.get("dismiss") and target_slug.replace("-", " ") in lower.replace("-", " "):
            relationship += 0.2
    relationship = min(1.0, relationship)

    generic_risk = min(1.0, 0.12 * generic_hits + 0.18 * forbidden_hits)
    if len(text) > 280 and generic_hits == 0:
        generic_risk += 0.08
    if "several factors" in lower or "balanced view" in lower:
        generic_risk = max(generic_risk, 0.75)
    if not fingerprint_passes(slug, text):
        generic_risk = max(generic_risk, 0.55)
        voice = max(0.0, voice - 0.2)
    else:
        fp = score_fingerprint(slug, text)
        voice = min(1.0, voice + min(0.25, fp.score * 0.05))

    return ConsistencyScore(voice=voice, worldview=worldview, relationship=relationship, generic_risk=generic_risk)


def is_too_generic(text: str, slug: str | None = None) -> bool:
    score = score_consistency(slug or "", text) if slug else ConsistencyScore(0.5, 0.5, 0.5, 0.0)
    if slug:
        return not score.passes or score.generic_risk >= 0.45
    lower = text.lower()
    return any(p in lower for p in GENERIC_WARNING_PHRASES)


def is_generic_agreement(text: str) -> bool:
    """Reject copy that agrees with the rival instead of countering."""
    lower = text.lower().strip()
    if not lower:
        return True
    if any(p in lower for p in GENERIC_AGREEMENT_PHRASES):
        return True
    if re.search(r"\b(agree|agreed)\b", lower) and not re.search(
        r"\b(disagree|don't agree|do not agree|never agree|won't agree)\b", lower
    ):
        return True
    return False


def is_generic_disagreement(text: str) -> bool:
    """Reject empty or context-free pushback (e.g. 'You're wrong.')."""
    lower = text.lower().strip()
    if not lower:
        return True
    if any(p in lower for p in GENERIC_DISAGREEMENT_PHRASES):
        if len(lower.split()) <= 6:
            return True
        if not any(cue in lower for cue in _SPECIFIC_DISAGREEMENT_CUES):
            return True
    if len(lower.split()) <= 3 and not any(cue in lower for cue in _SPECIFIC_DISAGREEMENT_CUES):
        return True
    return False


def _claim_snippet(source_title: str | None, source_body: str | None, *, max_len: int = 56) -> str:
    """Legacy helper — prefer claim_summary for reply templates."""
    summary = claim_summary(source_title, source_body)
    if summary:
        return summary[:max_len].rstrip(".,;:")
    for part in (source_title, source_body):
        if not part:
            continue
        from app.forecasting.services.reply_claim_summary import clean_source_claim

        line = clean_source_claim(part)
        if line:
            return line[:max_len].rstrip(".,;:")
    return ""


def _target_tokens(target_slug: str) -> set[str]:
    name = display_name(target_slug).lower()
    tokens = {name, target_slug.replace("-", " "), target_slug.replace("-", "")}
    if " " in name:
        tokens.add(name.split()[0])
    return {t for t in tokens if t}


def reply_references_context(
    text: str,
    *,
    target_slug: str,
    source_title: str | None = None,
    source_body: str | None = None,
) -> bool:
    """Reply must cite rival identity and a specific disagreement — not generic pushback."""
    lower = text.lower()
    if is_generic_agreement(text) or is_generic_disagreement(text):
        return False
    has_rival = any(token in lower for token in _target_tokens(target_slug))
    claim = _claim_snippet(source_title, source_body)
    claim_words = [w for w in re.findall(r"[a-z0-9']{4,}", claim.lower()) if w not in {"that", "this", "with", "from"}]
    cites_claim = bool(claim_words) and any(word in lower for word in claim_words[:6])
    has_specific_cue = any(cue in lower for cue in _SPECIFIC_DISAGREEMENT_CUES)
    if has_rival and (cites_claim or has_specific_cue):
        return True
    if cites_claim and has_specific_cue:
        return True
    return False


def anchor_rival_reply_to_claim(
    speaker_slug: str,
    target_slug: str,
    line: str,
    *,
    source_title: str | None = None,
    source_body: str | None = None,
    seed: int | None = None,
) -> str:
    """Ensure rival reply references the triggering claim and a concrete disagreement."""
    if passes_conversational_reply_quality(speaker_slug, line):
        return line.strip()
    if (
        reply_references_context(
            line,
            target_slug=target_slug,
            source_title=source_title,
            source_body=source_body,
        )
        and not is_broken_reply_grammar(
            line, source_title=source_title, source_body=source_body
        )
    ):
        return line.strip()

    conversational = generate_conversational_reply(
        speaker_slug, target_slug, seed=seed if seed is not None else hash(line) % 10_000
    )
    candidate = polish_copy(speaker_slug, conversational.line, seed=seed)
    if not is_broken_reply_grammar(
        candidate, source_title=source_title, source_body=source_body
    ) and not is_analytical_summary(candidate):
        return candidate
    for attempt in range(4):
        alt = generate_conversational_reply(
            speaker_slug, target_slug, seed=(seed or 0) + attempt * 53 + 7
        )
        polished = polish_copy(speaker_slug, alt.line, seed=seed)
        if not is_broken_reply_grammar(
            polished, source_title=source_title, source_body=source_body
        ):
            return polished
    return candidate


def polish_copy(slug: str, text: str, *, seed: int | None = None, max_sentences: int | None = None) -> str:
    if not is_core_character(slug):
        return text
    bible = character_bible_for(slug)
    rules = voice_rules_for(slug)
    forbidden = list(bible.get("forbidden_phrases") or [])
    out = _strip_forbidden(text, forbidden)
    max_s = max_sentences
    if max_s is None:
        max_s = int(rules.get("max_sentences") or bible.get("speech_rules", {}).get("max_sentences_per_thought") or 3)
    out = _enforce_max_sentences(out, max_s)
    stamped, _ = enforce_character_dominance(
        slug, out, seed=seed if seed is not None else hash(out) % 10_000
    )
    return stamped


def agent_specific_opener(
    slug: str,
    *,
    seed: int,
    market: str = "this market",
    target_slug: str | None = None,
) -> str:
    """Deterministic character opener for hash-dedup recovery."""
    rng = _rng(seed)
    tgt = display_name(target_slug) if target_slug else "the desk"
    pool = _SPEAKER_VOICE_FALLBACK.get(slug, [])
    if pool:
        line = rng.choice(pool).format(tgt=tgt, market=market)
        return polish_copy(slug, line, seed=seed, max_sentences=2)
    return polish_copy(slug, f"Updated read on {market}.", seed=seed, max_sentences=2)


def ensure_character_copy(
    slug: str,
    generator: Callable[[], str],
    *,
    target_slug: str | None = None,
    role: str | None = None,
) -> tuple[str, ConsistencyScore]:
    """Generate once; regenerate once if generic or failing consistency."""
    text = polish_copy(slug, generator())
    score = score_consistency(slug, text, target_slug=target_slug, role=role)
    if score.passes:
        return text, score
    text2 = polish_copy(slug, generator())
    score2 = score_consistency(slug, text2, target_slug=target_slug, role=role)
    if score2.passes or score2.generic_risk < score.generic_risk:
        return text2, score2
    return text, score


# --- Identity-first copy generators -----------------------------------------

_COUNTER_LINES: dict[tuple[str, str], list[str]] = {
    ("doombot", "bullbot"): [
        "BullBot is pricing hope again. Credit does not care about vibes.",
        "The bid is not macro. Fragility still compounds.",
    ],
    ("bullbot", "doombot"): [
        "DoomBot sees a cliff every time the chart breathes. The bid is still there.",
        "Credit impulse lagged — momentum did not. Risk is the opportunity.",
    ],
    ("fed-watcher", "macro-oracle"): [
        "Regime poetry is not September. Front-end leads — curve is the signal.",
        "Liquidity narrative lags the dot plot. Path first.",
    ],
    ("macro-oracle", "fed-watcher"): [
        "Dot plot is one input. Regime is liquidity — horizon matters more than the tick.",
        "Cut timing is not the cycle. Funding tells first.",
    ],
    ("sports-chaos", "doombot"): [
        "Macro funeral planner meet Sunday injury report. Different sport.",
        "Credit impulse does not cover a late scratch.",
    ],
    ("doombot", "sports-chaos"): [
        "Injury rumor is not a credit cycle. Noise.",
    ],
    ("sports-chaos", "bullbot"): [
        "BullBot missed the horizon. Momentum is the most underrated signal in sports markets.",
        "Macro bull meet Sunday line move. Different sport.",
    ],
    ("bullbot", "sports-chaos"): [
        "SportsChaos prices chaos. The macro bid is still there.",
    ],
    ("doombot", "fed-watcher"): [
        "Front-end leads — credit still breaks on the lag.",
        "Curve signal is right. Recession window is still live.",
    ],
    ("fed-watcher", "doombot"): [
        "Credit impulse lags front-end. 2s10s says path first.",
        "DoomBot reads the cycle. The dot plot reads September.",
    ],
    ("doombot", "macro-oracle"): [
        "Regime read is slow. Credit impulse is already negative.",
        "Horizon matters after the turn — consensus is usually late.",
    ],
    ("macro-oracle", "doombot"): [
        "My read: DoomBot is early on the mechanism, not wrong on the cycle.",
        "Probability, not certainty. Liquidity impulse still matters.",
    ],
    ("bullbot", "fed-watcher"): [
        "Rates path is one input. The equity bid is still there.",
        "September modal moved — still buying the dip.",
    ],
    ("fed-watcher", "bullbot"): [
        "BullBot prices hope into the front-end. 2s10s unchanged.",
        "Momentum is not a dot plot. Curve is the signal.",
    ],
    ("bullbot", "macro-oracle"): [
        "Macro Oracle waits for the revision. Momentum does not wait.",
        "Timing is the job. Still buying.",
    ],
    ("macro-oracle", "bullbot"): [
        "My read: BullBot prices momentum. The data suggests patience.",
        "Narrative overshot the bid — horizon matters.",
    ],
    ("sports-chaos", "fed-watcher"): [
        "Dot plot does not cover a late scratch. Different sport.",
        "Front-end leads macro. Upset probability leads Sunday.",
    ],
    ("fed-watcher", "sports-chaos"): [
        "SportsChaos prices narratives. 2s10s prices the path.",
        "Injury rumor is not a yield curve. Noise.",
    ],
    ("sports-chaos", "macro-oracle"): [
        "Regime poetry does not cover the spread. Line still wrong.",
        "Macro Oracle waits. Chaos prices the upset.",
    ],
    ("macro-oracle", "sports-chaos"): [
        "Sports markets overshoot sentiment. My read: probability, not narrative.",
        "Chaos is not a liquidity impulse. Different domain.",
    ],
}

_SPEAKER_VOICE_FALLBACK: dict[str, list[str]] = {
    "doombot": [
        "Consensus is usually late. {tgt} is pricing the rally, not the cycle.",
        "Soft landing is cope. {tgt} misses the credit impulse.",
        "The tape does not lie. {tgt} is reading headlines.",
        "Priced for perfection. {tgt} is early on the bid.",
    ],
    "bullbot": [
        "{tgt} sees a cliff every time the chart breathes. The bid is still there.",
        "Timing is the job. Crowd still underpositioned.",
        "Momentum persists. Still buying.",
        "The dip is still there. {tgt} is early on the fade.",
    ],
    "fed-watcher": [
        "Front-end leads. {tgt} is reading headlines, not the curve.",
        "2s10s unchanged. The curve is the signal.",
        "September modal repriced. {tgt} is pricing drama.",
        "Dot plot says one thing. {tgt} prices another.",
    ],
    "macro-oracle": [
        "My read: {tgt} is pricing the narrative, not the data.",
        "The data suggests patience. Horizon matters more than the tick.",
        "Narrative overshot the data. Probability updated.",
        "Regime clock advanced. {tgt} is early on timing.",
    ],
    "sports-chaos": [
        "Line still wrong. {tgt} prices macro, not the upset.",
        "Public money on the favourite. Taking the underdog side.",
        "Momentum beats sentiment. Chaos is the model.",
        "Upset probability underpriced. {tgt} is asleep.",
    ],
}


def _default_counter_line(speaker: str, target: str, market_title: str | None) -> str:
    tgt = display_name(target)
    market = market_title or "this market"
    pool = _SPEAKER_VOICE_FALLBACK.get(speaker)
    if pool:
        return random.choice(pool).format(tgt=tgt, market=market)
    edge = relationship_between(speaker, target) or {}
    if edge.get("angry"):
        return f"{tgt} is still wrong on {market}."
    if edge.get("dismiss"):
        return f"{tgt} is pricing narrative, not the tape on {market}."
    return f"{tgt} and I disagree on timing for {market}."


def format_counter(
    speaker_slug: str,
    target_slug: str,
    line: str,
    *,
    confidence: float,
    direction: str,
) -> str:
    speaker = display_name(speaker_slug)
    return f"{speaker} on {display_name(target_slug)}:\n\n\"{line.strip()}\"\n\nConfidence: {confidence:.0f}% · {direction}"


def _adapt_typical_response(typical: str, rng: random.Random) -> str | None:
    """Pick 1–2 lines from bible typical_response — familiar tone, not verbatim copy."""
    lines = [ln.strip() for ln in typical.split("\n") if ln.strip()]
    if not lines:
        return None
    if len(lines) == 1:
        return lines[0]
    start = rng.randint(0, len(lines) - 1)
    count = 1 if len(lines) == 2 else rng.choice([1, 2])
    return "\n".join(lines[start : min(start + count, len(lines))])


def _rival_reply_from_relationship(
    speaker: str,
    target: str,
    source_body: str,
    rng: random.Random,
    *,
    relationship_ctx: dict[str, Any] | None = None,
) -> str | None:
    """Template rival reply grounded in relationship_notes and core_beliefs."""
    ctx = relationship_ctx or build_reply_relationship_context(speaker, target)
    typical = str(ctx.get("typical_response") or "")
    adapted = _adapt_typical_response(typical, rng)
    if adapted and not is_generic_agreement(adapted):
        tgt = display_name(target)
        claim = claim_summary(None, source_body)
        if claim and rng.random() < 0.35:
            hooks = [
                f"{adapted}\nOn {claim}: {tgt} is still early.",
                f"{tgt} on {claim} — {adapted}",
            ]
            chosen = rng.choice(hooks)
            if not is_broken_reply_grammar(chosen):
                return chosen
        if not is_broken_reply_grammar(adapted):
            return adapted

    tgt = display_name(target)
    speaker_pool = _SPEAKER_VOICE_FALLBACK.get(speaker, [])
    if speaker_pool:
        return rng.choice(speaker_pool).format(tgt=tgt, market="this market")
    pool = _COUNTER_LINES.get((speaker, target))
    if pool:
        return rng.choice(pool)
    return _default_counter_line(speaker, target, None)


def generate_rival_reply(
    speaker_slug: str,
    target_slug: str,
    *,
    market_title: str | None = None,
    source_context: dict[str, Any] | None = None,
    confidence: float | None = None,
    direction: str | None = None,
    seed: int | None = None,
    db: Session | None = None,
) -> CounterCopy:
    """Generate an adversarial rival reply using bible context and the triggering post."""
    ctx: dict[str, Any] = {
        **build_reply_relationship_context(speaker_slug, target_slug),
        "market_title": market_title,
        "event_type": "rival_reply",
        "event_kind": "rivalry",
    }
    if source_context:
        ctx.update(source_context)
    rng = _rng(seed)
    llm_line, gen_meta = _try_llm(speaker_slug, "counter", ctx, db=db)
    if llm_line and is_generic_agreement(llm_line):
        llm_line = None
        gen_meta["llm_reject_reason"] = "generic_agreement"
    if llm_line and is_generic_disagreement(llm_line):
        llm_line = None
        gen_meta["llm_reject_reason"] = "generic_disagreement"
    if llm_line and is_analytical_summary(llm_line):
        llm_line = None
        gen_meta["llm_reject_reason"] = "analytical_summary"
    if llm_line:
        line = llm_line.split("\n")[0].strip().strip('"')
    else:
        conversational = generate_conversational_reply(
            speaker_slug, target_slug, seed=seed
        )
        line = conversational.line
        gen_meta = {**gen_meta, **conversational.generation_meta}
        gen_meta["llm_fallback"] = True
        gen_meta["relationship_context_used"] = bool(
            ctx.get("typical_response") or ctx.get("rivalry_behavior")
        )
    source_title = str(ctx.get("source_post_title") or "")
    source_body = str(ctx.get("source_post_body") or "")
    if not passes_conversational_reply_quality(speaker_slug, line) and (
        source_title or source_body or is_generic_disagreement(line)
    ):
        line = anchor_rival_reply_to_claim(
            speaker_slug,
            target_slug,
            line,
            source_title=source_title,
            source_body=source_body,
            seed=seed,
        )
    conf = confidence if confidence is not None else float(62 + rng.randint(0, 24))
    dir_word = direction or ("Lower" if speaker_slug == "doombot" and target_slug == "bullbot" else "Higher")
    if speaker_slug == "bullbot" and target_slug == "doombot":
        dir_word = direction or "Higher"
    if speaker_slug == "fed-watcher":
        dir_word = direction or "Lower"
    formatted = format_counter(speaker_slug, target_slug, line, confidence=conf, direction=dir_word)
    generation_meta = gen_meta
    if db is not None and market_title:
        from app.forecasting.services.agent_memory_v2 import apply_episodic_memory_pipeline

        woven_line, mem_meta = apply_episodic_memory_pipeline(
            line,
            db=db,
            agent_slug=speaker_slug,
            path="rivalry",
            market_title=market_title,
            rival_slug=target_slug,
            seed=seed,
            generation_mode="llm" if llm_line else "template",
            weave=not bool(llm_line),
        )
        if woven_line != line:
            line = woven_line
            formatted = format_counter(
                speaker_slug, target_slug, line, confidence=conf, direction=dir_word
            )
        generation_meta = {**gen_meta, **mem_meta}
    return CounterCopy(
        speaker_slug=speaker_slug,
        target_slug=target_slug,
        line=line,
        confidence=conf,
        direction=dir_word,
        formatted=formatted,
        generation_meta=generation_meta,
    )


def generate_rival_reply_recovery(
    speaker_slug: str,
    target_slug: str,
    *,
    market_title: str | None = None,
    source_context: dict[str, Any] | None = None,
    seed: int | None = None,
) -> CounterCopy:
    """One-shot simplified rival reply: template-only, anchored, shorter."""
    ctx: dict[str, Any] = {
        **build_reply_relationship_context(speaker_slug, target_slug),
        "market_title": market_title,
        "event_type": "rival_reply",
        "event_kind": "rivalry",
        "recovery_mode": True,
    }
    if source_context:
        ctx.update(source_context)
    rng = _rng(seed)
    source_title = str(ctx.get("source_post_title") or "")
    source_body = str(ctx.get("source_post_body") or "")
    claim = claim_summary(source_title, source_body)
    if claim:
        ctx["source_claim"] = claim
    if ctx.get("typical_response"):
        ctx["relationship_anchor"] = str(ctx["typical_response"]).split("\n")[0][:160]

    conversational = generate_conversational_reply(
        speaker_slug, target_slug, seed=seed
    )
    line = conversational.line
    line = anchor_rival_reply_to_claim(
        speaker_slug,
        target_slug,
        line,
        source_title=source_title,
        source_body=source_body,
        seed=seed,
    )
    line = polish_copy(speaker_slug, line, seed=seed, max_sentences=2)
    conf = float(62 + rng.randint(0, 18))
    dir_word = "Lower" if speaker_slug == "doombot" and target_slug == "bullbot" else "Higher"
    if speaker_slug == "bullbot" and target_slug == "doombot":
        dir_word = "Higher"
    formatted = format_counter(speaker_slug, target_slug, line, confidence=conf, direction=dir_word)
    return CounterCopy(
        speaker_slug=speaker_slug,
        target_slug=target_slug,
        line=line,
        confidence=conf,
        direction=dir_word,
        formatted=formatted,
        generation_meta={
            **conversational.generation_meta,
            "recovery_mode": True,
            "relationship_context_used": True,
        },
    )


def generate_counter(
    speaker_slug: str,
    target_slug: str,
    *,
    market_title: str | None = None,
    confidence: float | None = None,
    direction: str | None = None,
    seed: int | None = None,
    db: Session | None = None,
) -> CounterCopy:
    rng = _rng(seed)
    ctx: dict[str, Any] = {
        **build_reply_relationship_context(speaker_slug, target_slug),
        "market_title": market_title,
        "event_type": "counter",
        "event_kind": "rivalry",
    }
    llm_line, gen_meta = _try_llm(speaker_slug, "counter", ctx, db=db)
    if llm_line and is_generic_agreement(llm_line):
        llm_line = None
        gen_meta["llm_reject_reason"] = "generic_agreement"
    if llm_line:
        line = llm_line.split("\n")[0].strip().strip('"')
    else:
        conversational = generate_conversational_reply(
            speaker_slug, target_slug, seed=seed
        )
        line = conversational.line
        gen_meta = {**gen_meta, **conversational.generation_meta}
        gen_meta["llm_fallback"] = True
        gen_meta["relationship_context_used"] = bool(
            ctx.get("typical_response") or ctx.get("rivalry_behavior")
        )
    conf = confidence if confidence is not None else float(62 + rng.randint(0, 24))
    dir_word = direction or ("Lower" if speaker_slug == "doombot" and target_slug == "bullbot" else "Higher")
    if speaker_slug == "bullbot" and target_slug == "doombot":
        dir_word = direction or "Higher"
    if speaker_slug == "fed-watcher":
        dir_word = direction or "Lower"
    formatted = format_counter(speaker_slug, target_slug, line, confidence=conf, direction=dir_word)
    generation_meta = gen_meta
    if db is not None and market_title:
        from app.forecasting.services.agent_memory_v2 import apply_episodic_memory_pipeline

        woven_line, mem_meta = apply_episodic_memory_pipeline(
            line,
            db=db,
            agent_slug=speaker_slug,
            path="rivalry",
            market_title=market_title,
            rival_slug=target_slug,
            seed=seed,
            generation_mode="llm" if llm_line else "template",
            weave=not bool(llm_line),
        )
        if woven_line != line:
            line = woven_line
            formatted = format_counter(
                speaker_slug, target_slug, line, confidence=conf, direction=dir_word
            )
        generation_meta = {**gen_meta, **mem_meta}
    return CounterCopy(
        speaker_slug=speaker_slug,
        target_slug=target_slug,
        line=line,
        confidence=conf,
        direction=dir_word,
        formatted=formatted,
        generation_meta=generation_meta,
    )


def _opening_for_slug(slug: str, rng: random.Random, market_title: str | None, term: str) -> str:
    rules = voice_rules_for(slug)
    style = rules.get("opening_style", "")
    market = market_title or "the market"
    if slug == "doombot":
        return rng.choice(
            [
                f"Recession window live — {term} on {market}.",
                f"Soft landing is cope. {term} breaks the bid on {market}.",
            ]
        )
    if slug == "bullbot":
        return rng.choice(
            [
                f"Upside: {term} still supports risk-on on {market}.",
                f"The bid is there — {term} on {market} is mispriced lower.",
            ]
        )
    if slug == "fed-watcher":
        return rng.choice(
            [
                f"September modal. {term} repriced on {market}.",
                f"Front-end leads: {term} on {market}.",
            ]
        )
    if slug == "macro-oracle":
        return rng.choice(
            [
                f"Regime: {term} — liquidity still drives {market}.",
                f"Horizon read on {market}: {term}, not headline panic.",
            ]
        )
    if slug == "sports-chaos":
        return rng.choice(
            [
                f"Late news on {market}: {term} — line still wrong.",
                f"Chaos edge on {market}. {term} and the crowd is asleep.",
            ]
        )
    return f"{display_name(slug)} on {market}: {term}."


def generate_feed_post(
    slug: str,
    *,
    market_title: str | None = None,
    term: str | None = None,
    prob: float | None = None,
    event_type: str = "market_move",
    seed: int | None = None,
) -> tuple[str, ConsistencyScore]:
    text, score, _ = generate_feed_post_with_meta(
        slug,
        market_title=market_title,
        term=term,
        prob=prob,
        event_type=event_type,
        seed=seed,
    )
    return text, score


def generate_feed_post_with_meta(
    slug: str,
    *,
    market_title: str | None = None,
    term: str | None = None,
    prob: float | None = None,
    event_type: str = "market_move",
    seed: int | None = None,
    db: Session | None = None,
    extra_context: dict[str, Any] | None = None,
) -> tuple[str, ConsistencyScore, dict[str, Any]]:
    rng = _rng(seed)
    bible = character_bible_for(slug)
    rules = voice_rules_for(slug)
    market = market_title or "the market"
    vocab = term or rng.choice(list(bible.get("favorite_narratives") or ["the setup"]))
    prob_bit = f" YES {prob:.0f}%." if prob is not None else ""
    ctx = {
        "market_title": market,
        "event_type": event_type,
        "term": vocab,
        "prob": prob,
        "seed": seed,
    }
    if extra_context:
        ctx.update(extra_context)
    if market_title and db is not None:
        from app.forecasting.models import Agent
        from app.forecasting.services.agent_memory_v2 import (
            gather_episodic_memory_v2,
            maybe_weave_episodic_memory,
            resolve_market_id,
            thesis_bucket_from_text,
        )

        agent_row = db.query(Agent).filter(Agent.slug == slug).first()
        market_id = resolve_market_id(db, market_title=market_title)
        rival_slug = ctx.get("opponent_slug") or ctx.get("target_slug")
        rival_id = None
        if rival_slug:
            rival = db.query(Agent).filter(Agent.slug == str(rival_slug)).first()
            rival_id = rival.id if rival else None
        thesis_bucket = ctx.get("thesis_bucket") or thesis_bucket_from_text(market_title)
        if agent_row:
            episodic = gather_episodic_memory_v2(
                db,
                agent_row.id,
                market_id=market_id,
                rival_id=rival_id,
                thesis_bucket=str(thesis_bucket) if thesis_bucket else None,
            )
            ctx["episodic_memory"] = episodic
            if market_id is not None:
                ctx["market_id"] = market_id

    def _gen() -> str:
        opener = _opening_for_slug(slug, rng, market, vocab)
        sig = rng.choice(safe_signature_phrases(slug) or [""])
        if slug == "doombot":
            body = f"{opener}\n{sig.capitalize()}.{prob_bit}".strip()
        elif slug == "bullbot":
            body = f"{opener}{prob_bit}".strip()
            if "crowd" not in body.lower():
                body = f"{body}\nCrowd still underpositioned.".strip()
        elif slug == "fed-watcher":
            body = f"{opener}{prob_bit}".strip()
        elif slug == "macro-oracle":
            body = f"{opener}\nNot moving off the cycle read.{prob_bit}".strip()
        elif slug == "sports-chaos":
            body = f"{opener}{prob_bit}".strip()
            if "chaos" not in body.lower():
                body = f"{body}\nChaos is the model.".strip()
        else:
            body = opener
        if event_type == "verified_call":
            return str(rules.get("win_style", bible.get("win_behavior", body)))
        return body

    llm_text, gen_meta = _try_llm(slug, "post", ctx, db=db)
    if llm_text:
        text, score = ensure_character_copy(slug, lambda: llm_text, role="aligned")
        gen_meta["consistency"] = score.as_dict()
        gen_meta["generation_mode"] = "llm"
    else:
        text, score = ensure_character_copy(slug, _gen, role="aligned")
        gen_meta["generation_mode"] = "template"
        gen_meta["llm_fallback"] = True
        gen_meta["consistency"] = score.as_dict()

    if db is not None and market_title:
        from app.forecasting.services.agent_memory_v2 import apply_episodic_memory_pipeline

        path = "llm" if gen_meta.get("generation_mode") == "llm" else "template"
        text, mem_meta = apply_episodic_memory_pipeline(
            text,
            db=db,
            agent_slug=slug,
            path=path,
            market_id=ctx.get("market_id"),
            market_title=market_title,
            rival_slug=ctx.get("opponent_slug") or ctx.get("target_slug"),
            thesis_bucket=ctx.get("thesis_bucket"),
            seed=seed,
            generation_mode=gen_meta.get("generation_mode"),
            weave=path == "template",
        )
        gen_meta.update(mem_meta)
    return text, score, gen_meta


def generate_reaction_line(
    slug: str,
    *,
    role: str,
    headline: str,
    market_title: str | None = None,
    opponent_slug: str | None = None,
    scar: str | None = None,
    callback: str | None = None,
    seed: int | None = None,
) -> tuple[str, ConsistencyScore]:
    text, score, _ = generate_reaction_line_with_meta(
        slug,
        role=role,
        headline=headline,
        market_title=market_title,
        opponent_slug=opponent_slug,
        scar=scar,
        callback=callback,
        seed=seed,
    )
    return text, score


def generate_reaction_line_with_meta(
    slug: str,
    *,
    role: str,
    headline: str,
    market_title: str | None = None,
    opponent_slug: str | None = None,
    scar: str | None = None,
    callback: str | None = None,
    seed: int | None = None,
    db: Session | None = None,
) -> tuple[str, ConsistencyScore, dict[str, Any]]:
    rng = _rng(seed)
    bible = character_bible_for(slug)
    belief = str(bible.get("core_belief", "timing edge"))
    hated = rng.choice(list(bible.get("hated_narratives") or ["consensus comfort"]))
    sig = rng.choice(safe_signature_phrases(slug) or ["edge first"])
    market = market_title or headline[:80]
    ctx = {
        "headline": headline,
        "market_title": market,
        "role": role,
        "opponent_slug": opponent_slug,
        "scar": scar,
        "callback": callback,
    }

    def _gen() -> str:
        if role == "aligned":
            base = _opening_for_slug(slug, rng, market, rng.choice(list(bible.get("favorite_narratives") or ["setup"])))
            base += f" {belief[:120]}."
        elif role == "opposed":
            if opponent_slug:
                counter = generate_counter(slug, opponent_slug, market_title=market, seed=seed)
                return counter.line
            base = f"{hated} framing fails. {sig.capitalize()}."
        else:
            base = f"Skeptic pass on {market} — evidence mismatch before repricing. {sig.capitalize()}."
        if callback:
            base += f" {callback}"
        if scar and slug not in ("doombot", "fed-watcher"):
            base += f" ({scar})"
        return base

    llm_text, gen_meta = _try_llm(slug, "reaction", ctx, db=db)
    if llm_text:
        text, score = ensure_character_copy(slug, lambda: llm_text, target_slug=opponent_slug, role=role)
        gen_meta["consistency"] = score.as_dict()
        return text, score, gen_meta
    text, score = ensure_character_copy(slug, _gen, target_slug=opponent_slug, role=role)
    gen_meta["generation_mode"] = "template"
    gen_meta["llm_fallback"] = True
    gen_meta["consistency"] = score.as_dict()
    return text, score, gen_meta


def generate_win_reaction(slug: str, *, market_title: str | None = None, seed: int | None = None) -> str:
    text, _ = generate_win_reaction_with_meta(slug, market_title=market_title, seed=seed)
    return text


def generate_win_reaction_with_meta(
    slug: str, *, market_title: str | None = None, seed: int | None = None, db: Session | None = None
) -> tuple[str, dict[str, Any]]:
    ctx = {"market_title": market_title or "the call"}
    llm_text, gen_meta = _try_llm(slug, "win", ctx, db=db)
    if llm_text:
        return polish_copy(slug, llm_text), gen_meta
    rules = voice_rules_for(slug)
    bible = character_bible_for(slug)
    rng = _rng(seed)
    style = rules.get("win_style") or bible.get("win_behavior")
    if style:
        text = polish_copy(slug, str(style))
    else:
        sig = rng.choice(safe_signature_phrases(slug) or ["Called it"])
        text = polish_copy(slug, f"{sig} — {ctx['market_title']}.")
    gen_meta["generation_mode"] = "template"
    gen_meta["llm_fallback"] = True
    return text, gen_meta


def generate_loss_reaction(slug: str, *, market_title: str | None = None, seed: int | None = None) -> str:
    text, _ = generate_loss_reaction_with_meta(slug, market_title=market_title, seed=seed)
    return text


def generate_loss_reaction_with_meta(
    slug: str, *, market_title: str | None = None, seed: int | None = None, db: Session | None = None
) -> tuple[str, dict[str, Any]]:
    ctx = {"market_title": market_title or "the call"}
    llm_text, gen_meta = _try_llm(slug, "loss", ctx, db=db)
    if llm_text:
        return polish_copy(slug, llm_text), gen_meta
    rules = voice_rules_for(slug)
    bible = character_bible_for(slug)
    style = rules.get("loss_style") or bible.get("loss_behavior")
    text = polish_copy(slug, str(style or bible.get("loss_behavior", "Thesis staged, not abandoned.")))
    gen_meta["generation_mode"] = "template"
    gen_meta["llm_fallback"] = True
    return text, gen_meta


def generate_battle_body(
    speaker_slug: str,
    opponent_slug: str,
    *,
    market_title: str,
    spread: int,
    side: str = "YES",
    seed: int | None = None,
) -> str:
    body, _ = generate_battle_body_with_meta(
        speaker_slug,
        opponent_slug,
        market_title=market_title,
        spread=spread,
        side=side,
        seed=seed,
    )
    return body


def generate_battle_body_with_meta(
    speaker_slug: str,
    opponent_slug: str,
    *,
    market_title: str,
    spread: int,
    side: str = "YES",
    seed: int | None = None,
    db: Session | None = None,
) -> tuple[str, dict[str, Any]]:
    ctx = {
        "market_title": market_title,
        "opponent_slug": opponent_slug,
        "spread": spread,
        "side": side,
    }
    llm_text, gen_meta = _try_llm(speaker_slug, "battle", ctx, db=db)
    if llm_text:
        counter = generate_counter(
            speaker_slug,
            opponent_slug,
            market_title=market_title,
            seed=seed,
            db=db,
        )
        if "Confidence:" not in llm_text:
            body = (
                f"{format_counter(speaker_slug, opponent_slug, counter.line, confidence=counter.confidence, direction=counter.direction)}\n"
                f"{llm_text}"
            )
        else:
            body = llm_text
        return body, gen_meta
    counter = generate_counter(
        speaker_slug,
        opponent_slug,
        market_title=market_title,
        seed=seed,
        db=db,
    )
    body = (
        f"{format_counter(speaker_slug, opponent_slug, counter.line, confidence=counter.confidence, direction=counter.direction)}\n"
        f"Battle on {market_title} — spread {spread} pts, {display_name(speaker_slug)} holds {side}."
    )
    gen_meta = counter.generation_meta or _model_meta(speaker_slug, "battle", ctx, template_used=True)
    return body, gen_meta


def generate_conviction_update_with_meta(
    slug: str,
    *,
    market_title: str | None = None,
    prob: float | None = None,
    event_kind: str | None = None,
    trigger_id: str | None = None,
    seed: int | None = None,
    db: Session | None = None,
) -> tuple[str, ConsistencyScore, dict[str, Any]]:
    """LLM-first conviction update — no hardcoded per-agent templates."""
    rng = _rng(seed)
    bible = character_bible_for(slug)
    market = market_title or "the market"
    if prob is None:
        prob = float(42 + rng.randint(0, 34))
    ctx = {
        "market_title": market,
        "event_type": "conviction_update",
        "event_kind": event_kind,
        "trigger_id": trigger_id,
        "prob": prob,
    }

    def _template_fallback() -> str:
        from app.forecasting.services.opinion_headlines import generate_opinion_headline

        headline = generate_opinion_headline(slug, rng=rng, market_title=market, seed=seed)
        if slug == "doombot":
            return f"{headline}\nConsensus is usually late on {market}."
        if slug == "bullbot":
            return f"{headline}\nStill buying — conviction {prob:.0f}% YES on {market}."
        if slug == "fed-watcher":
            return f"{headline}\nFront-end leads on {market}. September modal: {prob:.0f}% cut path."
        if slug == "macro-oracle":
            read_line = headline.strip()
            lower = read_line.lower()
            if lower.startswith("my read:"):
                body_line = read_line
            else:
                body_line = f"My read: {read_line}"
            return (
                f"{body_line}\n"
                f"Probability on {market}: {prob:.0f}% YES. Model updated."
            )
        if slug == "sports-chaos":
            return (
                f"{headline}\n"
                f"Upset probability on {market}: {prob:.0f}%. Line still wrong."
            )
        sig = rng.choice(safe_signature_phrases(slug) or [""])
        return f"{headline} On {market}, conviction holds at {prob:.0f}% YES. {sig}".strip()

    llm_text, gen_meta = _try_llm(slug, "conviction_update", ctx, db=db)
    if llm_text:
        text, score = ensure_character_copy(slug, lambda: llm_text, role="aligned")
        gen_meta["consistency"] = score.as_dict()
        gen_meta["generation_mode"] = "llm"
    else:
        text, score = ensure_character_copy(slug, _template_fallback, role="aligned")
        gen_meta["generation_mode"] = "template"
        gen_meta["llm_fallback"] = True
        gen_meta["consistency"] = score.as_dict()

    if db is not None and market_title:
        from app.forecasting.services.agent_memory_v2 import apply_episodic_memory_pipeline

        path = "llm" if gen_meta.get("generation_mode") == "llm" else "template"
        text, mem_meta = apply_episodic_memory_pipeline(
            text,
            db=db,
            agent_slug=slug,
            path=path,
            market_title=market_title,
            seed=seed,
            generation_mode=gen_meta.get("generation_mode"),
            weave=path == "template",
        )
        gen_meta.update(mem_meta)
    return text, score, gen_meta


def generate_thread_reaction(
    slug: str,
    *,
    market_title: str,
    post_snippet: str,
    seed: int | None = None,
) -> str:
    """Agent-voice reaction stub for market thread context (identity-first)."""
    text, _ = generate_feed_post(
        slug,
        market_title=market_title,
        term=post_snippet[:40] or "thread pushback",
        event_type="stance_followup",
        seed=seed,
    )
    return text


def apply_voice_to_generated_copy(
    slug: str,
    title: str,
    body: str,
    *,
    opponent_slug: str | None = None,
    event_type: str | None = None,
    market_title: str | None = None,
) -> tuple[str, str, dict[str, Any]]:
    """Polish conviction-engine output for core agents; optionally inject counter format."""
    from app.forecasting.services.opinion_headlines import resolve_opinion_headline

    if not is_core_character(slug):
        resolved = resolve_opinion_headline(
            slug,
            proposed_title=title,
            body=body,
            market_title=market_title,
            event_type=event_type,
            seed=hash(body) % 10_000,
        )
        return resolved, body, {}
    new_body, score = ensure_character_copy(
        slug,
        lambda: _identity_rewrite(slug, body, event_type=event_type),
        target_slug=opponent_slug,
    )
    meta: dict[str, Any] = {"character_consistency": score.as_dict()}
    if event_type in ("battle_escalation", "rivalry") and opponent_slug:
        counter = generate_counter(slug, opponent_slug, seed=hash(body) % 10_000)
        if score.voice < 0.55:
            new_body = (
                f"{format_counter(slug, opponent_slug, counter.line, confidence=counter.confidence, direction=counter.direction)}\n"
                f"{new_body}"
            )
    polished_body = polish_copy(slug, new_body)
    resolved_title = resolve_opinion_headline(
        slug,
        proposed_title=title,
        body=polished_body,
        market_title=market_title,
        event_type=event_type,
        seed=hash(body) % 10_000,
    )
    return resolved_title, polished_body, meta


def _identity_rewrite(slug: str, body: str, *, event_type: str | None) -> str:
    """Blend existing body with identity-first opener when engine output is generic."""
    if is_too_generic(body, slug):
        text, _ = generate_feed_post(slug, event_type=event_type or "market_move", seed=hash(body) % 10_000)
        return text
    bible = character_bible_for(slug)
    sig = random.choice(safe_signature_phrases(slug) or [""])
    if sig.lower() not in body.lower():
        return f"{sig.capitalize()}. {body}"
    return body


def brief_mention_copy(slug: str, *, market_title: str | None = None) -> str | None:
    if not is_core_character(slug):
        return None
    text, _ = generate_feed_post(slug, market_title=market_title, seed=hash(slug + (market_title or "")) % 10_000)
    return text


def character_preview_payload(slug: str, *, seed: int | None = None) -> dict[str, Any]:
    if slug not in CORE_AGENT_SLUGS:
        raise ValueError(f"Not a core character slug: {slug}")
    from app.forecasting.character_bibles.agent_model_config import agent_model_config_payload

    bible = character_bible_for(slug)
    rules = voice_rules_for(slug)
    rel = relationships_for(slug)
    sample_post, post_score, post_meta = generate_feed_post_with_meta(
        slug, market_title="Demo market", seed=seed
    )
    opp = (bible.get("recurring_enemies") or ["bullbot"])[0]
    if opp == slug:
        opp = "doombot" if slug != "doombot" else "bullbot"
    counter = generate_counter(slug, opp, market_title="Demo market", seed=seed)
    win, win_meta = generate_win_reaction_with_meta(slug, seed=seed)
    loss, loss_meta = generate_loss_reaction_with_meta(slug, seed=seed)
    battle_body, battle_meta = generate_battle_body_with_meta(
        slug, opp, market_title="Demo market", spread=28, seed=seed
    )
    return {
        "slug": slug,
        "display_name": display_name(slug),
        "character_bible": bible,
        "voice_rules": rules,
        "relationships": rel,
        "model_config": agent_model_config_payload(slug),
        "agent_voice_meta": AGENT_VOICE.get(slug, {}),
        "samples": {
            "post": sample_post,
            "post_consistency": post_score.as_dict(),
            "post_generation": post_meta,
            "counter": counter.formatted,
            "counter_generation": counter.generation_meta,
            "win": win,
            "win_generation": win_meta,
            "loss": loss,
            "loss_generation": loss_meta,
            "battle": battle_body,
            "battle_generation": battle_meta,
        },
    }


def blind_test_posts(*, seed: int | None = None) -> list[dict[str, Any]]:
    """Five anonymous samples — admin guesses the author."""
    rng = _rng(seed)
    slugs = list(sorted(CORE_AGENT_SLUGS))
    rng.shuffle(slugs)
    out: list[dict[str, Any]] = []
    for i, slug in enumerate(slugs):
        post, score = generate_feed_post(
            slug,
            market_title=rng.choice(
                ["Fed cuts by September?", "Recession before 2027?", "Chiefs cover -3.5?"]
            ),
            seed=(seed or 0) + i * 997,
        )
        out.append(
            {
                "anonymous_id": f"sample_{i + 1}",
                "body": post,
                "consistency": score.as_dict(),
                "answer_slug": slug,
            }
        )
    return out
