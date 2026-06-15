"""Scry network pacing — heat, cadence, cooldowns, and agent posting rhythms."""

from __future__ import annotations

import random
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Any

from app.forecasting.models import Agent, AgentReputation, FeedEvent, Market, MarketTake
from app.forecasting.seed_data.agents import AGENT_VOICE
from app.forecasting.services.agent_state import AgentMemory
from app.forecasting.services.utils import hash_seed

# --- Agent posting buckets ---------------------------------------------------

MEME_STYLE_MARKERS = ("shitpost", "caps-lock", "winking", "savage", "desperate")
MEME_SLUGS = frozenset(
    {
        "leverage-goblin",
        "pelosi-tracker",
        "perma-bear-9000",
        "rate-cut-copium",
        "exit-liquidity",
        "bullbot",
        "meme-cycle",
    }
)

BUCKET_DEFAULTS: dict[str, dict[str, float]] = {
    "institutional": {"post_weight": 0.42, "agent_cooldown_min": 48, "burst_chance": 0.04},
    "meme": {"post_weight": 1.85, "agent_cooldown_min": 9, "burst_chance": 0.38},
    "volatile": {"post_weight": 1.45, "agent_cooldown_min": 11, "burst_chance": 0.52},
    "selective": {"post_weight": 0.58, "agent_cooldown_min": 38, "burst_chance": 0.08},
    "standard": {"post_weight": 1.0, "agent_cooldown_min": 22, "burst_chance": 0.18},
}

MARKET_COOLDOWN_MINUTES = 14
RIVALRY_PAIR_COOLDOWN_MINUTES = 26
RIVALRY_PAIR_HOT_COOLDOWN_MINUTES = 14

# Event intensity tiers for balanced mix
MAJOR_TYPES = frozenset({"battle_escalation", "reputation_move", "verified_call", "rivalry"})
MEDIUM_TYPES = frozenset({"market_move", "signal_shift", "new_take"})
MINOR_TYPES = frozenset({"stance_followup", "position_update", "narrative_acceleration"})
QUIET_TYPES = frozenset({"quiet_pulse"})

ARC_STAGE_TYPES: dict[str, str] = {
    "new_take": "new_thesis",
    "stance_followup": "follow_up",
    "battle_escalation": "escalation",
    "rivalry": "disagreement",
    "signal_shift": "follow_up",
    "market_move": "follow_up",
    "narrative_acceleration": "escalation",
}


def _utcnow() -> datetime:
    return datetime.utcnow()


@dataclass(frozen=True)
class AgentPostingProfile:
    bucket: str
    post_weight: float
    agent_cooldown_min: int
    burst_chance: float


@dataclass
class MarketHeatState:
    market_id: int
    score: float
    last_event_at: datetime | None = None
    events_last_2h: int = 0
    major_move_recent: bool = False
    stale: bool = False


@dataclass
class CadencePlan:
    mode: str  # quiet | normal | burst
    min_count: int
    max_count: int
    arc_bias: float
    major_slot: int = 1
    quiet_pulse_weight: float = 0.25


@dataclass
class PacingState:
    """Runtime pacing ledger for one generation batch."""

    market_heat: dict[int, MarketHeatState] = field(default_factory=dict)
    agent_profiles: dict[int, AgentPostingProfile] = field(default_factory=dict)
    last_agent_post: dict[int, datetime] = field(default_factory=dict)
    last_market_post: dict[int, datetime] = field(default_factory=dict)
    last_rivalry_pair: dict[tuple[str, str], datetime] = field(default_factory=dict)
    markets_with_arcs: set[int] = field(default_factory=set)
    simulated_now: datetime = field(default_factory=_utcnow)
    burst_agents: set[int] = field(default_factory=set)


def classify_agent_bucket(slug: str, rep: AgentReputation | None) -> str:
    voice = AGENT_VOICE.get(slug, {})
    aggressiveness = float(voice.get("aggressiveness", 0.55))
    archetype = str(voice.get("archetype", ""))
    tier = str(voice.get("reputation_tier", ""))
    certainty = str(voice.get("certainty_style", "")).lower()
    rep_score = rep.score if rep else 0.0

    if slug in MEME_SLUGS or aggressiveness >= 0.78 or any(m in certainty for m in MEME_STYLE_MARKERS):
        return "meme"
    if archetype == "volatility_chaser" or (aggressiveness >= 0.72 and tier != "elite"):
        return "volatile"
    if tier == "elite" and aggressiveness <= 0.48:
        return "institutional"
    if tier == "elite" or rep_score >= 68:
        return "selective"
    return "standard"


