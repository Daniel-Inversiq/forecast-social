"""Scry simulated intelligence — generates feed events from existing DB state."""

from __future__ import annotations

import os
import random
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Callable

from sqlalchemy.orm import Session, joinedload

from app.forecasting.models import (
    Agent,
    AgentReputation,
    FeedEvent,
    Market,
    MarketTake,
    Position,
    ReputationEvent,
)
from app.forecasting.conviction_engine import ConvictionEngine, build_conviction_engine
from app.forecasting.seed_data.agents import AGENT_VOICE, opponent_slugs_for
from app.forecasting.services.agent_state import (
    AgentMemory,
    AgentStateStore,
    market_delta_for_side,
    pick_arc_continuation,
    resolve_agent_side,
)
from app.forecasting.services.event_pacing import (
    CadencePlan,
    PacingState,
    agent_can_post,
    arc_stage_label,
    build_pacing_state,
    bump_market_heat_after_major_move,
    decide_cadence,
    market_can_receive,
    pick_agent_weighted,
    pick_event_type,
    pick_market_weighted,
    plan_hour_timestamps,
    record_post,
    rivalry_pair_can_post,
)
from app.forecasting.services.utils import hash_seed
from app.forecasting.services.world_events import scheduled_arc_activity_multiplier

ENGINE_VERSION = "scry-3"
GENERATED_META = {"generated": True, "engine": ENGINE_VERSION}

EVENT_TYPES = (
    "market_move",
    "battle_escalation",
    "reputation_move",
    "verified_call",
    "signal_shift",
    "new_take",
    "position_update",
    "narrative_acceleration",
    "stance_followup",
    "rivalry",
    "quiet_pulse",
)

TYPE_COOLDOWN_MINUTES: dict[str, int] = {
    "market_move": 18,
    "battle_escalation": 22,
    "reputation_move": 35,
    "verified_call": 45,
    "signal_shift": 16,
    "new_take": 14,
    "position_update": 20,
    "narrative_acceleration": 24,
    "stance_followup": 12,
    "rivalry": 20,
    "quiet_pulse": 8,
}

FRESHNESS_OFFSETS_MINUTES = (0, 3, 12, 60)


@dataclass
class _EngineContext:
    agents: list[Agent]
    markets: list[Market]
    takes: list[MarketTake]
    positions: list[Position]
    rep_by_agent: dict[int, AgentReputation]
    agent_states: dict[int, AgentMemory]
    state_store: AgentStateStore
    recent_bodies: set[str]
    recent_keys: set[tuple[int | None, str]]
    last_event_at: dict[tuple[int | None, str], datetime]
    rng: random.Random
    conviction: ConvictionEngine
    agents_by_slug: dict[str, Agent] = field(default_factory=dict)
    markets_by_id: dict[int, Market] = field(default_factory=dict)
    pacing: PacingState | None = None
    cadence: CadencePlan | None = None
    major_budget: int = 1
    arc_bias: float = 0.35
    next_timestamp: datetime | None = None


def _is_dev_environment() -> bool:
    from app.settings import is_dev_environment

    return is_dev_environment()


def _utcnow() -> datetime:
    return datetime.utcnow()


def _freshness_timestamp(rng: random.Random) -> datetime:
    minutes = rng.choice(FRESHNESS_OFFSETS_MINUTES)
    if minutes == 0:
        return _utcnow()
    return _utcnow() - timedelta(minutes=minutes, seconds=rng.randint(5, 55))


def _event_timestamp(ctx: _EngineContext) -> datetime:
    if ctx.next_timestamp is not None:
        ts = ctx.next_timestamp
        ctx.next_timestamp = None
        return ts
    return _freshness_timestamp(ctx.rng)


def _load_recent_keys(
    db: Session, *, lookback_hours: int = 6
) -> tuple[set[tuple[int | None, str]], set[str], dict[tuple[int | None, str], datetime], list[FeedEvent]]:
    cutoff = _utcnow() - timedelta(hours=lookback_hours)
    recent = (
        db.query(FeedEvent)
        .options(joinedload(FeedEvent.agent))
        .filter(FeedEvent.created_at >= cutoff)
        .order_by(FeedEvent.created_at.desc())
        .limit(200)
        .all()
    )
    keys: set[tuple[int | None, str]] = set()
    bodies: set[str] = set()
    last_at: dict[tuple[int | None, str], datetime] = {}
    for event in recent:
        key = (event.market_id, event.type)
        keys.add(key)
        if event.created_at:
            last_at[key] = max(last_at.get(key, event.created_at), event.created_at)
        if event.body:
            bodies.add(event.body.strip().lower()[:160])
    return keys, bodies, last_at, recent


def _active_markets(ctx: _EngineContext) -> list[Market]:
    open_markets = [m for m in ctx.markets if m.status == "open"]
    if not open_markets:
        return [m for m in ctx.markets if m.status == "open"]

    if ctx.pacing and ctx.pacing.market_heat:
        ranked = sorted(
            open_markets,
            key=lambda m: ctx.pacing.market_heat.get(m.id).score if ctx.pacing.market_heat.get(m.id) else 0,
            reverse=True,
        )
        return ranked[:10]

    take_counts: dict[int, int] = {}
    for take in ctx.takes:
        take_counts[take.market_id] = take_counts.get(take.market_id, 0) + 1

    def activity_score(market: Market) -> float:
        takes_n = take_counts.get(market.id, 0)
        vol = abs(market.current_yes_probability - 50.0)
        fav_agents = sum(
            1
            for mem in ctx.agent_states.values()
            if market.id in mem.favorite_market_ids()
        )
        return takes_n * 3.0 + vol * 0.15 + fav_agents * 0.5 + ctx.rng.random()

    open_markets.sort(key=activity_score, reverse=True)
    return open_markets[:8] if len(open_markets) > 8 else open_markets


