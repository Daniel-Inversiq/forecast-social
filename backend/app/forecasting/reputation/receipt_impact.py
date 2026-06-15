"""Attach live reputation-engine impact to verified-call / receipt payloads."""

from __future__ import annotations

import re
from typing import Any

from sqlalchemy.orm import Session, joinedload

from app.forecasting.models import Agent, AgentReputation, FeedEvent, Market, MarketTake, ReputationEvent
from app.forecasting.reputation.config import REPUTATION_TIERS
from app.forecasting.reputation.scoring import ScoreInput, score_event
from app.forecasting.reputation.service import _final_outcome, ensure_reputation_initialized
from app.forecasting.reputation.timing import consensus_state, estimate_days_early

_RECEIPT_ID = re.compile(r"^receipt-(event|take|fallback)-(\d+)$")


def parse_receipt_source(receipt_id: str) -> tuple[str, int] | None:
    m = _RECEIPT_ID.match(receipt_id)
    if not m:
        return None
    kind, raw_id = m.group(1), int(m.group(2))
    if kind in ("event", "fallback"):
        return "feed_event", raw_id
    if kind == "take":
        return "market_take", raw_id
    return None


def _tier_impact_note(
    *,
    delta: float,
    score: float,
    tier_key: str,
    tier_label: str,
    consensus_breaking: bool,
) -> str | None:
    if consensus_breaking and tier_key != "consensus_breaker":
        return "Consensus-break path — contrarian tier eligible"
    if delta <= 0:
        return None
    for tier in reversed(REPUTATION_TIERS):
        if tier.key == "consensus_breaker":
            continue
        if score < tier.min_score:
            gap = round(tier.min_score - score, 1)
            if gap <= max(8.0, delta * 2):
                return f"+{delta:.1f} toward {tier.label}"
            break
    if delta >= 12 and tier_key in ("proven", "elite", "legendary"):
        return f"Reinforced {tier_label} standing"
    return None


def _impact_from_event(
    event: ReputationEvent,
    *,
    agent_rep: AgentReputation | None,
) -> dict[str, Any]:
    breakdown = event.breakdown_json or {}
    components = event.components_json or {}
    timing_bd = breakdown.get("timing") or {}
    conv_bd = breakdown.get("conviction") or {}
    consensus_breaking = bool(breakdown.get("consensus_break"))
    timing_mult = timing_bd.get("multiplier") if isinstance(timing_bd, dict) else None
    conv_mult = conv_bd.get("multiplier") if isinstance(conv_bd, dict) else None

    tier_key = agent_rep.tier_key if agent_rep else "emerging"
    tier_label = agent_rep.tier_label if agent_rep else "Emerging"
    score = agent_rep.score if agent_rep else 50.0
    timing_quality = agent_rep.timing_quality if agent_rep else None
    calibration_score = agent_rep.calibration_score if agent_rep else None

    cal_component = components.get("calibration") if isinstance(components, dict) else None
    cal_impact = (
        round(float(cal_component), 2)
        if cal_component
        else (round(calibration_score * 0.04, 2) if calibration_score else None)
    )

    tier_note = _tier_impact_note(
        delta=event.delta,
        score=score,
        tier_key=tier_key,
        tier_label=tier_label,
        consensus_breaking=consensus_breaking,
    )

    return {
        "reputation_delta": round(event.delta, 2),
        "reputation_category": event.category,
        "reputation_reason": event.reason,
        "tier_key": tier_key,
        "tier_label": tier_label,
        "tier_impact": tier_note,
        "timing_multiplier": timing_mult,
        "timing_quality": timing_quality,
        "calibration_impact": cal_impact,
        "conviction_multiplier": conv_mult,
        "consensus_breaking": consensus_breaking,
        "reputation_live": True,
        "reputation_event_id": event.id,
    }


def _compute_impact(
    *,
    correct: bool,
    confidence: float,
    days_early: int,
    market_probability: float,
    agent_side: str,
    contested_sides: int,
    agent_rep: AgentReputation | None,
) -> dict[str, Any]:
    inp = ScoreInput(
        event_type="forecast_resolution",
        correct=correct,
        confidence=confidence,
        days_early=days_early,
        seed=days_early,
        market_probability=market_probability,
        agent_side=agent_side,
        contested_sides=contested_sides,
        narrative_lead=days_early >= 14,
    )
    result = score_event(inp)
    breakdown = result.breakdown
    timing_bd = breakdown.get("timing") or {}
    conv_bd = breakdown.get("conviction") or {}
    consensus_breaking = bool(breakdown.get("consensus_break"))
    timing_mult = timing_bd.get("multiplier") if isinstance(timing_bd, dict) else None
    conv_mult = conv_bd.get("multiplier") if isinstance(conv_bd, dict) else None

    tier_key = agent_rep.tier_key if agent_rep else "emerging"
    tier_label = agent_rep.tier_label if agent_rep else "Emerging"
    score = agent_rep.score if agent_rep else 50.0
    timing_quality = agent_rep.timing_quality if agent_rep else None
    calibration_score = agent_rep.calibration_score if agent_rep else None
    cal_impact = (
        round(result.components.calibration, 2)
        if result.components.calibration
        else (round(calibration_score * 0.03, 2) if calibration_score else None)
    )

    tier_note = _tier_impact_note(
        delta=result.delta,
        score=score,
        tier_key=tier_key,
        tier_label=tier_label,
        consensus_breaking=consensus_breaking,
    )

    return {
        "reputation_delta": result.delta,
        "reputation_category": result.category,
        "reputation_reason": None,
        "tier_key": tier_key,
        "tier_label": tier_label,
        "tier_impact": tier_note,
        "timing_multiplier": timing_mult,
        "timing_quality": timing_quality,
        "calibration_impact": cal_impact,
        "conviction_multiplier": conv_mult,
        "consensus_breaking": consensus_breaking,
        "reputation_live": False,
        "reputation_event_id": None,
    }


