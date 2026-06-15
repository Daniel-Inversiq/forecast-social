"""Narrative progression memory — evolving theses per agent+narrative."""

from __future__ import annotations

import re
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy.orm import Session

from app.forecasting.agent_status import CORE_AGENT_SLUGS
from app.forecasting.models import AgentGeneratedActivity, AgentNarrativeState
from app.forecasting.services.utils import hash_seed

NARRATIVE_PROGRESSION_WINDOW_HOURS = 24
MAX_CONSECUTIVE_SAME_STAGE = 2

NARRATIVE_STAGES: tuple[str, ...] = (
    "initial_call",
    "early_confirmation",
    "consensus_shift",
    "resolution",
)

STAGE_DISPLAY_LABELS: dict[str, str] = {
    "initial_call": "Initial call",
    "early_confirmation": "Early confirmation",
    "consensus_shift": "Consensus shift",
    "resolution": "Resolution",
}

STAGE_HEADLINE_LEADS: dict[str, tuple[str, ...]] = {
    "initial_call": (
        "My read:",
        "This starts with",
        "Opening call —",
    ),
    "early_confirmation": (
        "The first read is holding",
        "Early tape confirms",
        "This is moving my way on",
    ),
    "consensus_shift": (
        "Consensus is catching up",
        "The desk is moving toward",
        "The crowd moved late on",
    ),
    "resolution": (
        "That was the read on",
        "The call held on",
        "Marked —",
    ),
}

_STAGE_BODY_TEMPLATES: dict[str, dict[str, tuple[str, ...]]] = {
    "bullbot": {
        "initial_call": (
            "{lead} {label}. Risk-on tape still engaged — buyers keep showing up on this setup.",
            "{lead} {label}. This starts with momentum intact; crowd still underpositioned here.",
        ),
        "early_confirmation": (
            "The first read is holding on {label}. Early tape confirms the upside path I flagged.",
            "Prior call on {label} still stands. Early tape confirms — this is moving my way.",
        ),
        "consensus_shift": (
            "Consensus is catching up on {label}. The desk is moving toward the risk-on read now.",
            "The crowd moved late on {label}. Network repricing finally aligns with the bid thesis.",
        ),
        "resolution": (
            "That was the read on {label}. The call held — marked on the tape.",
            "Closing {label}: the call held. Marked — upside path played out.",
        ),
    },
    "doombot": {
        "initial_call": (
            "{lead} {label}. Fragility doesn't disappear — recession window still open on this.",
            "{lead} {label}. This starts with credit impulse negative; consensus is usually late.",
        ),
        "early_confirmation": (
            "The first read is holding on {label}. Early tape confirms the downside skew I flagged.",
            "Prior call on {label} intact. Early prints align — this is moving my way.",
        ),
        "consensus_shift": (
            "Consensus is catching up on {label}. The desk is moving toward the fragility read.",
            "The crowd moved late on {label}. Network repricing finally prices the downside.",
        ),
        "resolution": (
            "That was the read on {label}. The call held — mechanism played out.",
            "Closing {label}: thesis resolved. Marked — consensus was late again.",
        ),
    },
    "fed-watcher": {
        "initial_call": (
            "{lead} {label}. Path first — front-end leads; the curve is tracking this setup.",
            "{lead} {label}. This starts with rates repriced before the headline narrative.",
        ),
        "early_confirmation": (
            "The first read is holding on {label}. Early tape confirms — front-end moved first.",
            "Prior call on {label} stands. Early prints align with the curve read.",
        ),
        "consensus_shift": (
            "Consensus is catching up on {label}. The desk is moving toward the path I priced.",
            "The crowd moved late on {label}. Market pricing finally aligns with the curve signal.",
        ),
        "resolution": (
            "That was the read on {label}. The call held — path repriced, marked.",
            "Closing {label}: thesis resolved. Marked — drama lagged the curve again.",
        ),
    },
    "macro-oracle": {
        "initial_call": (
            "{lead} {label}. My read: cycle matters more than the headline here.",
            "{lead} {label}. This starts with the data suggesting a regime shift on {label}.",
        ),
        "early_confirmation": (
            "The first read is holding on {label}. Early tape confirms the cycle read I posted.",
            "Prior call on {label} intact. Early data aligns — this is moving my way.",
        ),
        "consensus_shift": (
            "Consensus is catching up on {label}. The desk is moving toward the cycle thesis.",
            "The crowd moved late on {label}. Narrative overshoot finally mean-reverts to my read.",
        ),
        "resolution": (
            "That was the read on {label}. The call held — model updated, marked.",
            "Closing {label}: thesis resolved. Marked — data over narratives again.",
        ),
    },
    "sports-chaos": {
        "initial_call": (
            "{lead} {label}. Upset probability rising — the line is still wrong here.",
            "{lead} {label}. This starts with chaos priced too low on {label}.",
        ),
        "early_confirmation": (
            "The first read is holding on {label}. Early tape confirms the upset lane I flagged.",
            "Prior call on {label} stands. Early flow aligns — this is moving my way.",
        ),
        "consensus_shift": (
            "Consensus is catching up on {label}. The desk is moving toward the upset read.",
            "The crowd moved late on {label}. The line finally reprices toward chaos.",
        ),
        "resolution": (
            "That was the read on {label}. The call held — marked before kickoff.",
            "Closing {label}: thesis resolved. Marked — chaos was the model.",
        ),
    },
}

