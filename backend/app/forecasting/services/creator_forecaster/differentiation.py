"""Creator forecaster differentiation — weighted heuristics vs core cast and peers."""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any

from sqlalchemy.orm import Session

from app.forecasting.agent_status import CORE_AGENT_SLUGS
from app.forecasting.character_bibles import character_bible_for
from app.forecasting.models import CreatorForecaster, ForecasterKnowledgeSource
from app.forecasting.seed_data.agents import AGENT_VOICE

# Dimension weights (sum = 100). Archetype alone is intentionally moderate.
_WEIGHT_ARCHETYPE = 14
_WEIGHT_DOMAIN = 18
_WEIGHT_BLIND_SPOT = 16
_WEIGHT_SLIDERS = 22
_WEIGHT_BIO = 8
_WEIGHT_SAMPLES = 14
_WEIGHT_NARRATIVES = 8

_LEVEL_DISTINCT = "distinct"
_LEVEL_SOME_OVERLAP = "some_overlap"
_LEVEL_TOO_CLOSE = "too_close"
_LEVEL_CLONE_RISK = "clone_risk"

_CORE_ARCHETYPE_MAP: dict[str, str] = {
    "doombot": "the_bear",
    "bullbot": "the_bull",
    "fed-watcher": "the_data_monk",
    "macro-oracle": "the_specialist",
    "sports-chaos": "the_challenger",
}

_CORE_DOMAIN: dict[str, str] = {
    "doombot": "Macro",
    "bullbot": "Macro",
    "fed-watcher": "Macro",
    "macro-oracle": "Macro",
    "sports-chaos": "Sports",
}

_CORE_DISPLAY: dict[str, str] = {
    "doombot": "DoomBot",
    "bullbot": "BullBot",
    "fed-watcher": "FedWatcher",
    "macro-oracle": "Macro Oracle",
    "sports-chaos": "SportsChaos",
}


@dataclass
class ForecasterProfile:
    slug: str
    name: str
    archetype: str
    domain_focus: str
    blind_spot: str
    aggressiveness: int
    humor: int
    contrarian_level: int
    data_vs_intuition: int
    confidence: int
    short_bio: str = ""
    sample_texts: list[str] = field(default_factory=list)
    favorite_narratives: list[str] = field(default_factory=list)
    hated_narratives: list[str] = field(default_factory=list)
    has_custom_knowledge: bool = False


@dataclass
class MatchBreakdown:
    slug: str
    name: str
    similarity_score: int
    overlap_reasons: list[str]
    dimension_scores: dict[str, float]


def _normalize(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "").lower().strip())


def _token_set(text: str) -> set[str]:
    return {t for t in re.findall(r"[a-z0-9]+", _normalize(text)) if len(t) > 2}


def _text_overlap(a: str, b: str) -> float:
    ta, tb = _token_set(a), _token_set(b)
    if not ta or not tb:
        return 0.0
    return len(ta & tb) / len(ta | tb)


def _slider_similarity(
    a: tuple[int, int, int, int, int],
    b: tuple[int, int, int, int, int],
) -> float:
    diffs = [abs(x - y) for x, y in zip(a, b)]
    avg_diff = sum(diffs) / len(diffs)
    return max(0.0, 1.0 - avg_diff / 50.0)


def _sample_tone_similarity(candidate: list[str], other: list[str]) -> float:
    if not candidate or not other:
        return 0.0
    scores = [_text_overlap(c, o) for c in candidate for o in other]
    return max(scores) if scores else 0.0


def _narrative_overlap(
    candidate_domain: str,
    candidate_archetype: str,
    favorite: list[str],
    hated: list[str],
) -> float:
    """Light signal when domain + archetype align with a core agent's narrative stack."""
    if not favorite and not hated:
        return 0.0
    domain_bonus = 0.35 if candidate_domain in ("Macro", "Sports") else 0.15
    arch_bonus = 0.25 if candidate_archetype in ("the_bear", "the_bull") else 0.1
    return min(1.0, domain_bonus + arch_bonus)


