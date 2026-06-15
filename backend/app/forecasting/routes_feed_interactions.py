from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session, joinedload

from app.auth.dependencies import get_current_user, get_current_user_optional
from app.database import get_db
from app.forecasting.models import FeedInteraction, User
from app.forecasting.services.feed_interactions import (
    _normalize_side,
    _validate_probability,
    _validate_thesis,
    build_event_interactions_response,
    get_feed_event_or_404,
    get_interaction_or_404,
    interaction_to_payload,
    soft_remove_interaction,
    upsert_interaction,
    user_interaction_history,
)

router = APIRouter(tags=["feed-interactions"])


class InteractionIn(BaseModel):
    interaction_type: Literal["back", "challenge"]
    thesis_text: str | None = None
    user_probability: float | None = None
    side: Literal["yes", "no"] | None = None


class InteractionPatchIn(BaseModel):
    interaction_type: Literal["back", "challenge"] | None = None
    thesis_text: str | None = None
    user_probability: float | None = None
    side: Literal["yes", "no"] | None = None


@router.post("/feed/events/{event_id}/interactions")
def create_feed_interaction(
    event_id: int,
    body: InteractionIn,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    event = get_feed_event_or_404(db, event_id)
    interaction = upsert_interaction(
        db,
        current_user,
        event,
        interaction_type=body.interaction_type,
        thesis_text=body.thesis_text,
        user_probability=body.user_probability,
        side=body.side,
    )
    row = (
        db.query(FeedInteraction)
        .options(joinedload(FeedInteraction.user))
        .filter(FeedInteraction.id == interaction.id)
        .first()
    )
    return interaction_to_payload(row)  # type: ignore[arg-type]


@router.get("/feed/events/{event_id}/interactions")
def get_feed_event_interactions(
    event_id: int,
    current_user: User | None = Depends(get_current_user_optional),
    db: Session = Depends(get_db),
):
    get_feed_event_or_404(db, event_id)
    return build_event_interactions_response(db, event_id, current_user)


@router.patch("/feed/interactions/{interaction_id}")
def patch_feed_interaction(
    interaction_id: int,
    body: InteractionPatchIn,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    interaction = get_interaction_or_404(db, interaction_id)
    if interaction.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your interaction")
    if interaction.status == "removed":
        raise HTTPException(status_code=400, detail="Interaction was removed")

    itype = body.interaction_type or interaction.interaction_type
    thesis = body.thesis_text if body.thesis_text is not None else interaction.thesis_text
    prob = (
        body.user_probability
        if body.user_probability is not None
        else interaction.user_probability
    )
    side = body.side if body.side is not None else interaction.side

    _validate_thesis(thesis, itype)  # type: ignore[arg-type]
    interaction.thesis_text = thesis
    interaction.user_probability = _validate_probability(
        prob,
        required=itype == "challenge",
    )
    interaction.interaction_type = itype
    interaction.side = _normalize_side(side)
    db.commit()
    row = (
        db.query(FeedInteraction)
        .options(joinedload(FeedInteraction.user))
        .filter(FeedInteraction.id == interaction.id)
        .first()
    )
    return interaction_to_payload(row)  # type: ignore[arg-type]


@router.delete("/feed/interactions/{interaction_id}")
def delete_feed_interaction(
    interaction_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    interaction = get_interaction_or_404(db, interaction_id)
    if interaction.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your interaction")
    soft_remove_interaction(db, interaction)
    return {"removed": True, "id": interaction_id}


@router.get("/users/{username}/feed-interactions")
def get_user_feed_interactions(username: str, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == username.strip().lower()).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user_interaction_history(db, user.id)
