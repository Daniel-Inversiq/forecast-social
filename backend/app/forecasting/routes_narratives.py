import re
from collections import defaultdict
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.forecasting.models import Agent, FeedEvent, Market, MarketTake, Position

router = APIRouter(tags=["narratives"])


def _hash(*parts) -> int:
    return sum(ord(c) for p in parts for c in str(p))


def _title_to_slug(title: str) -> str:
    slug = title.lower()
    slug = re.sub(r"[^a-z0-9]+", "-", slug)
    return slug.strip("-")


def _iso(dt: datetime) -> str:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc).isoformat()
    return dt.isoformat()


def _probability_delta(seed: str) -> float:
    h = _hash(seed)
    delta = (h % 17) - 8
    if delta == 0:
        delta = 3 if h % 2 else -2
    return float(delta)


def _narrative_item(
    *,
    title: str,
    description: str,
    narrative_type: str,
    direction: str,
    strength: float,
    change: float,
    agents_involved: list[str],
    markets_involved: list[str],
    created_at: datetime,
) -> dict:
    return {
        "title": title,
        "description": description,
        "type": narrative_type,
        "direction": direction,
        "strength": round(strength, 1),
        "change": round(change, 1),
        "agents_involved": agents_involved,
        "markets_involved": markets_involved,
        "created_at": _iso(created_at),
    }


def _contested_by_market(takes: list[MarketTake], positions: list[Position]) -> dict[int, dict]:
    sides: dict[int, set[str]] = defaultdict(set)
    spreads: dict[int, list[float]] = defaultdict(list)
    agents: dict[int, set[int]] = defaultdict(set)

    for take in takes:
        if not take.market_id:
            continue
        sides[take.market_id].add(take.side)
        if take.agent_id:
            agents[take.market_id].add(take.agent_id)
    for pos in positions:
        sides[pos.market_id].add(pos.side)

    latest: dict[tuple[int, int], MarketTake] = {}
    for take in takes:
        if not take.agent_id or not take.market_id:
            continue
        key = (take.agent_id, take.market_id)
        if key not in latest:
            latest[key] = take

    by_market: dict[int, list[MarketTake]] = defaultdict(list)
    for take in latest.values():
        by_market[take.market_id].append(take)

    for market_id, market_takes in by_market.items():
        if len(market_takes) < 2:
            continue
        confidences = [t.confidence for t in market_takes]
        sides_set = {t.side for t in market_takes}
        if len(sides_set) > 1:
            spreads[market_id].append(max(confidences) - min(confidences))

    result: dict[int, dict] = {}
    for market_id, side_set in sides.items():
        if len(side_set) <= 1:
            continue
        spread_vals = spreads.get(market_id, [])
        result[market_id] = {
            "spread": max(spread_vals) if spread_vals else 25 + _hash(str(market_id)) % 20,
            "agent_count": len(agents.get(market_id, set())) or 2 + _hash(str(market_id)) % 6,
        }
    return result


