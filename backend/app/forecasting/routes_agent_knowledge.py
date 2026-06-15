"""Agent knowledge layer — public snapshots, studio view, compare overlap."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user, get_current_user_optional
from app.database import get_db
from app.forecasting.models import Agent, User
from app.forecasting.routes_agents import _get_agent_by_slug
from app.forecasting.routes_studio import _claim_agent_ownership
from app.forecasting.services.agent_knowledge import (
    build_agent_knowledge_profile,
    build_public_knowledge_snapshot,
    compare_agent_beliefs,
)

router = APIRouter(tags=["agent-knowledge"])


@router.get("/agents/{slug}/knowledge")
def get_agent_knowledge_public(slug: str, db: Session = Depends(get_db)):
    """Public knowledge snapshot for agent profiles."""
    agent = _get_agent_by_slug(slug, db)
    profile = build_agent_knowledge_profile(db, agent)
    return build_public_knowledge_snapshot(profile)


@router.get("/agents/{slug}/knowledge/full")
def get_agent_knowledge_full(
    slug: str,
    current_user: User | None = Depends(get_current_user_optional),
    db: Session = Depends(get_db),
):
    """Full knowledge profile — studio owners or any viewer for public agents."""
    agent = _get_agent_by_slug(slug, db)
    if current_user:
        _claim_agent_ownership(agent, current_user, db)
    return build_agent_knowledge_profile(db, agent)


@router.get("/studio/agents/{slug}/knowledge")
def get_studio_agent_knowledge(
    slug: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Creator studio knowledge brain — requires management access."""
    agent = _get_agent_by_slug(slug, db)
    if not _claim_agent_ownership(agent, current_user, db):
        if agent.owner_user_id != current_user.id:
            raise HTTPException(status_code=403, detail="You do not manage this agent")
    return build_agent_knowledge_profile(db, agent)


@router.get("/compare/{slug_a}/{slug_b}/knowledge")
def get_compare_knowledge(
    slug_a: str,
    slug_b: str,
    db: Session = Depends(get_db),
):
    """Belief overlap for head-to-head compare."""
    for slug in (slug_a, slug_b):
        try:
            _get_agent_by_slug(slug, db)
        except HTTPException:
            pass
    agent_a = db.query(Agent).filter(Agent.slug == slug_a).first()
    agent_b = db.query(Agent).filter(Agent.slug == slug_b).first()
    if not agent_a or not agent_b:
        raise HTTPException(status_code=404, detail="One or both agents not found")
    return compare_agent_beliefs(db, slug_a, slug_b)
