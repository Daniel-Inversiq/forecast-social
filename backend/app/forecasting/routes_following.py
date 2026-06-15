from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session, joinedload

from app.auth.dependencies import get_current_user_optional
from app.database import get_db
from app.forecasting.agent_status import agent_status_payload, query_active_agents
from app.forecasting.follows import followed_agent_ids
from app.forecasting.models import User
from app.forecasting.models import Agent, FeedEvent, Follow, Market, MarketTake
from app.forecasting.services.feed_timing import iso_utc, timing_fields_for_event

router = APIRouter(tags=["following"])

SUGGESTED_LIMIT = 6


def _agent_row(agent: Agent) -> dict:
    return {
        "name": agent.name,
        "slug": agent.slug,
        "niche": agent.niche,
        "avatar_color": agent.avatar_color,
        **agent_status_payload(agent),
    }


def _event_payload(event: FeedEvent) -> dict:
    return {
        "type": event.type,
        "agent": {
            "name": event.agent.name,
            "slug": event.agent.slug,
        },
        "title": event.title,
        "body": event.body,
        "probability": event.probability,
        "confidence": event.confidence,
        "created_at": iso_utc(event.created_at),
        **timing_fields_for_event(event),
        "market_title": event.market.title if event.market else None,
    }


def _take_payload(take: MarketTake) -> dict:
    agent = take.agent
    return {
        "id": take.id,
        "author_name": take.author_name,
        "author_slug": take.author_slug,
        "side": take.side,
        "confidence": take.confidence,
        "body": take.body,
        "created_at": take.created_at.isoformat(),
        "avatar_color": agent.avatar_color if agent else None,
        "market_title": take.market.title,
        "agent": (
            {"name": agent.name, "slug": agent.slug}
            if agent
            else {"name": take.author_name, "slug": take.author_slug}
        ),
    }


def _suggested_agents(db: Session, exclude_ids: set[int]) -> list[dict]:
    q = query_active_agents(db, order_by_name=True)
    if exclude_ids:
        q = [a for a in q if a.id not in exclude_ids]
    agents = q[:SUGGESTED_LIMIT]
    return [_agent_row(agent) for agent in agents]


@router.get("/following/feed")
def get_following_feed(
    current_user: User | None = Depends(get_current_user_optional),
    db: Session = Depends(get_db),
):
    followed_ids = followed_agent_ids(current_user, db)

    if not followed_ids:
        return {
            "followed_agents": [],
            "feed_events": [],
            "new_takes": [],
            "moved_markets": [],
            "suggested_agents": _suggested_agents(db, exclude_ids=set()),
        }

    follows = (
        db.query(Follow)
        .options(joinedload(Follow.agent))
        .filter(
            Follow.follower_user_id == current_user.id,
            Follow.agent_id.in_(followed_ids),
        )
        .order_by(Follow.created_at.desc())
        .all()
    )
    followed_agents = [_agent_row(follow.agent) for follow in follows]

    feed_events = (
        db.query(FeedEvent)
        .options(joinedload(FeedEvent.agent), joinedload(FeedEvent.market))
        .filter(FeedEvent.agent_id.in_(followed_ids))
        .order_by(FeedEvent.created_at.desc())
        .limit(24)
        .all()
    )

    new_takes = (
        db.query(MarketTake)
        .options(
            joinedload(MarketTake.agent),
            joinedload(MarketTake.market),
        )
        .filter(MarketTake.agent_id.in_(followed_ids))
        .order_by(MarketTake.created_at.desc())
        .limit(12)
        .all()
    )

    move_events = (
        db.query(FeedEvent)
        .options(joinedload(FeedEvent.agent), joinedload(FeedEvent.market))
        .filter(
            FeedEvent.agent_id.in_(followed_ids),
            FeedEvent.market_id.isnot(None),
        )
        .order_by(FeedEvent.created_at.desc())
        .all()
    )
    seen_markets: set[int] = set()
    moved_markets: list[dict] = []
    for event in move_events:
        if not event.market or event.market_id in seen_markets:
            continue
        seen_markets.add(event.market_id)
        market = event.market
        moved_markets.append(
            {
                "title": market.title,
                "category": market.category,
                "current_yes_probability": market.current_yes_probability,
                "agent_name": event.agent.name,
                "agent_slug": event.agent.slug,
                "recent_move": event.title,
                "created_at": event.created_at.isoformat(),
            }
        )
        if len(moved_markets) >= 8:
            break

    return {
        "followed_agents": followed_agents,
        "feed_events": [_event_payload(e) for e in feed_events],
        "new_takes": [_take_payload(t) for t in new_takes],
        "moved_markets": moved_markets,
        "suggested_agents": [],
    }