def _category_momentum(
    label: str,
    markets: list[Market],
    events: list[FeedEvent],
    takes: list[MarketTake],
    contested: dict[int, dict],
) -> dict | None:
    category_map = {
        "AI": {"Tech"},
        "Macro": {"Macro", "Rates", "Commodities"},
        "Crypto": {"Crypto"},
        "Sports": {"Sports"},
        "Politics": {"Politics"},
        "Climate": {"Climate"},
    }
    cats = category_map.get(label, {label})
    relevant = [
        m
        for m in markets
        if m.category in cats or (label == "AI" and "AI" in m.title)
    ]
    if not relevant and label != "AI":
        return None

    market_ids = {m.id for m in relevant}
    cat_events = [e for e in events if e.market_id in market_ids]
    cat_takes = [t for t in takes if t.market_id in market_ids]
    shift_events = [e for e in cat_events if e.type in ("consensus_shift", "confidence_shift")]
    rivalry_events = [e for e in cat_events if e.type == "rivalry"]

    h = _hash(label, "momentum")
    base_strength = 42 + h % 38
    if shift_events:
        base_strength += 8
    if rivalry_events:
        base_strength += 6
    if cat_takes:
        base_strength += min(12, len(cat_takes))

    contested_bonus = sum(contested.get(m.id, {}).get("spread", 0) for m in relevant) / max(
        len(relevant), 1
    )
    if contested_bonus > 30:
        direction = "split"
    else:
        probs = [m.current_yes_probability for m in relevant]
        avg_prob = sum(probs) / len(probs) if probs else 50
        delta = _probability_delta(f"cat-{label}")
        direction = "up" if delta > 0 or avg_prob >= 55 else "down"

    change = abs(_probability_delta(f"change-{label}")) + contested_bonus * 0.08
    agent_slugs: set[str] = set()
    for e in cat_events[:6]:
        if e.agent:
            agent_slugs.add(e.agent.slug)
    for t in cat_takes[:8]:
        if t.agent:
            agent_slugs.add(t.agent.slug)
        elif t.author_slug:
            agent_slugs.add(t.author_slug)

    return {
        "category": label,
        "direction": direction,
        "strength": min(98.0, base_strength + contested_bonus * 0.15),
        "change": round(change, 1),
        "agent_count": max(len(agent_slugs), 3 + h % 14),
        "markets_involved": [m.title for m in relevant[:4]],
    }


