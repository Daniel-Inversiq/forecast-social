"""Agent Studio — creator management (separate from public agent profiles)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from app.auth.dependencies import get_current_user
from app.database import get_db
from app.forecasting.models import Agent, CreatorForecaster, User
from app.forecasting.reputation.service import ensure_reputation_initialized, get_agent_reputation
from app.forecasting.routes_agents import _get_agent_by_slug, _stats_for_slug, _tagline
from app.forecasting.agent_status import agent_status_payload

router = APIRouter(tags=["studio"])


def _claim_agent_ownership(agent: Agent, user: User, db: Session) -> bool:
    """Assign owner when missing if the user created this agent via Creator Forecaster."""
    if agent.owner_user_id == user.id:
        return True
    if agent.owner_user_id is not None and agent.owner_user_id != user.id:
        return False

    cf = (
        db.query(CreatorForecaster)
        .filter(
            CreatorForecaster.owner_user_id == user.id,
            CreatorForecaster.status == "published",
        )
        .filter(
            (CreatorForecaster.agent_id == agent.id)
            | (CreatorForecaster.username == agent.slug)
        )
        .first()
    )
    if not cf:
        return False

    agent.owner_user_id = user.id
    agent.owner_username = user.username
    agent.is_creator = True
    if not cf.agent_id:
        cf.agent_id = agent.id
    db.commit()
    db.refresh(agent)
    return True


def _ownership_fields(agent: Agent) -> dict:
    return {
        "owner_user_id": agent.owner_user_id,
        "owner_username": agent.owner_username,
    }


def _studio_agent_summary(agent: Agent, db: Session) -> dict:
    ensure_reputation_initialized(db)
    rep = agent.reputation
    stats = _stats_for_slug(agent.slug)
    payload = {
        "name": agent.name,
        "slug": agent.slug,
        "niche": agent.niche,
        "conviction_style": agent.conviction_style,
        "personality_tagline": _tagline(agent.personality, agent.tone),
        "avatar_color": agent.avatar_color,
        "is_creator": bool(agent.is_creator),
        **agent_status_payload(agent),
        **stats,
        **_ownership_fields(agent),
    }
    if rep:
        payload.update(
            {
                "reputation_score": round(rep.score),
                "tier_key": rep.tier_key,
                "tier_label": rep.tier_label,
                "reputation_velocity": rep.velocity,
                "reputation_trend": rep.trend,
            }
        )
    return payload


@router.get("/studio/agents/mine")
def list_my_studio_agents(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Agents owned by the current user (management roster)."""
    cfs = (
        db.query(CreatorForecaster)
        .options(joinedload(CreatorForecaster.agent))
        .filter(
            CreatorForecaster.owner_user_id == current_user.id,
            CreatorForecaster.status == "published",
        )
        .all()
    )
    for cf in cfs:
        if cf.agent:
            _claim_agent_ownership(cf.agent, current_user, db)
        elif cf.username:
            orphan = db.query(Agent).filter(Agent.slug == cf.username).first()
            if orphan:
                _claim_agent_ownership(orphan, current_user, db)

    agents = (
        db.query(Agent)
        .options(joinedload(Agent.reputation))
        .filter(Agent.owner_user_id == current_user.id)
        .order_by(Agent.created_at.desc())
        .all()
    )

    return [_studio_agent_summary(a, db) for a in agents]


@router.get("/studio/agents/{slug}")
def get_studio_agent(
    slug: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Creator dashboard context — rejects only when owner_user_id != current user."""
    agent = _get_agent_by_slug(slug, db)
    can_manage = _claim_agent_ownership(agent, current_user, db)

    if not can_manage:
        raise HTTPException(status_code=403, detail="You do not manage this agent")

    cf = (
        db.query(CreatorForecaster)
        .filter(
            CreatorForecaster.owner_user_id == current_user.id,
            CreatorForecaster.agent_id == agent.id,
        )
        .first()
    )

    rep_detail = get_agent_reputation(db, slug)
    profile = {
        "name": agent.name,
        "slug": agent.slug,
        "niche": agent.niche,
        "conviction_style": agent.conviction_style,
        "personality_tagline": _tagline(agent.personality, agent.tone),
        "avatar_color": agent.avatar_color,
        "is_creator": bool(agent.is_creator),
        **agent_status_payload(agent),
        **_stats_for_slug(slug),
        **_ownership_fields(agent),
        "can_manage": True,
        "creator_forecaster_id": cf.id if cf else None,
    }
    if rep_detail:
        profile["reputation"] = rep_detail
        profile["reputation_score"] = round(rep_detail["score"])
        profile["tier_label"] = rep_detail["tier_label"]

    return profile
