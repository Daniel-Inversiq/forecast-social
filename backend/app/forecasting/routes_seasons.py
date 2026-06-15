"""Narrative seasons API — current era, archive, agent season performance."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.forecasting.models import Agent, NarrativeSeason
from app.forecasting.services.narrative_seasons import (
    agent_season_performance,
    detect_era_signals,
    ensure_seasons_initialized,
    get_active_season,
    season_detail_payload,
    season_to_summary,
)

router = APIRouter(tags=["seasons"])


@router.get("/seasons")
def list_seasons(db: Session = Depends(get_db)):
    ensure_seasons_initialized(db)
    seasons = (
        db.query(NarrativeSeason)
        .order_by(NarrativeSeason.started_at.desc())
        .all()
    )
    active = get_active_season(db)
    return {
        "active_slug": active.slug if active else None,
        "seasons": [season_to_summary(s) for s in seasons],
    }


@router.get("/seasons/current")
def current_season(db: Session = Depends(get_db)):
    ensure_seasons_initialized(db)
    active = get_active_season(db)
    if not active:
        raise HTTPException(status_code=404, detail="No active season")
    return season_detail_payload(db, active)


@router.get("/seasons/archive")
def season_archive(db: Session = Depends(get_db)):
    ensure_seasons_initialized(db)
    archived = (
        db.query(NarrativeSeason)
        .filter(NarrativeSeason.status == "archived")
        .order_by(NarrativeSeason.ended_at.desc())
        .all()
    )
    return {
        "seasons": [
            {
                **season_to_summary(s),
                "top_forecaster": (s.highlights_json or {}).get("top_forecasters", [{}])[0],
                "narrative_winner": (s.dominant_narratives or ["—"])[0],
            }
            for s in archived
        ],
    }


@router.get("/seasons/era/signals")
def era_signals(db: Session = Depends(get_db)):
    ensure_seasons_initialized(db)
    return detect_era_signals(db)


@router.get("/seasons/{slug}")
def season_by_slug(slug: str, db: Session = Depends(get_db)):
    ensure_seasons_initialized(db)
    season = db.query(NarrativeSeason).filter(NarrativeSeason.slug == slug).first()
    if not season:
        raise HTTPException(status_code=404, detail="Season not found")
    return season_detail_payload(db, season)


@router.get("/agents/{slug}/seasons")
def agent_seasons(slug: str, db: Session = Depends(get_db)):
    ensure_seasons_initialized(db)
    agent = db.query(Agent).filter(Agent.slug == slug).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    return agent_season_performance(db, agent)
