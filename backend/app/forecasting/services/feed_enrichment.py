"""Reputation and market-credibility enrichment for personalized feed events."""

from __future__ import annotations

from sqlalchemy.orm import Session, joinedload

from app.forecasting.market_credibility import (
    _rep_by_slug,
    build_credibility_split,
    build_why_moving,
    enrich_agent_take,
)
from app.forecasting.models import Agent, AgentReputation, FeedEvent, Market
from app.forecasting.reputation.featured_marks import load_milestone_map_by_agent, resolve_featured_marks
from app.forecasting.reputation.service import ensure_reputation_initialized
from app.forecasting.services.utils import hash_seed
from app.forecasting.trust.distribution import trust_from_agent_rep


def load_reputation_by_agent(db: Session) -> dict[int, AgentReputation]:
    ensure_reputation_initialized(db)
    rows = (
        db.query(AgentReputation)
        .options(joinedload(AgentReputation.agent))
        .all()
    )
    return {r.agent_id: r for r in rows}


def _fallback_rep(agent: Agent) -> dict:
    h = hash_seed(agent.slug, "feed-rep")
    score = 48 + (h % 32)
    verified = 2 + (h % 6)
    calibration = 58 + (h % 24)
    trust = trust_from_agent_rep(
        verified_calls=verified,
        reputation_score=score,
        calibration_score=calibration,
        created_at=agent.created_at,
    )
    return {
        "reputation_tier_key": "trusted" if h % 4 == 0 else "emerging",
        "reputation_tier_label": "Trusted" if h % 4 == 0 else "Emerging",
        "reputation_score": score,
        "timing_quality": 62 + (h % 22),
        "calibration_score": calibration,
        "verified_calls_count": verified,
        "reputation_live": False,
        **trust.to_dict(),
    }


def agent_reputation_fields(
    agent: Agent,
    rep: AgentReputation | None,
    *,
    milestone_map: dict[int, dict[str, dict]] | None = None,
) -> dict:
    if not rep:
        return _fallback_rep(agent)
    delta = None
    if rep.trend == "rising":
        delta = round(rep.velocity * 1.2, 1) if rep.velocity else 3
    elif rep.trend == "cooling" and rep.velocity:
        delta = round(-rep.velocity * 0.8, 1)
    marks: list[dict] = []
    if milestone_map is not None:
        keys = agent.featured_milestone_keys if isinstance(agent.featured_milestone_keys, list) else []
        by_key = milestone_map.get(agent.id, {})
        ml = list(by_key.values())
        marks = resolve_featured_marks(keys, by_key, fallback_milestones=ml)
    trust = trust_from_agent_rep(
        verified_calls=rep.verified_calls,
        reputation_score=rep.score,
        calibration_score=rep.calibration_score,
        created_at=agent.created_at,
    )
    return {
        "reputation_tier_key": rep.tier_key,
        "reputation_tier_label": rep.tier_label,
        "reputation_score": round(rep.score, 1),
        "timing_quality": rep.timing_quality,
        "calibration_score": rep.calibration_score,
        "verified_calls_count": rep.verified_calls,
        "reputation_live": True,
        "reputation_delta": delta,
        "reputation_impact": _reputation_impact_label(rep, delta),
        "featured_reputation_marks": marks[:2],
        **trust.to_dict(),
    }


def _reputation_impact_label(rep: AgentReputation, delta: float | None) -> str:
    if delta and delta > 0:
        return f"+{abs(delta):.0f} rep velocity · {rep.tier_label}"
    if delta and delta < 0:
        return f"{delta:.0f} rep cooling · {rep.tier_label}"
    if rep.verified_calls >= 3:
        return f"{rep.verified_calls} verified calls · {rep.tier_label}"
    return f"{rep.tier_label} · {round(rep.calibration_score)}% calibration"


def _takes_for_market(db: Session, market: Market) -> list[dict]:
    from app.forecasting.routes_markets import _agent_takes

    return _agent_takes(db, market)


def market_credibility_for_event(
    db: Session,
    event: FeedEvent,
    *,
    rep_by_slug: dict[str, AgentReputation] | None = None,
) -> dict | None:
    market = event.market
    if not market:
        return None
    rep_by_slug = rep_by_slug or _rep_by_slug(db)
    raw_takes = _takes_for_market(db, market)
    enriched = [enrich_agent_take(t, rep_by_slug.get(t["slug"])) for t in raw_takes]
    break_count = 1 if event.type == "receipt" else 0
    credibility = build_credibility_split(
        enriched,
        market_prob=market.current_yes_probability,
        consensus_break_count=break_count,
    )
    activity = [
        {
            "agent_slug": event.agent.slug if event.agent else None,
            "agent_name": event.agent.name if event.agent else None,
            "type": event.type,
        }
    ]
    first_movers = []
    for t in sorted(enriched, key=lambda x: -x.get("reputation_score", 0))[:3]:
        first_movers.append(
            {
                "name": t["name"],
                "slug": t["slug"],
                "reputation_score": t.get("reputation_score", 50),
                "tier_label": t.get("tier_label", ""),
            }
        )
    why = build_why_moving(market, takes=enriched, credibility=credibility, first_movers=first_movers)
    yes_rep = credibility["yes"]["total_reputation"]
    no_rep = credibility["no"]["total_reputation"]
    total = yes_rep + no_rep or 1
    return {
        "credibility_split": credibility,
        "movement_type": credibility["movement_type"],
        "first_mover": first_movers[0] if first_movers else None,
        "why_it_matters": why["summary"],
        "credibility_label": _credibility_label(credibility["movement_type"]),
        "reputation_yes_share": round(100 * yes_rep / total),
    }


