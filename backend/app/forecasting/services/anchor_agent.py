"""Anchor agent — user's primary forecasting identity lens."""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any, Literal

from sqlalchemy.orm import Session, joinedload

from app.forecasting.follows import followed_agent_ids, is_following_agent
from app.forecasting.models import (
    Agent,
    AgentReputation,
    FeedEvent,
    FeedInteraction,
    Follow,
    MarketTake,
    Position,
    User,
    UserProfile,
)
from app.forecasting.services.context import INTEREST_CATEGORY_MAP
from app.forecasting.services.utils import hours_since, iso_dt, parse_spread

AnchorMood = Literal[
    "loud",
    "quiet",
    "isolated",
    "aggressive",
    "cooling",
    "doubling_down",
    "under_pressure",
    "vindicated",
    "exposed",
]

MOOD_LABELS: dict[AnchorMood, str] = {
    "loud": "On a tear",
    "quiet": "Unusually quiet",
    "isolated": "Standing alone",
    "aggressive": "Picking fights",
    "cooling": "Pulling back",
    "doubling_down": "Doubling down",
    "under_pressure": "Under pressure",
    "vindicated": "Vindicated",
    "exposed": "Exposed",
}

MAJOR_EVENT_TYPES = frozenset(
    {
        "rivalry",
        "battle_escalation",
        "receipt",
        "verified_call",
        "failed_high_conviction_call",
        "confidence_shift",
        "consensus_shift",
        "reputation_move",
        "leaderboard_move",
    }
)


def pinned_anchor_agent_id(user: User | None, db: Session) -> int | None:
    if user is None or not user.profile:
        return None
    return user.profile.anchor_agent_id


def detect_anchor_agent_id(user: User, db: Session) -> int | None:
    """Infer anchor from follows, interactions, positions, and takes."""
    scores: dict[int, float] = {}

    follows = (
        db.query(Follow)
        .filter(Follow.follower_user_id == user.id)
        .order_by(Follow.created_at.desc())
        .all()
    )
    for i, follow in enumerate(follows):
        scores[follow.agent_id] = scores.get(follow.agent_id, 0.0) + 18.0 - min(i * 1.5, 12.0)

    interactions = (
        db.query(FeedInteraction)
        .options(joinedload(FeedInteraction.feed_event).joinedload(FeedEvent.agent))
        .filter(FeedInteraction.user_id == user.id)
        .order_by(FeedInteraction.created_at.desc())
        .limit(40)
        .all()
    )
    for ix in interactions:
        if ix.feed_event and ix.feed_event.agent_id:
            weight = 24.0 if ix.interaction_type == "challenge" else 16.0
            scores[ix.feed_event.agent_id] = scores.get(ix.feed_event.agent_id, 0.0) + weight

    positions = (
        db.query(Position)
        .options(joinedload(Position.market))
        .filter(Position.user_id == user.id)
        .all()
    )
    position_market_ids = {p.market_id for p in positions}
    if position_market_ids:
        agent_takes = (
            db.query(MarketTake)
            .filter(MarketTake.market_id.in_(position_market_ids))
            .all()
        )
        for take in agent_takes:
            if take.agent_id:
                scores[take.agent_id] = scores.get(take.agent_id, 0.0) + 28.0

    user_takes = db.query(MarketTake).filter(MarketTake.user_id == user.id).all()
    for take in user_takes:
        if take.agent_id:
            scores[take.agent_id] = scores.get(take.agent_id, 0.0) + 32.0

    since = datetime.utcnow() - timedelta(days=14)
    recent_events = (
        db.query(FeedEvent)
        .filter(FeedEvent.created_at >= since)
        .order_by(FeedEvent.created_at.desc())
        .limit(200)
        .all()
    )
    for event in recent_events:
        if event.agent_id and event.agent_id in scores:
            scores[event.agent_id] += 0.5

    profile = user.profile
    if profile and profile.selected_interests:
        from app.forecasting.agent_status import query_active_agents

        agents = query_active_agents(db)
        keywords: set[str] = set()
        for interest in profile.selected_interests:
            key = str(interest).lower().strip()
            keywords.add(key)
            keywords.update(INTEREST_CATEGORY_MAP.get(key, [key]))
        for agent in agents:
            niche_blob = f"{agent.niche} {agent.slug} {agent.personality}".lower()
            if any(kw in niche_blob for kw in keywords):
                scores[agent.id] = scores.get(agent.id, 0.0) + 12.0

    if not scores:
        return None
    return max(scores, key=scores.get)


