from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session, joinedload

from app.auth.dependencies import get_current_user, get_current_user_optional
from app.database import get_db
from app.forecasting.agent_status import agent_status_payload, query_active_agents
from app.forecasting.beta_network_scale import beta_follower_count
from app.forecasting.follows import is_anchor_agent, is_following_agent
from app.forecasting.models import Agent, AgentReputation, FeedEvent, Follow, Market, ReputationMilestone, User
from app.forecasting.services.anchor_agent import (
    build_anchor_payload,
    clear_anchor_agent,
    resolve_anchor_agent_id,
    set_anchor_agent,
)
from app.forecasting.reputation.featured_marks import (
    agent_featured_payload,
    set_agent_featured_keys,
)
from app.forecasting.reputation.service import ensure_reputation_initialized, get_agent_reputation

router = APIRouter(tags=["agents"])


class FeaturedMilestonesIn(BaseModel):
    keys: list[str] = Field(default_factory=list, max_length=3)


def _stats_for_slug(slug: str) -> dict[str, int]:
    h = sum(ord(c) for c in slug)
    return {
        "streak": 3 + h % 14,
        "accuracy_score": 78 + h % 18,
        "follower_count": beta_follower_count(slug),
    }


def _tagline(personality: str, tone: str) -> str:
    return f"{personality.capitalize()} · {tone}"


def _get_agent_by_slug(slug: str, db: Session) -> Agent:
    agent = db.query(Agent).filter(Agent.slug == slug).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    return agent


@router.get("/agents")
def get_agents(db: Session = Depends(get_db)):
    ensure_reputation_initialized(db)
    agents = query_active_agents(db, order_by_name=True)
    rep_map = {
        r.agent_id: r
        for r in db.query(AgentReputation).all()
    }
    result = []
    for agent in agents:
        rep = rep_map.get(agent.id)
        base = {
            "name": agent.name,
            "slug": agent.slug,
            "niche": agent.niche,
            "conviction_style": agent.conviction_style,
            "personality_tagline": _tagline(agent.personality, agent.tone),
            "avatar_color": agent.avatar_color,
            "is_creator": getattr(agent, "is_creator", False),
            **_stats_for_slug(agent.slug),
            **agent_status_payload(agent),
        }
        if rep:
            base.update(
                {
                    "reputation_score": round(rep.score),
                    "tier_key": rep.tier_key,
                    "tier_label": rep.tier_label,
                    "reputation_velocity": rep.velocity,
                    "reputation_trend": rep.trend,
                    "timing_quality": rep.timing_quality,
                    "calibration_score": rep.calibration_score,
                }
            )
        result.append(base)
    return result


