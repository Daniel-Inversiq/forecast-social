"""Daily intelligence brief API — global, personal, and season briefings."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user, get_current_user_optional
from app.database import get_db
from app.forecasting.models import DailyBrief, User
from app.forecasting.services.daily_brief import (
    brief_to_api,
    ensure_daily_briefs,
    get_or_create_user_brief,
    user_brief_to_api,
)
from app.forecasting.services.narrative_seasons import get_active_season, season_to_summary

router = APIRouter(tags=["brief"])


@router.get("/brief/today")
def get_today_brief(
    db: Session = Depends(get_db),
    user: User | None = Depends(get_current_user_optional),
):
    """Global morning intelligence brief for the network."""
    brief = ensure_daily_briefs(db)
    season = get_active_season(db)
    season_summary = season_to_summary(season) if season else None
    payload = brief_to_api(brief, season_summary=season_summary)
    if user:
        user_brief = get_or_create_user_brief(db, user)
        payload["user_preview"] = {
            "reputation_delta": user_brief.reputation_delta,
            "personalized_summary": user_brief.personalized_summary,
        }
    return payload


@router.get("/brief/me")
def get_my_brief(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Personalized forecasting brief for the authenticated user."""
    global_brief = ensure_daily_briefs(db)
    user_brief = get_or_create_user_brief(db, user)
    return user_brief_to_api(user_brief, global_brief)


@router.get("/brief/season")
def get_season_brief(db: Session = Depends(get_db)):
    """Active season briefing layered on today's global pulse."""
    brief = ensure_daily_briefs(db)
    season = get_active_season(db)
    if not season:
        return {
            "date": brief.brief_date,
            "season": None,
            "brief": brief_to_api(brief),
            "message": "No active narrative season.",
        }
    season_summary = season_to_summary(season)
    return {
        "date": brief.brief_date,
        "season": season_summary,
        "brief": brief_to_api(brief, season_summary=season_summary),
        "season_headline": (
            f"{season.title}: {season.consensus_state} consensus · "
            f"volatility {season.volatility_score:.0%}"
        ),
        "dominant_narratives": season.dominant_narratives,
        "summary": season.summary or brief.summary,
    }


@router.get("/brief/history")
def get_brief_history(
    days: int = 7,
    db: Session = Depends(get_db),
):
    """Recent global brief archive (for ritual continuity)."""
    days = min(max(days, 1), 30)
    rows = (
        db.query(DailyBrief)
        .order_by(DailyBrief.brief_date.desc())
        .limit(days)
        .all()
    )
    return [
        {
            "date": b.brief_date,
            "volatility_state": b.volatility_state,
            "summary": b.summary,
            "verified_calls_count": b.verified_calls_count,
            "generated_at": b.generated_at.isoformat() if b.generated_at else None,
        }
        for b in rows
    ]


@router.get("/brief/delivery")
def get_delivery_preferences():
    """Stub for future email/push digest channels — not implemented yet."""
    return {
        "channels": {
            "email": {"enabled": False, "available": False, "note": "Planned — not configured"},
            "push": {"enabled": False, "available": False, "note": "Planned — not configured"},
            "in_app": {"enabled": True, "available": True},
        },
        "schedule": "daily_0600_utc",
    }