def _top_agents(ctx: _EngineContext, *, limit: int = 6) -> list[Agent]:
    scored: list[tuple[float, Agent]] = []
    for agent in ctx.agents:
        rep = ctx.rep_by_agent.get(agent.id)
        base = rep.score if rep else 42.0 + hash_seed(agent.slug) % 18
        velocity = rep.velocity if rep else 0.0
        mem = ctx.agent_states.get(agent.id)
        arc_bonus = len(mem.active_arcs) * 0.4 if mem else 0
        scored.append((base + velocity * 0.8 + arc_bonus, agent))
    scored.sort(key=lambda x: -x[0])
    return [a for _, a in scored[:limit]]


def _pick_agent(
    ctx: _EngineContext,
    market: Market | None = None,
    *,
    prefer_id: int | None = None,
) -> Agent:
    if ctx.pacing:
        return pick_agent_weighted(
            ctx.agents,
            ctx.pacing,
            ctx.rng,
            market=market,
            prefer_id=prefer_id,
        )
    if market is None:
        return ctx.rng.choice(_top_agents(ctx, limit=8))
    from app.forecasting.services.agent_state import pick_agent_for_market

    return pick_agent_for_market(
        ctx.agents,
        market,
        ctx.agent_states,
        ctx.rep_by_agent,
        ctx.rng,
    )


def _agent_memory(ctx: _EngineContext, agent: Agent) -> AgentMemory:
    mem = ctx.agent_states.get(agent.id)
    if mem is None:
        mem = AgentMemory(agent.id, agent.slug)
        ctx.agent_states[agent.id] = mem
    return mem


def _memory_context(ctx: _EngineContext, agent: Agent, market: Market | None) -> dict:
    mem = _agent_memory(ctx, agent)
    stance = mem.stance_for_market(market.id) if market else None
    recent = mem.data.get("recent_calls", [])
    prior = recent[0] if recent else None
    return {
        "prior_thesis": stance.get("thesis") if stance else None,
        "prior_call_summary": prior.get("summary") if prior else None,
        "flip_reason": stance.get("flip_reason") if stance else None,
        "recent_phrases": list(mem.recent_phrases),
        "confidence_tendency": mem.confidence_tendency,
        "arc_stage": None,
        "rival_heat": 0,
        "knowledge_context": mem.data.get("knowledge_context"),
    }


def _opponent_for_market(ctx: _EngineContext, market_id: int, exclude_id: int) -> Agent | None:
    market = ctx.markets_by_id.get(market_id)
    actor = next((a for a in ctx.agents if a.id == exclude_id), None)
    mem = ctx.agent_states.get(exclude_id) if actor else None

    if mem and mem.rivals:
        hot = sorted(mem.rivals.items(), key=lambda x: -x[1].get("heat", 0))
        for rival_slug, _ in hot[:4]:
            rival = ctx.agents_by_slug.get(rival_slug)
            if rival and rival.id != exclude_id:
                return rival

    sides: dict[int, str] = {}
    for take in ctx.takes:
        if take.market_id == market_id and take.agent_id:
            sides[take.agent_id] = take.side
    for agent_id, side in sides.items():
        if agent_id == exclude_id:
            continue
        for other_id, other_side in sides.items():
            if other_id != agent_id and other_id != exclude_id and other_side != side:
                agent = next((a for a in ctx.agents if a.id == other_id), None)
                if agent:
                    return agent

    others = [a for a in ctx.agents if a.id != exclude_id]
    if not others:
        return None

    if actor:
        preferred_slugs = opponent_slugs_for(actor.slug)
        preferred = [a for a in others if a.slug in preferred_slugs]
        if preferred:
            return ctx.rng.choice(preferred)

    actor_voice = AGENT_VOICE.get(actor.slug if actor else "", {})
    actor_bias = str(actor_voice.get("bias", ""))
    bearish_markers = ("bear", "contrarian", "fade", "skeptic", "nihilist", "cynical")
    bullish_markers = ("bull", "momentum", "optimistic", "dovish", "upset")
    if any(m in actor_bias for m in bearish_markers):
        opposed = [
            a
            for a in others
            if any(m in str(AGENT_VOICE.get(a.slug, {}).get("bias", "")) for m in bullish_markers)
        ]
        if opposed:
            return ctx.rng.choice(opposed)
    if any(m in actor_bias for m in bullish_markers):
        opposed = [
            a
            for a in others
            if any(m in str(AGENT_VOICE.get(a.slug, {}).get("bias", "")) for m in bearish_markers)
        ]
        if opposed:
            return ctx.rng.choice(opposed)

    cross_niche = [a for a in others if market and a.niche.lower() != market.category.lower()]
    pool = cross_niche or others
    return ctx.rng.choice(pool)


def _pick_market(ctx: _EngineContext) -> Market | None:
    if ctx.pacing:
        return pick_market_weighted(ctx.markets, ctx.pacing, ctx.rng)
    active = _active_markets(ctx)
    return ctx.rng.choice(active) if active else None


def _cooldown_ok(ctx: _EngineContext, market_id: int | None, event_type: str) -> bool:
    key = (market_id, event_type)
    last = ctx.last_event_at.get(key)
    if last is None:
        return True
    cooldown = timedelta(minutes=TYPE_COOLDOWN_MINUTES.get(event_type, 20))
    now = ctx.pacing.simulated_now if ctx.pacing else _utcnow()
    return now - last >= cooldown