def agent_posting_profile(agent: Agent, rep: AgentReputation | None) -> AgentPostingProfile:
    bucket = classify_agent_bucket(agent.slug, rep)
    defaults = BUCKET_DEFAULTS[bucket]
    return AgentPostingProfile(
        bucket=bucket,
        post_weight=float(defaults["post_weight"]),
        agent_cooldown_min=int(defaults["agent_cooldown_min"]),
        burst_chance=float(defaults["burst_chance"]),
    )


def build_pacing_state(
    *,
    agents: list[Agent],
    markets: list[Market],
    takes: list[MarketTake],
    agent_states: dict[int, AgentMemory],
    rep_by_agent: dict[int, AgentReputation],
    recent_events: list[FeedEvent],
    rng: random.Random,
    now: datetime | None = None,
) -> PacingState:
    now = now or _utcnow()
    state = PacingState(simulated_now=now)

    for agent in agents:
        state.agent_profiles[agent.id] = agent_posting_profile(agent, rep_by_agent.get(agent.id))
        if rng.random() < state.agent_profiles[agent.id].burst_chance:
            state.burst_agents.add(agent.id)

    for mem in agent_states.values():
        for arc in mem.active_arcs:
            mid = int(arc.get("market_id", 0))
            if mid:
                state.markets_with_arcs.add(mid)

    take_counts: dict[int, int] = {}
    for take in takes:
        take_counts[take.market_id] = take_counts.get(take.market_id, 0) + 1

    events_by_market: dict[int, list[FeedEvent]] = {}
    last_agent: dict[int, datetime] = {}
    last_market: dict[int, datetime] = {}
    last_rivalry: dict[tuple[str, str], datetime] = {}

    cutoff_2h = now - timedelta(hours=2)
    for event in recent_events:
        if event.created_at:
            if event.agent_id:
                last_agent[event.agent_id] = max(last_agent.get(event.agent_id, event.created_at), event.created_at)
            if event.market_id:
                last_market[event.market_id] = max(last_market.get(event.market_id, event.created_at), event.created_at)
                events_by_market.setdefault(event.market_id, []).append(event)

        meta = event.metadata_json or {}
        opp_slug = meta.get("opponent_slug")
        if opp_slug and event.agent and event.agent.slug:
            pair = tuple(sorted((event.agent.slug, str(opp_slug))))
            if event.created_at:
                last_rivalry[pair] = max(last_rivalry.get(pair, event.created_at), event.created_at)

    state.last_agent_post = last_agent
    state.last_market_post = last_market
    state.last_rivalry_pair = last_rivalry

    open_markets = [m for m in markets if m.status == "open"]
    for market in open_markets:
        score = 18.0 + take_counts.get(market.id, 0) * 2.2
        score += abs(market.current_yes_probability - 50.0) * 0.12

        fav_n = sum(1 for mem in agent_states.values() if market.id in mem.favorite_market_ids())
        score += fav_n * 2.5

        recent = events_by_market.get(market.id, [])
        events_2h = sum(1 for e in recent if e.created_at and e.created_at >= cutoff_2h)
        score += events_2h * 4.0

        last_at = last_market.get(market.id)
        major_move = False
        stale = False
        if last_at:
            age_min = (now - last_at).total_seconds() / 60
            if age_min < 45:
                score += 12
            elif age_min > 240:
                score *= 0.35
                stale = True
            elif age_min > 120:
                score *= 0.62
                stale = True

            for e in recent[:6]:
                meta = e.metadata_json or {}
                delta = abs(float(meta.get("delta", 0) or 0))
                if e.type in ("market_move", "signal_shift") and delta >= 2.2:
                    if e.created_at and (now - e.created_at).total_seconds() < 3600:
                        major_move = True
                        score += 22
                    break

        if market.id in state.markets_with_arcs:
            score += 8

        score += rng.uniform(-4, 4)
        state.market_heat[market.id] = MarketHeatState(
            market_id=market.id,
            score=max(0.0, min(100.0, score)),
            last_event_at=last_at,
            events_last_2h=events_2h,
            major_move_recent=major_move,
            stale=stale,
        )

    return state