_STAGE_SET = frozenset(NARRATIVE_STAGES)

_INITIAL_CALL_RE = re.compile(
    r"\b(my read|this starts with|opening call)\b", re.I
)
_EARLY_CONFIRMATION_RE = re.compile(
    r"\b(first read|prior call|early tape|moving my way|holding)\b", re.I
)
_CONSENSUS_SHIFT_RE = re.compile(
    r"\b(consensus|desk.{0,24}mov|crowd moved|repric|catching up|network repric)\b", re.I
)
_RESOLUTION_RE = re.compile(
    r"\b(that was the read|call held|marked|thesis (played|resolved|closed)|closing)\b", re.I
)

_narrative_progression_adjustments = 0


def narrative_progression_adjustments() -> int:
    return _narrative_progression_adjustments


def reset_narrative_progression_adjustments() -> None:
    global _narrative_progression_adjustments
    _narrative_progression_adjustments = 0


def record_narrative_progression_adjustment() -> None:
    global _narrative_progression_adjustments
    _narrative_progression_adjustments += 1


def _utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def is_valid_stage(stage: str | None) -> bool:
    return isinstance(stage, str) and stage in _STAGE_SET


def stage_display_label(stage: str) -> str:
    return STAGE_DISPLAY_LABELS.get(stage, stage.replace("_", " ").title())


def stage_progression_meta(stage: str, *, narrative_id: str, narrative_label: str) -> dict[str, Any]:
    return {
        "narrative_id": narrative_id,
        "narrative_label": narrative_label,
        "narrative_stage": stage,
        "narrative_stage_label": stage_display_label(stage),
    }


def headline_pattern_key(title: str, *, stage: str | None = None) -> str:
    """Normalize headline opener for adjacent-stage de-duplication."""
    if stage and is_valid_stage(stage):
        return stage
    lowered = title.strip().lower()
    for stage_name, leads in STAGE_HEADLINE_LEADS.items():
        for lead in leads:
            if lowered.startswith(lead.lower()):
                return f"{stage_name}:{lead.lower()}"
    return lowered[:48]


def is_generic_signature_only(slug: str, text: str) -> bool:
    """True when copy is only a bare signature phrase with no arc framing."""
    from app.forecasting.services.copy_sanitize import safe_signature_phrases

    normalized = re.sub(r"\s+", " ", text.strip().lower())
    if len(normalized) < 8:
        return True
    for phrase in safe_signature_phrases(slug):
        p = re.sub(r"\s+", " ", phrase.strip().lower())
        if normalized == p:
            return True
    return False


