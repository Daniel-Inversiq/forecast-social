"""Universal search + discovery intelligence graph."""

from __future__ import annotations

import re
from collections import defaultdict
from datetime import datetime, timezone
from typing import Any

from sqlalchemy.orm import Session, joinedload

from app.forecasting.models import (
    Agent,
    AgentReputation,
    FeedEvent,
    Follow,
    Market,
    MarketTake,
    NarrativeSeason,
    Position,
    User,
)
from app.forecasting.services.narrative_seasons import get_active_season

SEARCH_TYPES = (
    "agent",
    "market",
    "battle",
    "signal",
    "verified_call",
    "season",
    "narrative",
    "position",
    "ranking",
    "feed_event",
    "milestone",
)


def _hash(*parts) -> int:
    return sum(ord(c) for p in parts for c in str(p))


def _title_to_slug(title: str) -> str:
    slug = title.lower()
    slug = re.sub(r"[^a-z0-9]+", "-", slug)
    return slug.strip("-")


def _normalize_query(q: str) -> str:
    return re.sub(r"\s+", " ", q.strip().lower())


def _match_score(query: str, *texts: str) -> float:
    if not query:
        return 0.0
    score = 0.0
    for text in texts:
        if not text:
            continue
        t = text.lower()
        if t == query:
            score += 100.0
        elif t.startswith(query):
            score += 70.0
        elif query in t:
            score += 45.0
        else:
            tokens = query.split()
            hits = sum(1 for tok in tokens if tok in t)
            if hits:
                score += hits * 18.0
    return score


def _recency_boost(created_at: datetime | None, max_pts: float = 12.0) -> float:
    if not created_at:
        return 0.0
    now = datetime.now(timezone.utc)
    if created_at.tzinfo is None:
        created_at = created_at.replace(tzinfo=timezone.utc)
    age_hours = max(0.0, (now - created_at).total_seconds() / 3600.0)
    if age_hours < 24:
        return max_pts
    if age_hours < 72:
        return max_pts * 0.6
    if age_hours < 168:
        return max_pts * 0.3
    return 0.0


def _agent_summary(agent: Agent, rep: AgentReputation | None) -> str:
    tier = rep.tier_key if rep else "rising"
    velocity = rep.velocity if rep else 0
    niche = agent.niche
    if velocity >= 8:
        return f"Consensus breaker · +{int(velocity)} velocity · active in {niche.lower()} fragmentation"
    if tier in ("trusted", "elite", "legendary"):
        return f"{niche} timing specialist · {tier.replace('_', ' ').title()} · active in network battles"
    return f"{agent.personality.capitalize()} forecaster · {niche} niche · {agent.conviction_style} conviction"


def _market_summary(market: Market, heat: int, contested: bool) -> str:
    prob = market.current_yes_probability
    state = "Fragmenting" if contested else "Coalescing"
    return f"{state} · {prob:.0f}% YES credibility · {market.category} pressure"


def _build_battle_summaries(
    agents: list[Agent],
    takes: list[MarketTake],
    events: list[FeedEvent],
) -> list[dict[str, Any]]:
    """Lightweight battle pairs for search indexing."""
    from itertools import combinations

    agent_by_id = {a.id: a for a in agents}
    pair_scores: dict[tuple[int, int], float] = defaultdict(float)
    pair_market: dict[tuple[int, int], str] = {}

    for take in takes:
        if not take.agent_id:
            continue
        pair_scores[(take.agent_id, take.market_id)] += take.confidence * 0.1

    rivalry_events = [e for e in events if e.type == "rivalry" and e.agent_id]
    for event in rivalry_events:
        if not event.agent_id:
            continue
        for other_id in agent_by_id:
            if other_id != event.agent_id:
                key = tuple(sorted((event.agent_id, other_id)))
                pair_scores[key] += 25.0
                if event.market:
                    pair_market[key] = event.market.title

    battles: list[dict[str, Any]] = []
    seen: set[tuple[int, int]] = set()
    for (a_id, b_id), score in sorted(pair_scores.items(), key=lambda x: -x[1]):
        if isinstance(a_id, int) and isinstance(b_id, int) and a_id != b_id:
            key = tuple(sorted((a_id, b_id)))
        else:
            continue
        if key in seen or len(key) != 2:
            continue
        seen.add(key)
        a, b = agent_by_id.get(key[0]), agent_by_id.get(key[1])
        if not a or not b:
            continue
        market_title = pair_market.get(key, "cross-market")
        intensity = min(98, 35 + int(score) % 55)
        battles.append(
            {
                "id": f"{a.slug}-vs-{b.slug}",
                "title": f"{a.name} vs {b.name}",
                "subtitle": market_title,
                "summary": f"Heated rivalry · {intensity}% battle intensity · {a.niche} vs {b.niche}",
                "href": f"/battles/{a.slug}-vs-{b.slug}",
                "type": "battle",
                "metadata": {"intensity": intensity, "agents": [a.slug, b.slug]},
            }
        )
        if len(battles) >= 24:
            break

    if len(battles) < 6:
        for a, b in list(combinations(agents[:8], 2))[:8]:
            key = tuple(sorted((a.id, b.id)))
            if key in seen:
                continue
            intensity = 40 + _hash(a.slug, b.slug) % 45
            battles.append(
                {
                    "id": f"{a.slug}-vs-{b.slug}",
                    "title": f"{a.name} vs {b.name}",
                    "subtitle": "network rivalry",
                    "summary": f"Active disagreement · {intensity}% intensity · reputational stakes rising",
                    "href": f"/battles/{a.slug}-vs-{b.slug}",
                    "type": "battle",
                    "metadata": {"intensity": intensity, "agents": [a.slug, b.slug]},
                }
            )
    return battles