def _credibility_label(movement_type: str) -> str:
    return {
        "contrarian_led": "Contrarian credibility",
        "consensus_led": "Consensus credibility",
        "mixed": "Mixed credibility",
    }.get(movement_type, "Credibility-weighted")


def why_it_matters_for_event(
    event: FeedEvent,
    *,
    rep: AgentReputation | None,
    market_fields: dict | None,
    reasoning_summary: str | None,
) -> str:
    if market_fields and market_fields.get("why_it_matters"):
        return market_fields["why_it_matters"][:220]
    if reasoning_summary:
        return reasoning_summary[:220]
    agent_name = event.agent.name if event.agent else "Agent"
    if event.type == "receipt":
        vc = rep.verified_calls if rep else 0
        return (
            f"Verified proof from {agent_name} — {vc or 'multiple'} archived calls "
            "before consensus repriced; timing edge drives reputation."
        )
    if event.type == "rivalry":
        return f"High-reputation agents disagree on {event.market.title if event.market else 'this market'} — credibility split is widening."
    if event.type == "leaderboard_move" and rep:
        return f"{agent_name} reputation at {round(rep.score)} ({rep.tier_label}) — velocity {rep.trend} on calibration."
    return f"{agent_name} signal in {event.agent.niche if event.agent else 'network'} — watch reputation-weighted follow-through."


def build_intelligence_modules(
    payloads: list[dict],
    reputation_movements: list[dict],
) -> dict:
    """Homepage intelligence highlights from enriched feed."""

    def _market_payloads():
        return [p for p in payloads if p.get("market_slug") and p.get("credibility_split")]

    market_events = _market_payloads()
    receipts = [p for p in payloads if p.get("type") == "receipt"]
    contrarian = [p for p in market_events if p.get("movement_type") == "contrarian_led"]
    consensus = [p for p in market_events if p.get("movement_type") == "consensus_led"]

    highest_shift = None
    if market_events:
        highest_shift = max(
            market_events,
            key=lambda p: abs(p.get("movement_delta") or 0)
            + (p.get("credibility_split", {}).get("yes", {}).get("total_reputation", 0) * 0.01),
        )

    top_mover = reputation_movements[0] if reputation_movements else None
    if not top_mover:
        lb = [p for p in payloads if p.get("type") == "leaderboard_move"]
        top_mover = (
            {
                "agent": lb[0]["agent"],
                "reputation_delta": lb[0].get("reputation_delta") or 4,
                "label": lb[0].get("reputation_impact") or "Reputation jump",
            }
            if lb
            else None
        )

    strongest_contrarian = contrarian[0] if contrarian else None
    verified_proof = receipts[0] if receipts else None
    cred_move = consensus[0] if consensus else (market_events[0] if market_events else None)

    modules: dict = {}

    if highest_shift:
        modules["highest_credibility_shift"] = {
            "title": highest_shift.get("market_title") or highest_shift.get("title"),
            "summary": (highest_shift.get("why_it_matters") or "")[:140],
            "market_slug": highest_shift.get("market_slug"),
            "delta": highest_shift.get("movement_delta"),
            "credibility_label": highest_shift.get("credibility_label"),
            "movement_type": highest_shift.get("movement_type"),
            "href": f"/markets/{highest_shift['market_slug']}" if highest_shift.get("market_slug") else None,
        }

    if top_mover:
        agent = top_mover.get("agent", {})
        slug = agent.get("slug", "")
        modules["top_reputation_mover"] = {
            "title": agent.get("name", "Rising agent"),
            "summary": top_mover.get("label") or "Reputation velocity leading network",
            "reputation_delta": top_mover.get("reputation_delta"),
            "tier_label": agent.get("tier_label") or top_mover.get("tier_key"),
            "href": f"/agents/{slug}" if slug else None,
        }

    if strongest_contrarian:
        fm = strongest_contrarian.get("first_mover") or strongest_contrarian.get("agent", {})
        modules["strongest_contrarian"] = {
            "title": strongest_contrarian.get("market_title") or strongest_contrarian.get("title"),
            "summary": (strongest_contrarian.get("why_it_matters") or "")[:140],
            "agent_name": fm.get("name") if isinstance(fm, dict) else strongest_contrarian["agent"]["name"],
            "market_slug": strongest_contrarian.get("market_slug"),
            "href": f"/markets/{strongest_contrarian['market_slug']}" if strongest_contrarian.get("market_slug") else None,
        }

    if verified_proof:
        modules["verified_proof"] = {
            "title": verified_proof.get("title"),
            "summary": (verified_proof.get("why_it_matters") or "Verified call before consensus moved")[:140],
            "agent_name": verified_proof["agent"]["name"],
            "market_slug": verified_proof.get("market_slug"),
            "verified_calls_count": verified_proof.get("verified_calls_count"),
            "reputation_impact": verified_proof.get("reputation_impact"),
            "href": (
                f"/markets/{verified_proof['market_slug']}"
                if verified_proof.get("market_slug")
                else "/verified-calls"
            ),
        }

    if cred_move:
        split = cred_move.get("credibility_split") or {}
        yes_rep = split.get("yes", {}).get("total_reputation", 0)
        no_rep = split.get("no", {}).get("total_reputation", 0)
        total = yes_rep + no_rep or 1
        modules["credibility_market_move"] = {
            "title": cred_move.get("market_title") or cred_move.get("title"),
            "summary": (cred_move.get("why_it_matters") or "")[:140],
            "probability": cred_move.get("probability"),
            "movement_type": cred_move.get("movement_type"),
            "reputation_yes_share": cred_move.get("reputation_yes_share")
            or round(100 * yes_rep / total),
            "market_slug": cred_move.get("market_slug"),
            "href": f"/markets/{cred_move['market_slug']}" if cred_move.get("market_slug") else None,
        }

    return modules
