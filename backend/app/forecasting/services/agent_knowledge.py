"""Agent knowledge & memory layer — beliefs, worldview, influence, forecast DNA."""

from __future__ import annotations

import hashlib
import re
from datetime import datetime, timezone
from typing import Any

from sqlalchemy.orm import Session

from app.forecasting.agent_status import CORE_AGENT_SLUGS
from app.forecasting.character_bibles import character_bible_for
from app.forecasting.models import Agent, CreatorForecaster, ForecasterKnowledgeSource
from app.forecasting.services.creator_forecaster.knowledge import serialize_source_public

_ARCHETYPE_TAGS: dict[str, list[str]] = {
    "the_bear": ["Defensive", "Risk-off", "Slow conviction"],
    "the_bull": ["Momentum-aware", "Risk-on", "Optimistic bias"],
    "the_contrarian": ["Contrarian", "Crowd-skeptical", "Patience"],
    "the_data_monk": ["Analytical", "Data-first", "Methodical"],
    "the_insider": ["Narrative-led", "Flow-sensitive", "Fast reads"],
    "the_narrator": ["Story-driven", "Macro-first", "Thematic"],
    "the_challenger": ["Adversarial", "Debate-first", "High conviction"],
    "the_specialist": ["Domain expert", "Macro-first", "Deep research"],
}

_CORE_SLIDER_DEFAULTS: dict[str, dict[str, int]] = {
    "doombot": {
        "consensus_following": 25,
        "contrarianism": 78,
        "risk_appetite": 30,
        "forecast_speed": 35,
        "narrative_sensitivity": 55,
    },
    "bullbot": {
        "consensus_following": 62,
        "contrarianism": 38,
        "risk_appetite": 72,
        "forecast_speed": 58,
        "narrative_sensitivity": 48,
    },
    "fed-watcher": {
        "consensus_following": 48,
        "contrarianism": 52,
        "risk_appetite": 42,
        "forecast_speed": 40,
        "narrative_sensitivity": 35,
    },
    "macro-oracle": {
        "consensus_following": 32,
        "contrarianism": 68,
        "risk_appetite": 45,
        "forecast_speed": 28,
        "narrative_sensitivity": 42,
    },
    "sports-chaos": {
        "consensus_following": 55,
        "contrarianism": 62,
        "risk_appetite": 65,
        "forecast_speed": 72,
        "narrative_sensitivity": 70,
    },
}


def _slug_seed(slug: str, salt: str) -> int:
    h = hashlib.sha256(f"{slug}:{salt}".encode()).hexdigest()
    return int(h[:8], 16)


def _display_status(status: str) -> str:
    mapping = {
        "ready": "Active",
        "processing": "Processing",
        "uploaded": "Uploaded",
        "failed": "Failed",
    }
    return mapping.get(status, status.title())


def _source_type_label(filename: str, source_type: str) -> str:
    if source_type == "pdf" or filename.lower().endswith(".pdf"):
        return "PDF"
    if filename.lower().endswith(".docx"):
        return "DOCX"
    if filename.lower().endswith(".md"):
        return "Library"
    ext = filename.rsplit(".", 1)[-1].upper() if "." in filename else "Research"
    return ext if len(ext) <= 6 else "Research"


def _relative_label(dt: datetime | None) -> str:
    if not dt:
        return "Recently"
    now = datetime.now(timezone.utc)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    delta = now - dt
    days = max(0, delta.days)
    if days == 0:
        return "Today"
    if days == 1:
        return "1d ago"
    if days < 7:
        return f"{days}d ago"
    weeks = days // 7
    if weeks < 5:
        return f"{weeks}w ago"
    months = days // 30
    return f"{months}mo ago" if months else f"{weeks}w ago"


