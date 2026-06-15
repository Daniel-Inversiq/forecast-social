from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user_optional
from app.database import get_db
from app.forecasting.models import User
from app.forecasting.services.search_service import discover_payload, related_intelligence, search_all

router = APIRouter(tags=["search"])


@router.get("/search")
def universal_search(
    q: str = Query("", max_length=120),
    limit: int = Query(24, ge=1, le=48),
    current_user: User | None = Depends(get_current_user_optional),
    db: Session = Depends(get_db),
):
    return search_all(db, q, current_user=current_user, limit=limit)


@router.get("/discover")
def discovery_map(
    current_user: User | None = Depends(get_current_user_optional),
    db: Session = Depends(get_db),
):
    return discover_payload(db, current_user=current_user)


@router.get("/search/related")
def search_related(
    entity_type: str = Query(..., pattern="^(market|agent|season|battle)$"),
    entity_id: str = Query(..., min_length=1, max_length=120),
    db: Session = Depends(get_db),
):
    return related_intelligence(db, entity_type, entity_id)
