"""Creator Forecaster Studio API — wizard, preview, publish, discovery."""

from __future__ import annotations

import re
import time

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.auth.dependencies import get_current_user
from app.database import get_db
from app.forecasting.agent_status import CORE_AGENT_SLUGS, agent_status_payload, query_active_agents
from app.forecasting.beta_network_scale import beta_follower_count
from app.forecasting.models import Agent, AgentReputation, CreatorForecaster, Follow, ForecasterKnowledgeSource, User
from app.forecasting.reputation.service import ensure_reputation_initialized
from app.forecasting.services.creator_forecaster.archetypes import (
    BLIND_SPOT_SUGGESTIONS,
    DOMAIN_FOCUS_OPTIONS,
    archetype_description,
    list_archetypes_public,
)
from app.forecasting.services.creator_forecaster.differentiation import (
    score_creator_forecaster,
    score_differentiation,
)
from app.forecasting.services.creator_forecaster.knowledge import build_compact_context
from app.forecasting.services.creator_forecaster.personality import personality_summary
from app.forecasting.services.creator_forecaster.preview import generate_preview
from app.forecasting.services.creator_forecaster.publish import publish_creator_forecaster

router = APIRouter(tags=["creator-forecasters"])

SLIDER_MIN = 0
SLIDER_MAX = 100


class PersonalityIn(BaseModel):
    aggressiveness: int = Field(50, ge=SLIDER_MIN, le=SLIDER_MAX)
    humor: int = Field(50, ge=SLIDER_MIN, le=SLIDER_MAX)
    contrarian_level: int = Field(50, ge=SLIDER_MIN, le=SLIDER_MAX)
    data_vs_intuition: int = Field(50, ge=SLIDER_MIN, le=SLIDER_MAX)
    confidence: int = Field(50, ge=SLIDER_MIN, le=SLIDER_MAX)


class CreatorForecasterCreateIn(BaseModel):
    archetype: str | None = None


class CreatorForecasterUpdateIn(BaseModel):
    archetype: str | None = None
    display_name: str | None = None
    username: str | None = None
    avatar_color: str | None = None
    short_bio: str | None = None
    domain_focus: str | None = None
    blind_spot: str | None = None
    aggressiveness: int | None = Field(None, ge=SLIDER_MIN, le=SLIDER_MAX)
    humor: int | None = Field(None, ge=SLIDER_MIN, le=SLIDER_MAX)
    contrarian_level: int | None = Field(None, ge=SLIDER_MIN, le=SLIDER_MAX)
    data_vs_intuition: int | None = Field(None, ge=SLIDER_MIN, le=SLIDER_MAX)
    confidence: int | None = Field(None, ge=SLIDER_MIN, le=SLIDER_MAX)


class PreviewIn(BaseModel):
    seed: int | None = None


class DifferentiationCheckIn(BaseModel):
    archetype: str
    domain_focus: str = ""
    blind_spot: str = ""
    short_bio: str = ""
    aggressiveness: int = Field(50, ge=SLIDER_MIN, le=SLIDER_MAX)
    humor: int = Field(50, ge=SLIDER_MIN, le=SLIDER_MAX)
    contrarian_level: int = Field(50, ge=SLIDER_MIN, le=SLIDER_MAX)
    data_vs_intuition: int = Field(50, ge=SLIDER_MIN, le=SLIDER_MAX)
    confidence: int = Field(50, ge=SLIDER_MIN, le=SLIDER_MAX)
    sample_outputs: list[str] | None = None
    exclude_forecaster_id: int | None = None


def _get_owned(db: Session, cf_id: int, user: User) -> CreatorForecaster:
    cf = db.query(CreatorForecaster).filter(CreatorForecaster.id == cf_id).first()
    if not cf:
        raise HTTPException(status_code=404, detail="Creator forecaster not found")
    if cf.owner_user_id != user.id:
        raise HTTPException(status_code=403, detail="Not your forecaster")
    return cf


def _serialize(cf: CreatorForecaster, *, include_preview: bool = False) -> dict:
    out = {
        "id": cf.id,
        "display_name": cf.display_name,
        "username": cf.username,
        "avatar_color": cf.avatar_color,
        "short_bio": cf.short_bio,
        "domain_focus": cf.domain_focus,
        "archetype": cf.archetype,
        "archetype_description": cf.archetype_description,
        "aggressiveness": cf.aggressiveness,
        "humor": cf.humor,
        "contrarian_level": cf.contrarian_level,
        "data_vs_intuition": cf.data_vs_intuition,
        "confidence": cf.confidence,
        "blind_spot": cf.blind_spot,
        "status": cf.status,
        "agent_slug": cf.agent.slug if cf.agent else None,
        "created_at": cf.created_at.isoformat(),
        "updated_at": cf.updated_at.isoformat(),
        "published_at": cf.published_at.isoformat() if cf.published_at else None,
        "personality_summary": personality_summary(
            aggressiveness=cf.aggressiveness,
            humor=cf.humor,
            contrarian_level=cf.contrarian_level,
            data_vs_intuition=cf.data_vs_intuition,
            confidence=cf.confidence,
        ),
    }
    if include_preview and cf.preview_json:
        out["preview"] = cf.preview_json
    return out


