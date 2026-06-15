from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session, joinedload

from app.auth.dependencies import get_current_user, get_current_user_optional
from app.database import get_db
from app.forecasting.models import MarketThreadPost, User
from app.forecasting.routes_markets import _find_market_by_slug
from app.forecasting.services.market_thread import (
    build_thread_response,
    create_thread_post,
    post_to_payload,
    soft_remove_thread_post,
    update_thread_post,
)

router = APIRouter(tags=["market-thread"])


class ThreadPostIn(BaseModel):
    body: str = Field(..., min_length=8, max_length=800)
    stance: Literal["yes", "no", "neutral"] = "neutral"
    post_type: Literal["thesis", "counter-thesis", "update", "evidence", "question"] = "thesis"
    user_probability: float | None = None


class ThreadPostPatchIn(BaseModel):
    body: str | None = Field(None, min_length=8, max_length=800)
    stance: Literal["yes", "no", "neutral"] | None = None
    post_type: Literal["thesis", "counter-thesis", "update", "evidence", "question"] | None = None
    user_probability: float | None = None


@router.get("/markets/{slug}/thread")
def get_market_thread(
    slug: str,
    current_user: User | None = Depends(get_current_user_optional),
    db: Session = Depends(get_db),
):
    market = _find_market_by_slug(db, slug)
    if not market:
        raise HTTPException(status_code=404, detail="Market not found")
    return build_thread_response(db, market, current_user)


@router.post("/markets/{slug}/thread")
def post_market_thread(
    slug: str,
    body: ThreadPostIn,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    market = _find_market_by_slug(db, slug)
    if not market:
        raise HTTPException(status_code=404, detail="Market not found")
    post = create_thread_post(
        db,
        current_user,
        market,
        body=body.body,
        stance=body.stance,
        post_type=body.post_type,
        user_probability=body.user_probability,
    )
    return post_to_payload(post)


@router.patch("/markets/thread/posts/{post_id}")
def patch_market_thread_post(
    post_id: int,
    body: ThreadPostPatchIn,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    post = (
        db.query(MarketThreadPost)
        .options(joinedload(MarketThreadPost.user))
        .filter(MarketThreadPost.id == post_id)
        .first()
    )
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    updated = update_thread_post(
        db,
        post,
        current_user,
        body=body.body,
        stance=body.stance,
        post_type=body.post_type,
        user_probability=body.user_probability,
    )
    return post_to_payload(updated)


@router.delete("/markets/thread/posts/{post_id}")
def delete_market_thread_post(
    post_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    post = db.query(MarketThreadPost).filter(MarketThreadPost.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    if post.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your post")
    soft_remove_thread_post(db, post)
    return {"removed": True, "id": post_id}