def matches_stage_voice(stage: str, title: str, body: str) -> bool:
    blob = f"{title}\n{body}"
    if stage == "initial_call":
        return bool(_INITIAL_CALL_RE.search(blob))
    if stage == "early_confirmation":
        return bool(_EARLY_CONFIRMATION_RE.search(blob))
    if stage == "consensus_shift":
        return bool(_CONSENSUS_SHIFT_RE.search(blob))
    if stage == "resolution":
        return bool(_RESOLUTION_RE.search(blob))
    return False


def _pick_lead(slug: str, stage: str, seed: int) -> str:
    leads = STAGE_HEADLINE_LEADS[stage]
    return leads[hash_seed(slug, stage, str(seed), "headline_lead") % len(leads)]


def _stage_title(slug: str, label: str, stage: str, lead: str, seed: int) -> str:
    short_label = label.strip() or "this narrative"
    if stage == "initial_call":
        if lead.endswith(":"):
            return f"{lead} {short_label}"
        if lead.endswith("—"):
            return f"{lead} {short_label}"
        return f"{lead} {short_label}"
    if stage == "resolution" and lead.startswith("Marked"):
        return f"{lead} {short_label}"
    if lead.endswith("on"):
        return f"{lead} {short_label}"
    return f"{lead} — {short_label}"


def _light_polish(slug: str, text: str, *, max_sentences: int = 3) -> str:
    """Voice cleanup without fingerprint stamping — keeps stage headlines intact."""
    from app.forecasting.character_bibles import character_bible_for, voice_rules_for
    from app.forecasting.services.voice_engine import _enforce_max_sentences, _strip_forbidden

    bible = character_bible_for(slug)
    rules = voice_rules_for(slug)
    forbidden = list(bible.get("forbidden_phrases") or [])
    out = _strip_forbidden(text, forbidden)
    max_s = max_sentences or int(rules.get("max_sentences") or 3)
    return _enforce_max_sentences(out, max_s)


def compose_narrative_stage_copy(
    slug: str,
    narrative_label: str | None,
    stage: str,
    *,
    seed: int = 0,
) -> tuple[str, str]:
    """
    Stage-native copy — visibly different patterns per arc position.
    Replaces generic signature slogans as the primary headline.
    """
    from app.forecasting.services.character_fingerprints import (
        enforce_character_dominance,
        fingerprint_passes,
    )

    if slug not in CORE_AGENT_SLUGS:
        slug = "macro-oracle"
    label = (narrative_label or "this narrative").strip()
    lead = _pick_lead(slug, stage, seed)
    templates = _STAGE_BODY_TEMPLATES.get(slug, _STAGE_BODY_TEMPLATES["macro-oracle"])[stage]
    template = templates[hash_seed(slug, label, stage, str(seed), "body") % len(templates)]
    body = template.format(lead=lead, label=label)
    title = _stage_title(slug, label, stage, lead, seed)

    title = _light_polish(slug, title, max_sentences=2)[:255]
    body = _light_polish(slug, body, max_sentences=3)
    body, _fp_meta = enforce_character_dominance(slug, body, seed=seed + 17)

    combined = f"{title}\n{body}".strip()
    if not fingerprint_passes(slug, combined):
        body, _ = enforce_character_dominance(
            slug,
            body,
            seed=seed + 29,
        )
    return title, body


def next_narrative_stage(current: str | None) -> str:
    """Advance one stage; resolution loops back to initial_call."""
    if not current or not is_valid_stage(current) or current == "resolution":
        return "initial_call"
    idx = NARRATIVE_STAGES.index(current)
    return NARRATIVE_STAGES[idx + 1]


def _trailing_consecutive(stages: list[str], stage: str) -> int:
    count = 0
    for item in reversed(stages):
        if item == stage:
            count += 1
        else:
            break
    return count


def would_exceed_consecutive_limit(
    recent_stages: list[str],
    stage: str,
    *,
    max_consecutive: int = MAX_CONSECUTIVE_SAME_STAGE,
) -> bool:
    """True when picking `stage` would create more than max_consecutive in a row."""
    return _trailing_consecutive(recent_stages, stage) >= max_consecutive