def _agent_card(agent: Agent, rep: AgentReputation | None, follower_count: int) -> dict:
    h = sum(ord(c) for c in agent.slug)
    base = {
        "name": agent.name,
        "slug": agent.slug,
        "niche": agent.niche,
        "conviction_style": agent.conviction_style,
        "personality_tagline": f"{agent.personality.capitalize()} · {agent.tone}",
        "avatar_color": agent.avatar_color,
        "is_creator": agent.is_creator,
        "follower_count": (
            follower_count
            if follower_count > 0
            else (0 if agent.is_creator else beta_follower_count(agent.slug))
        ),
        "streak": 3 + h % 14,
        "accuracy_score": 78 + h % 18,
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
            }
        )
    return base


@router.get("/creator-forecasters/options")
def get_wizard_options():
    return {
        "archetypes": list_archetypes_public(),
        "domain_focus": list(DOMAIN_FOCUS_OPTIONS),
        "blind_spot_suggestions": list(BLIND_SPOT_SUGGESTIONS),
    }


@router.get("/creator-forecasters/mine")
def list_my_creator_forecasters(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(CreatorForecaster)
        .options(joinedload(CreatorForecaster.agent))
        .filter(CreatorForecaster.owner_user_id == current_user.id)
        .order_by(CreatorForecaster.updated_at.desc())
        .all()
    )
    return [_serialize(cf) for cf in rows]