def _pacing_allows_event(
    ctx: _EngineContext,
    *,
    agent: Agent,
    market: Market | None,
    event_type: str,
    opponent: Agent | None = None,
) -> bool:
    if ctx.pacing is None:
        return True

    if not agent_can_post(ctx.pacing, agent.id, rng=ctx.rng):
        return False
    if market and not market_can_receive(ctx.pacing, market.id):
        return False
    if opponent and event_type in ("battle_escalation", "rivalry"):
        mem = ctx.agent_states.get(agent.id)
        heat = mem.rival_heat(opponent.slug) if mem else 0
        if not rivalry_pair_can_post(ctx.pacing, agent.slug, opponent.slug, heat=heat):
            return False
    return True


def _body_unique(ctx: _EngineContext, body: str) -> bool:
    key = body.strip().lower()[:160]
    if key in ctx.recent_bodies:
        return False
    ctx.recent_bodies.add(key)
    return True


def _nudge_market_probability(market: Market, delta: float) -> float:
    new_prob = round(max(3.0, min(97.0, market.current_yes_probability + delta)), 1)
    market.current_yes_probability = new_prob
    return new_prob


def _apply_reputation_nudge(
    db: Session,
    agent: Agent,
    *,
    delta: float,
    reason: str,
    market_id: int | None,
    category: str,
) -> None:
    rep = db.query(AgentReputation).filter(AgentReputation.agent_id == agent.id).first()
    if not rep:
        return
    rep.score = round(max(22.0, min(98.0, rep.score + delta)), 2)
    rep.velocity = round(min(14.0, max(0.5, rep.velocity + abs(delta) * 0.25)), 2)
    if delta >= 1.5:
        rep.trend = "rising"
    elif delta <= -1.0:
        rep.trend = "cooling"
    rep.last_active_at = _utcnow()
    rep.updated_at = _utcnow()
    db.add(
        ReputationEvent(
            agent_id=agent.id,
            category=category,
            delta=round(delta, 2),
            reason=reason,
            source_type="system",
            source_id=None,
            market_id=market_id,
            components_json=None,
            breakdown_json={"generated": True, "engine": ENGINE_VERSION},
        )
    )


def _record_event_memory(
    ctx: _EngineContext,
    *,
    agent: Agent,
    market: Market | None,
    event_type: str,
    side: str | None,
    body: str,
    confidence: float | None,
    opponent: Agent | None,
    flip_reason: str | None = None,
    arc_id: str | None = None,
    skip_arc_start: bool = False,
) -> None:
    mem = _agent_memory(ctx, agent)
    if market:
        mem.bump_favorite(market.id)
        if side:
            mem.set_stance(
                market.id,
                side,
                confidence or mem.confidence_tendency * 100,
                reason=flip_reason,
                thesis=body.split(".")[0][:140] if body else None,
            )
            mem.record_thesis(market.id, side, body.split(".")[0][:140], confidence or 70.0)
    if opponent:
        mem.bump_rival(opponent.slug, market_id=market.id if market else None, event_type=event_type)
        opp_mem = ctx.agent_states.get(opponent.id)
        if opp_mem:
            opp_mem.bump_rival(agent.slug, market_id=market.id if market else None, event_type=event_type)
    mem.record_call(
        event_type=event_type,
        market_id=market.id if market else None,
        side=side,
        summary=body[:180],
        opponent_slug=opponent.slug if opponent else None,
    )
    for phrase in body.split()[:6]:
        if len(phrase) > 5:
            mem.add_phrase(phrase)
    if market and side and event_type in ("new_take", "battle_escalation", "rivalry") and not arc_id and not skip_arc_start:
        has_arc = any(int(a.get("market_id", -1)) == market.id for a in mem.active_arcs)
        if not has_arc:
            mem.start_arc(
                market_id=market.id,
                rival_slug=opponent.slug if opponent else None,
                thesis=body.split(".")[0][:140],
                side=side,
            )
    elif arc_id:
        mem.advance_arc(arc_id)


def _make_event(
    ctx: _EngineContext,
    *,
    event_type: str,
    agent: Agent,
    market: Market | None,
    title: str,
    body: str,
    probability: float | None,
    confidence: float | None,
    created_at: datetime,
    extra_meta: dict | None = None,
    side: str | None = None,
    opponent: Agent | None = None,
    flip_reason: str | None = None,
    arc_id: str | None = None,
    skip_arc_start: bool = False,
) -> FeedEvent | None:
    if not _pacing_allows_event(
        ctx,
        agent=agent,
        market=market,
        event_type=event_type,
        opponent=opponent,
    ):
        return None
    if not _cooldown_ok(ctx, market.id if market else None, event_type):
        return None
    if not _body_unique(ctx, body):
        return None

    from app.forecasting.services.copy_sanitize import finalize_persisted_copy
    from app.forecasting.services.voice_engine import is_core_character

    meta = {**GENERATED_META, **(extra_meta or {})}
    if is_core_character(agent.slug):
        title, body, san_meta = finalize_persisted_copy(
            agent.slug,
            title,
            body,
            seed=hash_seed(agent.slug, title, body),
        )
        if san_meta:
            meta.update(san_meta)
    meta["arc_stage"] = arc_stage_label(event_type)
    if flip_reason:
        meta["stance_flip_reason"] = flip_reason
    if arc_id:
        meta["arc_id"] = arc_id
        meta["arc_stage"] = arc_stage_label(event_type)
    if event_type == "quiet_pulse":
        meta["intensity"] = "quiet"
        meta["pacing"] = "pulse"

    published_at = _utcnow()
    event = FeedEvent(
        type=event_type,
        agent_id=agent.id,
        market_id=market.id if market else None,
        title=title[:255],
        body=body,
        probability=probability,
        confidence=confidence,
        metadata_json=meta,
        created_at=created_at,
        feed_published_at=published_at,
    )
    key = (market.id if market else None, event_type)
    ctx.recent_keys.add(key)
    ctx.last_event_at[key] = created_at
    if ctx.pacing:
        opponent_slugs: tuple[str, ...] = ()
        if opponent:
            opponent_slugs = (agent.slug, opponent.slug)
        record_post(
            ctx.pacing,
            agent_id=agent.id,
            market_id=market.id if market else None,
            created_at=created_at,
            opponent_slugs=opponent_slugs,
        )
        delta = float((extra_meta or {}).get("delta", 0) or 0)
        if market and event_type in ("market_move", "signal_shift") and delta:
            bump_market_heat_after_major_move(ctx.pacing, market.id, delta)
    _record_event_memory(
        ctx,
        agent=agent,
        market=market,
        event_type=event_type,
        side=side,
        body=body,
        confidence=confidence,
        opponent=opponent,
        flip_reason=flip_reason,
        arc_id=arc_id,
        skip_arc_start=skip_arc_start,
    )
    return event


