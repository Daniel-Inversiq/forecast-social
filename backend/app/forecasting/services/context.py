from dataclasses import dataclass, field

from sqlalchemy.orm import Session

from app.forecasting.follows import followed_agent_ids
from app.forecasting.models import Agent, AgentReputation, FeedEvent, Market, MarketTake, Position, User, UserProfile


INTEREST_CATEGORY_MAP: dict[str, list[str]] = {
    "macro": ["macro", "rates", "commodities", "recession", "fed", "oil"],
    "politics": ["politic", "election", "policy", "debate"],
    "crypto": ["crypto", "btc", "eth", "on-chain"],
    "tech": ["tech", "ai", "nvda", "capex", "semiconductor"],
    "sports": ["sport", "league", "football", "champions"],
    "climate": ["climate", "carbon", "energy", "grid"],
    "equities": ["equities", "earnings", "beat"],
}


@dataclass
class IntelligenceContext:
    user_id: int | None = None
    followed_agent_ids: set[int] = field(default_factory=set)
    anchor_agent_id: int | None = None
    interest_keywords: set[str] = field(default_factory=set)
    conviction_style: str | None = None
    viewed_market_ids: set[int] = field(default_factory=set)
    position_market_ids: set[int] = field(default_factory=set)
    engaged_event_types: dict[str, int] = field(default_factory=dict)
    agent_niches: dict[int, str] = field(default_factory=dict)
    market_categories: dict[int, str] = field(default_factory=dict)
    battle_market_ids: set[int] = field(default_factory=set)
    narrative_labels: dict[str, float] = field(default_factory=dict)
    agent_reputation_scores: dict[int, float] = field(default_factory=dict)
    agent_reputation_velocity: dict[int, float] = field(default_factory=dict)
    agent_reputation_trend: dict[int, str] = field(default_factory=dict)


def build_intelligence_context(
    user: User | None,
    db: Session,
    *,
    agents: list[Agent] | None = None,
    markets: list[Market] | None = None,
    events: list[FeedEvent] | None = None,
    takes: list[MarketTake] | None = None,
) -> IntelligenceContext:
    ctx = IntelligenceContext()

    reps = db.query(AgentReputation).all()
    for rep in reps:
        ctx.agent_reputation_scores[rep.agent_id] = rep.score
        ctx.agent_reputation_velocity[rep.agent_id] = rep.velocity
        ctx.agent_reputation_trend[rep.agent_id] = rep.trend

    if agents:
        ctx.agent_niches = {a.id: a.niche.lower() for a in agents}
    if markets:
        ctx.market_categories = {m.id: m.category.lower() for m in markets}

    if user:
        ctx.user_id = user.id
        ctx.followed_agent_ids = followed_agent_ids(user, db)
        from app.forecasting.services.anchor_agent import resolve_anchor_agent_id

        ctx.anchor_agent_id = resolve_anchor_agent_id(user, db)

        profile = db.query(UserProfile).filter(UserProfile.user_id == user.id).first()
        if profile:
            ctx.conviction_style = profile.conviction_style
            for interest in profile.selected_interests or []:
                key = str(interest).lower().strip()
                ctx.interest_keywords.add(key)
                for kw in INTEREST_CATEGORY_MAP.get(key, [key]):
                    ctx.interest_keywords.add(kw)

        positions = db.query(Position).filter(Position.user_id == user.id).all()
        ctx.position_market_ids = {p.market_id for p in positions}

        user_takes = db.query(MarketTake).filter(MarketTake.user_id == user.id).all()
        for take in user_takes:
            ctx.viewed_market_ids.add(take.market_id)

        ctx.viewed_market_ids |= ctx.position_market_ids

    if events:
        for event in events:
            ctx.engaged_event_types[event.type] = ctx.engaged_event_types.get(event.type, 0) + 1
            if event.type == "rivalry" and event.market_id:
                ctx.battle_market_ids.add(event.market_id)

    if takes:
        sides_by_market: dict[int, set[str]] = {}
        for take in takes:
            if not take.market_id or not take.agent_id:
                continue
            sides_by_market.setdefault(take.market_id, set()).add(take.side.lower())
        for market_id, sides in sides_by_market.items():
            if len(sides) > 1:
                ctx.battle_market_ids.add(market_id)

    return ctx
