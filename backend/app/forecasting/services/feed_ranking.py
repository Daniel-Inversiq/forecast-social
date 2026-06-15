from typing import Any

from app.forecasting.models import Agent, AgentReputation, FeedEvent
from app.forecasting.services.context import IntelligenceContext
from app.forecasting.trust.distribution import trust_from_agent_rep
from app.forecasting.services.resolution_horizon import feed_resolution_boost
from app.forecasting.services.utils import (
    active_takes_count,
    hash_seed,
    hours_since,
    parse_spread,
)


TYPE_BASE: dict[str, float] = {
    "rivalry": 11.0,
    "battle_escalation": 11.0,
    "receipt": 17.0,
    "verified_call": 17.0,
    "failed_high_conviction_call": 14.0,
    "calibration_jump": 14.0,
    "leaderboard_move": 14.0,
    "reputation_move": 14.0,
    "consensus_shift": 12.0,
    "narrative_acceleration": 12.0,
    "confidence_shift": 10.0,
    "market_move": 10.0,
    "signal_shift": 10.0,
    "new_take": 9.0,
    "position_update": 8.0,
}

STALE_HOURS = 72.0


def _trust_weight_for_agent(
    agent: Agent | None,
    rep_row: AgentReputation | None,
) -> tuple[float, str | None]:
    """Feed distribution multiplier from SCRY trust tier (forecasting quality)."""
    if not agent:
        return 1.0, None
    verified = rep_row.verified_calls if rep_row else 0
    score = rep_row.score if rep_row else ctx_fallback_score(agent)
    calibration = rep_row.calibration_score if rep_row else 50.0
    evaluation = trust_from_agent_rep(
        verified_calls=verified,
        reputation_score=score,
        calibration_score=calibration,
        created_at=agent.created_at,
    )
    return evaluation.distribution_weight, evaluation.tier_key


def ctx_fallback_score(agent: Agent) -> float:
    from app.forecasting.services.utils import hash_seed

    h = hash_seed(agent.slug, "trust")
    return 38.0 + (h % 18)


def _interest_match(ctx: IntelligenceContext, event: FeedEvent) -> float:
    if not ctx.interest_keywords:
        return 0.0
    blob = " ".join(
        filter(
            None,
            [
                event.title.lower(),
                event.body.lower(),
                event.agent.niche.lower() if event.agent else "",
                event.market.category.lower() if event.market else "",
                event.market.title.lower() if event.market else "",
            ],
        )
    )
    hits = sum(1 for kw in ctx.interest_keywords if kw in blob)
    return min(12.0, hits * 3.5)


def _volatility_boost(event: FeedEvent) -> float:
    if event.market is None:
        return 0.0
    prob = event.market.current_yes_probability
    distance = abs(prob - 50.0)
    return min(6.0, distance / 8.0)


