"""Market discussion thread — one public thread per open market."""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any, Literal

from fastapi import HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.forecasting.market_resolution import is_market_resolved
from app.forecasting.models import (
    ConvictionPosition,
    FeedEvent,
    FeedInteraction,
    Market,
    MarketTake,
    MarketThreadPost,
    MarketWatch,
    Position,
    User,
)
from app.forecasting.services.conviction_limits import open_user_exposure
from app.settings import is_dev_environment

MIN_BODY_LENGTH = 8
MAX_BODY_LENGTH = 800
POST_TYPES = frozenset({"thesis", "counter-thesis", "update", "evidence", "question"})
STANCES = frozenset({"yes", "no", "neutral"})
PostType = Literal["thesis", "counter-thesis", "update", "evidence", "question"]
Stance = Literal["yes", "no", "neutral"]


def _snapshots_for_user(db: Session, user: User) -> dict[str, Any]:
    exposure: float | None = None
    try:
        exposure = open_user_exposure(db, user.id)
    except Exception:
        pass
    return {
        "reputation_snapshot": float(user.reputation_score or 0),
        "wallet_verified_snapshot": bool(user.wallet_verified),
        "conviction_exposure_snapshot": exposure,
    }


def post_to_payload(post: MarketThreadPost) -> dict:
    user = post.user
    return {
        "id": post.id,
        "market_id": post.market_id,
        "body": post.body,
        "stance": post.stance,
        "user_probability": post.user_probability,
        "post_type": post.post_type,
        "status": post.status,
        "created_at": post.created_at.isoformat() if post.created_at else None,
        "updated_at": post.updated_at.isoformat() if post.updated_at else None,
        "user": {
            "id": user.id,
            "username": user.username,
            "avatar_color": user.avatar_color,
            "reputation_score": post.reputation_snapshot,
            "wallet_verified": post.wallet_verified_snapshot,
        },
    }


def user_can_post_to_thread(db: Session, user: User, market: Market) -> bool:
    if is_market_resolved(market) or market.status != "open":
        return False
    if is_dev_environment():
        return True

    if (
        db.query(ConvictionPosition.id)
        .filter(
            ConvictionPosition.user_id == user.id,
            ConvictionPosition.market_id == market.id,
            ConvictionPosition.status == "open",
        )
        .first()
    ):
        return True

    if (
        db.query(Position.id)
        .filter(Position.user_id == user.id, Position.market_id == market.id)
        .first()
    ):
        return True

    if (
        db.query(MarketTake.id)
        .filter(MarketTake.user_id == user.id, MarketTake.market_id == market.id)
        .first()
    ):
        return True

    if (
        db.query(MarketWatch.id)
        .filter(MarketWatch.user_id == user.id, MarketWatch.market_id == market.id)
        .first()
    ):
        return True

    event_ids = [
        row[0]
        for row in db.query(FeedEvent.id).filter(FeedEvent.market_id == market.id).all()
    ]
    if event_ids and (
        db.query(FeedInteraction.id)
        .filter(
            FeedInteraction.user_id == user.id,
            FeedInteraction.feed_event_id.in_(event_ids),
            FeedInteraction.status == "active",
        )
        .first()
    ):
        return True

    return False


def ensure_market_watch(db: Session, user_id: int, market_id: int) -> None:
    existing = (
        db.query(MarketWatch)
        .filter(MarketWatch.user_id == user_id, MarketWatch.market_id == market_id)
        .first()
    )
    if existing:
        return
    db.add(MarketWatch(user_id=user_id, market_id=market_id))
    db.commit()


def _validate_body(body: str) -> str:
    trimmed = body.strip()
    if len(trimmed) < MIN_BODY_LENGTH:
        raise HTTPException(
            status_code=400,
            detail=f"body must be at least {MIN_BODY_LENGTH} characters",
        )
    if len(trimmed) > MAX_BODY_LENGTH:
        raise HTTPException(
            status_code=400,
            detail=f"body must be at most {MAX_BODY_LENGTH} characters",
        )
    return trimmed


def _validate_stance(stance: str) -> str:
    s = stance.strip().lower()
    if s not in STANCES:
        raise HTTPException(status_code=400, detail="stance must be yes, no, or neutral")
    return s