def enrich_receipts_with_reputation(
    db: Session,
    receipts: list[dict],
    *,
    contested_by_market: dict[int, int] | None = None,
    markets_by_title: dict[str, Market] | None = None,
) -> list[dict]:
    """Merge ledger-backed (or computed) reputation impact into receipt dicts."""
    if not receipts:
        return receipts

    ensure_reputation_initialized(db)
    contested_by_market = contested_by_market or {}

    agents = {a.slug: a for a in db.query(Agent).all()}
    reps = {
        r.agent_id: r
        for r in db.query(AgentReputation).all()
    }

    ledger_events = (
        db.query(ReputationEvent)
        .filter(ReputationEvent.category.in_(("verified_receipt", "consensus_break", "missed_call")))
        .all()
    )
    ledger_index: dict[tuple[str, int], ReputationEvent] = {}
    for ev in ledger_events:
        if ev.source_type and ev.source_id is not None:
            ledger_index[(ev.source_type, ev.source_id)] = ev

    feed_ids = []
    take_ids = []
    for r in receipts:
        parsed = parse_receipt_source(r["id"])
        if not parsed:
            continue
        st, sid = parsed
        if st == "feed_event":
            feed_ids.append(sid)
        elif st == "market_take":
            take_ids.append(sid)

    feed_events = {
        e.id: e
        for e in db.query(FeedEvent)
        .options(joinedload(FeedEvent.market))
        .filter(FeedEvent.id.in_(feed_ids))
        .all()
    } if feed_ids else {}

    takes = {
        t.id: t
        for t in db.query(MarketTake)
        .options(joinedload(MarketTake.market))
        .filter(MarketTake.id.in_(take_ids))
        .all()
    } if take_ids else {}

    enriched: list[dict] = []
    for receipt in receipts:
        payload = dict(receipt)
        parsed = parse_receipt_source(receipt["id"])
        agent = agents.get(receipt.get("agent_slug", ""))
        agent_rep = reps.get(agent.id) if agent else None

        if parsed:
            st, sid = parsed
            ledger_ev = ledger_index.get((st, sid))
            if ledger_ev:
                payload.update(_impact_from_event(ledger_ev, agent_rep=agent_rep))
                enriched.append(payload)
                continue

            if st == "feed_event" and sid in feed_events:
                ev = feed_events[sid]
                market = ev.market
                if market and ev.agent_id:
                    side = "YES" if (ev.probability or 0) >= 50 else "NO"
                    seed = f"rep-event-{ev.id}"
                    verified = _final_outcome(side, seed)
                    correct = verified.upper() == side.upper()
                    days = estimate_days_early(ev.id, ev.market_id)
                    contested_n = contested_by_market.get(ev.market_id or 0, 0)
                    payload.update(
                        _compute_impact(
                            correct=correct,
                            confidence=ev.confidence or 85.0,
                            days_early=days,
                            market_probability=market.current_yes_probability,
                            agent_side=side,
                            contested_sides=contested_n,
                            agent_rep=agent_rep,
                        )
                    )
                    enriched.append(payload)
                    continue

            if st == "market_take" and sid in takes:
                take = takes[sid]
                market = take.market
                if market:
                    seed = f"rep-take-{take.id}"
                    verified = _final_outcome(take.side, seed)
                    correct = verified.upper() == take.side.upper()
                    days = estimate_days_early(take.id, take.market_id)
                    contested_n = contested_by_market.get(take.market_id or 0, 0)
                    payload.update(
                        _compute_impact(
                            correct=correct,
                            confidence=take.confidence,
                            days_early=days,
                            market_probability=market.current_yes_probability,
                            agent_side=take.side,
                            contested_sides=contested_n,
                            agent_rep=agent_rep,
                        )
                    )
                    enriched.append(payload)
                    continue

        # Heuristic fallback from receipt fields
        correct = receipt.get("final_outcome") == receipt.get("side")
        market_prob = receipt.get("original_probability", 50.0)
        if receipt.get("side") == "NO":
            market_prob = 100.0 - market_prob
        _, broke = consensus_state(market_prob, receipt.get("side", "YES"), contested_sides=1)
        payload.update(
            _compute_impact(
                correct=correct,
                confidence=float(receipt.get("confidence", 70)),
                days_early=int(receipt.get("days_early", 5)),
                market_probability=market_prob,
                agent_side=receipt.get("side", "YES"),
                contested_sides=2 if receipt.get("receipt_strength") == "contested" else 1,
                agent_rep=agent_rep,
            )
        )
        if broke and payload.get("reputation_delta", 0) > 0:
            payload["consensus_breaking"] = True
            payload["reputation_category"] = "consensus_break"
        enriched.append(payload)

    return enriched


def biggest_reputation_gains(receipts: list[dict], *, limit: int = 5) -> list[dict]:
    """Top verified-call reputation deltas for sidebar modules."""
    verified = [
        r
        for r in receipts
        if r.get("final_outcome") == r.get("side") and (r.get("reputation_delta") or 0) > 0
    ]
    verified.sort(key=lambda r: r.get("reputation_delta", 0), reverse=True)
    return [
        {
            "id": r["id"],
            "agent_name": r["agent_name"],
            "agent_slug": r["agent_slug"],
            "avatar_color": r["avatar_color"],
            "market_title": r["market_title"],
            "market_slug": r["market_slug"],
            "reputation_delta": r.get("reputation_delta", 0),
            "consensus_breaking": r.get("consensus_breaking", False),
            "tier_label": r.get("tier_label"),
        }
        for r in verified[:limit]
    ]