def _resolve_side_for_event(ctx: _EngineContext, agent: Agent, market: Market) -> tuple[str, float, str | None]:
    mem = _agent_memory(ctx, agent)
    market_takes = [t for t in ctx.takes if t.market_id == market.id and t.agent_id == agent.id]
    take = market_takes[0] if market_takes else None
    return resolve_agent_side(agent, market, mem, rng=ctx.rng, take=take)


def _gen_market_move(ctx: _EngineContext, market: Market) -> FeedEvent | None:
    agent = _pick_agent(ctx, market)
    opponent = _opponent_for_market(ctx, market.id, agent.id)
    side, conf, flip_reason = _resolve_side_for_event(ctx, agent, market)
    delta = market_delta_for_side(side, ctx.rng)
    new_prob = _nudge_market_probability(market, delta)
    mem_ctx = _memory_context(ctx, agent, market)
    copy = ctx.conviction.generate(
        "market_move",
        agent,
        market,
        opponent=opponent,
        delta=delta,
        new_prob=new_prob,
        side=side,
        **mem_ctx,
    )
    return _make_event(
        ctx,
        event_type="market_move",
        agent=agent,
        market=market,
        title=copy.title,
        body=copy.body,
        probability=new_prob,
        confidence=copy.confidence or conf,
        created_at=_event_timestamp(ctx),
        side=side,
        opponent=opponent,
        flip_reason=flip_reason,
        extra_meta={
            "delta": round(delta, 2),
            "reasoning_summary": copy.reasoning_summary,
            "opponent_slug": opponent.slug if opponent else None,
            "side": side,
        },
    )


def _gen_signal_shift(ctx: _EngineContext, market: Market, *, arc: dict | None = None) -> FeedEvent | None:
    prefer_id = int(arc["agent_id"]) if arc and arc.get("agent_id") else None
    agent = _pick_agent(ctx, market, prefer_id=prefer_id)
    opponent_slug = arc.get("rival_slug") if arc else None
    opponent = (
        ctx.agents_by_slug.get(str(opponent_slug))
        if opponent_slug
        else _opponent_for_market(ctx, market.id, agent.id)
    )
    side, conf, flip_reason = _resolve_side_for_event(ctx, agent, market)
    delta = market_delta_for_side(side, ctx.rng) * ctx.rng.uniform(0.9, 1.4)
    new_prob = _nudge_market_probability(market, delta)
    mem_ctx = _memory_context(ctx, agent, market)
    if arc:
        mem_ctx["arc_stage"] = int(arc.get("stage", 0))
        mem_ctx["prior_thesis"] = arc.get("thesis") or mem_ctx.get("prior_thesis")
    copy = ctx.conviction.generate(
        "signal_shift",
        agent,
        market,
        opponent=opponent,
        delta=delta,
        new_prob=new_prob,
        side=side,
        **mem_ctx,
    )
    return _make_event(
        ctx,
        event_type="signal_shift",
        agent=agent,
        market=market,
        title=copy.title,
        body=copy.body,
        probability=new_prob,
        confidence=copy.confidence or conf,
        created_at=_event_timestamp(ctx),
        side=side,
        opponent=opponent,
        flip_reason=flip_reason,
        arc_id=str(arc.get("arc_id")) if arc and arc.get("arc_id") else None,
        skip_arc_start=bool(arc),
        extra_meta={"opponent_slug": opponent.slug if opponent else None, "side": side, "delta": round(delta, 2)},
    )


def _gen_battle_escalation(ctx: _EngineContext, market: Market, *, arc: dict | None = None) -> FeedEvent | None:
    prefer_id = int(arc["agent_id"]) if arc and arc.get("agent_id") else None
    agent = _pick_agent(ctx, market, prefer_id=prefer_id)
    opponent_slug = arc.get("rival_slug") if arc else None
    opponent = (
        ctx.agents_by_slug.get(str(opponent_slug))
        if opponent_slug
        else _opponent_for_market(ctx, market.id, agent.id)
    )
    side, conf, flip_reason = _resolve_side_for_event(ctx, agent, market)
    mem = _agent_memory(ctx, agent)
    base_spread = 22 + hash_seed(market.id, agent.slug) % 28
    spread = base_spread + mem.rival_heat(opponent.slug if opponent else "") * 3
    mem_ctx = _memory_context(ctx, agent, market)
    if opponent:
        mem_ctx["rival_heat"] = mem.rival_heat(opponent.slug)
    if arc:
        mem_ctx["arc_stage"] = int(arc.get("stage", 0))
        mem_ctx["prior_thesis"] = arc.get("thesis") or mem_ctx.get("prior_thesis")
    copy = ctx.conviction.generate(
        "battle_escalation",
        agent,
        market,
        opponent=opponent,
        spread=spread,
        side=side,
        **mem_ctx,
    )
    return _make_event(
        ctx,
        event_type="battle_escalation",
        agent=agent,
        market=market,
        title=copy.title,
        body=copy.body,
        probability=market.current_yes_probability,
        confidence=copy.confidence or conf,
        created_at=_event_timestamp(ctx),
        side=side,
        opponent=opponent,
        flip_reason=flip_reason,
        arc_id=str(arc.get("arc_id")) if arc and arc.get("arc_id") else None,
        skip_arc_start=bool(arc),
        extra_meta={
            "spread": copy.spread or spread,
            "opponent_slug": opponent.slug if opponent else None,
            "side": side,
            "rival_heat": mem_ctx.get("rival_heat", 0),
        },
    )


