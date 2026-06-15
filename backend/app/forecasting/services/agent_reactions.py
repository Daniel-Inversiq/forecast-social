from __future__ import annotations

import random
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any

from sqlalchemy.orm import Session

from app.forecasting.models import (
    Agent,
    AgentSeasonStat,
    AgentState,
    EventCandidate,
    FeedEvent,
    ForecastResolution,
    Market,
    NarrativeSeason,
    ReputationEvent,
)
from app.forecasting.seed_data.agents import ideology_profile_for
from app.forecasting.services.voice_engine import generate_reaction_line, is_core_character
from app.forecasting.services.memory_callbacks import memory_preview_for_candidate
from app.forecasting.services.utils import hash_seed


@dataclass
class ReactionDraft:
    agent_id: int
    role: str
    event_type: str
    title: str
    body: str
    confidence: float
    metadata_json: dict[str, Any]


def _pick_market(db: Session, candidate: EventCandidate, market_id: int | None) -> Market | None:
    if market_id:
        market = db.get(Market, market_id)
        if market:
            return market
    if candidate.attached_market_id:
        market = db.get(Market, candidate.attached_market_id)
        if market:
            return market
    for mid in candidate.suggested_markets or []:
        if isinstance(mid, int):
            market = db.get(Market, int(mid))
            if market:
                return market
    return None


def _scar_context(db: Session, agent: Agent) -> dict[str, Any]:
    rep_events = (
        db.query(ReputationEvent)
        .filter(ReputationEvent.agent_id == agent.id)
        .order_by(ReputationEvent.created_at.desc())
        .limit(8)
        .all()
    )
    resolutions = (
        db.query(ForecastResolution)
        .filter(ForecastResolution.agent_id == agent.id)
        .order_by(ForecastResolution.resolved_at.desc())
        .limit(8)
        .all()
    )
    failures = sum(1 for r in resolutions if not r.correct)
    wins = sum(1 for r in resolutions if r.correct)
    net_rep = round(sum(float(e.delta or 0.0) for e in rep_events), 2)
    if failures >= 4 and failures > wins:
        scar = "overcorrecting after a failed stretch"
    elif wins >= 4 and wins >= failures:
        scar = "doubling down after recent validation"
    elif net_rep < -2.0:
        scar = "defensive after a public hit"
    else:
        scar = "guarded but opportunistic"
    return {
        "scar": scar,
        "failure_count": failures,
        "win_count": wins,
        "net_rep_delta_recent": net_rep,
    }


def _latest_state(db: Session, agent: Agent) -> dict[str, Any]:
    row = db.query(AgentState).filter(AgentState.agent_id == agent.id).first()
    return dict(row.state_json) if row and row.state_json else {}


def _callback_line(db: Session, candidate: EventCandidate, agent: Agent, market: Market | None) -> tuple[str | None, dict[str, Any]]:
    season = db.query(NarrativeSeason).order_by(NarrativeSeason.created_at.desc()).first()
    if season:
        stat = (
            db.query(AgentSeasonStat)
            .filter(AgentSeasonStat.season_id == season.id, AgentSeasonStat.agent_id == agent.id)
            .first()
        )
    else:
        stat = None
    prior_feed = (
        db.query(FeedEvent)
        .filter(
            FeedEvent.agent_id == agent.id,
            FeedEvent.created_at >= datetime.utcnow() - timedelta(days=90),
        )
        .order_by(FeedEvent.created_at.desc())
        .limit(30)
        .all()
    )
    receipt = (
        db.query(ForecastResolution)
        .filter(ForecastResolution.agent_id == agent.id)
        .order_by(ForecastResolution.resolved_at.desc())
        .first()
    )
    if stat and stat.consensus_breaks >= 2:
        return (
            f"Same pattern that broke consensus in {season.title}.",
            {"season_id": season.id, "season_slug": season.slug, "consensus_breaks": stat.consensus_breaks},
        )
    if receipt and receipt.correct:
        days = max(1, (datetime.utcnow() - receipt.resolved_at).days)
        return (
            f"Receipt check: similar setup validated {days}d ago.",
            {"resolution_id": receipt.id, "receipt_correct": True},
        )
    if prior_feed:
        last = prior_feed[0]
        days = max(1, (datetime.utcnow() - last.created_at).days)
        return (
            f"This echoes a call from {days}d ago.",
            {"prior_feed_event_id": last.id, "days_since_prior": days},
        )
    return (None, {})