def decide_cadence(rng: random.Random, *, for_hour: bool = False) -> CadencePlan:
    if for_hour:
        return CadencePlan(
            mode="hour",
            min_count=6,
            max_count=14,
            arc_bias=0.44,
            major_slot=2,
            quiet_pulse_weight=0.18,
        )

    roll = rng.random()
    if roll < 0.24:
        return CadencePlan(mode="quiet", min_count=0, max_count=1, arc_bias=0.12, major_slot=0, quiet_pulse_weight=0.72)
    if roll < 0.42:
        return CadencePlan(mode="burst", min_count=3, max_count=5, arc_bias=0.52, major_slot=1, quiet_pulse_weight=0.08)
    return CadencePlan(mode="normal", min_count=1, max_count=3, arc_bias=0.42, major_slot=1, quiet_pulse_weight=0.28)


def pick_market_weighted(
    markets: list[Market],
    pacing: PacingState,
    rng: random.Random,
    *,
    prefer_hot: bool = True,
) -> Market | None:
    open_markets = [m for m in markets if m.status == "open"]
    if not open_markets:
        return None

    weights: list[float] = []
    for market in open_markets:
        heat = pacing.market_heat.get(market.id)
        if heat is None:
            weights.append(8.0)
            continue
        w = heat.score
        if not prefer_hot and heat.stale:
            w *= 1.35
        if market.id in pacing.markets_with_arcs:
            w *= 1.25
        if not market_can_receive(pacing, market.id):
            w *= 0.15
        weights.append(max(0.5, w))

    if sum(weights) <= 0:
        return rng.choice(open_markets)
    return rng.choices(open_markets, weights=weights, k=1)[0]


def pick_agent_weighted(
    agents: list[Agent],
    pacing: PacingState,
    rng: random.Random,
    *,
    market: Market | None = None,
    prefer_id: int | None = None,
) -> Agent:
    if prefer_id:
        agent = next((a for a in agents if a.id == prefer_id), None)
        if agent and agent_can_post(pacing, agent.id, rng=rng):
            return agent

    pool: list[Agent] = []
    weights: list[float] = []
    for agent in agents:
        profile = pacing.agent_profiles.get(agent.id)
        if profile is None:
            continue
        if not agent_can_post(pacing, agent.id, rng=rng):
            continue
        w = profile.post_weight
        if market and agent.niche.lower() == market.category.lower():
            w *= 1.35
        if agent.id in pacing.burst_agents:
            w *= 1.55
        pool.append(agent)
        weights.append(w)

    if not pool:
        return rng.choice(agents)
    return rng.choices(pool, weights=weights, k=1)[0]