def _belief_confidence(text: str, source_count: int) -> int:
    base = 62 + min(28, len(text) // 8)
    base += min(10, source_count * 3)
    return min(97, max(55, base))


def _normalize_belief(text: str) -> str:
    t = re.sub(r"\s+", " ", (text or "").strip())
    if not t:
        return ""
    if t[-1] not in ".!?":
        t = t.rstrip(",;") + "."
    if len(t) > 0 and t[0].islower():
        t = t[0].upper() + t[1:]
    return t[:220]


def _token_set(text: str) -> set[str]:
    return {t for t in re.findall(r"[a-z0-9]+", text.lower()) if len(t) > 2}


def _text_overlap(a: str, b: str) -> float:
    ta, tb = _token_set(a), _token_set(b)
    if not ta or not tb:
        return 0.0
    return len(ta & tb) / len(ta | tb)


def _resolve_creator_forecaster(db: Session, agent: Agent) -> CreatorForecaster | None:
    if agent.id:
        cf = (
            db.query(CreatorForecaster)
            .filter(CreatorForecaster.agent_id == agent.id)
            .first()
        )
        if cf:
            return cf
    return (
        db.query(CreatorForecaster)
        .filter(
            CreatorForecaster.username == agent.slug,
            CreatorForecaster.status == "published",
        )
        .first()
    )


def _worldview_sliders(cf: CreatorForecaster | None, slug: str) -> dict[str, int]:
    if slug in _CORE_SLIDER_DEFAULTS:
        return dict(_CORE_SLIDER_DEFAULTS[slug])
    if cf:
        return {
            "consensus_following": max(0, min(100, 100 - cf.contrarian_level)),
            "contrarianism": cf.contrarian_level,
            "risk_appetite": cf.aggressiveness,
            "forecast_speed": cf.confidence,
            "narrative_sensitivity": max(0, min(100, 100 - cf.data_vs_intuition)),
        }
    seed = _slug_seed(slug, "sliders")
    return {
        "consensus_following": 35 + (seed % 40),
        "contrarianism": 40 + ((seed >> 4) % 45),
        "risk_appetite": 30 + ((seed >> 8) % 50),
        "forecast_speed": 25 + ((seed >> 12) % 55),
        "narrative_sensitivity": 30 + ((seed >> 16) % 50),
    }


def _worldview_tags(cf: CreatorForecaster | None, slug: str, sliders: dict[str, int]) -> list[str]:
    tags: list[str] = []
    if cf and cf.archetype:
        tags.extend(_ARCHETYPE_TAGS.get(cf.archetype, [])[:3])
    if slug in CORE_AGENT_SLUGS:
        bible = character_bible_for(slug)
        style = (bible.get("confidence_style") or "")[:40]
        if "contrarian" in style.lower() or sliders["contrarianism"] >= 60:
            tags.append("Contrarian")
        if "slow" in style.lower() or sliders["forecast_speed"] <= 40:
            tags.append("Slow conviction")
        if "macro" in (bible.get("worldview") or "").lower() or "cycle" in style.lower():
            tags.append("Macro-first")
        if "analyt" in style.lower() or sliders["narrative_sensitivity"] <= 45:
            tags.append("Analytical")
    if not tags:
        if sliders["contrarianism"] >= 65:
            tags.append("Contrarian")
        if sliders["narrative_sensitivity"] <= 40:
            tags.append("Analytical")
        else:
            tags.append("Narrative-aware")
        if sliders["forecast_speed"] <= 40:
            tags.append("Slow conviction")
        elif sliders["forecast_speed"] >= 65:
            tags.append("Fast conviction")
        if sliders["risk_appetite"] >= 60:
            tags.append("Risk-on")
    seen: set[str] = set()
    out: list[str] = []
    for t in tags:
        if t not in seen:
            seen.add(t)
            out.append(t)
    return out[:5]


def _beliefs_from_sources(
    sources: list[ForecasterKnowledgeSource],
) -> list[dict[str, Any]]:
    beliefs: list[dict[str, Any]] = []
    for src in sources:
        if src.status != "ready":
            continue
        claims = src.key_claims_json or []
        display_name = src.filename.rsplit(".", 1)[0] if src.filename else "Research"
        for claim in claims[:4]:
            text = _normalize_belief(str(claim))
            if len(text) < 20:
                continue
            beliefs.append(
                {
                    "belief": text,
                    "confidence": _belief_confidence(text, 1),
                    "origin_source": display_name,
                    "origin_source_id": src.id,
                }
            )
    return beliefs[:12]


def _beliefs_from_bible(slug: str) -> list[dict[str, Any]]:
    bible = character_bible_for(slug)
    if not bible:
        return []
    pool: list[str] = []
    for belief in bible.get("core_beliefs") or []:
        if isinstance(belief, str) and belief.strip():
            pool.append(belief.strip())
    for key in ("core_belief", "worldview"):
        val = bible.get(key)
        if val and isinstance(val, str) and val not in pool:
            pool.append(val)
    pool.extend(bible.get("favorite_narratives") or [])
    beliefs = []
    for i, text in enumerate(pool[:6]):
        normalized = _normalize_belief(text)
        if len(normalized) < 12:
            continue
        beliefs.append(
            {
                "belief": normalized,
                "confidence": 78 + (i * 3) % 15,
                "origin_source": "Character research",
                "origin_source_id": None,
            }
        )
    return beliefs


def _beliefs_from_personality(
    agent: Agent, cf: CreatorForecaster | None
) -> list[dict[str, Any]]:
    domain = (cf.domain_focus if cf and cf.domain_focus else agent.niche) or "Markets"
    archetype = cf.archetype if cf else ""
    blind = (cf.blind_spot if cf else "") or agent.conviction_style
    beliefs = [
        {
            "belief": f"{domain} regime shifts matter more than single headline prints.",
            "confidence": 72,
            "origin_source": "Worldview",
            "origin_source_id": None,
        },
    ]
    if archetype == "the_contrarian":
        beliefs.append(
            {
                "belief": "Consensus positioning is usually late, not wrong — but priced last.",
                "confidence": 80,
                "origin_source": "Worldview",
                "origin_source_id": None,
            }
        )
    if blind:
        beliefs.append(
            {
                "belief": f"Explicit blind spot tracked: {blind[:120]}.",
                "confidence": 68,
                "origin_source": "Risk framework",
                "origin_source_id": None,
            }
        )
    return beliefs


def _compute_influence(sources: list[ForecasterKnowledgeSource]) -> list[dict[str, Any]]:
    ready = [s for s in sources if s.status == "ready"]
    if not ready:
        return []
    weights: list[tuple[str, int]] = []
    for src in ready:
        claims = len(src.key_claims_json or [])
        summary_len = len(src.summary or "")
        w = max(1, claims * 3 + summary_len // 80)
        display = src.filename.rsplit(".", 1)[0] if src.filename else "Source"
        weights.append((display, w))
    total = sum(w for _, w in weights) or 1
    rows = [
        {"source": name, "pct": round(100 * w / total)}
        for name, w in weights
    ]
    rows.sort(key=lambda r: r["pct"], reverse=True)
    if len(rows) > 4:
        top = rows[:3]
        other_pct = 100 - sum(r["pct"] for r in top)
        top.append({"source": "Other", "pct": max(0, other_pct)})
        return top
    return rows


def _forecast_dna(sliders: dict[str, int], slug: str, domain: str) -> list[dict[str, Any]]:
    seed = _slug_seed(slug, "dna")
    metrics = [
        (
            "contrarian",
            sliders["contrarianism"],
            "More contrarian than {p}% of agents",
        ),
        (
            "horizon",
            100 - sliders["forecast_speed"],
            "Longer forecast horizon than {p}% of agents",
        ),
        (
            "macro",
            sliders["narrative_sensitivity"],
            "Higher macro weighting than {p}% of agents",
        ),
        (
            "reactive",
            100 - sliders["consensus_following"],
            "Less reactive than {p}% of agents",
        ),
    ]
    out = []
    for _key, value, template in metrics:
        jitter = (seed % 17) - 8
        pct = max(52, min(96, value + jitter + (seed % 11)))
        seed >>= 3
        out.append({"label": template.format(p=pct), "percentile": pct})
    if domain and domain.lower() in ("macro", "crypto", "ai"):
        out[2]["label"] = f"Higher {domain.lower()} weighting than {out[2]['percentile']}% of agents"
    return out


def _training_summary(
    agent: Agent,
    sources: list[ForecasterKnowledgeSource],
    cf: CreatorForecaster | None,
) -> str:
    ready = [s for s in sources if s.status == "ready"]
    if ready:
        themes: list[str] = []
        for s in ready[:3]:
            name = s.filename.rsplit(".", 1)[0]
            themes.append(name)
        domain = (cf.domain_focus if cf else agent.niche) or "markets"
        joined = ", ".join(themes[:3])
        extra = f", and {len(ready) - 3} more" if len(ready) > 3 else ""
        return (
            f"{agent.name} is trained on {joined}{extra} — "
            f"shaped for {domain.lower()} conviction."
        )
    if agent.slug in CORE_AGENT_SLUGS:
        bible = character_bible_for(agent.slug)
        worldview = bible.get("worldview") or agent.personality
        return f"{agent.name} is built on {worldview[:200]}"
    domain = (cf.domain_focus if cf else agent.niche) or "forecasting"
    return (
        f"{agent.name} reasons from {domain.lower()} frameworks, "
        f"personality calibration, and network priors."
    )


def _activity_feed(
    sources: list[ForecasterKnowledgeSource],
    beliefs: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    events: list[tuple[datetime, dict[str, Any]]] = []
    for src in sources:
        ts = src.created_at or datetime.utcnow()
        name = src.filename.rsplit(".", 1)[0] if src.filename else src.filename
        if src.status == "ready":
            events.append(
                (
                    ts,
                    {
                        "when": _relative_label(ts),
                        "kind": "source_added",
                        "title": "Added source",
                        "detail": name,
                    },
                )
            )
        elif src.status == "failed":
            events.append(
                (
                    ts,
                    {
                        "when": _relative_label(ts),
                        "kind": "source_failed",
                        "title": "Source processing failed",
                        "detail": name,
                    },
                )
            )
    for belief in beliefs[:2]:
        events.append(
            (
                datetime.utcnow(),
                {
                    "when": "Recently",
                    "kind": "belief_active",
                    "title": "Active belief",
                    "detail": belief["belief"][:80],
                },
            )
        )
    events.sort(key=lambda x: x[0], reverse=True)
    return [e[1] for e in events[:8]]


def _last_updated(sources: list[ForecasterKnowledgeSource]) -> str | None:
    if not sources:
        return None
    latest = max((s.updated_at or s.created_at for s in sources), default=None)
    return _relative_label(latest) if latest else None


def build_agent_knowledge_profile(db: Session, agent: Agent) -> dict[str, Any]:
    """Full knowledge profile for studio and public surfaces."""
    cf = _resolve_creator_forecaster(db, agent)
    sources: list[ForecasterKnowledgeSource] = []
    if cf:
        sources = (
            db.query(ForecasterKnowledgeSource)
            .filter(ForecasterKnowledgeSource.forecaster_id == cf.id)
            .order_by(ForecasterKnowledgeSource.created_at.asc())
            .all()
        )

    active_sources = [s for s in sources if s.status in ("ready", "processing", "uploaded")]
    serialized_sources = []
    for src in sources:
        pub = serialize_source_public(src)
        serialized_sources.append(
            {
                **pub,
                "display_name": src.filename.rsplit(".", 1)[0],
                "type_label": _source_type_label(src.filename, src.source_type),
                "status_label": _display_status(src.status),
                "uploaded_ago": _relative_label(src.created_at),
                "is_active": src.status == "ready",
            }
        )

    beliefs = _beliefs_from_sources(sources)
    if len(beliefs) < 3 and agent.slug in CORE_AGENT_SLUGS:
        beliefs = _beliefs_from_bible(agent.slug) + beliefs
    if len(beliefs) < 2:
        beliefs = beliefs + _beliefs_from_personality(agent, cf)
    seen_belief: set[str] = set()
    unique_beliefs: list[dict[str, Any]] = []
    for b in beliefs:
        key = b["belief"].lower()[:50]
        if key not in seen_belief:
            seen_belief.add(key)
            unique_beliefs.append(b)
    beliefs = unique_beliefs[:8]

    sliders = _worldview_sliders(cf, agent.slug)
    tags = _worldview_tags(cf, agent.slug, sliders)
    influence = _compute_influence(sources)
    if not influence and agent.slug in CORE_AGENT_SLUGS:
        influence = [
            {"source": "Character research", "pct": 55},
            {"source": "Network priors", "pct": 30},
            {"source": "Live markets", "pct": 15},
        ]

    domain = (cf.domain_focus if cf and cf.domain_focus else agent.niche) or "Markets"
    active_count = sum(1 for s in sources if s.status == "ready")

    return {
        "agent_slug": agent.slug,
        "agent_name": agent.name,
        "training_summary": _training_summary(agent, sources, cf),
        "sources": serialized_sources,
        "active_source_count": active_count,
        "beliefs": beliefs,
        "worldview": {
            "tags": tags,
            "sliders": sliders,
            "editable": False,
        },
        "influence": influence,
        "forecast_dna": _forecast_dna(sliders, agent.slug, domain),
        "updates": _activity_feed(sources, beliefs),
        "last_updated": _last_updated(sources) or "Recently",
        "creator_forecaster_id": cf.id if cf else None,
    }


def build_public_knowledge_snapshot(profile: dict[str, Any]) -> dict[str, Any]:
    """Compact card for agent profiles."""
    beliefs = profile.get("beliefs") or []
    core = [b["belief"] for b in beliefs[:3]]
    return {
        "training_summary": profile.get("training_summary", ""),
        "core_beliefs": core,
        "active_source_count": profile.get("active_source_count", 0),
        "last_updated": profile.get("last_updated", "Recently"),
        "agent_slug": profile.get("agent_slug"),
    }


def compare_agent_beliefs(
    db: Session, slug_a: str, slug_b: str
) -> dict[str, Any]:
    """Belief overlap between two agents."""
    agent_a = db.query(Agent).filter(Agent.slug == slug_a).first()
    agent_b = db.query(Agent).filter(Agent.slug == slug_b).first()
    if not agent_a or not agent_b:
        return {
            "belief_overlap_pct": 0,
            "major_agreement": None,
            "major_disagreement": None,
            "beliefs_a": [],
            "beliefs_b": [],
        }

    prof_a = build_agent_knowledge_profile(db, agent_a)
    prof_b = build_agent_knowledge_profile(db, agent_b)
    beliefs_a = [b["belief"] for b in prof_a.get("beliefs") or []]
    beliefs_b = [b["belief"] for b in prof_b.get("beliefs") or []]

    if not beliefs_a or not beliefs_b:
        seed = (_slug_seed(slug_a, "cmp") + _slug_seed(slug_b, "cmp")) % 40
        return {
            "belief_overlap_pct": 28 + seed,
            "major_agreement": "Macro regime framing",
            "major_disagreement": "Risk appetite and timing",
            "beliefs_a": beliefs_a[:4],
            "beliefs_b": beliefs_b[:4],
        }

    overlaps: list[float] = []
    for ba in beliefs_a:
        for bb in beliefs_b:
            overlaps.append(_text_overlap(ba, bb))
    avg_overlap = sum(overlaps) / len(overlaps) if overlaps else 0.0
    pct = round(min(92, max(18, avg_overlap * 100 + 15)))

    best_pair = (0.0, "", "")
    for ba in beliefs_a:
        for bb in beliefs_b:
            score = _text_overlap(ba, bb)
            if score > best_pair[0]:
                best_pair = (score, ba, bb)

    def _topic_hint(text: str) -> str:
        lower = text.lower()
        if "fed" in lower or "easing" in lower or "cut" in lower:
            return "Fed path"
        if "infrastructure" in lower or "ai " in lower:
            return "AI infrastructure valuation"
        if "btc" in lower or "liquidity" in lower or "crypto" in lower:
            return "Liquidity cycles"
        if "energy" in lower:
            return "Energy supercycle"
        return text.split(".")[0][:48]

    major_agreement = _topic_hint(best_pair[1]) if best_pair[0] > 0.25 else "Macro regime framing"
    low_pairs = [( _text_overlap(ba, bb), ba, bb) for ba in beliefs_a for bb in beliefs_b]
    low_pairs.sort(key=lambda x: x[0])
    disagree_hint = "Risk appetite and timing"
    if low_pairs:
        _, da, db_b = low_pairs[0]
        if _text_overlap(da, db_b) < 0.12:
            disagree_hint = _topic_hint(da) if da != db_b else disagree_hint

    return {
        "belief_overlap_pct": pct,
        "major_agreement": major_agreement,
        "major_disagreement": disagree_hint,
        "beliefs_a": beliefs_a[:4],
        "beliefs_b": beliefs_b[:4],
    }