def _validate_post_type(post_type: str) -> str:
    pt = post_type.strip().lower()
    if pt not in POST_TYPES:
        raise HTTPException(status_code=400, detail="invalid post_type")
    return pt


def _validate_probability(probability: float | None) -> float | None:
    if probability is None:
        return None
    p = float(probability)
    if p < 1 or p > 99:
        raise HTTPException(status_code=400, detail="user_probability must be between 1 and 99")
    return round(p, 1)


def build_thread_response(
    db: Session,
    market: Market,
    current_user: User | None,
    *,
    limit: int = 40,
) -> dict:
    archived = is_market_resolved(market) or market.status != "open"
    posts = (
        db.query(MarketThreadPost)
        .options(joinedload(MarketThreadPost.user))
        .filter(
            MarketThreadPost.market_id == market.id,
            MarketThreadPost.status == "active",
        )
        .order_by(MarketThreadPost.created_at.desc())
        .limit(limit)
        .all()
    )

    can_post = bool(current_user and user_can_post_to_thread(db, current_user, market))
    post_count = (
        db.query(func.count(MarketThreadPost.id))
        .filter(
            MarketThreadPost.market_id == market.id,
            MarketThreadPost.status == "active",
        )
        .scalar()
        or 0
    )

    return {
        "market_id": market.id,
        "archived": archived,
        "resolved_at": market.resolved_at.isoformat() if market.resolved_at else None,
        "post_count": post_count,
        "can_post": can_post and not archived,
        "posts": [post_to_payload(p) for p in posts],
        "highlights": _thread_highlights(posts),
    }


def _thread_highlights(posts: list[MarketThreadPost]) -> dict:
    if not posts:
        return {"top_thesis": None, "top_counter": None}
    thesis_pool = [p for p in posts if p.post_type in ("thesis", "update", "evidence")]
    counter_pool = [p for p in posts if p.post_type in ("counter-thesis", "question")]

    def pick(pool: list[MarketThreadPost]) -> MarketThreadPost | None:
        if not pool:
            return None
        return max(
            pool,
            key=lambda p: (
                len(p.body),
                p.reputation_snapshot or 0,
                p.created_at or datetime.min,
            ),
        )

    top_thesis = pick(thesis_pool) or pick(posts)
    top_counter = pick(counter_pool)
    return {
        "top_thesis": post_to_payload(top_thesis) if top_thesis else None,
        "top_counter": post_to_payload(top_counter) if top_counter else None,
    }


def create_thread_post(
    db: Session,
    user: User,
    market: Market,
    *,
    body: str,
    stance: str,
    post_type: str,
    user_probability: float | None,
) -> MarketThreadPost:
    if is_market_resolved(market) or market.status != "open":
        raise HTTPException(status_code=403, detail="Thread is archived — market resolved")

    if not user_can_post_to_thread(db, user, market):
        raise HTTPException(
            status_code=403,
            detail="Post requires conviction on this market, a watch, or feed engagement",
        )

    trimmed = _validate_body(body)
    stance_norm = _validate_stance(stance)
    type_norm = _validate_post_type(post_type)
    prob = _validate_probability(user_probability)

    ensure_market_watch(db, user.id, market.id)

    post = MarketThreadPost(
        market_id=market.id,
        user_id=user.id,
        body=trimmed,
        stance=stance_norm,
        post_type=type_norm,
        user_probability=prob,
        status="active",
        metadata_json={"market_status": market.status},
        **_snapshots_for_user(db, user),
    )
    db.add(post)
    db.commit()
    db.refresh(post)

    row = (
        db.query(MarketThreadPost)
        .options(joinedload(MarketThreadPost.user))
        .filter(MarketThreadPost.id == post.id)
        .first()
    )
    try:
        from app.forecasting.services.public_status_moments import refresh_thread_moments_for_market

        refresh_thread_moments_for_market(db, market.id)
    except Exception:
        pass
    return row  # type: ignore[return-value]