def _opposition_pair(agents: list[Agent], primary: Agent) -> Agent | None:
    if len(agents) < 2:
        return None
    p = ideology_profile_for(primary.slug)
    p_bias = str(p.get("default_bias", "")).lower()
    bearish = ("bear", "skeptic", "contrarian", "cynical", "tail")
    bullish = ("bull", "momentum", "dovish", "upset", "product")
    def opposed(other: Agent) -> float:
        o = ideology_profile_for(other.slug)
        o_bias = str(o.get("default_bias", "")).lower()
        score = 0.0
        if any(m in p_bias for m in bearish) and any(m in o_bias for m in bullish):
            score += 3.0
        if any(m in p_bias for m in bullish) and any(m in o_bias for m in bearish):
            score += 3.0
        if other.slug in list(p.get("recurring_enemies", [])):
            score += 2.0
        if other.niche != primary.niche:
            score += 0.5
        return score
    ranked = sorted([a for a in agents if a.id != primary.id], key=opposed, reverse=True)
    return ranked[0] if ranked else None


def _category_flavor(category: str) -> str:
    c = (category or "macro").lower()
    return {
        "geopolitics": "coalitions and second-order shocks",
        "macro": "liquidity and policy transmission",
        "crypto": "flow reflexivity and leverage",
        "ai": "compute, regulation, and adoption",
        "sports": "injury variance and matchup chaos",
        "climate": "policy cliffs and physical risk",
        "politics": "coalition math and turnout mechanics",
    }.get(c, "cross-asset narrative pressure")


def _line_for_agent(
    *,
    agent: Agent,
    candidate: EventCandidate,
    market: Market | None,
    role: str,
    opponent: Agent | None,
    callback: str | None,
    scar: str,
) -> str:
    market_title = market.title if market else candidate.title
    if is_core_character(agent.slug):
        line, _ = generate_reaction_line(
            agent.slug,
            role=role,
            headline=candidate.title,
            market_title=market_title,
            opponent_slug=opponent.slug if opponent else None,
            scar=scar,
            callback=callback,
            seed=hash_seed(agent.id, candidate.id, role),
        )
        return line[:5000]

    profile = ideology_profile_for(agent.slug)
    sig = random.choice(list(profile.get("signature_phrases") or ["timing over consensus"]))
    belief = str(profile.get("core_belief", "edge is timing"))
    hated = ", ".join(list(profile.get("hated_narratives") or [])[:1]) or "consensus comfort"
    flavor = _category_flavor(candidate.category)
    if role == "aligned":
        base = f"{agent.name} leans into {flavor}: \"{belief}.\""
    elif role == "opposed":
        base = f"{agent.name} rejects the framing as {hated}: \"{sig}.\""
    else:
        base = f"{agent.name} plays skeptic, citing evidence mismatch before repricing {market_title}."
    if opponent:
        base += f" Rivalry context: still at odds with {opponent.name}."
    if callback:
        base += f" {callback}"
    base += f" Scar context: {scar}."
    return base[:5000]


