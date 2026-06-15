"""Public status moments — reputation-as-social-status tied to stored user actions."""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any

from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.forecasting.models import (
    ConvictionPosition,
    FeedEvent,
    FeedInteraction,
    Market,
    MarketThreadPost,
    PublicStatusMoment,
    User,
)
from app.forecasting.services.feed_timing import iso_utc
from app.forecasting.services.utils import title_to_slug

STATUS_LABELS: dict[str, str] = {
    "early_call": "Early",
    "consensus_breaker": "Consensus breaker",
    "challenge_validated": "Challenge validated",
    "called_it": "Called it",
    "isolated_validated": "Isolated but right",
    "public_read": "Public read",
    "read_visibility": "Public read",
    "conviction_resolved": "High conviction",
}

MIN_FEED_SIGNIFICANCE = 0.55
FEED_INJECT_INTERVAL = 11
MAX_FEED_INJECTIONS = 1


def _days_between(earlier: datetime, later: datetime) -> int:
    if not earlier or not later:
        return 0
    return max(0, (later - earlier).days)


def _side_from_interaction(interaction: FeedInteraction, event: FeedEvent) -> str | None:
    if interaction.side in ("yes", "no"):
        return interaction.side.upper()
    if event.probability is not None:
        return "YES" if event.probability >= 50 else "NO"
    return None


def _minority_side(market: Market | None, side: str) -> bool:
    if not market or not side:
        return False
    prob = market.current_yes_probability
    if side == "YES":
        return prob < 42
    return prob > 58


def _prob_moved_toward(
    interaction: FeedInteraction,
    market: Market,
    side: str,
    delta: float,
) -> bool:
    """True when market probability moved toward the user's side since the interaction."""
    if market.status == "resolved" and market.resolved_outcome:
        outcome = market.resolved_outcome.upper()
        return (side == "YES" and outcome == "YES") or (side == "NO" and outcome == "NO")
    if interaction.user_probability is not None:
        current = market.current_yes_probability
        prior = float(interaction.user_probability)
        if side == "YES":
            return current - prior >= delta
        return prior - current >= delta
    return False


def _visibility_block(
    db: Session,
    *,
    feed_event_id: int | None = None,
    market_id: int | None = None,
) -> dict[str, Any]:
    visibility: dict[str, Any] = {"feed_exposure_label": "Visible in the public feed"}
    if feed_event_id:
        counts = (
            db.query(
                FeedInteraction.interaction_type,
                func.count(FeedInteraction.id),
            )
            .filter(
                FeedInteraction.feed_event_id == feed_event_id,
                FeedInteraction.status == "active",
            )
            .group_by(FeedInteraction.interaction_type)
            .all()
        )
        by_type = {t: c for t, c in counts}
        backs = by_type.get("back", 0)
        challenges = by_type.get("challenge", 0)
        if backs or challenges:
            visibility["interaction_backs"] = backs
            visibility["interaction_challenges"] = challenges
            visibility.pop("feed_exposure_label", None)
    if market_id:
        thread_count = (
            db.query(func.count(MarketThreadPost.id))
            .filter(
                MarketThreadPost.market_id == market_id,
                MarketThreadPost.status == "active",
            )
            .scalar()
            or 0
        )
        if thread_count > 1:
            visibility["thread_activity"] = thread_count
    return visibility


