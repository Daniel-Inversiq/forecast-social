from collections import defaultdict
from itertools import combinations

from app.forecasting.models import Agent, FeedEvent, Market, MarketTake
from app.forecasting.services.utils import hash_seed, parse_spread, title_to_slug


def _battle_strength(score: float) -> str:
    if score >= 80:
        return "legendary"
    if score >= 60:
        return "heated"
    if score >= 40:
        return "active"
    return "emerging"


def detect_battles(
    agents: list[Agent],
    events: list[FeedEvent],
    takes: list[MarketTake],
    markets: list[Market],
    *,
    limit: int = 12,
) -> list[dict]:
    agent_by_id = {a.id: a for a in agents}
    market_by_id = {m.id: m for m in markets}
    pairs: dict[tuple[int, int, int | None], dict] = {}

    takes_by_market: dict[int, list[MarketTake]] = defaultdict(list)
    for take in takes:
        if take.agent_id:
            takes_by_market[take.market_id].append(take)

    for market_id, market_takes in takes_by_market.items():
        by_agent: dict[int, MarketTake] = {}
        for take in market_takes:
            if take.agent_id not in by_agent or take.confidence > by_agent[take.agent_id].confidence:
                by_agent[take.agent_id] = take
        agent_ids = [aid for aid in by_agent if aid in agent_by_id]
        if len(agent_ids) < 2:
            continue
        for a_id, b_id in combinations(agent_ids, 2):
            ta, tb = by_agent[a_id], by_agent[b_id]
            if ta.side.lower() == tb.side.lower():
                continue
            key = (min(a_id, b_id), max(a_id, b_id), market_id)
            spread = abs(ta.confidence - tb.confidence)
            pairs[key] = {
                "agent_a_id": a_id,
                "agent_b_id": b_id,
                "market_id": market_id,
                "disagreement_score": spread + 20,
                "conviction_delta": abs(ta.confidence - tb.confidence),
                "source": "takes",
            }

    for event in events:
        if event.type not in ("rivalry", "battle_escalation") or not event.agent_id:
            continue
        spread = parse_spread(event.body) or 30
        h = hash_seed(event.id, event.agent.slug)
        other_id = next(
            (a.id for a in agents if a.id != event.agent_id and a.id in agent_by_id),
            None,
        )
        if other_id is None or event.agent_id not in agent_by_id:
            continue
        key = (min(event.agent_id, other_id), max(event.agent_id, other_id), event.market_id)
        existing = pairs.get(key)
        score = spread + 15 + (event.confidence or 50) * 0.1
        if existing:
            existing["disagreement_score"] = max(existing["disagreement_score"], score)
            existing["source"] = "rivalry+take"
        else:
            pairs[key] = {
                "agent_a_id": event.agent_id,
                "agent_b_id": other_id,
                "market_id": event.market_id,
                "disagreement_score": score,
                "conviction_delta": spread,
                "source": "rivalry",
            }

    battles: list[dict] = []
    for key, data in pairs.items():
        a = agent_by_id.get(data["agent_a_id"])
        b = agent_by_id.get(data["agent_b_id"])
        if not a or not b:
            continue
        market = market_by_id.get(data["market_id"]) if data["market_id"] else None
        rank_gap = abs(hash_seed(a.slug) - hash_seed(b.slug)) % 12
        score = data["disagreement_score"] + rank_gap * 1.5
        battles.append(
            {
                "id": f"{a.slug}-vs-{b.slug}-{data['market_id'] or 'open'}",
                "agent_a": {"name": a.name, "slug": a.slug, "niche": a.niche},
                "agent_b": {"name": b.name, "slug": b.slug, "niche": b.niche},
                "market_title": market.title if market else None,
                "market_slug": title_to_slug(market.title) if market else None,
                "disagreement_score": round(score, 1),
                "conviction_delta": round(data["conviction_delta"], 1),
                "timing_delta_hours": 2 + hash_seed(key) % 18,
                "reputation_stakes": "high" if rank_gap >= 6 else "medium",
                "intensity": _battle_strength(score),
                "widening": (hash_seed(key) % 3) == 0,
            }
        )

    battles.sort(key=lambda x: -x["disagreement_score"])
    return battles[:limit]
