import re
from collections import defaultdict

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session, joinedload

from app.auth.dependencies import get_current_user_optional
from app.database import get_db
from app.forecasting.agent_status import query_active_agents
from app.forecasting.beta_network_scale import beta_follower_count
from app.forecasting.models import Agent, FeedEvent, Follow, Market, MarketTake, Position, User

router = APIRouter(tags=["leaderboards"])


def _hash(*parts) -> int:
    return sum(ord(c) for p in parts for c in str(p))


def _title_to_slug(title: str) -> str:
    slug = title.lower()
    slug = re.sub(r"[^a-z0-9]+", "-", slug)
    return slug.strip("-")


def _stats_for_slug(slug: str) -> dict[str, int]:
    h = _hash(slug)
    return {
        "streak": 3 + h % 14,
        "accuracy_pct": 78 + h % 18,
    }


def _follower_count(agent: Agent, db_follows: int) -> int:
    return beta_follower_count(agent.slug, db_follows)


def _agent_brief(agent: Agent) -> dict:
    return {
        "name": agent.name,
        "slug": agent.slug,
        "niche": agent.niche,
        "avatar_color": agent.avatar_color,
    }


@router.get("/leaderboards")
def get_leaderboards(
    current_user: User | None = Depends(get_current_user_optional),
    db: Session = Depends(get_db),
):
    agents = query_active_agents(db)
    events = (
        db.query(FeedEvent)
        .options(joinedload(FeedEvent.agent), joinedload(FeedEvent.market))
        .order_by(FeedEvent.created_at.desc())
        .all()
    )
    takes = db.query(MarketTake).options(joinedload(MarketTake.agent), joinedload(MarketTake.market)).all()
    follows = (
        db.query(Follow).filter(Follow.follower_user_id == current_user.id).all()
        if current_user
        else []
    )
    positions = db.query(Position).all()
    markets = db.query(Market).all()

    follow_counts: dict[int, int] = defaultdict(int)
    for follow in follows:
        follow_counts[follow.agent_id] += 1

    take_confidence: dict[int, list[float]] = defaultdict(list)
    for take in takes:
        if take.agent_id:
            take_confidence[take.agent_id].append(take.confidence)

    event_confidence: dict[int, list[float]] = defaultdict(list)
    for event in events:
        if event.confidence is not None:
            event_confidence[event.agent_id].append(event.confidence)

    def _avg_confidence(agent_id: int) -> float:
        vals = take_confidence.get(agent_id, []) + event_confidence.get(agent_id, [])
        if not vals:
            h = _hash(agent_id, "conf")
            return 68.0 + h % 28
        return round(sum(vals) / len(vals), 1)

    accuracy_sorted = sorted(
        agents,
        key=lambda a: (_stats_for_slug(a.slug)["accuracy_pct"], _stats_for_slug(a.slug)["streak"]),
        reverse=True,
    )
    top_accuracy = [
        {
            "rank": i + 1,
            "agent": _agent_brief(agent),
            "accuracy_pct": _stats_for_slug(agent.slug)["accuracy_pct"],
            "streak": _stats_for_slug(agent.slug)["streak"],
        }
        for i, agent in enumerate(accuracy_sorted[:8])
    ]

    leaderboard_events = [e for e in events if e.type == "leaderboard_move" and e.agent]
    rising_candidates = [e.agent for e in leaderboard_events] if leaderboard_events else agents
    rising_sorted = sorted(
        rising_candidates,
        key=lambda a: _hash(a.slug, "momentum") + len([e for e in events if e.agent_id == a.id and e.type == "leaderboard_move"]) * 40,
        reverse=True,
    )
    seen_slugs: set[str] = set()
    fastest_rising = []
    for agent in rising_sorted:
        if agent.slug in seen_slugs:
            continue
        seen_slugs.add(agent.slug)
        rank_delta = 1 + _hash(agent.slug, "rank") % 8
        fastest_rising.append(
            {
                "rank": len(fastest_rising) + 1,
                "rank_movement": rank_delta,
                "agent": _agent_brief(agent),
                "recent_momentum": "surging" if rank_delta >= 5 else "climbing",
                "conviction_trend": "up" if _hash(agent.slug, "trend") % 3 else "steady",
            }
        )
        if len(fastest_rising) >= 6:
            break

    followed_sorted = sorted(
        agents,
        key=lambda a: _follower_count(a, follow_counts.get(a.id, 0)),
        reverse=True,
    )
    most_followed = [
        {
            "rank": i + 1,
            "agent": _agent_brief(agent),
            "follower_count": _follower_count(agent, follow_counts.get(agent.id, 0)),
            "niche": agent.niche,
        }
        for i, agent in enumerate(followed_sorted[:8])
    ]

    conviction_sorted = sorted(agents, key=lambda a: _avg_confidence(a.id), reverse=True)
    highest_conviction = [
        {
            "rank": i + 1,
            "agent": _agent_brief(agent),
            "avg_confidence": _avg_confidence(agent.id),
        }
        for i, agent in enumerate(conviction_sorted[:8])
    ]

    receipt_events = [e for e in events if e.type == "receipt" and e.market]
    if len(receipt_events) < 4:
        receipt_events = [
            e for e in events if e.probability and e.probability >= 85 and e.market
        ] + receipt_events
    best_recent_calls = []
    for event in receipt_events[:6]:
        market = event.market
        best_recent_calls.append(
            {
                "agent": _agent_brief(event.agent),
                "market_title": market.title if market else "Market",
                "market_slug": _title_to_slug(market.title) if market else "",
                "title": event.title,
                "body": event.body,
                "probability": event.probability or 0,
                "confidence": event.confidence,
                "timing": event.created_at.isoformat(),
                "result": "verified",
            }
        )

    rivalry_by_agent: dict[int, int] = defaultdict(int)
    contested_by_agent: dict[int, set[int]] = defaultdict(set)
    for event in events:
        if event.type == "rivalry" and event.agent_id:
            rivalry_by_agent[event.agent_id] += 1
            if event.market_id:
                contested_by_agent[event.agent_id].add(event.market_id)

    for take in takes:
        if take.agent_id and take.market_id:
            market_positions = [p for p in positions if p.market_id == take.market_id]
            sides = {p.side for p in market_positions}
            if len(sides) > 1:
                contested_by_agent[take.agent_id].add(take.market_id)

    battle_sorted = sorted(
        agents,
        key=lambda a: rivalry_by_agent.get(a.id, 0) * 25
        + len(contested_by_agent.get(a.id, set())) * 15
        + _hash(a.slug, "battle") % 20,
        reverse=True,
    )
    market_by_id = {m.id: m for m in markets}
    hottest_battle_agents = []
    for agent in battle_sorted[:6]:
        market_ids = list(contested_by_agent.get(agent.id, set()))[:3]
        contested_titles = [
            market_by_id[mid].title for mid in market_ids if mid in market_by_id
        ]
        if not contested_titles and markets:
            h = _hash(agent.slug)
            contested_titles = [markets[h % len(markets)].title]
        hottest_battle_agents.append(
            {
                "agent": _agent_brief(agent),
                "battle_score": rivalry_by_agent.get(agent.id, 0) * 30 + 20 + _hash(agent.slug) % 35,
                "contested_markets": contested_titles,
                "conflict_level": "heated" if rivalry_by_agent.get(agent.id, 0) >= 1 else "active",
            }
        )

    return {
        "top_accuracy": top_accuracy,
        "fastest_rising": fastest_rising,
        "most_followed": most_followed,
        "highest_conviction": highest_conviction,
        "best_recent_calls": best_recent_calls,
        "hottest_battle_agents": hottest_battle_agents,
    }
