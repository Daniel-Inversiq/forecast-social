from datetime import datetime, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session, joinedload

from app.auth.dependencies import get_current_user, get_current_user_optional
from app.database import get_db
from app.forecasting.models import Agent, FeedEvent, Position, User
from app.forecasting.services.feed_interactions import interaction_notifications_for_user
from app.forecasting.services.market_thread import (
    thread_closed_notifications,
    thread_notifications_for_user,
)
from app.forecasting.services.public_status_moments import status_notifications_for_user
from app.forecasting.services.anchor_agent import anchor_notifications_for_user

router = APIRouter(tags=["notifications"])


def _hash(*parts) -> int:
    return sum(ord(c) for p in parts for c in str(p))


def _probability_change(seed: str, event_type: str) -> float | None:
    if event_type in ("receipt", "leaderboard_move"):
        return None
    h = _hash(seed, event_type)
    delta = (h % 17) - 8
    if delta == 0:
        delta = 3 if h % 2 else -2
    return float(delta)


def _from_feed_event(event: FeedEvent, index: int) -> dict:
    seed = f"{event.id}-{event.type}"
    market_title = event.market.title if event.market else None
    payload = {
        "type": event.type,
        "title": event.title,
        "body": event.body,
        "timestamp": event.created_at.isoformat() if event.created_at else datetime.utcnow().isoformat(),
        "unread": index < 4,
        "probability_change": _probability_change(seed, event.type),
        "related_market": market_title,
        "related_agent": event.agent.name if event.agent else None,
    }
    if event.type == "receipt" and event.id:
        short = (market_title or "your call")[:48]
        payload["title"] = f"Receipt verified: your call on {short} resolved in your favor."
        payload["body"] = "Public read verified. Receipt locked."
        payload["receipt_href"] = f"/receipts/receipt-event-{event.id}"
    return payload


def _from_position(position: Position, index: int) -> dict:
    market = position.market
    title = market.title if market else "Unknown market"
    prob = market.current_yes_probability if market else None
    delta = _probability_change(f"pos-{position.id}", "position_update")
    return {
        "type": "position_update",
        "title": f"Position update · {title}",
        "body": f"Your {position.side} conviction (${int(position.amount)}) is still live on {title}.",
        "timestamp": position.created_at.isoformat() if position.created_at else datetime.utcnow().isoformat(),
        "unread": index < 2,
        "probability_change": delta,
        "related_market": title,
        "related_agent": None,
    }


def _from_agent(agent: Agent, index: int) -> dict:
    h = _hash(agent.slug)
    rank_delta = 1 + h % 5
    return {
        "type": "leaderboard_move",
        "title": f"{agent.name} climbed the ranks",
        "body": f"Reputation up in {agent.niche} — now trending after a {3 + h % 10}-day streak.",
        "timestamp": (datetime.utcnow() - timedelta(hours=2 + index * 5)).isoformat(),
        "unread": index == 0,
        "probability_change": None,
        "related_market": None,
        "related_agent": agent.name,
    }


def _public_notifications(db: Session) -> list[dict]:
    events = (
        db.query(FeedEvent)
        .options(joinedload(FeedEvent.agent), joinedload(FeedEvent.market))
        .order_by(FeedEvent.created_at.desc())
        .all()
    )
    from app.forecasting.agent_status import active_agents_query

    agents = active_agents_query(db).order_by(Agent.name).limit(3).all()
    notifications: list[dict] = []
    notifications.extend(_from_feed_event(e, i) for i, e in enumerate(events))
    notifications.extend(_from_agent(a, i) for i, a in enumerate(agents))
    notifications.sort(key=lambda n: n["timestamp"], reverse=True)
    return notifications


def _personal_notifications(db: Session, current_user: User) -> list[dict]:
    positions = (
        db.query(Position)
        .options(joinedload(Position.market))
        .filter(Position.user_id == current_user.id)
        .order_by(Position.created_at.desc())
        .limit(6)
        .all()
    )
    notifications: list[dict] = []
    notifications.extend(_from_position(p, i) for i, p in enumerate(positions))
    notifications.extend(interaction_notifications_for_user(db, current_user))
    notifications.extend(thread_notifications_for_user(db, current_user))
    notifications.extend(thread_closed_notifications(db, current_user))
    notifications.extend(status_notifications_for_user(db, current_user))
    notifications.extend(anchor_notifications_for_user(db, current_user))
    notifications.sort(key=lambda n: n["timestamp"], reverse=True)
    return notifications


@router.get("/notifications")
def get_notifications(
    db: Session = Depends(get_db),
    _: User | None = Depends(get_current_user_optional),
):
    # Legacy endpoint kept for compatibility, now returns only public activity.
    return _public_notifications(db)


@router.get("/notifications/public")
def get_public_notifications(db: Session = Depends(get_db)):
    return _public_notifications(db)


@router.get("/notifications/personal")
def get_personal_notifications(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return _personal_notifications(db, current_user)
