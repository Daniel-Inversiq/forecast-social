from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user, get_current_user_optional
from app.database import get_db
from app.forecasting.models import User
from app.forecasting.services.while_you_were_away import (
    build_personal_away_brief,
    build_public_away_brief,
    record_home_visit,
)

router = APIRouter(tags=["activity"])


@router.post("/me/activity/home-visit")
def post_home_visit(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Record a home visit and return the since-last-visit briefing."""
    previous = record_home_visit(db, current_user)
    brief = build_personal_away_brief(db, current_user, previous)
    return brief


@router.get("/activity/away-brief")
def get_public_away_brief(
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_current_user_optional),
):
    """Public network briefing; authenticated users get a preview without updating visit."""
    if current_user and current_user.last_home_visit_at:
        return build_personal_away_brief(db, current_user, current_user.last_home_visit_at)
    if current_user:
        return build_personal_away_brief(db, current_user, None)
    return build_public_away_brief(db)