def pick_narrative_stage(
    db: Session | None,
    agent_slug: str,
    narrative_id: str,
    *,
    seed: int = 0,
    max_consecutive: int = MAX_CONSECUTIVE_SAME_STAGE,
) -> str:
    """
    Prefer the next stage in the arc for this agent+narrative.
    Avoid a third consecutive repeat of the same stage.
    """
    stored = get_stored_stage(db, agent_slug, narrative_id) if db is not None else None
    preferred = next_narrative_stage(stored)
    if db is None:
        return preferred

    recent = load_recent_stages(db, agent_slug, narrative_id, limit=max_consecutive + 1)
    if would_exceed_consecutive_limit(recent, preferred, max_consecutive=max_consecutive):
        record_narrative_progression_adjustment()
        for offset in range(1, len(NARRATIVE_STAGES)):
            candidate = NARRATIVE_STAGES[
                (NARRATIVE_STAGES.index(preferred) + offset) % len(NARRATIVE_STAGES)
            ]
            if not would_exceed_consecutive_limit(
                recent, candidate, max_consecutive=max_consecutive
            ):
                return candidate
        return next_narrative_stage(preferred)

    if hash_seed(agent_slug, narrative_id, str(seed), "stage_jitter") % 100 < 12:
        alt = next_narrative_stage(preferred)
        if not would_exceed_consecutive_limit(recent, alt, max_consecutive=max_consecutive):
            return alt
    return preferred


def get_stored_stage(
    db: Session,
    agent_slug: str,
    narrative_id: str,
) -> str | None:
    row = (
        db.query(AgentNarrativeState)
        .filter(
            AgentNarrativeState.agent_slug == agent_slug,
            AgentNarrativeState.narrative_id == narrative_id,
        )
        .first()
    )
    if not row or not is_valid_stage(row.stage):
        return None
    return row.stage


def commit_narrative_stage(
    db: Session,
    agent_slug: str,
    narrative_id: str,
    stage: str,
) -> None:
    """Persist narrative arc position; resolution clears back to initial_call next tick."""
    if not is_valid_stage(stage):
        return
    now = _utcnow()
    row = (
        db.query(AgentNarrativeState)
        .filter(
            AgentNarrativeState.agent_slug == agent_slug,
            AgentNarrativeState.narrative_id == narrative_id,
        )
        .first()
    )
    if row:
        row.stage = stage
        row.updated_at = now
    else:
        db.add(
            AgentNarrativeState(
                agent_slug=agent_slug,
                narrative_id=narrative_id,
                stage=stage,
                updated_at=now,
            )
        )
    db.flush()


def load_recent_stages(
    db: Session,
    agent_slug: str,
    narrative_id: str,
    *,
    limit: int = 8,
    hours: int = NARRATIVE_PROGRESSION_WINDOW_HOURS,
) -> list[str]:
    """Recent narrative_stage values oldest-first for this agent+narrative."""
    cutoff = _utcnow() - timedelta(hours=hours)
    rows = (
        db.query(AgentGeneratedActivity)
        .filter(
            AgentGeneratedActivity.agent_slug == agent_slug,
            AgentGeneratedActivity.created_at >= cutoff,
            AgentGeneratedActivity.metadata_json["narrative_id"].as_string() == narrative_id,
        )
        .order_by(AgentGeneratedActivity.created_at.asc())
        .limit(limit)
        .all()
    )
    stages: list[str] = []
    for row in rows:
        meta = row.metadata_json or {}
        stage = meta.get("narrative_stage")
        if is_valid_stage(stage):
            stages.append(stage)
    return stages


def stage_headline_template(narrative_label: str, stage: str) -> str:
    """Legacy helper — prefer compose_narrative_stage_copy for visible arc copy."""
    label = narrative_label.strip() or "the narrative"
    lead = STAGE_HEADLINE_LEADS.get(stage, ("Updated read —",))[0]
    return _stage_title("macro-oracle", label, stage, lead, seed=0)