def _sliders_tuple(
    aggressiveness: int,
    humor: int,
    contrarian_level: int,
    data_vs_intuition: int,
    confidence: int,
) -> tuple[int, int, int, int, int]:
    return (aggressiveness, humor, contrarian_level, data_vs_intuition, confidence)


def _compare_profiles(candidate: ForecasterProfile, other: ForecasterProfile) -> MatchBreakdown:
    dim: dict[str, float] = {}
    reasons: list[str] = []

    if candidate.archetype and other.archetype and candidate.archetype == other.archetype:
        dim["archetype"] = 1.0
        reasons.append("Same archetype")
    else:
        dim["archetype"] = 0.0

    if candidate.domain_focus and other.domain_focus:
        if _normalize(candidate.domain_focus) == _normalize(other.domain_focus):
            dim["domain"] = 1.0
            focus = candidate.domain_focus
            reasons.append(f"Same {focus.lower()} focus" if focus != "Macro" else "Same macro focus")
        else:
            dim["domain"] = 0.0
    else:
        dim["domain"] = 0.0

    blind_sim = _text_overlap(candidate.blind_spot, other.blind_spot)
    dim["blind_spot"] = blind_sim
    if blind_sim >= 0.45:
        reasons.append("Similar blind spot")

    slider_sim = _slider_similarity(
        _sliders_tuple(
            candidate.aggressiveness,
            candidate.humor,
            candidate.contrarian_level,
            candidate.data_vs_intuition,
            candidate.confidence,
        ),
        _sliders_tuple(
            other.aggressiveness,
            other.humor,
            other.contrarian_level,
            other.data_vs_intuition,
            other.confidence,
        ),
    )
    dim["sliders"] = slider_sim
    if slider_sim >= 0.72:
        reasons.append("Similar confidence/aggression pattern")

    bio_sim = _text_overlap(candidate.short_bio, other.short_bio)
    dim["bio"] = bio_sim
    if bio_sim >= 0.5 and candidate.short_bio.strip():
        reasons.append("Similar bio positioning")

    sample_sim = _sample_tone_similarity(candidate.sample_texts, other.sample_texts)
    dim["samples"] = sample_sim
    if sample_sim >= 0.42:
        reasons.append("Sample posts sound too close")

    fav_overlap = max(
        _text_overlap(" ".join(candidate.favorite_narratives), " ".join(other.favorite_narratives)),
        _text_overlap(" ".join(candidate.hated_narratives), " ".join(other.hated_narratives)),
    )
    narrative_sim = max(fav_overlap, _narrative_overlap(
        candidate.domain_focus,
        candidate.archetype,
        other.favorite_narratives,
        other.hated_narratives,
    ) if other.favorite_narratives or other.hated_narratives else fav_overlap)
    dim["narratives"] = narrative_sim
    if narrative_sim >= 0.5:
        reasons.append("Overlapping favorite or hated narratives")

    weighted = (
        dim["archetype"] * _WEIGHT_ARCHETYPE
        + dim["domain"] * _WEIGHT_DOMAIN
        + dim["blind_spot"] * _WEIGHT_BLIND_SPOT
        + dim["sliders"] * _WEIGHT_SLIDERS
        + dim["bio"] * _WEIGHT_BIO
        + dim["samples"] * _WEIGHT_SAMPLES
        + dim["narratives"] * _WEIGHT_NARRATIVES
    )
    similarity = int(round(min(100, max(0, weighted))))

    return MatchBreakdown(
        slug=other.slug,
        name=other.name,
        similarity_score=similarity,
        overlap_reasons=reasons,
        dimension_scores=dim,
    )


def _level_for_score(similarity: int) -> str:
    if similarity >= 80:
        return _LEVEL_CLONE_RISK
    if similarity >= 65:
        return _LEVEL_TOO_CLOSE
    if similarity >= 40:
        return _LEVEL_SOME_OVERLAP
    return _LEVEL_DISTINCT