def resolve_anchor_agent_id(user: User | None, db: Session) -> int | None:
    if user is None:
        return None
    pinned = pinned_anchor_agent_id(user, db)
    if pinned is not None:
        return pinned
    return detect_anchor_agent_id(user, db)


def resolve_anchor_agent(user: User | None, db: Session) -> Agent | None:
    agent_id = resolve_anchor_agent_id(user, db)
    if agent_id is None:
        return None
    return db.query(Agent).filter(Agent.id == agent_id).first()


def set_anchor_agent(user: User, agent: Agent, db: Session) -> None:
    profile = db.query(UserProfile).filter(UserProfile.user_id == user.id).first()
    if profile is None:
        profile = UserProfile(user_id=user.id)
        db.add(profile)
        db.flush()
    profile.anchor_agent_id = agent.id
    if not is_following_agent(agent.id, user, db):
        db.add(Follow(follower_user_id=user.id, agent_id=agent.id))
    db.commit()


def clear_anchor_agent(user: User, db: Session) -> None:
    profile = db.query(UserProfile).filter(UserProfile.user_id == user.id).first()
    if profile and profile.anchor_agent_id is not None:
        profile.anchor_agent_id = None
        db.commit()


def suggest_anchor_agents(user: User | None, db: Session, *, limit: int = 3) -> list[dict]:
    if user is None:
        from app.forecasting.agent_status import query_active_agents

        agents = query_active_agents(db, order_by_name=True)[:limit]
    else:
        followed = followed_agent_ids(user, db)
        candidates: list[tuple[float, Agent]] = []
        profile = user.profile
        keywords: set[str] = set()
        if profile:
            for interest in profile.selected_interests or []:
                key = str(interest).lower().strip()
                keywords.add(key)
                keywords.update(INTEREST_CATEGORY_MAP.get(key, [key]))
        reps = {r.agent_id: r for r in db.query(AgentReputation).all()}
        from app.forecasting.agent_status import active_agents_query

        for agent in active_agents_query(db).all():
            if agent.id in followed:
                continue
            score = float(reps.get(agent.id).score if reps.get(agent.id) else 50)
            niche_blob = f"{agent.niche} {agent.slug}".lower()
            if keywords and any(kw in niche_blob for kw in keywords):
                score += 20.0
            candidates.append((score, agent))
        candidates.sort(key=lambda x: -x[0])
        agents = [a for _, a in candidates[:limit]]
        if len(agents) < limit:
            extra = (
                active_agents_query(db)
                .filter(~Agent.id.in_(followed | {a.id for a in agents}))
                .order_by(Agent.name)
                .limit(limit - len(agents))
                .all()
            )
            agents.extend(extra)

    return [
        {
            "name": a.name,
            "slug": a.slug,
            "niche": a.niche,
            "avatar_color": a.avatar_color,
        }
        for a in agents[:limit]
    ]


def _agent_events(db: Session, agent_id: int, *, hours: float = 48.0) -> list[FeedEvent]:
    since = datetime.utcnow() - timedelta(hours=hours)
    return (
        db.query(FeedEvent)
        .options(joinedload(FeedEvent.market))
        .filter(FeedEvent.agent_id == agent_id, FeedEvent.created_at >= since)
        .order_by(FeedEvent.created_at.desc())
        .all()
    )


def _isolated_market_count(db: Session, agent_id: int) -> int:
    takes = (
        db.query(MarketTake)
        .filter(MarketTake.agent_id == agent_id)
        .order_by(MarketTake.created_at.desc())
        .limit(80)
        .all()
    )
    by_market: dict[int, set[str]] = {}
    for take in takes:
        if not take.market_id:
            continue
        by_market.setdefault(take.market_id, set()).add(take.side.lower())
    isolated = 0
    for market_id, sides in by_market.items():
        if len(sides) == 1:
            isolated += 1
    return isolated


def _resolving_today_count(db: Session, agent_id: int) -> int:
    from app.forecasting.services.resolution_horizon import resolution_horizon_for_market

    takes = db.query(MarketTake).filter(MarketTake.agent_id == agent_id).all()
    market_ids = {t.market_id for t in takes if t.market_id}
    if not market_ids:
        return 0
    from app.forecasting.models import Market

    markets = db.query(Market).filter(Market.id.in_(market_ids)).all()
    count = 0
    for market in markets:
        rh = resolution_horizon_for_market(market)
        if rh and rh.get("bucket") in ("tonight", "soon"):
            count += 1
    return count