def apply_stage_framing(
    slug: str,
    narrative_label: str | None,
    stage: str,
    title: str,
    body: str,
    *,
    seed: int = 0,
) -> tuple[str, str]:
    """Replace generic copy with stage-native headline and body."""
    return compose_narrative_stage_copy(
        slug,
        narrative_label,
        stage,
        seed=seed,
    )


def narrative_progression_meta(
    db: Session | None,
    agent_slug: str,
    narrative_id: str,
    narrative_label: str,
    *,
    seed: int = 0,
) -> dict[str, Any]:
    """Metadata fields for autonomous narrative activities."""
    stage = pick_narrative_stage(db, agent_slug, narrative_id, seed=seed)
    return stage_progression_meta(
        stage,
        narrative_id=narrative_id,
        narrative_label=narrative_label,
    )


def stamp_activity_narrative_progression(
    db: Session,
    row: AgentGeneratedActivity,
    *,
    narrative_id: str,
    narrative_label: str,
    seed: int = 0,
) -> str:
    """Attach progression metadata and persist arc state on an activity row."""
    meta = dict(row.metadata_json or {})
    progression = narrative_progression_meta(
        db,
        row.agent_slug,
        narrative_id,
        narrative_label,
        seed=seed,
    )
    stage = str(progression["narrative_stage"])
    title, body = compose_narrative_stage_copy(
        row.agent_slug,
        narrative_label,
        stage,
        seed=seed,
    )
    row.title = title[:255]
    row.body = body
    meta.update(progression)
    row.metadata_json = meta
    commit_narrative_stage(db, row.agent_slug, narrative_id, stage)
    return stage


def enrich_trigger_narrative_progression(
    db: Session,
    trigger: Any,
    *,
    narrative_id: str,
    narrative_label: str,
    seed: int,
) -> Any:
    """Return trigger with narrative progression fields for generation."""
    from dataclasses import replace

    stage = pick_narrative_stage(db, trigger.agent_slug, narrative_id, seed=seed)
    title, _ = compose_narrative_stage_copy(
        trigger.agent_slug,
        narrative_label,
        stage,
        seed=seed,
    )
    return replace(
        trigger,
        headline_template=title,
        narrative_id=narrative_id,
        narrative_label=narrative_label,
        narrative_stage=stage,
    )


def compute_narrative_progression_debug_stats(
    db: Session,
    *,
    hours: int = NARRATIVE_PROGRESSION_WINDOW_HOURS,
) -> dict[str, Any]:
    cutoff = _utcnow() - timedelta(hours=hours)
    rows = (
        db.query(AgentGeneratedActivity)
        .filter(AgentGeneratedActivity.created_at >= cutoff)
        .order_by(AgentGeneratedActivity.created_at.asc())
        .limit(1200)
        .all()
    )

    agent_narrative_stage: dict[str, dict[str, str]] = {}
    stage_transition_count = 0
    repeated_stage_count = 0
    trailing_by_key: dict[tuple[str, str], list[str]] = {}

    for row in rows:
        meta = row.metadata_json or {}
        narrative_id = meta.get("narrative_id")
        stage = meta.get("narrative_stage")
        if not isinstance(narrative_id, str) or not is_valid_stage(stage):
            continue

        key = (row.agent_slug, narrative_id)
        agent_narrative_stage.setdefault(row.agent_slug, {})[narrative_id] = stage

        history = trailing_by_key.setdefault(key, [])
        if history and history[-1] != stage:
            stage_transition_count += 1
        history.append(stage)
        if len(history) >= 3 and history[-1] == history[-2] == history[-3]:
            repeated_stage_count += 1

    stored_rows = db.query(AgentNarrativeState).all()
    for stored in stored_rows:
        if is_valid_stage(stored.stage):
            agent_narrative_stage.setdefault(stored.agent_slug, {})[
                stored.narrative_id
            ] = stored.stage

    return {
        "agent_narrative_stage": agent_narrative_stage,
        "stage_transition_count_24h": stage_transition_count,
        "repeated_stage_count_24h": repeated_stage_count,
        "narrative_progression_adjustments": narrative_progression_adjustments(),
    }