def _can_publish(level: str) -> bool:
    return level != _LEVEL_CLONE_RISK


def _level_message(level: str, closest_name: str, similarity: int) -> str:
    if level == _LEVEL_DISTINCT:
        return f"Distinct — your forecaster adds a fresh angle ({100 - similarity}/100 differentiation)."
    if level == _LEVEL_SOME_OVERLAP:
        return f"Some overlap with {closest_name} — still publishable with a sharper niche."
    if level == _LEVEL_TOO_CLOSE:
        return (
            f"Your forecaster is close to {closest_name}. "
            "Make the blind spot more specific or narrow the domain before publishing."
        )
    return (
        f"Clone risk — too similar to {closest_name}. "
        "Edit archetype, domain, blind spot, or personality sliders before publishing."
    )


def _improvement_suggestions(
    *,
    level: str,
    overlap_reasons: list[str],
    closest_name: str,
    candidate: ForecasterProfile,
) -> list[str]:
    if level == _LEVEL_DISTINCT:
        return []

    tips: list[str] = []
    reasons_lower = " ".join(overlap_reasons).lower()

    if "archetype" in reasons_lower and candidate.archetype in ("the_bear", "the_bull"):
        tips.append("Keep the bear/bull angle but narrow domain (e.g. credit stress, single sport).")
    elif "archetype" in reasons_lower:
        tips.append("Choose a different archetype or lean harder into a sub-niche voice.")

    if "macro" in reasons_lower or "focus" in reasons_lower:
        tips.append("Narrow the domain — politics, AI, climate, or a sub-theme within macro.")

    if "blind spot" in reasons_lower:
        tips.append("Rewrite the blind spot to name a specific flaw only your forecaster has.")

    if "confidence" in reasons_lower or "aggression" in reasons_lower:
        if candidate.confidence >= 70:
            tips.append("Reduce confidence or soften aggressiveness to separate the tone.")
        else:
            tips.append("Shift data vs intuition or contrarian sliders for a distinct posture.")

    if "sample" in reasons_lower:
        tips.append("Regenerate preview after changing personality — samples should sound unmistakably yours.")

    if "bio" in reasons_lower:
        tips.append("Rewrite the short bio to highlight a unique evidence style or relationship posture.")

    if not candidate.has_custom_knowledge:
        tips.append("Add custom knowledge PDFs to anchor takes in material only you uploaded.")

    if closest_name in ("DoomBot", "BullBot", "FedWatcher", "Macro Oracle", "SportsChaos"):
        tips.append(f"You're echoing core cast voice ({closest_name}) — differentiate evidence style, not just mood.")

    # Dedupe while preserving order
    seen: set[str] = set()
    unique: list[str] = []
    for t in tips:
        if t not in seen:
            seen.add(t)
            unique.append(t)
    return unique[:5]


def _core_profiles() -> list[ForecasterProfile]:
    profiles: list[ForecasterProfile] = []
    for slug in CORE_AGENT_SLUGS:
        bible = character_bible_for(slug)
        voice = AGENT_VOICE.get(slug, {})
        agg = int(float(voice.get("aggressiveness", 0.5)) * 100)
        contrarian = 70 if voice.get("bias") == "contrarian" else 40
        if slug == "doombot":
            contrarian = 55
        if slug == "bullbot":
            contrarian = 35
        samples = list(bible.get("example_good_posts") or [])
        if voice.get("sample_take"):
            samples.append(str(voice["sample_take"]))
        profiles.append(
            ForecasterProfile(
                slug=slug,
                name=_CORE_DISPLAY.get(slug, slug),
                archetype=_CORE_ARCHETYPE_MAP.get(slug, "the_specialist"),
                domain_focus=_CORE_DOMAIN.get(slug, "Macro"),
                blind_spot=str(bible.get("blind_spot") or ""),
                aggressiveness=agg,
                humor=30,
                contrarian_level=contrarian,
                data_vs_intuition=60 if slug == "fed-watcher" else 45,
                confidence=75,
                short_bio=str(bible.get("worldview") or ""),
                sample_texts=samples,
                favorite_narratives=list(bible.get("favorite_narratives") or []),
                hated_narratives=list(bible.get("hated_narratives") or []),
                has_custom_knowledge=False,
            )
        )
    return profiles