def compute_agent_mood(db: Session, agent: Agent) -> AnchorMood:
    events = _agent_events(db, agent.id, hours=72.0)
    recent_6h = [e for e in events if hours_since(e.created_at) <= 6.0]
    recent_24h = [e for e in events if hours_since(e.created_at) <= 24.0]

    rep = db.query(AgentReputation).filter(AgentReputation.agent_id == agent.id).first()
    velocity = rep.velocity if rep else 0.0
    trend = rep.trend if rep else "stable"

    last_post = events[0] if events else None
    quiet_hours = hours_since(last_post.created_at) if last_post else 999.0

    if any(e.type in ("receipt", "verified_call") for e in recent_24h):
        return "vindicated"
    if any(e.type == "failed_high_conviction_call" for e in recent_24h):
        return "exposed"
    if len(recent_6h) >= 3:
        return "loud"
    if quiet_hours >= 9.0 and len(events) >= 2:
        return "quiet"
    battles = [e for e in recent_24h if e.type in ("rivalry", "battle_escalation")]
    if len(battles) >= 2:
        return "aggressive"
    isolated = _isolated_market_count(db, agent.id)
    if isolated >= 2:
        return "isolated"
    if velocity <= -3.0 and battles:
        return "under_pressure"
    if trend == "rising" and velocity >= 4.0 and any(e.confidence and e.confidence >= 75 for e in recent_24h):
        return "doubling_down"
    if velocity < -1.5 and len(recent_6h) <= 1 and len(events) >= 3:
        return "cooling"
    if quiet_hours >= 9.0:
        return "quiet"
    if len(recent_6h) >= 2:
        return "loud"
    return "cooling"


def _rival_line(db: Session, agent: Agent, events: list[FeedEvent]) -> str | None:
    for event in events:
        if event.type not in ("rivalry", "battle_escalation"):
            continue
        meta = event.metadata_json or {}
        opp_slug = meta.get("opponent_slug")
        if opp_slug:
            opp = db.query(Agent).filter(Agent.slug == opp_slug).first()
            if opp:
                return f"{agent.name} challenged {opp.name} again."
        body = event.body or ""
        if " vs " in body.lower():
            return f"{agent.name} {body.split('.')[0].strip()}."
    return None


def _module_lines(db: Session, agent: Agent, user: User | None) -> list[str]:
    events = _agent_events(db, agent.id, hours=48.0)
    lines: list[str] = []

    last_visit = user.last_home_visit_at if user else None
    if last_visit:
        since_visit = [e for e in events if e.created_at and e.created_at >= last_visit]
        if since_visit:
            lines.append(
                f"{agent.name} posted {len(since_visit)} time{'s' if len(since_visit) != 1 else ''} since your last check."
            )
    elif events:
        lines.append(f"{agent.name} posted {len(events)} times in the last 48h.")

    mood = compute_agent_mood(db, agent)
    last_post = events[0] if events else None
    quiet_hours = hours_since(last_post.created_at) if last_post else 999.0
    if mood == "quiet" and quiet_hours >= 9.0:
        lines.append(f"{agent.name} is unusually quiet — no take in {int(quiet_hours)}h.")

    rival = _rival_line(db, agent, events)
    if rival:
        lines.append(rival)

    isolated = _isolated_market_count(db, agent.id)
    if isolated >= 2:
        lines.append(f"{agent.name} is isolated in {isolated} active markets.")

    resolving = _resolving_today_count(db, agent.id)
    if resolving >= 1:
        noun = "call" if resolving == 1 else "calls"
        lines.append(f"{agent.name} has {resolving} {noun} resolving today.")

    rep = db.query(AgentReputation).filter(AgentReputation.agent_id == agent.id).first()
    if rep and abs(rep.velocity) >= 4.0:
        direction = "gained" if rep.velocity > 0 else "lost"
        lines.append(f"{agent.name} {direction} reputation sharply in the last stretch.")

    if not lines:
        lines.append(f"{agent.name} is on your desk — watch for the next conviction move.")

    return lines[:4]


def _module_title(agent: Agent, mood: AnchorMood) -> str:
    if mood == "quiet":
        return f"{agent.name} watch"
    if mood in ("aggressive", "under_pressure"):
        return "Your desk today"
    return "Your anchor agent"