def _gen_rivalry(ctx: _EngineContext, market: Market, *, arc: dict | None = None) -> FeedEvent | None:
    prefer_id = int(arc["agent_id"]) if arc and arc.get("agent_id") else None
    agent = _pick_agent(ctx, market, prefer_id=prefer_id)
    opponent_slug = arc.get("rival_slug") if arc else None
    opponent = (
        ctx.agents_by_slug.get(str(opponent_slug))
        if opponent_slug
        else _opponent_for_market(ctx, market.id, agent.id)
    )
    if not opponent:
        return None
    side, conf, flip_reason = _resolve_side_for_event(ctx, agent, market)
    mem = _agent_memory(ctx, agent)
    heat = mem.rival_heat(opponent.slug) + 1
    spread = 18 + heat * 4 + hash_seed(agent.slug, opponent.slug) % 15
    mem_ctx = _memory_context(ctx, agent, market)
    mem_ctx["rival_heat"] = heat
    if arc:
        mem_ctx["arc_stage"] = int(arc.get("stage", 0))
        mem_ctx["prior_thesis"] = arc.get("thesis") or mem_ctx.get("prior_thesis")
    copy = ctx.conviction.generate(
        "rivalry",
        agent,
        market,
        opponent=opponent,
        spread=spread,
        side=side,
        **mem_ctx,
    )
    return _make_event(
        ctx,
        event_type="rivalry",
        agent=agent,
        market=market,
        title=copy.title,
        body=copy.body,
        probability=market.current_yes_probability,
        confidence=copy.confidence or conf,
        created_at=_event_timestamp(ctx),
        side=side,
        opponent=opponent,
        flip_reason=flip_reason,
        arc_id=str(arc.get("arc_id")) if arc and arc.get("arc_id") else None,
        skip_arc_start=bool(arc),
        extra_meta={
            "spread": spread,
            "opponent_slug": opponent.slug,
            "side": side,
            "rival_heat": heat,
        },
    )


def _gen_narrative_acceleration(ctx: _EngineContext, market: Market) -> FeedEvent | None:
    agent = _pick_agent(ctx, market)
    opponent = _opponent_for_market(ctx, market.id, agent.id)
    side, conf, _ = _resolve_side_for_event(ctx, agent, market)
    mem_ctx = _memory_context(ctx, agent, market)
    copy = ctx.conviction.generate(
        "narrative_acceleration",
        agent,
        market,
        opponent=opponent,
        side=side,
        **mem_ctx,
    )
    return _make_event(
        ctx,
        event_type="narrative_acceleration",
        agent=agent,
        market=market,
        title=copy.title,
        body=copy.body,
        probability=market.current_yes_probability,
        confidence=copy.confidence or conf,
        created_at=_event_timestamp(ctx),
        side=side,
        opponent=opponent,
        extra_meta={"opponent_slug": opponent.slug if opponent else None, "side": side},
    )


def _gen_new_take(ctx: _EngineContext, market: Market, *, arc: dict | None = None) -> FeedEvent | None:
    prefer_id = int(arc["agent_id"]) if arc and arc.get("agent_id") else None
    agent = _pick_agent(ctx, market, prefer_id=prefer_id)
    opponent_slug = arc.get("rival_slug") if arc else None
    opponent = (
        ctx.agents_by_slug.get(str(opponent_slug))
        if opponent_slug
        else _opponent_for_market(ctx, market.id, agent.id)
    )
    market_takes = [t for t in ctx.takes if t.market_id == market.id and t.agent_id == agent.id]
    take = market_takes[0] if market_takes else None
    side, conf, flip_reason = _resolve_side_for_event(ctx, agent, market)
    snippet = (take.body[:120] + "…") if take and take.body else None
    mem_ctx = _memory_context(ctx, agent, market)
    if arc:
        mem_ctx["arc_stage"] = int(arc.get("stage", 0))
        mem_ctx["prior_thesis"] = arc.get("thesis") or mem_ctx.get("prior_thesis")
    copy = ctx.conviction.generate(
        "new_take",
        agent,
        market,
        opponent=opponent,
        side=side,
        take_snippet=snippet,
        **mem_ctx,
    )
    return _make_event(
        ctx,
        event_type="new_take",
        agent=agent,
        market=market,
        title=copy.title,
        body=copy.body,
        probability=market.current_yes_probability,
        confidence=copy.confidence or conf,
        created_at=_event_timestamp(ctx),
        side=side,
        opponent=opponent,
        flip_reason=flip_reason,
        arc_id=str(arc.get("arc_id")) if arc and arc.get("arc_id") else None,
        skip_arc_start=bool(arc),
        extra_meta={"side": side, "opponent_slug": opponent.slug if opponent else None},
    )


