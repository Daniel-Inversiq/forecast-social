"""Ongoing story / rivalry arc endpoints for the home feed."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user, get_current_user_optional
from app.database import get_db
from app.forecasting.models import StoryWatch, User
from app.forecasting.services.ongoing_stories import build_ongoing_stories
from app.security.rate_limit import limit_requests

router = APIRouter(tags=["feed-stories"])


@router.get("/feed/ongoing-stories")
def get_ongoing_stories(
    limit: int = 3,
    current_user: User | None = Depends(get_current_user_optional),
    db: Session = Depends(get_db),
):
    """Top unresolved rivalry arcs ranked for serialized feed tension."""
    return build_ongoing_stories(db, current_user, limit=min(max(limit, 1), 5))


@router.post("/feed/stories/{story_key:path}/watch")
def watch_story(
    story_key: str,
    story_type: str = "rivalry",
    _: None = Depends(limit_requests(limit=10, window_seconds=60, scope="subscriptions-watch")),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Subscribe to resolution moment for an open story."""
    existing = (
        db.query(StoryWatch)
        .filter(
            StoryWatch.user_id == current_user.id,
            StoryWatch.story_key == story_key,
        )
        .first()
    )
    if existing:
        if existing.status != "active":
            existing.status = "active"
            existing.resolved_at = None
            existing.resolution_json = None
            db.commit()
        return {"story_key": story_key, "watched": True, "status": existing.status}

    watch = StoryWatch(
        user_id=current_user.id,
        story_key=story_key,
        story_type=story_type,
        status="active",
    )
    db.add(watch)
    db.commit()
    return {"story_key": story_key, "watched": True, "status": "active"}


@router.delete("/feed/stories/{story_key:path}/watch")
def unwatch_story(
    story_key: str,
    _: None = Depends(limit_requests(limit=10, window_seconds=60, scope="subscriptions-unwatch")),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    deleted = (
        db.query(StoryWatch)
        .filter(
            StoryWatch.user_id == current_user.id,
            StoryWatch.story_key == story_key,
        )
        .delete()
    )
    db.commit()
    return {"story_key": story_key, "watched": False, "removed": deleted > 0}


@router.post("/feed/stories/{story_key:path}/archive")
def archive_story(
    story_key: str,
    _: None = Depends(limit_requests(limit=10, window_seconds=60, scope="subscriptions-archive")),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Dismiss a resolved story closure card."""
    watch = (
        db.query(StoryWatch)
        .filter(
            StoryWatch.user_id == current_user.id,
            StoryWatch.story_key == story_key,
        )
        .first()
    )
    if not watch:
        raise HTTPException(status_code=404, detail="Story watch not found")
    watch.status = "archived"
    db.commit()
    return {"story_key": story_key, "status": "archived"}