def agent_to_summary(agent: Agent) -> dict[str, Any]:
    return {
        "name": agent.name,
        "slug": agent.slug,
        "niche": agent.niche,
        "avatar_color": agent.avatar_color,
    }


def build_anchor_payload(user: User | None, db: Session) -> dict[str, Any]:
    if user is None:
        return {
            "has_anchor": False,
            "pinned": False,
            "agent": None,
            "mood": None,
            "mood_label": None,
            "title": "Choose an agent to track closely",
            "headline": "Sign in to pick your anchor forecaster.",
            "lines": [],
            "suggestions": suggest_anchor_agents(None, db),
            "href": "/agents",
        }

    pinned_id = pinned_anchor_agent_id(user, db)
    agent = resolve_anchor_agent(user, db)

    if agent is None:
        suggestions = suggest_anchor_agents(user, db)
        return {
            "has_anchor": False,
            "pinned": False,
            "agent": None,
            "mood": None,
            "mood_label": None,
            "title": "Choose an agent to track closely",
            "headline": "Pick one forecaster to watch like a recurring character.",
            "lines": [],
            "suggestions": suggestions,
            "href": "/agents",
        }

    mood = compute_agent_mood(db, agent)
    lines = _module_lines(db, agent, user)
    return {
        "has_anchor": True,
        "pinned": pinned_id == agent.id,
        "agent": agent_to_summary(agent),
        "mood": mood,
        "mood_label": MOOD_LABELS.get(mood),
        "title": _module_title(agent, mood),
        "headline": lines[0] if lines else f"Tracking {agent.name}.",
        "lines": lines,
        "suggestions": [],
        "href": f"/agents/{agent.slug}",
    }


def anchor_notifications_for_user(db: Session, user: User, *, limit: int = 6) -> list[dict]:
    agent = resolve_anchor_agent(user, db)
    if agent is None:
        return []

    since = datetime.utcnow() - timedelta(hours=36)
    events = (
        db.query(FeedEvent)
        .options(joinedload(FeedEvent.market), joinedload(FeedEvent.agent))
        .filter(
            FeedEvent.agent_id == agent.id,
            FeedEvent.created_at >= since,
            FeedEvent.type.in_(tuple(MAJOR_EVENT_TYPES)),
        )
        .order_by(FeedEvent.created_at.desc())
        .limit(limit * 2)
        .all()
    )

    mood = compute_agent_mood(db, agent)
    notifications: list[dict] = []

    for event in events[:limit]:
        spread = parse_spread(event.body) if event.type in ("rivalry", "battle_escalation") else None
        market_title = event.market.title if event.market else None
        title = event.title
        body = event.body

        if event.type in ("rivalry", "battle_escalation"):
            title = f"{agent.name} entered a rivalry"
            if spread and spread >= 25:
                body = f"High-stakes battle surfacing — spread {spread}pt."
        elif event.type in ("receipt", "verified_call"):
            title = f"{agent.name} got a receipt"
        elif event.type == "failed_high_conviction_call":
            title = f"{agent.name} took a public hit"
        elif event.type in ("confidence_shift", "consensus_shift"):
            title = f"{agent.name} posted a major take"
        elif event.type in ("reputation_move", "leaderboard_move"):
            title = f"{agent.name} reputation shifted sharply"

        notifications.append(
            {
                "type": "anchor_agent",
                "title": title,
                "body": body,
                "timestamp": iso_dt(event.created_at),
                "unread": True,
                "probability_change": None,
                "related_market": market_title,
                "related_agent": agent.name,
                "anchor_mood": mood,
            }
        )

    last_post = (
        db.query(FeedEvent)
        .filter(FeedEvent.agent_id == agent.id)
        .order_by(FeedEvent.created_at.desc())
        .first()
    )
    quiet_hours = hours_since(last_post.created_at) if last_post else 999.0
    if mood == "quiet" and quiet_hours >= 12.0 and len(notifications) < limit:
        notifications.append(
            {
                "type": "anchor_agent",
                "title": f"{agent.name} went quiet before the next move",
                "body": f"No take in {int(quiet_hours)}h — unusual lull for your anchor agent.",
                "timestamp": iso_dt(datetime.utcnow()),
                "unread": True,
                "probability_change": None,
                "related_market": None,
                "related_agent": agent.name,
                "anchor_mood": mood,
            }
        )

    return notifications[:limit]
