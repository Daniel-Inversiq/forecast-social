from collections import defaultdict

from app.forecasting.models import Agent, FeedEvent, Market, MarketTake
from app.forecasting.services.utils import hash_seed, title_to_slug


NARRATIVE_TEMPLATES: list[dict] = [
    {
        "id": "ai-acceleration",
        "label": "AI acceleration",
        "keywords": ["ai", "breakthrough", "nvda", "capex", "semiconductor"],
        "categories": ["tech", "equities"],
    },
    {
        "id": "soft-landing",
        "label": "Soft landing",
        "keywords": ["recession", "labor", "fed cut", "soft"],
        "categories": ["macro", "rates"],
    },
    {
        "id": "recession-risk",
        "label": "Recession risk",
        "keywords": ["recession", "credit", "tightening", "doom"],
        "categories": ["macro"],
    },
    {
        "id": "crypto-supercycle",
        "label": "Crypto supercycle",
        "keywords": ["btc", "crypto", "etf", "on-chain", "halving"],
        "categories": ["crypto"],
    },
    {
        "id": "sports-upset",
        "label": "Sports upset wave",
        "keywords": ["upset", "champions", "football", "league"],
        "categories": ["sports"],
    },
    {
        "id": "rates-repricing",
        "label": "Rates repricing",
        "keywords": ["fed", "cut", "sep", "december", "rates"],
        "categories": ["rates"],
    },
    {
        "id": "climate-policy",
        "label": "Climate policy shift",
        "keywords": ["carbon", "climate", "energy", "eu"],
        "categories": ["climate"],
    },
]


def _text_blob(*parts: str | None) -> str:
    return " ".join(p.lower() for p in parts if p)


def cluster_narratives(
    markets: list[Market],
    events: list[FeedEvent],
    takes: list[MarketTake],
    agents: list[Agent],
) -> list[dict]:
    agent_by_id = {a.id: a for a in agents}
    scores: dict[str, float] = defaultdict(float)
    market_ids: dict[str, set[int]] = defaultdict(set)
    agent_slugs: dict[str, set[str]] = defaultdict(set)
    momentum: dict[str, str] = {}

    def bump(nid: str, amount: float, market_id: int | None = None, agent_id: int | None = None):
        scores[nid] += amount
        if market_id:
            market_ids[nid].add(market_id)
        if agent_id and agent_id in agent_by_id:
            agent_slugs[nid].add(agent_by_id[agent_id].slug)

    for template in NARRATIVE_TEMPLATES:
        nid = template["id"]
        for market in markets:
            blob = _text_blob(market.title, market.category)
            if any(kw in blob for kw in template["keywords"]):
                bump(nid, 2.0, market.id)
            if market.category.lower() in template["categories"]:
                bump(nid, 1.5, market.id)

    for event in events:
        blob = _text_blob(event.title, event.body, event.market.title if event.market else None)
        for template in NARRATIVE_TEMPLATES:
            if any(kw in blob for kw in template["keywords"]):
                weight = 4.0 if event.type in ("consensus_shift", "rivalry") else 2.0
                bump(template["id"], weight, event.market_id, event.agent_id)

    for take in takes:
        if take.confidence < 65:
            continue
        market = take.market
        if not market:
            continue
        blob = _text_blob(market.title, take.body)
        for template in NARRATIVE_TEMPLATES:
            if any(kw in blob for kw in template["keywords"]):
                bump(template["id"], 1.0, market.id, take.agent_id)

    results: list[dict] = []
    for template in NARRATIVE_TEMPLATES:
        nid = template["id"]
        strength = scores.get(nid, 0.0)
        if strength < 3.0:
            continue
        h = hash_seed(nid, str(int(strength)))
        change = (h % 17) - 8
        if change > 4:
            momentum[nid] = "accelerating"
        elif change < -4:
            momentum[nid] = "cooling"
        elif change < 0:
            momentum[nid] = "fragmenting"
        else:
            momentum[nid] = "trending"

        results.append(
            {
                "id": nid,
                "label": template["label"],
                "strength": round(min(100.0, strength * 4.5), 1),
                "momentum": momentum[nid],
                "market_count": len(market_ids[nid]),
                "agent_count": len(agent_slugs[nid]),
                "change_24h": change,
            }
        )

    results.sort(key=lambda x: -x["strength"])
    return results[:8]