def _gen_stance_followup(ctx: _EngineContext, market: Market, *, arc: dict | None = None) -> FeedEvent | None:
    if arc:
        agent = next((a for a in ctx.agents if a.id == arc.get("agent_id")), None) or _pick_agent(ctx, market)
        mem = _agent_memory(ctx, agent)
        side = arc.get("side") or mem.side_for_market(market.id) or "YES"
    else:
        agent = _pick_agent(ctx, market)
        mem = _agent_memory(ctx, agent)
        stance = mem.stance_for_market(market.id)
        if not stance and not mem.data.get("recent_calls"):
            return None
        side = stance.get("side") if stance else "YES"

    opponent_slug = arc.get("rival_slug") if arc else None
    opponent = ctx.agents_by_slug.get(opponent_slug) if opponent_slug else _opponent_for_market(ctx, market.id, agent.id)

    conf = float(mem.stance_for_market(market.id).get("confidence", 72)) if mem.stance_for_market(market.id) else 72.0
    mem_ctx = _memory_context(ctx, agent, market)
    if arc:
        mem_ctx["arc_stage"] = int(arc.get("stage", 0))
        mem_ctx["prior_thesis"] = arc.get("thesis") or mem_ctx.get("prior_thesis")
    copy = ctx.conviction.generate(
        "stance_followup",
        agent,
        market,
        opponent=opponent,
        side=side,
        **mem_ctx,
    )
    return _make_event(
        ctx,
        event_type="stance_followup",
        agent=agent,
        market=market,
        title=copy.title,
        body=copy.body,
        probability=market.current_yes_probability,
        confidence=copy.confidence or conf,
        created_at=_event_timestamp(ctx),
        side=side,
        opponent=opponent,
        arc_id=arc.get("arc_id") if arc else None,
        extra_meta={
            "side": side,
            "opponent_slug": opponent.slug if opponent else None,
            "arc_stage": mem_ctx.get("arc_stage"),
        },
    )


def _gen_position_update(ctx: _EngineContext, market: Market) -> FeedEvent | None:
    market_positions = [p for p in ctx.positions if p.market_id == market.id]
    if not market_positions:
        return None
    pos = ctx.rng.choice(market_positions)
    agent = _pick_agent(ctx, market)
    opponent = _opponent_for_market(ctx, market.id, agent.id)
    side, conf, _ = _resolve_side_for_event(ctx, agent, market)
    mem_ctx = _memory_context(ctx, agent, market)
    copy = ctx.conviction.generate(
        "position_update",
        agent,
        market,
        opponent=opponent,
        position_side=pos.side,
        position_amount=pos.amount,
        side=side,
        **mem_ctx,
    )
    return _make_event(
        ctx,
        event_type="position_update",
        agent=agent,
        market=market,
        title=copy.title,
        body=copy.body,
        probability=market.current_yes_probability,
        confidence=copy.confidence or conf,
        created_at=_event_timestamp(ctx),
        side=side,
        opponent=opponent,
        extra_meta={
            "position_side": pos.side,
            "position_amount": pos.amount,
            "opponent_slug": opponent.slug if opponent else None,
        },
    )


def _gen_reputation_move(ctx: _EngineContext, agent: Agent) -> FeedEvent | None:
    rep = ctx.rep_by_agent.get(agent.id)
    if not rep or rep.score < 52:
        return None
    delta = round(1.5 + ctx.rng.uniform(0.5, 4.5), 1)
    market = ctx.rng.choice(_active_markets(ctx)) if ctx.markets else None
    opponent = next((a for a in ctx.agents if a.id != agent.id and a.niche == agent.niche), None)
    mem_ctx = _memory_context(ctx, agent, market)
    copy = ctx.conviction.generate(
        "reputation_move",
        agent,
        market,
        opponent=opponent,
        rep_delta=delta,
        **mem_ctx,
    )
    event = _make_event(
        ctx,
        event_type="reputation_move",
        agent=agent,
        market=market,
        title=copy.title,
        body=copy.body,
        probability=None,
        confidence=copy.confidence,
        created_at=_event_timestamp(ctx),
        opponent=opponent,
        extra_meta={"reputation_delta": delta, "opponent_slug": opponent.slug if opponent else None},
    )
    return event


def _gen_verified_call(ctx: _EngineContext, agent: Agent) -> FeedEvent | None:
    rep = ctx.rep_by_agent.get(agent.id)
    if not rep or rep.verified_calls < 1:
        return None
    market = next(
        (m for m in _active_markets(ctx) if m.category.lower() == agent.niche.lower()),
        ctx.rng.choice(_active_markets(ctx)),
    )
    opponent = _opponent_for_market(ctx, market.id, agent.id) if market else None
    mem_ctx = _memory_context(ctx, agent, market)
    copy = ctx.conviction.generate(
        "verified_call",
        agent,
        market,
        opponent=opponent,
        verified_calls=rep.verified_calls,
        **mem_ctx,
    )
    return _make_event(
        ctx,
        event_type="verified_call",
        agent=agent,
        market=market,
        title=copy.title,
        body=copy.body,
        probability=100.0,
        confidence=copy.confidence,
        created_at=_event_timestamp(ctx),
        opponent=opponent,
        extra_meta={"opponent_slug": opponent.slug if opponent else None},
    )


def _gen_quiet_pulse(ctx: _EngineContext, market: Market | None = None) -> FeedEvent | None:
    market = market or _pick_market(ctx)
    if not market or market.status != "open":
        return None
    agent = _pick_agent(ctx, market)
    side, conf, _ = _resolve_side_for_event(ctx, agent, market)
    prob = market.current_yes_probability
    mem = _agent_memory(ctx, agent)
    stance = mem.stance_for_market(market.id)
    thesis_hint = (stance or {}).get("thesis") or f"watching {market.category.lower()} tape"
    from app.forecasting.services.opinion_headlines import generate_opinion_headline

    title = generate_opinion_headline(
        agent.slug,
        rng=ctx.rng,
        seed=hash_seed(agent.slug, market.id, "quiet_pulse"),
        market_title=market.title,
        event_type="quiet_pulse",
    )
    body = (
        f"{agent.name} on {market.title}: holding {side} at ~{prob:.0f}% implied. "
        f"No new thesis — {str(thesis_hint)[:90]}."
    )
    return _make_event(
        ctx,
        event_type="quiet_pulse",
        agent=agent,
        market=market,
        title=title,
        body=body,
        probability=prob,
        confidence=max(52.0, conf - 8),
        created_at=_event_timestamp(ctx),
        side=side,
        extra_meta={"side": side, "intensity": "quiet"},
    )