def build_reaction_suggestions(
    db: Session,
    candidate: EventCandidate,
    *,
    event_type: str = "signal_shift",
    market_id: int | None = None,
    seed: int | None = None,
) -> dict[str, Any]:
    rng = random.Random(seed if seed is not None else hash_seed(candidate.id, candidate.title, candidate.category))
    market = _pick_market(db, candidate, market_id)
    from app.forecasting.agent_status import query_active_agents

    agents = query_active_agents(db)
    pool = [a for a in agents if a.id in (candidate.suggested_agents or [])] or agents
    if not pool:
        raise ValueError("No agents available")
    primary = rng.choice(pool[: min(6, len(pool))])
    opposed = _opposition_pair(agents, primary)
    skeptic = None
    if len(agents) > 2 and rng.random() > 0.45:
        others = [a for a in agents if a.id not in {primary.id, opposed.id if opposed else -1}]
        skeptic = rng.choice(others) if others else None
    drafts: list[ReactionDraft] = []
    callback, callback_meta = _callback_line(db, candidate, primary, market)
    primary_scar = _scar_context(db, primary)
    primary_body = _line_for_agent(
        agent=primary,
        candidate=candidate,
        market=market,
        role="aligned",
        opponent=opposed,
        callback=callback,
        scar=primary_scar["scar"],
    )
    primary_memory_preview = memory_preview_for_candidate(
        db, agent_id=primary.id, market_id=market.id if market else None, title=candidate.title
    )
    drafts.append(
        ReactionDraft(
            agent_id=primary.id,
            role="aligned",
            event_type=event_type,
            title=candidate.title[:255],
            body=primary_body,
            confidence=74.0,
            metadata_json={
                "reaction_role": "primary",
                "ideology_label": ideology_profile_for(primary.slug).get("worldview"),
                "memory_callback": callback,
                "scar_context": primary_scar["scar"],
                "rivalry_context": opposed.slug if opposed else None,
                "memory_preview": primary_memory_preview,
                **callback_meta,
            },
        )
    )
    if opposed:
        opp_callback, opp_meta = _callback_line(db, candidate, opposed, market)
        opp_scar = _scar_context(db, opposed)
        opp_memory_preview = memory_preview_for_candidate(
            db, agent_id=opposed.id, market_id=market.id if market else None, title=candidate.title
        )
        drafts.append(
            ReactionDraft(
                agent_id=opposed.id,
                role="opposed",
                event_type="battle_escalation",
                title=f"Counterview: {candidate.title[:220]}",
                body=_line_for_agent(
                    agent=opposed,
                    candidate=candidate,
                    market=market,
                    role="opposed",
                    opponent=primary,
                    callback=opp_callback,
                    scar=opp_scar["scar"],
                ),
                confidence=68.0,
                metadata_json={
                    "reaction_role": "opposition",
                    "ideology_label": ideology_profile_for(opposed.slug).get("worldview"),
                    "memory_callback": opp_callback,
                    "scar_context": opp_scar["scar"],
                    "rivalry_context": primary.slug,
                    "memory_preview": opp_memory_preview,
                    **opp_meta,
                },
            )
        )
    if skeptic:
        sk_callback, sk_meta = _callback_line(db, candidate, skeptic, market)
        sk_scar = _scar_context(db, skeptic)
        sk_memory_preview = memory_preview_for_candidate(
            db, agent_id=skeptic.id, market_id=market.id if market else None, title=candidate.title
        )
        drafts.append(
            ReactionDraft(
                agent_id=skeptic.id,
                role="skeptic",
                event_type="stance_followup",
                title=f"Skeptic check: {candidate.title[:210]}",
                body=_line_for_agent(
                    agent=skeptic,
                    candidate=candidate,
                    market=market,
                    role="skeptic",
                    opponent=primary,
                    callback=sk_callback,
                    scar=sk_scar["scar"],
                ),
                confidence=63.0,
                metadata_json={
                    "reaction_role": "skeptic",
                    "ideology_label": ideology_profile_for(skeptic.slug).get("worldview"),
                    "memory_callback": sk_callback,
                    "scar_context": sk_scar["scar"],
                    "rivalry_context": primary.slug,
                    "memory_preview": sk_memory_preview,
                    **sk_meta,
                },
            )
        )
    rivalry_possible = bool(opposed and opposed.slug in ideology_profile_for(primary.slug).get("recurring_enemies", []))
    receipt_possible = bool(callback_meta.get("resolution_id"))
    possible_old_receipts: list[dict[str, Any]] = []
    possible_failed_calls: list[str] = []
    possible_rivalry_callbacks: list[dict[str, Any]] = []
    possible_season_echoes: list[dict[str, Any]] = []
    memory_scores: list[float] = []
    memory_tiers: list[str] = []
    memory_sources: list[tuple[str | None, int | None]] = []
    for draft in drafts:
        preview = draft.metadata_json.get("memory_preview")
        if not isinstance(preview, dict):
            continue
        memory_scores.append(float(preview.get("memory_value_score") or 0.0))
        memory_tiers.append(str(preview.get("memory_tier") or "none"))
        memory_sources.append((preview.get("memory_source_type"), preview.get("memory_source_id")))
        possible_old_receipts.extend(preview.get("possible_old_receipts") or [])
        possible_failed_calls.extend(preview.get("possible_failed_calls") or [])
        possible_rivalry_callbacks.extend(preview.get("possible_rivalry_callbacks") or [])
        possible_season_echoes.extend(preview.get("possible_season_echoes") or [])

    return {
        "candidate_id": candidate.id,
        "market_id": market.id if market else None,
        "event_type": event_type,
        "suggestions": [
            {
                "key": f"{d.agent_id}:{d.role}",
                "agent_id": d.agent_id,
                "role": d.role,
                "event_type": d.event_type,
                "title": d.title,
                "body": d.body,
                "confidence": d.confidence,
                "metadata_json": d.metadata_json,
            }
            for d in drafts
        ],
        "possible_rivalry": rivalry_possible,
        "possible_receipt_callback": receipt_possible,
        "possible_old_receipts": possible_old_receipts[:5],
        "possible_old_failed_calls": possible_failed_calls[:5],
        "possible_rivalry_callbacks": possible_rivalry_callbacks[:5],
        "possible_season_echoes": possible_season_echoes[:5],
        "memory_value_score": round(max(memory_scores) if memory_scores else 0.0, 1),
        "memory_tier": (
            "major"
            if "major" in memory_tiers
            else "strong" if "strong" in memory_tiers else "subtle" if "subtle" in memory_tiers else "none"
        ),
        "memory_source_type": next((src for src, _ in memory_sources if src), None),
        "memory_source_id": next((sid for _, sid in memory_sources if sid is not None), None),
    }

