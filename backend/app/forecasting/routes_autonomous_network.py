"""Autonomous network engine — dev controls and metrics."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.database import get_db
from app.forecasting.services.agent_activity_engine import activity_to_dict
from app.forecasting.services.autonomous_network_engine import (
    clear_generated_dev_data,
    execute_network_tick,
    get_network_debug,
    get_network_status,
    is_engine_running,
    prune_generated_dev_data,
    reset_autonomous_state,
    start_engine,
    stop_engine,
)
from app.settings import is_dev_environment

router = APIRouter(tags=["autonomous-network"])


class NetworkTickIn(BaseModel):
    seed: int | None = None
    mirror_to_feed: bool = True


class ResetAutonomousStateIn(BaseModel):
    delete_mirrored_feed_events: bool = False


class ClearGeneratedDevDataIn(BaseModel):
    delete_mirrored_feed_events: bool = False
    include_legacy_without_source: bool = True


@router.get("/dev/network-status")
@router.get("/api/dev/network-status")
def dev_network_status(db: Session = Depends(get_db)):
    """Network heat, thread/narrative counts, and activity rates."""
    if not is_dev_environment():
        raise HTTPException(status_code=404, detail="Not found")
    return get_network_status(db)


@router.get("/dev/network-debug")
@router.get("/api/dev/network-debug")
def dev_network_debug(db: Session = Depends(get_db)):
    """Full inspection dashboard — narratives, threads, rivalries, decisions, scheduler."""
    if not is_dev_environment():
        raise HTTPException(status_code=404, detail="Not found")
    return get_network_debug(db)


@router.post("/dev/network/start")
@router.post("/api/dev/network/start")
async def dev_network_start(db: Session = Depends(get_db)):
    """Start the background autonomous network scheduler."""
    if not is_dev_environment():
        raise HTTPException(status_code=404, detail="Not found")
    try:
        db.execute(text("SELECT 1"))
    except Exception as exc:
        return JSONResponse(
            status_code=503,
            content={
                "status": "error",
                "engine_running": False,
                "error": "database_unavailable",
                "detail": str(exc),
                "error_type": type(exc).__name__,
            },
        )
    try:
        result = await start_engine()
    except Exception as exc:
        return JSONResponse(
            status_code=503,
            content={
                "status": "error",
                "engine_running": False,
                "error": "scheduler_start_failed",
                "detail": str(exc),
                "error_type": type(exc).__name__,
            },
        )
    if result.get("status") == "error":
        return JSONResponse(status_code=503, content=result)
    return result


@router.post("/dev/network/stop")
@router.post("/api/dev/network/stop")
def dev_network_stop():
    """Stop the background autonomous network scheduler."""
    if not is_dev_environment():
        raise HTTPException(status_code=404, detail="Not found")
    return stop_engine()


@router.post("/dev/network/tick")
@router.post("/api/dev/network/tick")
def dev_network_tick(
    body: NetworkTickIn | None = None,
    db: Session = Depends(get_db),
):
    """Execute one scheduler cycle manually."""
    if not is_dev_environment():
        raise HTTPException(status_code=404, detail="Not found")
    payload = body or NetworkTickIn()
    result = execute_network_tick(
        db,
        seed=payload.seed,
        mirror_to_feed=payload.mirror_to_feed,
    )
    return {
        "skipped": result.skipped,
        "reason": result.reason,
        "seed": result.seed,
        "network_heat": result.network_heat,
        "resolutions_processed": result.resolutions_processed,
        "activities_created": len(result.activities_created),
        "decisions": result.decisions,
        "items": [activity_to_dict(r) for r in result.activities_created],
        "engine_running": is_engine_running(),
        "network_status": get_network_status(db),
    }


@router.post("/dev/network/reset-autonomous-state")
@router.post("/api/dev/network/reset-autonomous-state")
def dev_network_reset_autonomous_state(
    body: ResetAutonomousStateIn | None = None,
    db: Session = Depends(get_db),
):
    """Clear decision log, scheduler timing, and autonomous activity rows (dev only)."""
    if not is_dev_environment():
        raise HTTPException(status_code=404, detail="Not found")
    payload = body or ResetAutonomousStateIn()
    return reset_autonomous_state(
        db,
        delete_mirrored_feed_events=payload.delete_mirrored_feed_events,
    )


@router.post("/dev/network/prune-generated")
@router.post("/api/dev/network/prune-generated")
def dev_network_prune_generated(
    older_than_hours: int = 24,
    delete_mirrored_feed_events: bool = False,
    db: Session = Depends(get_db),
):
    """Remove manual dev batch activities older than the given window."""
    if not is_dev_environment():
        raise HTTPException(status_code=404, detail="Not found")
    if older_than_hours < 1:
        raise HTTPException(status_code=400, detail="older_than_hours must be >= 1")
    return prune_generated_dev_data(
        db,
        older_than_hours=older_than_hours,
        delete_mirrored_feed_events=delete_mirrored_feed_events,
    )


@router.post("/dev/network/clear-generated-dev-data")
@router.post("/api/dev/network/clear-generated-dev-data")
def dev_network_clear_generated_dev_data(
    body: ClearGeneratedDevDataIn | None = None,
    db: Session = Depends(get_db),
):
    """Remove all manual dev batch activities (optional legacy untagged rows)."""
    if not is_dev_environment():
        raise HTTPException(status_code=404, detail="Not found")
    payload = body or ClearGeneratedDevDataIn()
    return clear_generated_dev_data(
        db,
        delete_mirrored_feed_events=payload.delete_mirrored_feed_events,
        include_legacy_without_source=payload.include_legacy_without_source,
    )