@router.post("/creator-forecasters")
def create_creator_forecaster(
    body: CreatorForecasterCreateIn | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    cf = CreatorForecaster(owner_user_id=current_user.id)
    if body and body.archetype:
        cf.archetype = body.archetype
        cf.archetype_description = archetype_description(body.archetype)
        meta = next((a for a in list_archetypes_public() if a["key"] == body.archetype), None)
        if meta:
            cf.avatar_color = meta["accent"]
    db.add(cf)
    db.commit()
    db.refresh(cf)
    return _serialize(cf)


@router.get("/creator-forecasters/{cf_id}")
def get_creator_forecaster(
    cf_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    cf = _get_owned(db, cf_id, current_user)
    return _serialize(cf, include_preview=True)


@router.patch("/creator-forecasters/{cf_id}")
def update_creator_forecaster(
    cf_id: int,
    body: CreatorForecasterUpdateIn,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    cf = _get_owned(db, cf_id, current_user)
    if cf.status == "published":
        raise HTTPException(status_code=400, detail="Published forecasters cannot be edited via wizard")

    data = body.model_dump(exclude_unset=True)
    if "archetype" in data and data["archetype"]:
        cf.archetype_description = archetype_description(data["archetype"])
        meta = next((a for a in list_archetypes_public() if a["key"] == data["archetype"]), None)
        if meta and "avatar_color" not in data:
            cf.avatar_color = meta["accent"]
    if "username" in data and data["username"]:
        slug = re.sub(r"[^a-z0-9-]", "", data["username"].lower().strip())
        data["username"] = slug

    for key, val in data.items():
        setattr(cf, key, val)

    db.commit()
    db.refresh(cf)
    return _serialize(cf)


@router.post("/creator-forecasters/{cf_id}/preview")
def regenerate_preview(
    cf_id: int,
    body: PreviewIn | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    cf = _get_owned(db, cf_id, current_user)
    if not cf.archetype:
        raise HTTPException(status_code=400, detail="Select an archetype first")

    knowledge_rows = (
        db.query(ForecasterKnowledgeSource)
        .filter(ForecasterKnowledgeSource.forecaster_id == cf.id)
        .order_by(ForecasterKnowledgeSource.created_at.asc())
        .all()
    )
    knowledge_context = build_compact_context(knowledge_rows)
    knowledge_sources = [
        {
            "filename": row.filename,
            "summary": row.summary,
            "key_claims": row.key_claims_json or [],
            "status": row.status,
        }
        for row in knowledge_rows
        if row.status == "ready"
    ]

    seed = body.seed if body and body.seed is not None else int(time.time())
    preview = generate_preview(
        display_name=cf.display_name or "Your Forecaster",
        archetype=cf.archetype,
        domain_focus=cf.domain_focus,
        blind_spot=cf.blind_spot,
        aggressiveness=cf.aggressiveness,
        humor=cf.humor,
        contrarian_level=cf.contrarian_level,
        data_vs_intuition=cf.data_vs_intuition,
        confidence=cf.confidence,
        seed=seed,
        knowledge_context=knowledge_context,
        knowledge_sources=knowledge_sources,
    )
    cf.preview_json = preview
    db.commit()

    differentiation = None
    if cf.archetype and cf.blind_spot.strip():
        differentiation = score_creator_forecaster(db, cf)

    return {
        "preview": preview,
        "personality_summary": _serialize(cf)["personality_summary"],
        "differentiation": differentiation,
    }


@router.post("/forecasters/differentiation-check")
def differentiation_check(
    body: DifferentiationCheckIn,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Score draft forecaster config against core cast and published creators."""
    if not body.archetype:
        raise HTTPException(status_code=400, detail="Archetype is required")
    has_knowledge = False
    if body.exclude_forecaster_id:
        has_knowledge = bool(
            db.query(ForecasterKnowledgeSource)
            .filter(
                ForecasterKnowledgeSource.forecaster_id == body.exclude_forecaster_id,
                ForecasterKnowledgeSource.status == "ready",
            )
            .first()
        )
    return score_differentiation(
        db,
        archetype=body.archetype,
        domain_focus=body.domain_focus,
        blind_spot=body.blind_spot,
        aggressiveness=body.aggressiveness,
        humor=body.humor,
        contrarian_level=body.contrarian_level,
        data_vs_intuition=body.data_vs_intuition,
        confidence=body.confidence,
        short_bio=body.short_bio,
        sample_outputs=body.sample_outputs,
        exclude_id=body.exclude_forecaster_id,
        owner_user_id=current_user.id,
        has_custom_knowledge=has_knowledge,
    )


@router.post("/creator-forecasters/{cf_id}/differentiation")
def check_differentiation(
    cf_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    cf = _get_owned(db, cf_id, current_user)
    if not cf.archetype or not cf.blind_spot.strip():
        raise HTTPException(status_code=400, detail="Complete archetype and blind spot first")
    return score_creator_forecaster(db, cf)


@router.post("/creator-forecasters/{cf_id}/publish")
def publish_forecaster(
    cf_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    cf = _get_owned(db, cf_id, current_user)
    if not cf.preview_json:
        raise HTTPException(status_code=400, detail="Generate a preview before publishing")

    diff = score_creator_forecaster(db, cf)
    if not diff["can_publish"]:
        raise HTTPException(
            status_code=400,
            detail={
                "message": diff["message"],
                "differentiation": diff,
            },
        )

    agent = publish_creator_forecaster(db, cf)
    return {
        "status": "published",
        "agent_slug": agent.slug,
        "profile_url": f"/agents/{agent.slug}",
        "differentiation": diff,
    }


@router.get("/forecasters")
def discover_forecasters(db: Session = Depends(get_db)):
    """Discovery page — core SCRY agents separate from creator forecasters."""
    ensure_reputation_initialized(db)
    all_active = query_active_agents(db, order_by_name=False)
    rep_map = {r.agent_id: r for r in db.query(AgentReputation).all()}

    follower_counts = dict(
        db.query(Follow.agent_id, func.count(Follow.id))
        .group_by(Follow.agent_id)
        .all()
    )

    core: list[dict] = []
    creators: list[dict] = []
    for agent in all_active:
        card = _agent_card(agent, rep_map.get(agent.id), follower_counts.get(agent.id, 0))
        if agent.slug in CORE_AGENT_SLUGS:
            core.append(card)
        elif getattr(agent, "is_creator", False):
            creators.append(card)

    def _sort_trending(items: list[dict]) -> list[dict]:
        return sorted(
            items,
            key=lambda a: (
                a.get("reputation_velocity", 0),
                a.get("reputation_score", 0),
            ),
            reverse=True,
        )

    def _sort_rising(items: list[dict]) -> list[dict]:
        return sorted(
            items,
            key=lambda a: (
                1 if a.get("tier_key") == "rising" else 0,
                a.get("reputation_velocity", 0),
            ),
            reverse=True,
        )

    def _sort_newest(items: list[dict]) -> list[dict]:
        return list(items)

    def _sort_followed(items: list[dict]) -> list[dict]:
        return sorted(items, key=lambda a: a.get("follower_count", 0), reverse=True)

    return {
        "core_agents": core,
        "creator_forecasters": creators,
        "sections": {
            "trending": _sort_trending(creators),
            "rising": _sort_rising(creators),
            "newest": _sort_newest(creators),
            "most_followed": _sort_followed(creators),
        },
    }
