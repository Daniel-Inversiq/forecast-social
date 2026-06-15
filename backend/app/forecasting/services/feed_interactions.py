"""Feed event interactions — public back / challenge reads."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from fastapi import HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.forecasting.models import FeedEvent, FeedInteraction, User
from app.forecasting.services.conviction_ledger import get_or_create_balance
from app.forecasting.services.conviction_limits import open_user_exposure

MAX_THESIS_LENGTH = 500
MIN_CHALLENGE_THESIS = 12
InteractionType = Literal["back", "challenge"]
SideType = Literal["yes", "no"]


def _normalize_side(side: str | None) -> str | None:
    if side is None:
        return None
    s = side.strip().lower()
    if s in ("yes", "no"):
        return s
    raise HTTPException(status_code=400, detail="side must be yes or no")


def _validate_probability(probability: float | None, *, required: bool) -> float | None:
    if probability is None:
        if required:
            raise HTTPException(status_code=400, detail="user_probability is required")
        return None
    if not isinstance(probability, (int, float)):
        raise HTTPException(status_code=400, detail="user_probability must be a number")
    p = float(probability)
    if p < 1 or p > 99:
        raise HTTPException(status_code=400, detail="user_probability must be between 1 and 99")
    return round(p, 1)


def _validate_thesis(
    thesis_text: str | None,
    interaction_type: InteractionType,
) -> str | None:
    if thesis_text is None:
        if interaction_type == "challenge":
            raise HTTPException(status_code=400, detail="thesis_text is required for challenge")
        return None
    trimmed = thesis_text.strip()
    if interaction_type == "challenge":
        if len(trimmed) < MIN_CHALLENGE_THESIS:
            raise HTTPException(
                status_code=400,
                detail=f"thesis_text must be at least {MIN_CHALLENGE_THESIS} characters",
            )
    elif trimmed and len(trimmed) < 3:
        raise HTTPException(status_code=400, detail="note is too short")
    if len(trimmed) > MAX_THESIS_LENGTH:
        raise HTTPException(
            status_code=400,
            detail=f"thesis_text must be at most {MAX_THESIS_LENGTH} characters",
        )
    return trimmed or None


def _snapshots_for_user(db: Session, user: User) -> dict[str, Any]:
    exposure: float | None = None
    try:
        balance = get_or_create_balance(user.id, db)
        exposure = open_user_exposure(db, user.id)
        _ = balance  # future: surface balance in metadata
    except Exception:
        pass
    return {
        "reputation_snapshot": float(user.reputation_score or 0),
        "wallet_verified_snapshot": bool(user.wallet_verified),
        "conviction_exposure_snapshot": exposure,
    }


def interaction_to_payload(interaction: FeedInteraction) -> dict:
    user = interaction.user
    return {
        "id": interaction.id,
        "feed_event_id": interaction.feed_event_id,
        "interaction_type": interaction.interaction_type,
        "thesis_text": interaction.thesis_text,
        "user_probability": interaction.user_probability,
        "side": interaction.side,
        "status": interaction.status,
        "created_at": interaction.created_at.isoformat() if interaction.created_at else None,
        "updated_at": interaction.updated_at.isoformat() if interaction.updated_at else None,
        "user": {
            "id": user.id,
            "username": user.username,
            "avatar_color": user.avatar_color,
            "reputation_score": interaction.reputation_snapshot,
            "wallet_verified": interaction.wallet_verified_snapshot,
        },
    }


def get_feed_event_or_404(db: Session, event_id: int) -> FeedEvent:
    event = (
        db.query(FeedEvent)
        .options(joinedload(FeedEvent.market), joinedload(FeedEvent.agent))
        .filter(FeedEvent.id == event_id)
        .first()
    )
    if not event:
        raise HTTPException(status_code=404, detail="Feed event not found")
    return event


def get_interaction_or_404(db: Session, interaction_id: int) -> FeedInteraction:
    interaction = (
        db.query(FeedInteraction)
        .options(joinedload(FeedInteraction.user), joinedload(FeedInteraction.feed_event))
        .filter(FeedInteraction.id == interaction_id)
        .first()
    )
    if not interaction:
        raise HTTPException(status_code=404, detail="Interaction not found")
    return interaction


def upsert_interaction(
    db: Session,
    user: User,
    event: FeedEvent,
    *,
    interaction_type: InteractionType,
    thesis_text: str | None,
    user_probability: float | None,
    side: str | None,
) -> FeedInteraction:
    _validate_thesis(thesis_text, interaction_type)
    prob = _validate_probability(
        user_probability,
        required=interaction_type == "challenge",
    )
    normalized_side = _normalize_side(side)

    if interaction_type == "challenge" and event.market_id and normalized_side is None:
        pass  # side optional even with market

    existing = (
        db.query(FeedInteraction)
        .filter(
            FeedInteraction.user_id == user.id,
            FeedInteraction.feed_event_id == event.id,
        )
        .first()
    )

    snaps = _snapshots_for_user(db, user)
    meta: dict[str, Any] = {
        "feed_event_type": event.type,
        "agent_slug": event.agent.slug if event.agent else None,
        "market_id": event.market_id,
    }

    if existing:
        if existing.status == "removed":
            existing.status = "active"
        existing.interaction_type = interaction_type
        existing.thesis_text = thesis_text
        existing.user_probability = prob
        existing.side = normalized_side
        existing.reputation_snapshot = snaps["reputation_snapshot"]
        existing.wallet_verified_snapshot = snaps["wallet_verified_snapshot"]
        existing.conviction_exposure_snapshot = snaps["conviction_exposure_snapshot"]
        existing.metadata_json = {**(existing.metadata_json or {}), **meta}
        existing.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(existing)
        try:
            from app.forecasting.services.public_status_moments import evaluate_interaction_moments

            evaluate_interaction_moments(db, existing)
        except Exception:
            pass
        return existing

    interaction = FeedInteraction(
        feed_event_id=event.id,
        user_id=user.id,
        interaction_type=interaction_type,
        thesis_text=thesis_text,
        user_probability=prob,
        side=normalized_side,
        status="active",
        metadata_json=meta,
        **snaps,
    )
    db.add(interaction)
    db.commit()
    db.refresh(interaction)
    try:
        from app.forecasting.services.public_status_moments import evaluate_interaction_moments

        evaluate_interaction_moments(db, interaction)
    except Exception:
        pass
    return interaction


def soft_remove_interaction(db: Session, interaction: FeedInteraction) -> None:
    interaction.status = "removed"
    interaction.updated_at = datetime.utcnow()
    db.commit()


def _avg_probability(interactions: list[FeedInteraction]) -> float | None:
    probs = [i.user_probability for i in interactions if i.user_probability is not None]
    if not probs:
        return None
    return round(sum(probs) / len(probs), 1)


def _top_interaction(
    interactions: list[FeedInteraction],
    *,
    prefer_thesis: bool = False,
) -> FeedInteraction | None:
    if not interactions:
        return None
    if prefer_thesis:
        with_thesis = [i for i in interactions if i.thesis_text]
        pool = with_thesis or interactions
    else:
        pool = interactions
    return max(
        pool,
        key=lambda i: (
            len(i.thesis_text or ""),
            i.reputation_snapshot or 0,
            i.created_at or datetime.min,
        ),
    )


def build_event_interactions_response(
    db: Session,
    event_id: int,
    current_user: User | None,
) -> dict:
    rows = (
        db.query(FeedInteraction)
        .options(joinedload(FeedInteraction.user))
        .filter(
            FeedInteraction.feed_event_id == event_id,
            FeedInteraction.status == "active",
        )
        .order_by(FeedInteraction.created_at.desc())
        .all()
    )

    backs = [r for r in rows if r.interaction_type == "back"]
    challenges = [r for r in rows if r.interaction_type == "challenge"]

    user_interaction = None
    if current_user:
        mine = next((r for r in rows if r.user_id == current_user.id), None)
        if mine:
            user_interaction = interaction_to_payload(mine)

    top_challenge = _top_interaction(challenges, prefer_thesis=True)
    top_back = _top_interaction(backs, prefer_thesis=True)

    return {
        "backs": [interaction_to_payload(b) for b in backs[:20]],
        "challenges": [interaction_to_payload(c) for c in challenges[:20]],
        "counts": {
            "backs": len(backs),
            "challenges": len(challenges),
        },
        "avg_back_probability": _avg_probability(backs),
        "avg_challenge_probability": _avg_probability(challenges),
        "user_interaction": user_interaction,
        "top_challenge": interaction_to_payload(top_challenge) if top_challenge else None,
        "top_back": interaction_to_payload(top_back) if top_back else None,
    }


def interaction_summary_for_feed_card(
    db: Session,
    event_ids: list[int],
    current_user: User | None,
) -> dict[int, dict]:
    if not event_ids:
        return {}

    rows = (
        db.query(FeedInteraction)
        .options(joinedload(FeedInteraction.user))
        .filter(
            FeedInteraction.feed_event_id.in_(event_ids),
            FeedInteraction.status == "active",
        )
        .all()
    )

    by_event: dict[int, list[FeedInteraction]] = {}
    for row in rows:
        by_event.setdefault(row.feed_event_id, []).append(row)

    out: dict[int, dict] = {}
    for eid in event_ids:
        group = by_event.get(eid, [])
        backs = [g for g in group if g.interaction_type == "back"]
        challenges = [g for g in group if g.interaction_type == "challenge"]
        user_row = None
        if current_user:
            user_row = next((g for g in group if g.user_id == current_user.id), None)

        top_challenge = _top_interaction(challenges, prefer_thesis=True)
        top_back = _top_interaction(backs, prefer_thesis=True)

        out[eid] = {
            "counts": {"backs": len(backs), "challenges": len(challenges)},
            "avg_back_probability": _avg_probability(backs),
            "avg_challenge_probability": _avg_probability(challenges),
            "user_interaction": interaction_to_payload(user_row) if user_row else None,
            "top_challenge": interaction_to_payload(top_challenge) if top_challenge else None,
            "top_back": interaction_to_payload(top_back) if top_back else None,
        }
    return out


def user_interaction_history(
    db: Session,
    user_id: int,
    *,
    limit: int = 8,
) -> dict:
    rows = (
        db.query(FeedInteraction)
        .options(
            joinedload(FeedInteraction.feed_event).joinedload(FeedEvent.agent),
            joinedload(FeedInteraction.feed_event).joinedload(FeedEvent.market),
            joinedload(FeedInteraction.user),
        )
        .filter(
            FeedInteraction.user_id == user_id,
            FeedInteraction.status == "active",
        )
        .order_by(FeedInteraction.updated_at.desc())
        .limit(limit * 2)
        .all()
    )

    backs: list[dict] = []
    challenges: list[dict] = []
    for row in rows:
        event = row.feed_event
        if not event:
            continue
        item = {
            **interaction_to_payload(row),
            "feed_event": {
                "id": event.id,
                "type": event.type,
                "title": event.title,
                "agent_name": event.agent.name if event.agent else None,
                "agent_slug": event.agent.slug if event.agent else None,
                "market_title": event.market.title if event.market else None,
            },
        }
        if row.interaction_type == "back" and len(backs) < limit:
            backs.append(item)
        elif row.interaction_type == "challenge" and len(challenges) < limit:
            challenges.append(item)

    from app.forecasting.services.market_thread import user_thread_post_history

    thread_posts = user_thread_post_history(db, user_id, limit=limit)

    return {
        "recent_backs": backs[:limit],
        "recent_challenges": challenges[:limit],
        "recent_thread_posts": thread_posts,
        "back_count": (
            db.query(func.count(FeedInteraction.id))
            .filter(
                FeedInteraction.user_id == user_id,
                FeedInteraction.interaction_type == "back",
                FeedInteraction.status == "active",
            )
            .scalar()
            or 0
        ),
        "challenge_count": (
            db.query(func.count(FeedInteraction.id))
            .filter(
                FeedInteraction.user_id == user_id,
                FeedInteraction.interaction_type == "challenge",
                FeedInteraction.status == "active",
            )
            .scalar()
            or 0
        ),
    }


def interaction_notifications_for_user(db: Session, user: User, limit: int = 12) -> list[dict]:
    """Non-spammy alerts when someone takes the opposite read on your events."""
    mine = (
        db.query(FeedInteraction)
        .filter(
            FeedInteraction.user_id == user.id,
            FeedInteraction.status == "active",
        )
        .order_by(FeedInteraction.updated_at.desc())
        .limit(40)
        .all()
    )
    if not mine:
        return []

    event_ids = [m.feed_event_id for m in mine]
    my_by_event = {m.feed_event_id: m for m in mine}
    opposite_type = {"back": "challenge", "challenge": "back"}

    recent_opposite = (
        db.query(FeedInteraction)
        .options(joinedload(FeedInteraction.user), joinedload(FeedInteraction.feed_event))
        .filter(
            FeedInteraction.feed_event_id.in_(event_ids),
            FeedInteraction.status == "active",
            FeedInteraction.user_id != user.id,
        )
        .order_by(FeedInteraction.created_at.desc())
        .limit(50)
        .all()
    )

    notifications: list[dict] = []
    seen_events: set[int] = set()

    for opp in recent_opposite:
        mine_row = my_by_event.get(opp.feed_event_id)
        if not mine_row:
            continue
        expected = opposite_type.get(mine_row.interaction_type)
        if opp.interaction_type != expected:
            continue
        if opp.feed_event_id in seen_events:
            continue
        seen_events.add(opp.feed_event_id)

        event = opp.feed_event
        verb = "challenged" if opp.interaction_type == "challenge" else "backed"
        title = f"@{opp.user.username} {verb} your read"
        body = event.title if event else "Feed event"
        if opp.thesis_text:
            body = f"{body} — “{opp.thesis_text[:120]}”"

        notifications.append(
            {
                "type": f"interaction_{opp.interaction_type}",
                "title": title,
                "body": body,
                "timestamp": opp.created_at.isoformat() if opp.created_at else datetime.utcnow().isoformat(),
                "unread": len(notifications) < 3,
                "feed_event_id": opp.feed_event_id,
                "interaction_id": opp.id,
                "related_agent": event.agent.name if event and event.agent else None,
            }
        )
        if len(notifications) >= limit:
            break

    return notifications