def persist_moment(
    db: Session,
    *,
    user_id: int,
    status_type: str,
    headline: str,
    body: str | None = None,
    source_type: str,
    source_id: int,
    market_id: int | None = None,
    feed_event_id: int | None = None,
    receipt_ref: str | None = None,
    significance_score: float = 0.5,
    metadata: dict | None = None,
    validated_at: datetime | None = None,
    feed_visible: bool | None = None,
) -> PublicStatusMoment | None:
    if significance_score < 0.4:
        return None

    existing = (
        db.query(PublicStatusMoment)
        .filter(
            PublicStatusMoment.user_id == user_id,
            PublicStatusMoment.status_type == status_type,
            PublicStatusMoment.source_type == source_type,
            PublicStatusMoment.source_id == source_id,
        )
        .first()
    )
    if existing:
        if significance_score > existing.significance_score:
            existing.significance_score = significance_score
            existing.headline = headline
            existing.body = body
            existing.metadata_json = {**(existing.metadata_json or {}), **(metadata or {})}
            existing.validated_at = validated_at or existing.validated_at
            db.commit()
        return existing

    label = STATUS_LABELS.get(status_type, status_type.replace("_", " ").title())
    visible = feed_visible if feed_visible is not None else significance_score >= MIN_FEED_SIGNIFICANCE

    moment = PublicStatusMoment(
        user_id=user_id,
        status_type=status_type,
        label=label,
        headline=headline,
        body=body,
        source_type=source_type,
        source_id=source_id,
        market_id=market_id,
        feed_event_id=feed_event_id,
        receipt_ref=receipt_ref,
        significance_score=significance_score,
        feed_visible=visible,
        metadata_json=metadata or {},
        validated_at=validated_at or datetime.utcnow(),
    )
    db.add(moment)
    try:
        db.commit()
        db.refresh(moment)
        return moment
    except Exception:
        db.rollback()
        return None