def _preview_sample_texts(preview: dict[str, Any] | None) -> list[str]:
    if not preview:
        return []
    texts: list[str] = []
    for key in ("forecasts", "rivalry_reactions"):
        texts.extend(preview.get(key) or [])
    for key in ("winning_reaction", "losing_reaction"):
        val = preview.get(key)
        if val:
            texts.append(str(val))
    return texts


def _creator_to_profile(cf: CreatorForecaster, *, knowledge_ready: bool = False) -> ForecasterProfile:
    return ForecasterProfile(
        slug=cf.username or f"creator-{cf.id}",
        name=cf.display_name or cf.username or f"Creator {cf.id}",
        archetype=cf.archetype,
        domain_focus=cf.domain_focus,
        blind_spot=cf.blind_spot,
        aggressiveness=cf.aggressiveness,
        humor=cf.humor,
        contrarian_level=cf.contrarian_level,
        data_vs_intuition=cf.data_vs_intuition,
        confidence=cf.confidence,
        short_bio=cf.short_bio or "",
        sample_texts=_preview_sample_texts(cf.preview_json),
        has_custom_knowledge=knowledge_ready,
    )


def _result_payload(
    *,
    best: MatchBreakdown,
    level: str,
    candidate: ForecasterProfile,
) -> dict[str, Any]:
    similarity = best.similarity_score
    differentiation = max(0, min(100, 100 - similarity))
    suggestions = _improvement_suggestions(
        level=level,
        overlap_reasons=best.overlap_reasons,
        closest_name=best.name,
        candidate=candidate,
    )
    return {
        "similarity_score": similarity,
        "overall_similarity_score": similarity,
        "differentiation_score": differentiation,
        "level": level,
        "closest_match": {
            "slug": best.slug,
            "name": best.name,
        },
        "closest_agent_slug": best.slug,
        "closest_agent_name": best.name,
        "overlap_reasons": best.overlap_reasons,
        "improvement_suggestions": suggestions,
        "suggestions": suggestions,
        "can_publish": _can_publish(level),
        "message": _level_message(level, best.name, similarity),
        # Legacy fields for gradual client migration
        "too_similar": level in (_LEVEL_TOO_CLOSE, _LEVEL_CLONE_RISK),
        "threshold": 65,
    }