def agent_can_post(pacing: PacingState, agent_id: int, *, rng: random.Random | None = None) -> bool:
    profile = pacing.agent_profiles.get(agent_id)
    if profile is None:
        return True
    last = pacing.last_agent_post.get(agent_id)
    if last is None:
        return True
    cooldown = timedelta(minutes=profile.agent_cooldown_min)
    if agent_id in pacing.burst_agents and rng and rng.random() < 0.35:
        cooldown = timedelta(minutes=max(4, profile.agent_cooldown_min // 3))
    return pacing.simulated_now - last >= cooldown


def market_can_receive(pacing: PacingState, market_id: int | None) -> bool:
    if market_id is None:
        return True
    last = pacing.last_market_post.get(market_id)
    if last is None:
        return True
    return pacing.simulated_now - last >= timedelta(minutes=MARKET_COOLDOWN_MINUTES)


def rivalry_pair_can_post(
    pacing: PacingState,
    slug_a: str,
    slug_b: str,
    *,
    heat: int = 0,
) -> bool:
    pair = tuple(sorted((slug_a, slug_b)))
    last = pacing.last_rivalry_pair.get(pair)
    if last is None:
        return True
    minutes = RIVARLY_PAIR_HOT_COOLDOWN_MINUTES if heat >= 6 else RIVARLY_PAIR_COOLDOWN_MINUTES
    return pacing.simulated_now - last >= timedelta(minutes=minutes)


def record_post(
    pacing: PacingState,
    *,
    agent_id: int,
    market_id: int | None,
    created_at: datetime,
    opponent_slugs: tuple[str, ...] = (),
) -> None:
    pacing.simulated_now = max(pacing.simulated_now, created_at)
    pacing.last_agent_post[agent_id] = max(pacing.last_agent_post.get(agent_id, created_at), created_at)
    if market_id is not None:
        pacing.last_market_post[market_id] = max(pacing.last_market_post.get(market_id, created_at), created_at)
        heat = pacing.market_heat.get(market_id)
        if heat:
            heat.last_event_at = created_at
            heat.events_last_2h += 1
            heat.score = min(100.0, heat.score + 3.5)
            heat.stale = False
    for i, slug_a in enumerate(opponent_slugs):
        for slug_b in opponent_slugs[i + 1 :]:
            pair = tuple(sorted((slug_a, slug_b)))
            pacing.last_rivalry_pair[pair] = max(pacing.last_rivalry_pair.get(pair, created_at), created_at)


def bump_market_heat_after_major_move(pacing: PacingState, market_id: int, delta: float) -> None:
    heat = pacing.market_heat.get(market_id)
    if not heat:
        return
    if abs(delta) >= 2.0:
        heat.major_move_recent = True
        heat.score = min(100.0, heat.score + 18)
        heat.stale = False


def pick_event_type(
    rng: random.Random,
    *,
    cadence: CadencePlan,
    pacing: PacingState,
    market: Market | None,
    major_budget_remaining: int,
    arc_available: bool,
) -> str:
    if cadence.mode == "quiet" or (
        cadence.mode != "hour" and cadence.quiet_pulse_weight > 0.5 and rng.random() < cadence.quiet_pulse_weight
    ):
        return "quiet_pulse"

    if arc_available and rng.random() < cadence.arc_bias:
        return "__arc__"

    heat_score = pacing.market_heat.get(market.id).score if market and market.id in pacing.market_heat else 40.0

    if major_budget_remaining > 0:
        major_base = 0.38 if cadence.mode == "hour" else 0.22
        if rng.random() < major_base + (heat_score / 200):
            return rng.choice(
                ["rivalry", "battle_escalation", "rivalry", "reputation_move", "verified_call"]
            )

    if heat_score >= 55 and rng.random() < 0.42:
        return rng.choice(["rivalry", "battle_escalation", "stance_followup", "new_take"])

    if cadence.mode == "hour" and rng.random() < cadence.quiet_pulse_weight:
        return "quiet_pulse"

    if rng.random() < 0.32:
        return rng.choice(["stance_followup", "position_update", "narrative_acceleration", "quiet_pulse"])

    pool = [
        "rivalry",
        "stance_followup",
        "new_take",
        "position_update",
        "quiet_pulse",
        "market_move",
        "signal_shift",
    ]
    return rng.choice(pool)


def plan_hour_timestamps(count: int, rng: random.Random, *, now: datetime | None = None) -> list[datetime]:
    """Spread event timestamps across the last 60 minutes with natural gaps."""
    now = now or _utcnow()
    if count <= 0:
        return []

    # Cluster into 2–4 activity windows with quiet stretches between
    window_count = rng.randint(2, min(4, max(2, count // 2)))
    windows: list[tuple[int, int]] = []
    remaining = count
    for i in range(window_count):
        if i == window_count - 1:
            take = remaining
        else:
            take = max(1, min(remaining - (window_count - i - 1), rng.randint(1, max(1, remaining // 2))))
        remaining -= take
        start = rng.randint(5, 55)
        end = min(58, start + rng.randint(8, 22))
        windows.append((start, take))

    stamps: list[datetime] = []
    for start_min, batch_size in windows:
        for _ in range(batch_size):
            offset = start_min + rng.randint(0, 12)
            stamps.append(now - timedelta(minutes=60 - offset, seconds=rng.randint(0, 50)))

    stamps.sort()
    return stamps[:count]


def arc_stage_label(event_type: str) -> str:
    return ARC_STAGE_TYPES.get(event_type, "follow_up")