def evaluate_interaction_moments(db: Session, interaction: FeedInteraction) -> list[PublicStatusMoment]:
    """Detect status moments from a feed interaction."""
    if interaction.status != "active":
        return []

    event = (
        db.query(FeedEvent)
        .options(joinedload(FeedEvent.agent), joinedload(FeedEvent.market))
        .filter(FeedEvent.id == interaction.feed_event_id)
        .first()
    )
    if not event:
        return []

    user = db.query(User).filter(User.id == interaction.user_id).first()
    if not user:
        return []

    created: list[PublicStatusMoment] = []
    market = event.market
    agent_name = event.agent.name if event.agent else "the feed"
    side = _side_from_interaction(interaction, event)
    visibility = _visibility_block(db, feed_event_id=event.id, market_id=event.market_id)

    # Opposite reads on your interaction → read visibility (for future, scan others)
    opposite_count = (
        db.query(func.count(FeedInteraction.id))
        .filter(
            FeedInteraction.feed_event_id == event.id,
            FeedInteraction.status == "active",
            FeedInteraction.user_id != user.id,
        )
        .scalar()
        or 0
    )

    if interaction.interaction_type == "back" and market:
        shift = (
            db.query(FeedEvent)
            .filter(
                FeedEvent.market_id == market.id,
                FeedEvent.type == "consensus_shift",
                FeedEvent.created_at > interaction.created_at,
            )
            .order_by(FeedEvent.created_at.asc())
            .first()
        )
        if shift:
            days = _days_between(interaction.created_at, shift.created_at)
            if days >= 3:
                sig = min(1.0, 0.5 + days / 40)
                headline = f"@{user.username} called {market.title[:48]} {days}d early."
                m = persist_moment(
                    db,
                    user_id=user.id,
                    status_type="early_call",
                    headline=headline,
                    body=f"You were early — backed before consensus moved on {market.title}.",
                    source_type="feed_interaction",
                    source_id=interaction.id,
                    market_id=market.id,
                    feed_event_id=event.id,
                    significance_score=sig,
                    metadata={**visibility, "days_early": days, "agent_name": agent_name},
                    validated_at=shift.created_at,
                )
                if m:
                    created.append(m)

        if side and _minority_side(market, side):
            if _prob_moved_toward(interaction, market, side, 8):
                headline = f"@{user.username} was isolated on {side} — now the market is moving toward them."
                m = persist_moment(
                    db,
                    user_id=user.id,
                    status_type="isolated_validated",
                    headline=headline,
                    body="You challenged consensus before the crowd followed.",
                    source_type="feed_interaction",
                    source_id=interaction.id,
                    market_id=market.id,
                    feed_event_id=event.id,
                    significance_score=0.72,
                    metadata={**visibility, "side": side},
                )
                if m:
                    created.append(m)

    if interaction.interaction_type == "challenge":
        shift = (
            db.query(FeedEvent)
            .filter(
                FeedEvent.market_id == event.market_id,
                FeedEvent.type.in_(("consensus_shift", "confidence_shift")),
                FeedEvent.created_at > interaction.created_at,
            )
            .order_by(FeedEvent.created_at.asc())
            .first()
        ) if event.market_id else None

        if shift and event.agent:
            days = _days_between(interaction.created_at, shift.created_at)
            sig = min(1.0, 0.55 + days / 35)
            headline = f"@{user.username} challenged {agent_name} before consensus moved."
            m = persist_moment(
                db,
                user_id=user.id,
                status_type="consensus_breaker",
                headline=headline,
                body="You challenged consensus.",
                source_type="feed_interaction",
                source_id=interaction.id,
                market_id=event.market_id,
                feed_event_id=event.id,
                significance_score=sig,
                metadata={**visibility, "days_early": days, "agent_name": agent_name},
                validated_at=shift.created_at,
            )
            if m:
                created.append(m)

        challenge_count = (
            db.query(func.count(FeedInteraction.id))
            .filter(
                FeedInteraction.feed_event_id == event.id,
                FeedInteraction.interaction_type == "challenge",
                FeedInteraction.status == "active",
            )
            .scalar()
            or 0
        )
        if challenge_count >= 2:
            m = persist_moment(
                db,
                user_id=user.id,
                status_type="challenge_validated",
                headline=f"@{user.username}'s challenge is gaining support.",
                body="Your challenge gained support on the public feed.",
                source_type="feed_interaction",
                source_id=interaction.id,
                market_id=event.market_id,
                feed_event_id=event.id,
                significance_score=0.58 + min(0.2, challenge_count * 0.05),
                metadata={**visibility, "challenge_count": challenge_count},
            )
            if m:
                created.append(m)

    if opposite_count >= 1:
        m = persist_moment(
            db,
            user_id=user.id,
            status_type="read_visibility",
            headline=f"@{user.username}'s read is gaining visibility.",
            body="Your read is part of the public record.",
            source_type="feed_interaction",
            source_id=interaction.id,
            market_id=event.market_id,
            feed_event_id=event.id,
            significance_score=0.52 + min(0.25, opposite_count * 0.08),
            metadata={**visibility, "opposite_reads": opposite_count},
        )
        if m:
            created.append(m)

    return created


def evaluate_thread_post_moment(db: Session, post: MarketThreadPost) -> PublicStatusMoment | None:
    if post.status != "active" or post.post_type not in ("thesis", "counter-thesis"):
        return None

    user = db.query(User).filter(User.id == post.user_id).first()
    market = db.query(Market).filter(Market.id == post.market_id).first()
    if not user or not market:
        return None

    other_posts = (
        db.query(func.count(MarketThreadPost.id))
        .filter(
            MarketThreadPost.market_id == post.market_id,
            MarketThreadPost.id != post.id,
            MarketThreadPost.status == "active",
            MarketThreadPost.created_at > post.created_at,
        )
        .scalar()
        or 0
    )
    visibility = _visibility_block(db, market_id=post.market_id)
    if other_posts < 1:
        return None

    sig = 0.55 + min(0.3, other_posts * 0.06)
    headline = f"@{user.username} posted a high-signal read on {market.title[:40]}."
    return persist_moment(
        db,
        user_id=user.id,
        status_type="public_read",
        headline=headline,
        body=post.body[:200] if post.body else None,
        source_type="market_thread_post",
        source_id=post.id,
        market_id=market.id,
        significance_score=sig,
        metadata={**visibility, "thread_replies_after": other_posts, "stance": post.stance},
    )