def score_differentiation(
    db: Session,
    *,
    archetype: str,
    domain_focus: str,
    blind_spot: str,
    aggressiveness: int,
    humor: int,
    contrarian_level: int,
    data_vs_intuition: int,
    confidence: int,
    short_bio: str = "",
    preview_json: dict[str, Any] | None = None,
    sample_outputs: list[str] | None = None,
    exclude_id: int | None = None,
    owner_user_id: int | None = None,
    has_custom_knowledge: bool = False,
) -> dict[str, Any]:
    samples = list(sample_outputs or [])
    if not samples:
        samples = _preview_sample_texts(preview_json)

    candidate = ForecasterProfile(
        slug="candidate",
        name="Your forecaster",
        archetype=archetype,
        domain_focus=domain_focus,
        blind_spot=blind_spot,
        aggressiveness=aggressiveness,
        humor=humor,
        contrarian_level=contrarian_level,
        data_vs_intuition=data_vs_intuition,
        confidence=confidence,
        short_bio=short_bio,
        sample_texts=samples,
        has_custom_knowledge=has_custom_knowledge,
    )

    comparisons: list[MatchBreakdown] = []
    for core in _core_profiles():
        comparisons.append(_compare_profiles(candidate, core))

    published = (
        db.query(CreatorForecaster)
        .filter(CreatorForecaster.status == "published")
        .all()
    )
    for cf in published:
        if exclude_id and cf.id == exclude_id:
            continue
        knowledge_ready = bool(
            db.query(ForecasterKnowledgeSource)
            .filter(
                ForecasterKnowledgeSource.forecaster_id == cf.id,
                ForecasterKnowledgeSource.status == "ready",
            )
            .first()
        )
        comparisons.append(_compare_profiles(candidate, _creator_to_profile(cf, knowledge_ready=knowledge_ready)))

    if owner_user_id is not None:
        drafts = (
            db.query(CreatorForecaster)
            .filter(
                CreatorForecaster.owner_user_id == owner_user_id,
                CreatorForecaster.status == "draft",
            )
            .all()
        )
        for cf in drafts:
            if exclude_id and cf.id == exclude_id:
                continue
            comparisons.append(_compare_profiles(candidate, _creator_to_profile(cf)))

    if not comparisons:
        empty = MatchBreakdown("none", "None", 0, [], {})
        return _result_payload(best=empty, level=_LEVEL_DISTINCT, candidate=candidate)

    comparisons.sort(key=lambda m: m.similarity_score, reverse=True)
    best = comparisons[0]
    level = _level_for_score(best.similarity_score)
    return _result_payload(best=best, level=level, candidate=candidate)


def score_creator_forecaster(db: Session, cf: CreatorForecaster) -> dict[str, Any]:
    knowledge_ready = bool(
        db.query(ForecasterKnowledgeSource)
        .filter(
            ForecasterKnowledgeSource.forecaster_id == cf.id,
            ForecasterKnowledgeSource.status == "ready",
        )
        .first()
    )
    return score_differentiation(
        db,
        archetype=cf.archetype,
        domain_focus=cf.domain_focus,
        blind_spot=cf.blind_spot,
        aggressiveness=cf.aggressiveness,
        humor=cf.humor,
        contrarian_level=cf.contrarian_level,
        data_vs_intuition=cf.data_vs_intuition,
        confidence=cf.confidence,
        short_bio=cf.short_bio or "",
        preview_json=cf.preview_json,
        exclude_id=cf.id,
        owner_user_id=cf.owner_user_id,
        has_custom_knowledge=knowledge_ready,
    )


def admin_differentiation_overview(db: Session) -> dict[str, Any]:
    """Aggregate differentiation signals for published creator forecasters."""
    published = (
        db.query(CreatorForecaster)
        .filter(CreatorForecaster.status == "published")
        .order_by(CreatorForecaster.published_at.desc().nullslast(), CreatorForecaster.id.desc())
        .limit(100)
        .all()
    )
    rows: list[dict[str, Any]] = []
    buckets = {"distinct": 0, "some_overlap": 0, "too_close": 0, "clone_risk": 0}

    for cf in published:
        result = score_creator_forecaster(db, cf)
        level = result["level"]
        buckets[level] = buckets.get(level, 0) + 1
        rows.append(
            {
                "id": cf.id,
                "display_name": cf.display_name,
                "username": cf.username,
                "agent_slug": cf.agent.slug if cf.agent else None,
                "published_at": cf.published_at.isoformat() if cf.published_at else None,
                "similarity_score": result["similarity_score"],
                "differentiation_score": result["differentiation_score"],
                "level": level,
                "closest_match": result["closest_match"],
                "overlap_reasons": result["overlap_reasons"],
                "can_publish": result["can_publish"],
                "needs_review": level in (_LEVEL_TOO_CLOSE, _LEVEL_CLONE_RISK),
            }
        )

    clone_risk = [r for r in rows if r["level"] == _LEVEL_CLONE_RISK]
    too_close = [r for r in rows if r["level"] == _LEVEL_TOO_CLOSE]

    return {
        "distribution": buckets,
        "newest": rows[:25],
        "clone_risk": clone_risk,
        "too_close": too_close,
        "total_published": len(rows),
    }