def _build_trending_narratives(
    markets: list[Market],
    events: list[FeedEvent],
    agents: list[Agent],
    takes: list[MarketTake],
    contested: dict[int, dict],
) -> list[dict]:
    narratives: list[dict] = []
    categories = {m.category for m in markets}
    tech_markets = [m for m in markets if m.category == "Tech" or "AI" in m.title]
    rates_markets = [m for m in markets if m.category == "Rates"]
    crypto_markets = [m for m in markets if m.category == "Crypto"]
    climate_markets = [m for m in markets if m.category == "Climate"]

    def _agents_for_markets(ms: list[Market], limit: int = 4) -> list[str]:
        ids = {m.id for m in ms}
        slugs: list[str] = []
        for e in events:
            if e.market_id in ids and e.agent and e.agent.slug not in slugs:
                slugs.append(e.agent.slug)
        for t in takes:
            if t.market_id in ids:
                slug = t.agent.slug if t.agent else t.author_slug
                if slug not in slugs:
                    slugs.append(slug)
            if len(slugs) >= limit:
                break
        return slugs[:limit]

    if tech_markets:
        ai_agents = _agents_for_markets(tech_markets)
        latest = next((e for e in events if e.market_id in {m.id for m in tech_markets}), None)
        narratives.append(
            _narrative_item(
                title="AI optimism accelerating",
                description="Tech conviction clustering higher as agents stack high-confidence YES takes on breakthrough timelines.",
                narrative_type="momentum_up",
                direction="up",
                strength=72 + _hash("ai") % 18,
                change=8 + _probability_delta("ai-narr"),
                agents_involved=ai_agents or ["bullbot", "contr-cap"],
                markets_involved=[m.title for m in tech_markets],
                created_at=latest.created_at if latest else datetime.utcnow(),
            )
        )

    if rates_markets or "Macro" in categories:
        rate_markets = rates_markets or [m for m in markets if m.category == "Macro"][:2]
        shift = next(
            (e for e in events if e.type == "consensus_shift" and e.market_id in {m.id for m in rate_markets}),
            None,
        )
        narratives.append(
            _narrative_item(
                title="Rates consensus turning bearish",
                description="Fed-cut timing pulled forward while recession odds hold — macro agents repricing the soft-landing window.",
                narrative_type="consensus_shift",
                direction="down",
                strength=65 + _hash("rates") % 22,
                change=abs(_probability_delta("rates-shift")) + 4,
                agents_involved=_agents_for_markets(rate_markets) or ["fed-watcher", "macro-oracle"],
                markets_involved=[m.title for m in rate_markets],
                created_at=shift.created_at if shift else datetime.utcnow(),
            )
        )

    if crypto_markets:
        spread = max((contested.get(m.id, {}).get("spread", 0) for m in crypto_markets), default=35)
        rivalry = next((e for e in events if e.type == "rivalry" and e.market_id in {m.id for m in crypto_markets}), None)
        narratives.append(
            _narrative_item(
                title="Crypto disagreement widening",
                description=f"Year-end targets repriced while conviction spreads hit {spread:.0f} pts — agents refusing to converge.",
                narrative_type="disagreement",
                direction="split",
                strength=58 + spread * 0.4,
                change=spread * 0.12,
                agents_involved=_agents_for_markets(crypto_markets) or ["chaos-quant", "contr-cap"],
                markets_involved=[m.title for m in crypto_markets],
                created_at=rivalry.created_at if rivalry else datetime.utcnow(),
            )
        )

    if climate_markets:
        lb = next(
            (e for e in events if e.type == "leaderboard_move" and e.market_id in {m.id for m in climate_markets}),
            None,
        )
        narratives.append(
            _narrative_item(
                title="Climate conviction strengthening",
                description="Policy agents building streaks on carbon transition markets — consensus drift toward YES on EU policy shift.",
                narrative_type="momentum_up",
                direction="up",
                strength=61 + _hash("climate") % 20,
                change=5 + _probability_delta("climate"),
                agents_involved=_agents_for_markets(climate_markets) or ["contr-cap"],
                markets_involved=[m.title for m in climate_markets],
                created_at=lb.created_at if lb else datetime.utcnow(),
            )
        )

    receipt_events = [e for e in events if e.type == "receipt"]
    if receipt_events:
        top = receipt_events[0]
        narratives.append(
            _narrative_item(
                title="Receipt culture narrative breakout",
                description="Verified early calls resurfacing across feeds — agents racing to post before consensus locks.",
                narrative_type="narrative_breakout",
                direction="up",
                strength=70 + _hash("receipt") % 15,
                change=11 + len(receipt_events),
                agents_involved=[e.agent.slug for e in receipt_events[:4] if e.agent],
                markets_involved=[e.market.title for e in receipt_events[:3] if e.market],
                created_at=top.created_at,
            )
        )

    politics_markets = [m for m in markets if m.category == "Politics"]
    if politics_markets:
        narratives.append(
            _narrative_item(
                title="Polling-night narratives pulling forward",
                description="Election agents front-running polling cycles — probability clusters shifting pre-consensus.",
                narrative_type="narrative_breakout",
                direction="up",
                strength=55 + _hash("politics") % 25,
                change=6 + _probability_delta("pol"),
                agents_involved=_agents_for_markets(politics_markets) or ["election-brain"],
                markets_involved=[m.title for m in politics_markets],
                created_at=next(
                    (e.created_at for e in events if e.market_id in {m.id for m in politics_markets}),
                    datetime.utcnow(),
                ),
            )
        )

    if len(narratives) < 4:
        macro_agents = [a.slug for a in agents if a.niche in ("Macro", "Rates")][:3]
        narratives.append(
            _narrative_item(
                title="Macro agents reprice recession timing",
                description="Labor and credit signals pulling recession markets into contested territory.",
                narrative_type="momentum_down",
                direction="down",
                strength=52 + _hash("macro-fallback") % 20,
                change=7,
                agents_involved=macro_agents or ["macro-oracle", "doombot"],
                markets_involved=[m.title for m in markets if m.category == "Macro"][:2],
                created_at=datetime.utcnow(),
            )
        )

    narratives.sort(key=lambda n: n["strength"], reverse=True)
    return narratives[:6]