def refresh_thread_moments_for_market(db: Session, market_id: int) -> None:
    """Re-evaluate thesis posts when thread activity increases."""
    posts = (
        db.query(MarketThreadPost)
        .filter(
            MarketThreadPost.market_id == market_id,
            MarketThreadPost.status == "active",
            MarketThreadPost.post_type.in_(("thesis", "counter-thesis")),
        )
        .order_by(MarketThreadPost.created_at.asc())
        .all()
    )
    for post in posts:
        evaluate_thread_post_moment(db, post)


def evaluate_conviction_resolution_moments(
    db: Session,
    market: Market,
    position: ConvictionPosition,
) -> list[PublicStatusMoment]:
    if position.status != "won":
        return []

    user = db.query(User).filter(User.id == position.user_id).first()
    if not user:
        return []

    created: list[PublicStatusMoment] = []
    days = _days_between(position.opened_at, position.resolved_at or datetime.utcnow())
    slug = title_to_slug(market.title)
    receipt_ref = f"/receipts/receipt-position-{position.id}"
    visibility = _visibility_block(db, market_id=market.id)
    sig = 0.65 + min(0.25, days / 30) + (0.1 if (position.amount or 0) >= 50 else 0)

    headline = f"@{user.username} called it — {position.side} on {market.title[:36]}."
    m1 = persist_moment(
        db,
        user_id=user.id,
        status_type="called_it",
        headline=headline,
        body="Your position resolved correctly.",
        source_type="conviction_position",
        source_id=position.id,
        market_id=market.id,
        receipt_ref=receipt_ref,
        significance_score=sig,
        metadata={**visibility, "days_early": days, "side": position.side, "amount": position.amount},
        validated_at=position.resolved_at,
    )
    if m1:
        created.append(m1)

    if (position.amount or 0) >= 25:
        m2 = persist_moment(
            db,
            user_id=user.id,
            status_type="conviction_resolved",
            headline=f"@{user.username}'s conviction position resolved in a resolving story.",
            body=f"High conviction {position.side} — ${int(position.amount)} resolved correctly.",
            source_type="conviction_position",
            source_id=position.id,
            market_id=market.id,
            receipt_ref=receipt_ref,
            significance_score=sig + 0.05,
            metadata={**visibility, "side": position.side, "amount": position.amount},
            validated_at=position.resolved_at,
        )
        if m2:
            created.append(m2)

    return created


def scan_recent_status_moments(db: Session, *, lookback_days: int = 90) -> int:
    """Idempotent backfill — evaluate recent user actions for status moments."""
    cutoff = datetime.utcnow() - timedelta(days=lookback_days)
    created = 0

    interactions = (
        db.query(FeedInteraction)
        .filter(
            FeedInteraction.status == "active",
            FeedInteraction.created_at >= cutoff,
        )
        .order_by(FeedInteraction.created_at.desc())
        .limit(200)
        .all()
    )
    for row in interactions:
        before = db.query(func.count(PublicStatusMoment.id)).scalar() or 0
        evaluate_interaction_moments(db, row)
        after = db.query(func.count(PublicStatusMoment.id)).scalar() or 0
        if after > before:
            created += after - before

    posts = (
        db.query(MarketThreadPost)
        .filter(
            MarketThreadPost.status == "active",
            MarketThreadPost.created_at >= cutoff,
        )
        .order_by(MarketThreadPost.created_at.desc())
        .limit(100)
        .all()
    )
    for post in posts:
        before = db.query(func.count(PublicStatusMoment.id)).scalar() or 0
        evaluate_thread_post_moment(db, post)
        after = db.query(func.count(PublicStatusMoment.id)).scalar() or 0
        if after > before:
            created += after - before

    positions = (
        db.query(ConvictionPosition)
        .filter(
            ConvictionPosition.status == "won",
            ConvictionPosition.resolved_at >= cutoff,
        )
        .limit(80)
        .all()
    )
    for pos in positions:
        market = db.query(Market).filter(Market.id == pos.market_id).first()
        if market:
            before = db.query(func.count(PublicStatusMoment.id)).scalar() or 0
            evaluate_conviction_resolution_moments(db, market, pos)
            after = db.query(func.count(PublicStatusMoment.id)).scalar() or 0
            if after > before:
                created += after - before

    return created


