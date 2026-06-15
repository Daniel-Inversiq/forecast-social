"""Agent activity engine API — generated feed motion (dev-friendly)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.settings import is_dev_environment
from app.forecasting.models import AgentGeneratedActivity, FeedEvent
from app.forecasting.services.agent_activity_engine import (
    activity_to_dict,
    generate_agent_activity_batch,
    list_generated_activity,
    summarize_network_briefing,
)
from app.forecasting.services.agent_llm import build_prompt_bundle
from app.forecasting.services.agent_prompt_context import (
    reconstruct_context_from_activity,
    task_for_activity_type,
)

router = APIRouter(tags=["agent-activity"])


class GenerateActivityIn(BaseModel):
    count: int = Field(default=100, ge=5, le=100)
    seed: int | None = None
    mirror_to_feed: bool = True


@router.get("/feed/generated")
@router.get("/api/feed/generated")
def get_generated_feed(
    limit: int = Query(50, ge=1, le=100),
    since_hours: int | None = Query(None, ge=1, le=168),
    db: Session = Depends(get_db),
):
    """Recent bible-voiced agent activity for feed / briefing layers."""
    items = list_generated_activity(db, limit=limit, since_hours=since_hours)
    return {
        "items": items,
        "count": len(items),
        "network_briefing": summarize_network_briefing(db, since_hours=since_hours or 24),
    }


@router.post("/dev/generate-agent-activity")
@router.post("/api/dev/generate-agent-activity")
def dev_generate_agent_activity(
    body: GenerateActivityIn | None = None,
    db: Session = Depends(get_db),
):
    """Manually generate agent-network activity (dev only, up to 100 items)."""
    if not is_dev_environment():
        raise HTTPException(status_code=404, detail="Not found")
    payload = body or GenerateActivityIn()
    created = generate_agent_activity_batch(
        db,
        count=payload.count,
        seed=payload.seed,
        mirror_to_feed=payload.mirror_to_feed,
    )
    return {
        "generated": len(created),
        "items": [activity_to_dict(r) for r in created],
        "network_briefing": summarize_network_briefing(db, since_hours=24),
    }


def _prompt_debug_for_activity(db: Session, row: AgentGeneratedActivity) -> dict:
    ctx = reconstruct_context_from_activity(row)
    task = task_for_activity_type(row.activity_type)
    bundle = build_prompt_bundle(row.agent_slug, task, ctx, db=db)
    payload = bundle.debug_payload()
    payload["activity_id"] = row.activity_id
    payload["activity_type"] = row.activity_type
    payload["generated_body"] = row.body
    stored = (row.metadata_json or {}).get("prompt_debug")
    if stored:
        payload["stored_at_generation"] = stored
    return payload


@router.get("/dev/agent-prompt-debug")
@router.get("/api/dev/agent-prompt-debug")
def dev_agent_prompt_debug(
    activity_id: str | None = Query(None),
    feed_event_id: int | None = Query(None),
    db: Session = Depends(get_db),
):
    """Return full prompt transparency for a generated agent post (dev only)."""
    if not is_dev_environment():
        raise HTTPException(status_code=404, detail="Not found")
    if not activity_id and feed_event_id is None:
        raise HTTPException(status_code=400, detail="Provide activity_id or feed_event_id")

    row: AgentGeneratedActivity | None = None
    if activity_id:
        row = (
            db.query(AgentGeneratedActivity)
            .filter(AgentGeneratedActivity.activity_id == activity_id)
            .first()
        )
    elif feed_event_id is not None:
        row = (
            db.query(AgentGeneratedActivity)
            .filter(AgentGeneratedActivity.mirrored_feed_event_id == feed_event_id)
            .first()
        )
        if not row:
            feed = db.get(FeedEvent, feed_event_id)
            if not feed or not feed.agent:
                raise HTTPException(status_code=404, detail="Post not found")
            ctx = {
                "market_title": feed.title,
                "event_type": feed.type,
            }
            meta = feed.metadata_json or {}
            if meta.get("opponent_slug"):
                ctx["opponent_slug"] = meta["opponent_slug"]
            if meta.get("trigger_id"):
                ctx["trigger_id"] = meta["trigger_id"]
            task = "counter" if feed.type in ("rivalry", "battle_escalation") else "post"
            bundle = build_prompt_bundle(feed.agent.slug, task, ctx, db=db)
            payload = bundle.debug_payload()
            payload["feed_event_id"] = feed_event_id
            payload["generated_body"] = feed.body
            return payload

    if not row:
        raise HTTPException(status_code=404, detail="Activity not found")
    return _prompt_debug_for_activity(db, row)