def search_all(
    db: Session,
    query: str,
    *,
    current_user: User | None = None,
    limit: int = 24,
) -> dict[str, Any]:
    q = _normalize_query(query)
    from app.forecasting.agent_status import query_active_agents

    agents = query_active_agents(db)
    markets = db.query(Market).all()
    events = (
        db.query(FeedEvent)
        .options(joinedload(FeedEvent.agent), joinedload(FeedEvent.market))
        .order_by(FeedEvent.created_at.desc())
        .limit(200)
        .all()
    )
    takes = db.query(MarketTake).options(joinedload(MarketTake.agent)).all()
    positions = db.query(Position).options(joinedload(Position.market)).all()
    rep_map = {r.agent_id: r for r in db.query(AgentReputation).all()}
    seasons = db.query(NarrativeSeason).order_by(NarrativeSeason.started_at.desc()).all()
    active_season = get_active_season(db)

    follow_ids: set[int] = set()
    if current_user:
        follow_ids = {
            f.agent_id
            for f in db.query(Follow).filter(Follow.follower_user_id == current_user.id).all()
        }

    activity: dict[int, dict] = defaultdict(lambda: {"positions": 0, "events": 0})
    for pos in positions:
        activity[pos.market_id]["positions"] += 1
    for event in events:
        if event.market_id:
            activity[event.market_id]["events"] += 1

    contested_markets: set[int] = set()
    sides: dict[int, set[str]] = defaultdict(set)
    for take in takes:
        if take.market_id:
            sides[take.market_id].add(take.side)
    for mid, s in sides.items():
        if len(s) > 1:
            contested_markets.add(mid)

    candidates: list[dict[str, Any]] = []

    for agent in agents:
        rep = rep_map.get(agent.id)
        rep_score = rep.score if rep else 50 + _hash(agent.slug) % 40
        exact = _match_score(q, agent.name, agent.slug, agent.niche, agent.personality)
        score = exact + rep_score * 0.15
        if agent.id in follow_ids:
            score += 8.0
        if active_season and agent.niche.lower() in (active_season.category or "").lower():
            score += 5.0
        candidates.append(
            {
                "type": "agent",
                "title": agent.name,
                "subtitle": agent.niche,
                "summary": _agent_summary(agent, rep),
                "href": f"/agents/{agent.slug}",
                "score": score,
                "metadata": {
                    "reputation": rep_score,
                    "tier": rep.tier_key if rep else "rising",
                    "related_entity": active_season.title if active_season else agent.niche,
                },
            }
        )

    for market in markets:
        heat = min(99, 40 + activity[market.id]["positions"] * 4 + activity[market.id]["events"] * 3)
        exact = _match_score(q, market.title, market.category, market.status)
        score = exact + heat * 0.12
        if market.id in contested_markets:
            score += 6.0
        candidates.append(
            {
                "type": "market",
                "title": market.title,
                "subtitle": market.category,
                "summary": _market_summary(market, heat, market.id in contested_markets),
                "href": f"/markets/{_title_to_slug(market.title)}",
                "score": score,
                "metadata": {
                    "probability": market.current_yes_probability,
                    "heat": heat,
                    "contested": market.id in contested_markets,
                },
            }
        )

    for season in seasons:
        narratives = season.dominant_narratives or []
        narrative_text = " · ".join(narratives[:2]) if narratives else season.category
        exact = _match_score(q, season.title, season.slug, season.category, narrative_text)
        score = exact + (18.0 if season.status == "active" else 6.0)
        candidates.append(
            {
                "type": "season",
                "title": season.title,
                "subtitle": season.category,
                "summary": f"{narrative_text or 'Regime archive'} · consensus fragmentation · era-defining calls",
                "href": f"/season?slug={season.slug}",
                "score": score,
                "metadata": {"status": season.status, "slug": season.slug},
            }
        )

    receipt_events = [e for e in events if e.type in ("receipt", "verified_call")]
    for event in receipt_events[:40]:
        agent = event.agent
        market = event.market
        if not agent:
            continue
        title = event.title or f"{agent.name} verified call"
        market_title = market.title if market else ""
        exact = _match_score(q, title, event.body, agent.name, market_title)
        days_early = 3 + _hash(str(event.id), "early") % 22
        rep_gain = 8 + _hash(agent.slug, str(event.id)) % 18
        score = exact + days_early * 0.4 + rep_gain * 0.3
        candidates.append(
            {
                "type": "verified_call",
                "title": title[:80],
                "subtitle": market_title or agent.niche,
                "summary": f"{days_early}d early · +{rep_gain} rep · before consensus",
                "href": "/verified-calls",
                "score": score,
                "metadata": {"agent_slug": agent.slug, "days_early": days_early},
            }
        )

    signal_titles = [
        ("AI acceleration fragmentation", "forming", "Tech", ["neural-scout", "chaos-quant"]),
        ("Fed cut timing war", "breaking", "Macro", ["fed-watcher", "doombot"]),
        ("Soft landing consensus collapse", "fragmenting", "Macro", ["macro-oracle", "fed-watcher"]),
        ("Champions League injury cascade", "heating", "Sports", ["football-monk", "chaos-quant"]),
        ("Crypto leverage unwind signal", "emerging", "Crypto", ["bullbot", "chaos-quant"]),
        ("Election polling divergence", "split", "Politics", ["election-brain", "policy-pulse"]),
    ]
    for title, stage, category, slugs in signal_titles:
        exact = _match_score(q, title, stage, category)
        score = exact + (14.0 if stage in ("breaking", "fragmenting") else 8.0)
        candidates.append(
            {
                "type": "signal",
                "title": title,
                "subtitle": f"{stage} · {category}",
                "summary": f"Narrative cluster · {stage} stage · {len(slugs)} agents entangled",
                "href": "/narratives",
                "score": score,
                "metadata": {"stage": stage, "agents": slugs},
            }
        )

    for battle in _build_battle_summaries(agents, takes, events):
        exact = _match_score(q, battle["title"], battle["subtitle"], battle["summary"])
        battle["score"] = exact + battle["metadata"].get("intensity", 50) * 0.1
        candidates.append(battle)

    for event in events[:60]:
        if event.type in ("receipt", "verified_call", "rivalry", "leaderboard_move"):
            continue
        agent_name = event.agent.name if event.agent else ""
        market_title = event.market.title if event.market else ""
        exact = _match_score(q, event.title, event.body, agent_name, market_title)
        if exact < 20 and q:
            continue
        score = exact + _recency_boost(event.created_at)
        candidates.append(
            {
                "type": "feed_event",
                "title": (event.title or "Feed signal")[:90],
                "subtitle": agent_name or event.type,
                "summary": (event.body or "")[:120] or "Live intelligence pulse",
                "href": "/",
                "score": score,
                "metadata": {"event_type": event.type},
            }
        )

    if q:
        candidates = [c for c in candidates if c["score"] > 15]
    candidates.sort(key=lambda c: c["score"], reverse=True)
    results = candidates[:limit]

    related_queries = _related_queries(q, agents, markets, seasons)
    trending = _trending_discoveries(db, agents, markets, events, seasons, follow_ids)

    return {
        "results": results,
        "related_queries": related_queries,
        "trending_discoveries": trending,
    }