def moment_to_feed_payload(moment: PublicStatusMoment, db: Session) -> dict:
    user = moment.user or db.query(User).filter(User.id == moment.user_id).first()
    market = moment.market
    meta = moment.metadata_json or {}
    visibility = {k: v for k, v in meta.items() if k.startswith(("interaction_", "thread_", "opposite_", "feed_exposure"))}

    return {
        "id": f"status-{moment.id}",
        "type": "public_status",
        "agent": {
            "name": user.username if user else "Forecaster",
            "slug": user.username if user else "user",
            "avatar_color": user.avatar_color if user else "#7c3aed",
            "niche": "Public read",
        },
        "status_moment": {
            "id": moment.id,
            "status_type": moment.status_type,
            "label": moment.label,
            "headline": moment.headline,
            "body": moment.body,
            "username": user.username if user else None,
            "avatar_color": user.avatar_color if user else None,
            "market_title": market.title if market else None,
            "market_slug": title_to_slug(market.title) if market else None,
            "receipt_href": moment.receipt_ref,
            "visibility": visibility,
            "days_early": meta.get("days_early"),
            "source_type": moment.source_type,
            "source_id": moment.source_id,
        },
        "title": moment.headline,
        "body": moment.body or "",
        "created_at": iso_utc(moment.validated_at or moment.created_at),
        "live": True,
        "importance_tier": "major" if moment.significance_score >= 0.75 else "medium",
        "intelligence_tags": ["public-status", moment.label.lower()],
        "personalization_reason": "Public status moment",
    }


def status_moments_for_feed(
    db: Session,
    user: User | None,
    *,
    limit: int = 6,
) -> list[dict]:
    scan_recent_status_moments(db)

    q = (
        db.query(PublicStatusMoment)
        .options(
            joinedload(PublicStatusMoment.user),
            joinedload(PublicStatusMoment.market),
        )
        .filter(
            PublicStatusMoment.feed_visible.is_(True),
            PublicStatusMoment.significance_score >= MIN_FEED_SIGNIFICANCE,
        )
        .order_by(PublicStatusMoment.validated_at.desc(), PublicStatusMoment.created_at.desc())
    )

    if user:
        # Prioritize viewer's moments + network moments
        rows = q.limit(limit * 3).all()
        mine = [r for r in rows if r.user_id == user.id]
        others = [r for r in rows if r.user_id != user.id]
        selected = (mine[:2] + others)[:limit]
    else:
        selected = q.limit(limit).all()

    return [moment_to_feed_payload(m, db) for m in selected]


def inject_status_moments(
    payloads: list[dict],
    db: Session,
    user: User | None,
) -> list[dict]:
    """Rare injection of public status cards into the conviction feed."""
    if not payloads:
        return payloads

    moments = status_moments_for_feed(db, user, limit=4)
    if not moments:
        return payloads

    merged: list[dict] = []
    moment_idx = 0
    for i, event in enumerate(payloads):
        merged.append(event)
        if (
            moment_idx < len(moments)
            and moment_idx < MAX_FEED_INJECTIONS
            and (i + 1) % FEED_INJECT_INTERVAL == 0
        ):
            merged.append(moments[moment_idx])
            moment_idx += 1
    return merged