@router.post("/agents/{slug}/follow")
def follow_agent(
    slug: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    agent = _get_agent_by_slug(slug, db)
    if not is_following_agent(agent.id, current_user, db):
        db.add(Follow(follower_user_id=current_user.id, agent_id=agent.id))
        db.commit()
    return {"following": True}


@router.post("/agents/{slug}/unfollow")
def unfollow_agent(
    slug: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    agent = _get_agent_by_slug(slug, db)
    follow = (
        db.query(Follow)
        .filter(
            Follow.follower_user_id == current_user.id,
            Follow.agent_id == agent.id,
        )
        .first()
    )
    if follow:
        profile = db.query(UserProfile).filter(UserProfile.user_id == current_user.id).first()
        if profile and profile.anchor_agent_id == agent.id:
            profile.anchor_agent_id = None
        db.delete(follow)
        db.commit()
    return {"following": False}


@router.get("/agents/{slug}/follow-status")
def follow_status(
    slug: str,
    current_user: User | None = Depends(get_current_user_optional),
    db: Session = Depends(get_db),
):
    agent = _get_agent_by_slug(slug, db)
    return {"following": is_following_agent(agent.id, current_user, db)}


@router.get("/following/agents")
def get_following_agents(
    current_user: User | None = Depends(get_current_user_optional),
    db: Session = Depends(get_db),
):
    if current_user is None:
        return []

    anchor_id = resolve_anchor_agent_id(current_user, db)
    follows = (
        db.query(Follow)
        .options(joinedload(Follow.agent))
        .filter(Follow.follower_user_id == current_user.id)
        .order_by(Follow.created_at.desc())
        .all()
    )
    return [
        {
            "name": follow.agent.name,
            "slug": follow.agent.slug,
            "niche": follow.agent.niche,
            "avatar_color": follow.agent.avatar_color,
            "is_anchor": anchor_id == follow.agent_id,
            **agent_status_payload(follow.agent),
        }
        for follow in follows
    ]


@router.get("/agents/anchor")
def get_anchor_agent(
    current_user: User | None = Depends(get_current_user_optional),
    db: Session = Depends(get_db),
):
    return build_anchor_payload(current_user, db)


@router.post("/agents/{slug}/anchor")
def pin_anchor_agent(
    slug: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    agent = _get_agent_by_slug(slug, db)
    set_anchor_agent(current_user, agent, db)
    return build_anchor_payload(current_user, db)


@router.delete("/agents/anchor")
def unpin_anchor_agent(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    clear_anchor_agent(current_user, db)
    return build_anchor_payload(current_user, db)


@router.get("/agents/{slug}/anchor-status")
def anchor_status(
    slug: str,
    current_user: User | None = Depends(get_current_user_optional),
    db: Session = Depends(get_db),
):
    agent = _get_agent_by_slug(slug, db)
    return {"is_anchor": is_anchor_agent(agent.id, current_user, db)}


@router.get("/agents/{slug}")
def get_agent(slug: str, db: Session = Depends(get_db)):
    agent = _get_agent_by_slug(slug, db)

    stats = _stats_for_slug(slug)
    events = (
        db.query(FeedEvent)
        .options(joinedload(FeedEvent.market))
        .filter(FeedEvent.agent_id == agent.id)
        .order_by(FeedEvent.created_at.desc())
        .limit(12)
        .all()
    )

    receipt_events = [e for e in events if e.type == "receipt"][:4]
    if len(receipt_events) < 2:
        receipt_events = [e for e in events if e.probability and e.probability >= 90][:4]

    market_ids = {e.market_id for e in events if e.market_id}
    top_markets_q = (
        db.query(Market).filter(Market.id.in_(market_ids)).all()
        if market_ids
        else db.query(Market).filter(Market.category == agent.niche).limit(5).all()
    )
    if not top_markets_q:
        top_markets_q = db.query(Market).limit(5).all()

    h = sum(ord(c) for c in slug)

    def _event_payload(event: FeedEvent) -> dict:
        return {
            "type": event.type,
            "title": event.title,
            "body": event.body,
            "probability": event.probability,
            "confidence": event.confidence,
            "created_at": event.created_at.isoformat(),
            "market_title": event.market.title if event.market else None,
        }

    rep_detail = get_agent_reputation(db, slug)

    payload = {
        "name": agent.name,
        "slug": agent.slug,
        "niche": agent.niche,
        "conviction_style": agent.conviction_style,
        "personality_tagline": _tagline(agent.personality, agent.tone),
        "avatar_color": agent.avatar_color,
        "is_creator": getattr(agent, "is_creator", False),
        **agent_status_payload(agent),
        **stats,
        "resolved_calls": 18 + h % 80,
        "recent_events": [_event_payload(e) for e in events[:8]],
        "receipts": [
            {
                "title": e.title,
                "market_title": e.market.title if e.market else "Market",
                "probability": e.probability or 0,
                "timing": e.created_at.isoformat(),
                "result": "verified",
            }
            for e in receipt_events[:4]
        ],
        "top_markets": [
            {
                "title": m.title,
                "probability": m.current_yes_probability,
                "category": m.category,
                "strength": round(70 + (h + m.id) % 28),
            }
            for m in top_markets_q[:5]
        ],
    }
    if rep_detail:
        payload["reputation"] = rep_detail
        payload["reputation_score"] = round(rep_detail["score"])
        payload["tier_label"] = rep_detail["tier_label"]
        payload["reputation_velocity"] = rep_detail["velocity"]
        payload["reputation_trend"] = rep_detail["trend"]
        payload["featured_milestone_keys"] = rep_detail.get("featured_milestone_keys", [])
        payload["featured_reputation_marks"] = rep_detail.get("featured_reputation_marks", [])

    from app.forecasting.services.narrative_seasons import agent_season_performance, ensure_seasons_initialized

    ensure_seasons_initialized(db)
    payload["season_performance"] = agent_season_performance(db, agent)

    from app.forecasting.services.agent_state import AgentStateStore

    state_store = AgentStateStore(db)
    state_store.load([agent])
    mem = state_store.get(agent.id)
    if mem is None or not mem.last_stance:
        takes = db.query(MarketTake).filter(MarketTake.agent_id == agent.id).limit(20).all()
        markets = db.query(Market).all()
        rep = db.query(AgentReputation).filter(AgentReputation.agent_id == agent.id).first()
        mem = state_store.bootstrap_agent(agent, takes=takes, markets=markets, rep=rep)
        state_store.persist()
        db.commit()
    market_ids = {int(k) for k in mem.last_stance.keys()}
    markets_by_id = {m.id: m for m in db.query(Market).filter(Market.id.in_(market_ids)).all()} if market_ids else {}
    payload["memory"] = mem.to_public_dict(markets_by_id)

    return payload


@router.patch("/agents/{slug}/featured-milestones")
def patch_agent_featured_milestones(
    slug: str,
    body: FeaturedMilestonesIn,
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_current_user_optional),
):
    """Equip up to 3 unlocked prestige milestones for public display."""
    if current_user is None:
        raise HTTPException(status_code=401, detail="Authentication required")
    agent = _get_agent_by_slug(slug, db)
    keys = set_agent_featured_keys(db, agent, body.keys)
    rows = (
        db.query(ReputationMilestone)
        .filter(ReputationMilestone.agent_id == agent.id)
        .all()
    )
    from app.forecasting.reputation.service import _milestone_dicts

    milestone_list = _milestone_dicts(rows)
    block = agent_featured_payload(agent, milestone_list)
    return {"featured_milestone_keys": keys, **block}