def score_feed_event(
    event: FeedEvent,
    ctx: IntelligenceContext,
    *,
    rep_by_agent: dict[int, AgentReputation] | None = None,
    continuity_ctx: Any | None = None,
) -> tuple[float, list[str]]:
    reasons: list[str] = []
    score = TYPE_BASE.get(event.type, 8.0)

    if event.agent_id in ctx.followed_agent_ids:
        score += 14.0
        reasons.append(f"Following {event.agent.name}")

    if ctx.anchor_agent_id and event.agent_id == ctx.anchor_agent_id:
        score += 10.0
        reasons.append(f"Your anchor agent — {event.agent.name}")

    interest = _interest_match(ctx, event)
    if interest > 0:
        score += interest
        reasons.append("Matches your interest cluster")

    if event.market_id and event.market_id in ctx.position_market_ids:
        score += 8.0
        reasons.append("Market you have positioned in")

    if event.market_id and event.market_id in ctx.viewed_market_ids:
        score += 4.0
        reasons.append("Market you've engaged with")

    if event.market_id and event.market_id in ctx.battle_market_ids:
        score += 6.0
        reasons.append("Active battle zone")

    spread = parse_spread(event.body) if event.type in ("rivalry", "battle_escalation") else None
    if spread is not None:
        battle_boost = min(10.0, spread / 5.0)
        score += battle_boost
        if spread >= 30:
            reasons.append(f"High disagreement ({spread}pt spread)")

    if event.confidence is not None and event.confidence >= 80:
        score += 5.0
        reasons.append("High conviction signal")

    if event.type in ("receipt", "verified_call"):
        score += 8.0
        reasons.append("Verified proof event")

    if event.agent_id:
        rep_score = ctx.agent_reputation_scores.get(event.agent_id, 0.0)
        rep_velocity = ctx.agent_reputation_velocity.get(event.agent_id, 0.0)
        rep_trend = ctx.agent_reputation_trend.get(event.agent_id, "stable")
        rep_row = rep_by_agent.get(event.agent_id) if rep_by_agent else None
        if rep_row:
            rep_score = rep_row.score
            rep_velocity = rep_row.velocity
            rep_trend = rep_row.trend
        if rep_score >= 72:
            score += 7.0
            reasons.append("Elite forecaster signal")
        elif rep_score >= 58:
            score += 4.0
            reasons.append("High-reputation agent")
        elif rep_velocity >= 4.0 and rep_trend == "rising":
            score += 8.0
            reasons.append("Rising reputation — breakout potential")
        elif rep_score < 55 and rep_velocity >= 3.0 and rep_trend == "rising":
            score += 7.0
            reasons.append("Rising small agent — early signal")

    if event.type in ("rivalry", "battle_escalation") and spread and spread >= 28:
        score += 5.0
        reasons.append("Contrarian-led disagreement")

    if event.market_id and event.type in (
        "consensus_shift",
        "confidence_shift",
        "rivalry",
        "battle_escalation",
        "market_move",
        "signal_shift",
        "narrative_acceleration",
    ):
        score += 3.0

    if event.type in ctx.engaged_event_types:
        pref = ctx.engaged_event_types[event.type]
        score += min(4.0, pref * 0.8)

    score += _volatility_boost(event)

    res_boost, res_reason = feed_resolution_boost(event.market)
    if res_boost > 0:
        score += res_boost
        if res_reason:
            reasons.append(res_reason)

    age_h = hours_since(event.created_at)
    recency = max(0.0, 24.0 - age_h) * 0.45
    score += recency

    if age_h > STALE_HOURS:
        score -= 8.0
        reasons.append("Stale market activity")

    if event.type in ("confidence_shift", "signal_shift") and event.confidence is not None and event.confidence < 55:
        score -= 4.0

    if not event.market_id and event.type in ("confidence_shift", "signal_shift", "market_move"):
        score -= 5.0
        reasons.append("Low market context")

    if event.body and len(event.body) < 40:
        score -= 3.0

    h = hash_seed(event.id, event.type)
    if (event.id % 5) == 0:
        score += 2.0
        reasons.append("Early signal potential")

    live = (event.id % 3) != 0 or age_h < 6.0
    if live:
        score += 3.0

    seen_types = ctx.engaged_event_types
    if seen_types.get(event.type, 0) > 8:
        score -= 3.0

    meta = event.metadata_json or {}
    if meta.get("arc_id"):
        score += 6.0
        reasons.append("Active narrative arc")

    if continuity_ctx and event.market_id:
        mn = continuity_ctx.market_narrative.get(event.market_id)
        if mn and mn.get("state") in ("panic repricing", "fragmenting", "contrarian breakout"):
            score += 4.0
            reasons.append(f"Market in {mn['state']} state")

    if not reasons:
        if event.type in ("rivalry", "battle_escalation"):
            reasons.append("Battle intensity in network")
        elif event.type in ("receipt", "verified_call"):
            reasons.append("Verified call surfacing")
        elif event.type in ("consensus_shift", "narrative_acceleration"):
            reasons.append("Narrative acceleration")
        else:
            reasons.append("Network intelligence signal")

    rep_row = rep_by_agent.get(event.agent_id) if rep_by_agent and event.agent_id else None
    trust_mult, trust_tier = _trust_weight_for_agent(event.agent, rep_row)
    if trust_mult != 1.0:
        score *= trust_mult
        if trust_tier == "elite":
            reasons.append("Elite trust — priority distribution")
        elif trust_tier == "ranked":
            reasons.append("Ranked trust — elevated distribution")
        elif trust_tier in ("observer", "emerging") and trust_mult < 0.85:
            reasons.append("Building trust — limited distribution")

    return round(score, 2), reasons[:3]


def rank_feed_events(
    events: list[FeedEvent],
    ctx: IntelligenceContext,
    *,
    rep_by_agent: dict[int, AgentReputation] | None = None,
    continuity_ctx: Any | None = None,
) -> list[tuple[FeedEvent, float, list[str]]]:
    scored = [
        (e, *score_feed_event(e, ctx, rep_by_agent=rep_by_agent, continuity_ctx=continuity_ctx))
        for e in events
    ]
    scored.sort(
        key=lambda x: (
            -(x[0].created_at.timestamp() if x[0].created_at else 0),
            -x[1],
        )
    )
    return scored