def update_thread_post(
    db: Session,
    post: MarketThreadPost,
    user: User,
    *,
    body: str | None,
    stance: str | None,
    post_type: str | None,
    user_probability: float | None,
) -> MarketThreadPost:
    market = db.query(Market).filter(Market.id == post.market_id).first()
    if not market or is_market_resolved(market) or market.status != "open":
        raise HTTPException(status_code=403, detail="Thread is read-only")

    if post.user_id != user.id:
        raise HTTPException(status_code=403, detail="Not your post")

    if body is not None:
        post.body = _validate_body(body)
    if stance is not None:
        post.stance = _validate_stance(stance)
    if post_type is not None:
        post.post_type = _validate_post_type(post_type)
    if user_probability is not None:
        post.user_probability = _validate_probability(user_probability)

    post.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(post)
    return post


def soft_remove_thread_post(db: Session, post: MarketThreadPost) -> None:
    post.status = "removed"
    post.updated_at = datetime.utcnow()
    db.commit()


def user_thread_post_history(db: Session, user_id: int, *, limit: int = 6) -> list[dict]:
    rows = (
        db.query(MarketThreadPost)
        .options(joinedload(MarketThreadPost.user), joinedload(MarketThreadPost.market))
        .filter(
            MarketThreadPost.user_id == user_id,
            MarketThreadPost.status == "active",
        )
        .order_by(MarketThreadPost.created_at.desc())
        .limit(limit)
        .all()
    )
    out: list[dict] = []
    for row in rows:
        item = post_to_payload(row)
        if row.market:
            item["market"] = {
                "id": row.market.id,
                "title": row.market.title,
                "status": row.market.status,
            }
        out.append(item)
    return out


def thread_notifications_for_user(db: Session, user: User, limit: int = 8) -> list[dict]:
    """Notify when someone posts in a watched market or market with open exposure."""
    watched_ids = [
        w.market_id
        for w in db.query(MarketWatch.market_id)
        .filter(MarketWatch.user_id == user.id)
        .all()
    ]
    exposure_ids = [
        p.market_id
        for p in db.query(ConvictionPosition.market_id)
        .filter(
            ConvictionPosition.user_id == user.id,
            ConvictionPosition.status == "open",
        )
        .all()
    ]
    market_ids = list(set(watched_ids + exposure_ids))
    if not market_ids:
        return []

    since = datetime.utcnow() - timedelta(hours=48)
    recent = (
        db.query(MarketThreadPost)
        .options(joinedload(MarketThreadPost.user), joinedload(MarketThreadPost.market))
        .filter(
            MarketThreadPost.market_id.in_(market_ids),
            MarketThreadPost.status == "active",
            MarketThreadPost.user_id != user.id,
            MarketThreadPost.created_at >= since,
        )
        .order_by(MarketThreadPost.created_at.desc())
        .limit(limit * 2)
        .all()
    )

    notifications: list[dict] = []
    seen_markets: set[int] = set()
    for post in recent:
        if post.market_id in seen_markets:
            continue
        seen_markets.add(post.market_id)
        market = post.market
        notifications.append(
            {
                "type": "market_thread_post",
                "title": f"@{post.user.username} posted in market thread",
                "body": (market.title if market else "Market") + f" — {post.body[:100]}",
                "timestamp": post.created_at.isoformat() if post.created_at else datetime.utcnow().isoformat(),
                "unread": len(notifications) < 2,
                "market_id": post.market_id,
                "post_id": post.id,
                "related_market": market.title if market else None,
            }
        )
        if len(notifications) >= limit:
            break
    return notifications


def thread_closed_notifications(db: Session, user: User, limit: int = 4) -> list[dict]:
    """Markets user watched that resolved recently."""
    watched = (
        db.query(MarketWatch)
        .options(joinedload(MarketWatch.market))
        .filter(MarketWatch.user_id == user.id)
        .all()
    )
    out: list[dict] = []
    for watch in watched:
        market = watch.market
        if not market or not is_market_resolved(market):
            continue
        if not market.resolved_at:
            continue
        if market.resolved_at < datetime.utcnow() - timedelta(days=7):
            continue
        out.append(
            {
                "type": "market_thread_closed",
                "title": "Thread archived at resolution",
                "body": f"{market.title} — discussion is now read-only.",
                "timestamp": market.resolved_at.isoformat(),
                "unread": len(out) == 0,
                "market_id": market.id,
                "related_market": market.title,
            }
        )
        if len(out) >= limit:
            break
    return out