def _gen_arc_continuation(ctx: _EngineContext) -> FeedEvent | None:
    picked = pick_arc_continuation(ctx.agent_states, ctx.markets_by_id, ctx.rng)
    if not picked:
        return None
    mem, arc, market = picked
    agent = next((a for a in ctx.agents if a.id == mem.agent_id), None)
    if not agent:
        return None
    next_type = mem.arc_ready_for_stage(arc)
    if not next_type:
        return None
    arc_payload = {**arc, "agent_id": agent.id}
    if next_type == "stance_followup":
        return _gen_stance_followup(ctx, market, arc=arc_payload)
    if next_type == "rivalry":
        return _gen_rivalry(ctx, market, arc=arc_payload)
    if next_type == "battle_escalation":
        return _gen_battle_escalation(ctx, market, arc=arc_payload)
    if next_type == "new_take":
        return _gen_new_take(ctx, market, arc=arc_payload)
    if next_type == "signal_shift":
        return _gen_signal_shift(ctx, market, arc=arc_payload)
    return _gen_stance_followup(ctx, market, arc=arc_payload)


GENERATORS: list[tuple[str, Callable[[_EngineContext, Market], FeedEvent | None]]] = [
    ("market_move", _gen_market_move),
    ("signal_shift", _gen_signal_shift),
    ("battle_escalation", _gen_battle_escalation),
    ("rivalry", _gen_rivalry),
    ("narrative_acceleration", _gen_narrative_acceleration),
    ("new_take", _gen_new_take),
    ("stance_followup", _gen_stance_followup),
    ("position_update", _gen_position_update),
]


def _build_engine_context(
    db: Session,
    rng: random.Random,
    *,
    cadence: CadencePlan | None = None,
) -> _EngineContext | None:
    from app.forecasting.agent_status import query_active_agents

    agents = query_active_agents(db)
    markets = db.query(Market).filter(Market.status == "open").all()
    if not markets:
        markets = db.query(Market).all()
    takes = (
        db.query(MarketTake)
        .options(joinedload(MarketTake.agent), joinedload(MarketTake.market))
        .order_by(MarketTake.created_at.desc())
        .limit(120)
        .all()
    )
    positions = (
        db.query(Position)
        .options(joinedload(Position.market))
        .order_by(Position.created_at.desc())
        .limit(80)
        .all()
    )
    reps = db.query(AgentReputation).all()
    rep_by_agent = {r.agent_id: r for r in reps}

    recent_keys, recent_bodies, last_event_at, recent_events = _load_recent_keys(db)
    state_store = AgentStateStore(db, rng=rng)
    agent_states = state_store.ensure_all(agents, takes=takes, markets=markets, rep_by_agent=rep_by_agent)
    conviction = build_conviction_engine(rng, rep_by_agent, agents)
    pacing = build_pacing_state(
        agents=agents,
        markets=markets,
        takes=takes,
        agent_states=agent_states,
        rep_by_agent=rep_by_agent,
        recent_events=recent_events,
        rng=rng,
    )
    ctx = _EngineContext(
        agents=agents,
        markets=markets,
        takes=takes,
        positions=positions,
        rep_by_agent=rep_by_agent,
        agent_states=agent_states,
        state_store=state_store,
        recent_bodies=recent_bodies,
        recent_keys=recent_keys,
        last_event_at=last_event_at,
        rng=rng,
        conviction=conviction,
        agents_by_slug={a.slug: a for a in agents},
        markets_by_id={m.id: m for m in markets},
        pacing=pacing,
        cadence=cadence,
        major_budget=cadence.major_slot if cadence else 1,
        arc_bias=cadence.arc_bias if cadence else 0.35,
    )
    if not agents or not _active_markets(ctx):
        return None
    return ctx


def _apply_reputation_side_effects(db: Session, ctx: _EngineContext, event: FeedEvent) -> None:
    agent = next((a for a in ctx.agents if a.id == event.agent_id), None)
    if not agent:
        return
    if event.type == "reputation_move":
        meta = event.metadata_json or {}
        delta = float(meta.get("reputation_delta", 2.0))
        _apply_reputation_nudge(
            db,
            agent,
            delta=delta,
            reason=f"Simulated reputation move on {agent.niche}",
            market_id=event.market_id,
            category="leaderboard_move",
        )
    elif event.type == "verified_call":
        _apply_reputation_nudge(
            db,
            agent,
            delta=1.2,
            reason=f"Verified call highlighted on {event.market.title if event.market else 'network'}",
            market_id=event.market_id,
            category="verified_highlight",
        )


