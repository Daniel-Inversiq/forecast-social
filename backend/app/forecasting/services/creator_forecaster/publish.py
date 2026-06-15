"""Publish creator forecaster as a public Agent profile."""

from __future__ import annotations

import re
from datetime import datetime

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.forecasting.models import Agent, AgentReputation, CreatorForecaster, ForecasterKnowledgeSource, User
from app.forecasting.reputation.service import ensure_reputation_initialized
from app.forecasting.services.creator_forecaster.archetypes import derive_agent_fields
from app.forecasting.services.creator_forecaster.knowledge import build_compact_context
from app.forecasting.services.agent_state import AgentStateStore


def _slugify(username: str) -> str:
    slug = username.lower().strip()
    slug = re.sub(r"[^a-z0-9]+", "-", slug)
    return slug.strip("-")


def _validate_username(username: str, db: Session, *, exclude_agent_id: int | None = None) -> str:
    slug = _slugify(username)
    if len(slug) < 3:
        raise HTTPException(status_code=400, detail="Username must be at least 3 characters")
    if not re.match(r"^[a-z0-9][a-z0-9-]*[a-z0-9]$", slug) and len(slug) >= 3:
        if not re.match(r"^[a-z0-9]+$", slug):
            raise HTTPException(status_code=400, detail="Username may only contain letters, numbers, and hyphens")

    existing_user = db.query(User).filter(User.username == slug).first()
    if existing_user:
        raise HTTPException(status_code=409, detail="Username already taken by a user account")

    q = db.query(Agent).filter(Agent.slug == slug)
    if exclude_agent_id:
        q = q.filter(Agent.id != exclude_agent_id)
    if q.first():
        raise HTTPException(status_code=409, detail="Username already taken by an agent")

    other_cf = (
        db.query(CreatorForecaster)
        .filter(CreatorForecaster.username == slug, CreatorForecaster.status == "published")
        .first()
    )
    if other_cf:
        raise HTTPException(status_code=409, detail="Username already taken by a creator forecaster")

    return slug


def publish_creator_forecaster(db: Session, cf: CreatorForecaster) -> Agent:
    if not cf.archetype:
        raise HTTPException(status_code=400, detail="Archetype is required")
    if not cf.display_name.strip():
        raise HTTPException(status_code=400, detail="Display name is required")
    if not cf.blind_spot.strip():
        raise HTTPException(status_code=400, detail="Blind spot is required")
    if not cf.domain_focus:
        raise HTTPException(status_code=400, detail="Domain focus is required")

    slug = _validate_username(cf.username, db, exclude_agent_id=cf.agent_id)
    owner = db.query(User).filter(User.id == cf.owner_user_id).first()
    owner_username = owner.username if owner else None
    fields = derive_agent_fields(
        cf.archetype,
        aggressiveness=cf.aggressiveness,
        contrarian_level=cf.contrarian_level,
        data_vs_intuition=cf.data_vs_intuition,
        confidence=cf.confidence,
    )

    if cf.agent_id:
        agent = db.query(Agent).filter(Agent.id == cf.agent_id).first()
        if not agent:
            raise HTTPException(status_code=404, detail="Linked agent not found")
        agent.name = cf.display_name.strip()
        agent.slug = slug
        agent.niche = cf.domain_focus
        agent.personality = fields["personality"]
        agent.tone = fields["tone"]
        agent.conviction_style = fields["conviction_style"]
        agent.avatar_color = cf.avatar_color
        agent.status = "active"
        agent.is_creator = True
        agent.is_internal = False
        agent.owner_user_id = cf.owner_user_id
        agent.owner_username = owner_username
    else:
        agent = Agent(
            name=cf.display_name.strip(),
            slug=slug,
            niche=cf.domain_focus,
            personality=fields["personality"],
            tone=fields["tone"],
            conviction_style=fields["conviction_style"],
            avatar_color=cf.avatar_color,
            is_internal=False,
            is_creator=True,
            owner_user_id=cf.owner_user_id,
            owner_username=owner_username,
            status="active",
        )
        db.add(agent)
        db.flush()

    cf.agent_id = agent.id
    cf.username = slug
    cf.status = "published"
    cf.published_at = datetime.utcnow()

    ensure_reputation_initialized(db)
    rep = db.query(AgentReputation).filter(AgentReputation.agent_id == agent.id).first()
    if not rep:
        db.add(
            AgentReputation(
                agent_id=agent.id,
                score=42.0,
                tier_key="rising",
                tier_label="Rising",
                velocity=0.0,
                trend="flat",
                timing_quality=0.5,
                calibration_score=0.5,
            )
        )

    state_store = AgentStateStore(db)
    state_store.load([agent])
    mem = state_store.get(agent.id)
    if mem is None:
        mem = state_store.bootstrap_agent(agent, takes=[], markets=[], rep=None)
    mem.data["blind_spot"] = cf.blind_spot
    if cf.short_bio:
        mem.data["character_notes"] = cf.short_bio[:280]

    knowledge_rows = (
        db.query(ForecasterKnowledgeSource)
        .filter(
            ForecasterKnowledgeSource.forecaster_id == cf.id,
            ForecasterKnowledgeSource.status == "ready",
        )
        .all()
    )
    knowledge_context = build_compact_context(knowledge_rows)
    if knowledge_context:
        mem.data["knowledge_context"] = knowledge_context

    state_store.persist()

    db.commit()
    db.refresh(agent)
    return agent
