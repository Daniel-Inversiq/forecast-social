from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user_optional
from app.database import SessionLocal, get_db
from app.forecasting.models import User
from app.forecasting.services.feed_intelligence import build_personalized_feed
from app.forecasting.services.feed_stream import feed_event_generator

router = APIRouter(tags=["feed"])


@router.get("/feed")
def get_feed(
    chip: str | None = Query(None, description="Filter: latest, shifts, battles, verified, consensus, rising"),
    include_meta: bool = Query(False, alias="meta"),
    limit: int = Query(50, ge=1, le=100),
    current_user: User | None = Depends(get_current_user_optional),
    db: Session = Depends(get_db),
):
    result = build_personalized_feed(db, current_user, chip=chip, limit=limit)
    if include_meta:
        return result
    return result["events"]


@router.get("/feed/debug")
def get_feed_debug(
    chip: str | None = Query(None, description="Filter: latest, shifts, battles, verified, consensus, rising"),
    limit: int = Query(50, ge=1, le=100),
    current_user: User | None = Depends(get_current_user_optional),
    db: Session = Depends(get_db),
):
    """Ordering / dedupe audit snapshot: id, timestamps, ranking_score, rank_reasons, stage deltas."""
    from app.forecasting.services.feed_debug import build_feed_debug_report

    return build_feed_debug_report(db, current_user, chip=chip, limit=limit)


@router.get("/feed/intelligence")
def get_feed_intelligence(
    current_user: User | None = Depends(get_current_user_optional),
    db: Session = Depends(get_db),
):
    """Network pulse, narratives, battles, and reputation — for live UI layers."""
    result = build_personalized_feed(db, current_user, limit=30)
    return result["meta"]


@router.get("/feed/stream")
async def stream_feed(
    request: Request,
    chip: str | None = Query(None, description="Filter: latest, shifts, battles, verified, consensus, rising"),
    current_user: User | None = Depends(get_current_user_optional),
):
    """SSE stream: feed events, pulse, reputation, battles — natural pacing with heartbeats."""

    async def event_source():
        async for chunk in feed_event_generator(
            SessionLocal,
            current_user,
            chip=chip,
            is_disconnected=request.is_disconnected,
        ):
            yield chunk

    return StreamingResponse(
        event_source(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