def status_moments_for_profile(db: Session, user_id: int, *, limit: int = 8) -> dict:
    scan_recent_status_moments(db, lookback_days=120)

    rows = (
        db.query(PublicStatusMoment)
        .options(joinedload(PublicStatusMoment.market))
        .filter(PublicStatusMoment.user_id == user_id)
        .order_by(PublicStatusMoment.significance_score.desc(), PublicStatusMoment.created_at.desc())
        .limit(limit * 2)
        .all()
    )

    moments = []
    for m in rows[:limit]:
        meta = m.metadata_json or {}
        moments.append({
            "id": m.id,
            "status_type": m.status_type,
            "label": m.label,
            "headline": m.headline,
            "body": m.body,
            "market_title": m.market.title if m.market else None,
            "market_slug": title_to_slug(m.market.title) if m.market else None,
            "receipt_href": m.receipt_ref,
            "days_early": meta.get("days_early"),
            "created_at": iso_utc(m.created_at),
            "validated_at": iso_utc(m.validated_at) if m.validated_at else None,
            "visibility": {
                k: v
                for k, v in meta.items()
                if k.startswith(("interaction_", "thread_", "opposite_", "feed_exposure"))
            },
        })

    early_calls = [m for m in moments if m["status_type"] in ("early_call", "called_it")]
    challenges = [m for m in moments if m["status_type"] in ("consensus_breaker", "challenge_validated")]
    most_visible = max(
        moments,
        key=lambda x: (
            (x.get("visibility") or {}).get("interaction_backs", 0)
            + (x.get("visibility") or {}).get("interaction_challenges", 0)
            + (x.get("visibility") or {}).get("thread_activity", 0)
        ),
        default=None,
    )
    best_conviction = next(
        (m for m in moments if m["status_type"] in ("called_it", "conviction_resolved")),
        None,
    )

    streak = _public_streak(rows)

    return {
        "moments": moments,
        "early_calls": early_calls[:3],
        "successful_challenges": challenges[:3],
        "most_visible_read": most_visible,
        "best_resolved_conviction": best_conviction,
        "public_streak": streak,
    }


def _public_streak(moments: list[PublicStatusMoment]) -> dict | None:
    """Real streak of validated status moments — not gamified XP."""
    validated = [
        m
        for m in sorted(moments, key=lambda x: x.validated_at or x.created_at, reverse=True)
        if m.status_type in ("called_it", "early_call", "consensus_breaker", "isolated_validated")
    ]
    if len(validated) < 2:
        return None
    streak_days = 0
    for i in range(len(validated) - 1):
        a = validated[i].validated_at or validated[i].created_at
        b = validated[i + 1].validated_at or validated[i + 1].created_at
        if _days_between(b, a) <= 21:
            streak_days += 1
        else:
            break
    if streak_days < 1:
        return None
    return {
        "count": streak_days + 1,
        "label": f"{streak_days + 1} validated reads in a row",
    }


def status_notifications_for_user(db: Session, user: User, limit: int = 8) -> list[dict]:
    """Non-spammy alerts when a user's status moment is validated."""
    rows = (
        db.query(PublicStatusMoment)
        .options(joinedload(PublicStatusMoment.market))
        .filter(
            PublicStatusMoment.user_id == user.id,
            PublicStatusMoment.notified_at.is_(None),
            PublicStatusMoment.significance_score >= MIN_FEED_SIGNIFICANCE,
        )
        .order_by(PublicStatusMoment.created_at.desc())
        .limit(limit)
        .all()
    )

    notifications: list[dict] = []
    for m in rows:
        market_title = m.market.title if m.market else None
        body = m.body or m.headline
        if m.receipt_ref:
            body = f"{body} — View receipt"

        notifications.append({
            "type": "public_status",
            "title": m.headline,
            "body": body,
            "timestamp": (m.validated_at or m.created_at).isoformat(),
            "unread": True,
            "probability_change": None,
            "related_market": market_title,
            "related_agent": None,
            "status_moment_id": m.id,
            "status_label": m.label,
            "receipt_href": m.receipt_ref,
        })
        m.notified_at = datetime.utcnow()

    if rows:
        db.commit()

    return notifications