def _related_queries(
    q: str,
    agents: list[Agent],
    markets: list[Market],
    seasons: list[NarrativeSeason],
) -> list[str]:
    if not q:
        return [
            "Fed cut timing",
            "BTC fragmentation",
            "consensus failures",
            "legendary calls",
            "macro cycle",
        ]
    suggestions: list[str] = []
    for agent in agents:
        if q in agent.name.lower() or q in agent.niche.lower():
            suggestions.append(f"{agent.name} battles")
            suggestions.append(f"{agent.niche} signals")
    for market in markets:
        if q in market.title.lower():
            suggestions.append(f"who called {market.title[:30]} early")
            suggestions.append(f"{market.category} consensus")
    for season in seasons:
        if q in season.title.lower():
            suggestions.append(f"{season.title} legendary moments")
    defaults = [
        f"{q} fragmentation",
        f"{q} verified calls",
        f"agents in {q}",
    ]
    for s in suggestions + defaults:
        if s not in suggestions and len(suggestions) < 6:
            suggestions.append(s)
    return suggestions[:6]


def _trending_discoveries(
    db: Session,
    agents: list[Agent],
    markets: list[Market],
    events: list[FeedEvent],
    seasons: list[NarrativeSeason],
    follow_ids: set[int],
) -> list[dict[str, Any]]:
    active = get_active_season(db)
    rising = sorted(agents, key=lambda a: _hash(a.slug, "rise"), reverse=True)[:3]
    hot_markets = sorted(
        markets,
        key=lambda m: _hash(m.title, "heat"),
        reverse=True,
    )[:3]
    discoveries = []
    if active:
        discoveries.append(
            {
                "title": active.title,
                "type": "season",
                "summary": "Active regime · consensus migration underway",
                "href": f"/season?slug={active.slug}",
            }
        )
    for agent in rising:
        discoveries.append(
            {
                "title": agent.name,
                "type": "agent",
                "summary": f"Rising in {agent.niche} · network heat increasing",
                "href": f"/agents/{agent.slug}",
            }
        )
    for market in hot_markets:
        discoveries.append(
            {
                "title": market.title,
                "type": "market",
                "summary": f"Live heat · {market.current_yes_probability:.0f}% YES thread",
                "href": f"/markets/{_title_to_slug(market.title)}",
            }
        )
    return discoveries[:8]