def _build_consensus_shifts(events: list[FeedEvent], markets: list[Market]) -> list[dict]:
    shifts: list[dict] = []
    shift_events = [e for e in events if e.type in ("consensus_shift", "confidence_shift")]

    for event in shift_events:
        if not event.market:
            continue
        delta = _probability_delta(f"shift-{event.id}")
        direction = "up" if delta > 0 else "down"
        agents = [event.agent.slug] if event.agent else []
        shifts.append(
            _narrative_item(
                title=event.title,
                description=event.body[:220],
                narrative_type="consensus_shift",
                direction=direction,
                strength=55 + abs(delta) * 2.5 + (event.confidence or 0) * 0.15,
                change=abs(delta),
                agents_involved=agents,
                markets_involved=[event.market.title],
                created_at=event.created_at,
            )
        )

    for market in markets:
        if any(s["markets_involved"] == [market.title] for s in shifts):
            continue
        h = _hash(market.title, "consensus")
        if h % 3 != 0:
            continue
        delta = _probability_delta(f"market-{market.id}")
        shifts.append(
            _narrative_item(
                title=f"{market.title} consensus in motion",
                description=f"Agent cluster on {market.category} repricing — median probability drifting {'higher' if delta > 0 else 'lower'}.",
                narrative_type="consensus_shift",
                direction="up" if delta > 0 else "down",
                strength=48 + abs(delta) * 2,
                change=abs(delta),
                agents_involved=[],
                markets_involved=[market.title],
                created_at=market.created_at,
            )
        )

    shifts.sort(key=lambda s: s["change"], reverse=True)
    return shifts[:8]


def _build_expanding_disagreements(
    markets: list[Market],
    events: list[FeedEvent],
    takes: list[MarketTake],
    contested: dict[int, dict],
) -> list[dict]:
    disagreements: list[dict] = []
    market_by_id = {m.id: m for m in markets}

    for market_id, data in contested.items():
        market = market_by_id.get(market_id)
        if not market:
            continue
        spread = data["spread"]
        agent_slugs: list[str] = []
        for t in takes:
            if t.market_id == market_id:
                slug = t.agent.slug if t.agent else t.author_slug
                if slug not in agent_slugs:
                    agent_slugs.append(slug)
        rivalry = next((e for e in events if e.market_id == market_id and e.type == "rivalry"), None)
        title = f"{market.category} disagreement widening" if spread >= 35 else f"Split forming on {market.title}"
        if rivalry:
            title = rivalry.title

        disagreements.append(
            _narrative_item(
                title=title,
                description=rivalry.body[:220] if rivalry else f"Conviction spread at {spread:.0f} pts — agents diverging further on {market.title}.",
                narrative_type="disagreement",
                direction="split",
                strength=40 + spread * 0.55 + data["agent_count"] * 1.2,
                change=spread * 0.1 + _hash(market.title) % 5,
                agents_involved=agent_slugs[:5],
                markets_involved=[market.title],
                created_at=rivalry.created_at if rivalry else datetime.utcnow(),
            )
        )

    disagreements.sort(key=lambda d: d["strength"], reverse=True)
    return disagreements[:8]


@router.get("/narratives")
def get_narratives(db: Session = Depends(get_db)):
    markets = db.query(Market).all()
    events = (
        db.query(FeedEvent)
        .options(joinedload(FeedEvent.agent), joinedload(FeedEvent.market))
        .order_by(FeedEvent.created_at.desc())
        .all()
    )
    takes = (
        db.query(MarketTake)
        .options(joinedload(MarketTake.agent), joinedload(MarketTake.market))
        .order_by(MarketTake.created_at.desc())
        .all()
    )
    positions = db.query(Position).all()
    from app.forecasting.agent_status import query_active_agents

    agents = query_active_agents(db)

    contested = _contested_by_market(takes, positions)

    trending = _build_trending_narratives(markets, events, agents, takes, contested)
    consensus_shifts = _build_consensus_shifts(events, markets)
    expanding = _build_expanding_disagreements(markets, events, takes, contested)

    momentum_labels = ["AI", "Macro", "Crypto", "Sports", "Politics", "Climate"]
    momentum_markets = []
    for label in momentum_labels:
        row = _category_momentum(label, markets, events, takes, contested)
        if row:
            momentum_markets.append(row)

    return {
        "trending_narratives": trending,
        "consensus_shifts": consensus_shifts,
        "expanding_disagreements": expanding,
        "momentum_markets": momentum_markets,
    }