def _generate_one_event(
    ctx: _EngineContext,
    *,
    major_budget: int,
    arc_available: bool,
) -> tuple[FeedEvent | None, int]:
    rng = ctx.rng
    market = _pick_market(ctx)
    if market is None or market.status != "open":
        return None, major_budget

    if (
        ctx.pacing
        and market.id in ctx.pacing.markets_with_arcs
        and rng.random() < min(0.72, ctx.arc_bias + 0.2)
    ):
        arc_event = _gen_arc_continuation(ctx)
        if arc_event:
            if arc_event.type in ("battle_escalation", "reputation_move", "verified_call", "rivalry"):
                major_budget = max(0, major_budget - 1)
            return arc_event, major_budget

    event_type = pick_event_type(
        rng,
        cadence=ctx.cadence or CadencePlan("normal", 1, 3, 0.35),
        pacing=ctx.pacing or PacingState(),
        market=market,
        major_budget_remaining=major_budget,
        arc_available=arc_available,
    )

    if event_type == "__arc__":
        arc_event = _gen_arc_continuation(ctx)
        if arc_event and arc_event.type in ("battle_escalation", "reputation_move", "verified_call", "rivalry"):
            major_budget = max(0, major_budget - 1)
        return arc_event, major_budget

    if event_type == "quiet_pulse":
        return _gen_quiet_pulse(ctx, market), major_budget

    if event_type in ("reputation_move", "verified_call"):
        agent = pick_agent_weighted(ctx.agents, ctx.pacing, rng) if ctx.pacing else rng.choice(_top_agents(ctx, limit=5))
        if event_type == "reputation_move":
            event = _gen_reputation_move(ctx, agent)
        else:
            event = _gen_verified_call(ctx, agent)
        if event:
            major_budget = max(0, major_budget - 1)
        return event, major_budget

    if event_type == "position_update":
        pos_markets = [
            m
            for m in _active_markets(ctx)
            if m.status == "open" and any(p.market_id == m.id for p in ctx.positions)
        ]
        market = rng.choice(pos_markets) if pos_markets else market

    fn_map = {name: fn for name, fn in GENERATORS}
    fn = fn_map.get(event_type)
    event = fn(ctx, market) if fn else None
    if event and event.type in ("battle_escalation", "rivalry", "market_move", "signal_shift"):
        if event.type in ("battle_escalation", "rivalry"):
            major_budget = max(0, major_budget - 1)
    return event, major_budget


def _run_generation_batch(
    db: Session,
    ctx: _EngineContext,
    *,
    target: int,
    timestamps: list[datetime] | None = None,
) -> list[FeedEvent]:
    created: list[FeedEvent] = []
    attempts = 0
    max_attempts = max(target * 8, 12)
    major_budget = ctx.major_budget
    ts_iter = iter(timestamps or [])
    arc_available = bool(ctx.pacing and ctx.pacing.markets_with_arcs)

    def try_add(event: FeedEvent | None) -> bool:
        if event is None:
            return False
        db.add(event)
        created.append(event)
        return True

    while len(created) < target and attempts < max_attempts:
        attempts += 1
        try:
            ctx.next_timestamp = next(ts_iter)
        except StopIteration:
            ctx.next_timestamp = None

        event, major_budget = _generate_one_event(
            ctx,
            major_budget=major_budget,
            arc_available=arc_available,
        )
        if try_add(event):
            _apply_reputation_side_effects(db, ctx, event)

    if created:
        ctx.state_store.persist()
        db.commit()
        for event in created:
            db.refresh(event)
    return created


def generate_feed_events(
    db: Session,
    *,
    min_count: int | None = None,
    max_count: int | None = None,
    seed: int | None = None,
    cadence: CadencePlan | str | None = "auto",
    timestamps: list[datetime] | None = None,
) -> list[FeedEvent]:
    """Create simulated feed events with natural cadence; returns persisted rows."""
    rng = random.Random(seed if seed is not None else hash_seed(_utcnow().isoformat()))

    plan: CadencePlan | None
    if cadence == "auto" or cadence is None:
        plan = decide_cadence(rng)
    elif isinstance(cadence, CadencePlan):
        plan = cadence
    else:
        plan = None

    if timestamps:
        target = len(timestamps)
    elif plan:
        lo = max(0, plan.min_count)
        hi = max(lo, plan.max_count)
        target = lo if lo == hi else rng.randint(lo, hi)
    else:
        min_c = max(0, min_count if min_count is not None else 1)
        max_c = max(min_c, max_count if max_count is not None else 3)
        target = min_c if min_c == max_c else rng.randint(min_c, max_c)

    multiplier = scheduled_arc_activity_multiplier(db)
    if not timestamps and target > 0:
        boosted_target = int(round(target * multiplier))
        target = max(target, min(12, boosted_target))

    ctx = _build_engine_context(db, rng, cadence=plan)
    if ctx is None or target == 0:
        return []

    return _run_generation_batch(db, ctx, target=target, timestamps=timestamps)


def simulate_network_hour(
    db: Session,
    *,
    seed: int | None = None,
) -> dict:
    """Simulate a realistic hour of network activity with natural timestamp spread."""
    rng = random.Random(seed if seed is not None else hash_seed(_utcnow().isoformat(), "hour"))
    plan = decide_cadence(rng, for_hour=True)
    target = rng.randint(plan.min_count, plan.max_count)
    timestamps = plan_hour_timestamps(target, rng)
    hour_end = _utcnow()
    hour_start = hour_end - timedelta(hours=1)

    events = generate_feed_events(db, seed=seed, cadence=plan, timestamps=timestamps)

    type_mix: dict[str, int] = {}
    for event in events:
        type_mix[event.type] = type_mix.get(event.type, 0) + 1

    return {
        "created": len(events),
        "hour_window": {"start": hour_start.isoformat(), "end": hour_end.isoformat()},
        "cadence": plan.mode,
        "target": target,
        "type_mix": type_mix,
        "events": [event_to_summary(e) for e in events],
    }


def event_to_summary(event: FeedEvent) -> dict:
    return {
        "id": event.id,
        "type": event.type,
        "title": event.title,
        "agent_id": event.agent_id,
        "market_id": event.market_id,
        "created_at": event.created_at.isoformat() if event.created_at else None,
        "probability": event.probability,
    }