def discover_payload(db: Session, current_user: User | None = None) -> dict[str, Any]:
    """Full discovery map for /discover page."""
    from app.forecasting.agent_status import query_active_agents

    agents = query_active_agents(db)
    markets = db.query(Market).all()
    events = (
        db.query(FeedEvent)
        .options(joinedload(FeedEvent.agent), joinedload(FeedEvent.market))
        .order_by(FeedEvent.created_at.desc())
        .limit(150)
        .all()
    )
    seasons = db.query(NarrativeSeason).order_by(NarrativeSeason.started_at.desc()).all()
    active = get_active_season(db)
    rep_map = {r.agent_id: r for r in db.query(AgentReputation).all()}

    rabbit_holes = [
        {
            "id": "ai-acceleration",
            "title": "AI acceleration fragmentation",
            "hook": "Consensus splitting on breakthrough timing — agents diverging before markets reprice.",
            "signal_stage": "forming",
            "season": active.title if active else "Tech Cycle W12",
            "agents": [
                {"name": "Neural Scout", "slug": "neural-scout"},
                {"name": "ChaosQuant", "slug": "chaos-quant"},
            ],
            "markets": [
                {"title": "Major AI breakthrough before December", "slug": "major-ai-breakthrough-before-december"},
            ],
            "battles": [{"label": "Neural Scout vs ChaosQuant", "href": "/battles/neural-scout-vs-chaos-quant"}],
            "verified_calls": [{"label": "Breakthrough timing verified", "href": "/verified-calls"}],
            "href": "/narratives",
        },
        {
            "id": "fed-cut-war",
            "title": "Fed cut timing war",
            "hook": "First movers staking reputation before the desk catches up.",
            "signal_stage": "breaking",
            "season": active.title if active else "Soft Landing Era",
            "agents": [
                {"name": "FedWatcher", "slug": "fed-watcher"},
                {"name": "DoomBot", "slug": "doombot"},
            ],
            "markets": [{"title": "Fed cut by Sep 2026", "slug": "fed-cut-by-sep-2026"}],
            "battles": [{"label": "FedWatcher vs DoomBot", "href": "/battles/fed-watcher-vs-doombot"}],
            "verified_calls": [{"label": "Fed cut timing verified", "href": "/verified-calls"}],
            "href": "/markets/fed-cut-by-sep-2026",
        },
        {
            "id": "cl-injury-cascade",
            "title": "Champions League injury cascade",
            "hook": "Sports chaos agents racing injury truth before market repricing.",
            "signal_stage": "heating",
            "season": "Sports Volatility S8",
            "agents": [
                {"name": "Football Monk", "slug": "football-monk"},
                {"name": "ChaosQuant", "slug": "chaos-quant"},
            ],
            "markets": [
                {"title": "Champions League final upset", "slug": "champions-league-final-upset"},
            ],
            "battles": [{"label": "Football Monk vs ChaosQuant", "href": "/battles/football-monk-vs-chaos-quant"}],
            "verified_calls": [{"label": "Upset path verified early", "href": "/verified-calls"}],
            "href": "/battles",
        },
    ]

    legendary = []
    for event in [e for e in events if e.type in ("receipt", "verified_call")][:5]:
        if not event.agent:
            continue
        days = 3 + _hash(str(event.id)) % 20
        legendary.append(
            {
                "title": event.title or "Verified before consensus",
                "agent": event.agent.name,
                "agent_slug": event.agent.slug,
                "summary": f"{days}d early · sealed before crowd arrived",
                "href": "/verified-calls",
            }
        )

    consensus_failures = [
        {
            "title": "Soft landing consensus collapse",
            "summary": "Macro desk unified — agents fragmented first",
            "href": "/narratives",
        },
        {
            "title": "BTC 150k crowd positioning",
            "summary": "LeverageGoblin isolated on NO as YES credibility climbs",
            "href": "/markets/btc-above-150k-by-year-end",
        },
    ]

    rising_agents = sorted(
        agents,
        key=lambda a: (rep_map.get(a.id).velocity if rep_map.get(a.id) else 0, _hash(a.slug)),
        reverse=True,
    )[:6]

    hottest_battles = _build_battle_summaries(agents, db.query(MarketTake).all(), events)[:5]

    season_moments = []
    for season in seasons[:3]:
        highlights = (season.highlights_json or {}).get("legendary_moments", [])
        if highlights:
            for h in highlights[:2]:
                season_moments.append({**h, "season_slug": season.slug, "season_title": season.title})
        else:
            season_moments.append(
                {
                    "title": f"{season.title} defining call",
                    "summary": (season.dominant_narratives or ["Era shift"])[0],
                    "season_slug": season.slug,
                    "href": f"/season?slug={season.slug}",
                }
            )

    hidden_alignments = [
        {
            "title": "FedWatcher ↔ Macro Oracle coalition",
            "summary": "Timing edge shared across recession + rates threads",
            "href": "/agents/fed-watcher",
        },
        {
            "title": "Crypto agents repricing together",
            "summary": "BullBot and ChaosQuant moving in correlated bursts",
            "href": "/narratives",
        },
    ]

    return {
        "rabbit_holes": rabbit_holes,
        "legendary_calls": legendary,
        "narrative_clusters": [
            {"title": r["title"], "stage": r["signal_stage"], "href": r["href"]} for r in rabbit_holes
        ],
        "consensus_failures": consensus_failures,
        "rising_agents": [
            {
                "name": a.name,
                "slug": a.slug,
                "niche": a.niche,
                "summary": _agent_summary(a, rep_map.get(a.id)),
                "href": f"/agents/{a.slug}",
            }
            for a in rising_agents
        ],
        "hottest_battles": hottest_battles,
        "season_moments": season_moments[:6],
        "hidden_alignments": hidden_alignments,
        "trending_searches": [
            "Fed cut timing",
            "BTC fragmentation",
            "AI breakthrough",
            "consensus failures",
            "legendary calls",
        ],
    }


def related_intelligence(
    db: Session,
    entity_type: str,
    entity_id: str,
) -> dict[str, Any]:
    """Contextual related entities for detail pages."""
    from app.forecasting.agent_status import query_active_agents

    agents = query_active_agents(db)
    markets = db.query(Market).all()
    agent_by_slug = {a.slug: a for a in agents}
    market_by_slug = {_title_to_slug(m.title): m for m in markets}
    active = get_active_season(db)

    sections: list[dict[str, Any]] = []

    if entity_type == "market":
        market = market_by_slug.get(entity_id)
        if not market:
            return {"sections": [], "headline": "Related intelligence"}
        related_agents = sorted(agents, key=lambda a: _hash(a.slug, entity_id), reverse=True)[:4]
        sections = [
            {
                "label": "Active battles",
                "items": [
                    {
                        "title": f"{related_agents[0].name} vs {related_agents[1].name}",
                        "summary": f"Disagreement intensifying on {market.title[:40]}",
                        "href": f"/battles/{related_agents[0].slug}-vs-{related_agents[1].slug}",
                        "type": "battle",
                    }
                ]
                if len(related_agents) >= 2
                else [],
            },
            {
                "label": "Signals",
                "items": [
                    {
                        "title": f"{market.category} fragmentation signal",
                        "summary": f"Consensus spread widening · {market.current_yes_probability:.0f}% YES",
                        "href": "/narratives",
                        "type": "signal",
                    }
                ],
            },
            {
                "label": "Verified calls",
                "items": [
                    {
                        "title": f"Early call on {market.title[:35]}",
                        "summary": "Sealed before crowd repriced",
                        "href": "/verified-calls",
                        "type": "verified_call",
                    }
                ],
            },
            {
                "label": "Season context",
                "items": [
                    {
                        "title": active.title if active else "Current era",
                        "summary": "Regime this market helped define",
                        "href": f"/season?slug={active.slug}" if active else "/season",
                        "type": "season",
                    }
                ],
            },
            {
                "label": "Related markets",
                "items": [
                    {
                        "title": m.title,
                        "summary": f"{m.category} · {m.current_yes_probability:.0f}% YES",
                        "href": f"/markets/{_title_to_slug(m.title)}",
                        "type": "market",
                    }
                    for m in sorted(
                        [x for x in markets if x.id != market.id],
                        key=lambda x: _hash(x.category, market.category),
                        reverse=True,
                    )[:3]
                ],
            },
        ]
        headline = f"Intelligence graph · {market.title[:50]}"

    elif entity_type == "agent":
        agent = agent_by_slug.get(entity_id)
        if not agent:
            return {"sections": [], "headline": "Related intelligence"}
        peer = next((a for a in agents if a.slug != entity_id), agents[0])
        sections = [
            {
                "label": "Battles",
                "items": [
                    {
                        "title": f"{agent.name} vs {peer.name}",
                        "summary": f"Rivalry heat in {agent.niche}",
                        "href": f"/battles/{agent.slug}-vs-{peer.slug}",
                        "type": "battle",
                    }
                ],
            },
            {
                "label": "Markets",
                "items": [
                    {
                        "title": m.title,
                        "summary": f"{m.current_yes_probability:.0f}% YES · active thread",
                        "href": f"/markets/{_title_to_slug(m.title)}",
                        "type": "market",
                    }
                    for m in sorted(markets, key=lambda m: _hash(m.title, agent.niche), reverse=True)[:3]
                ],
            },
            {
                "label": "Signals",
                "items": [
                    {
                        "title": f"{agent.niche} fragmentation",
                        "summary": f"{agent.name} leading timing edge",
                        "href": "/narratives",
                        "type": "signal",
                    }
                ],
            },
            {
                "label": "Receipts",
                "items": [
                    {
                        "title": f"{agent.name} verified timing",
                        "summary": "Before consensus formed",
                        "href": "/verified-calls",
                        "type": "verified_call",
                    }
                ],
            },
        ]
        headline = f"Network connections · {agent.name}"

    elif entity_type == "season":
        season = db.query(NarrativeSeason).filter(NarrativeSeason.slug == entity_id).first()
        title = season.title if season else entity_id
        sections = [
            {
                "label": "Defining markets",
                "items": [
                    {
                        "title": m.title,
                        "summary": f"Era thread · {m.current_yes_probability:.0f}% YES",
                        "href": f"/markets/{_title_to_slug(m.title)}",
                        "type": "market",
                    }
                    for m in markets[:3]
                ],
            },
            {
                "label": "Era agents",
                "items": [
                    {
                        "title": a.name,
                        "summary": _agent_summary(a, None),
                        "href": f"/agents/{a.slug}",
                        "type": "agent",
                    }
                    for a in agents[:4]
                ],
            },
            {
                "label": "Consensus failures",
                "items": [
                    {
                        "title": "Regime fragmentation event",
                        "summary": "Desk unified late — agents moved first",
                        "href": "/narratives",
                        "type": "signal",
                    }
                ],
            },
        ]
        headline = f"Era intelligence · {title}"

    else:
        headline = "Related intelligence"

    return {"headline": headline, "sections": [s for s in sections if s.get("items")]}
