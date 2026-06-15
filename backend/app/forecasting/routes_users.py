from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user
from app.database import get_db
from app.forecasting.models import Agent, ReputationMilestone, User
from app.forecasting.reputation.featured_marks import (
    agent_featured_payload,
    set_user_featured_keys,
)
from app.forecasting.reputation.service import _milestone_dicts, get_user_public_profile

router = APIRouter(tags=["users"])


class FeaturedMilestonesIn(BaseModel):
    keys: list[str] = Field(default_factory=list, max_length=3)


@router.get("/users/{username}")
def get_user_profile(username: str, db: Session = Depends(get_db)):
    """Public user profile with reputation milestones when linked to an agent."""
    payload = get_user_public_profile(db, username.strip().lower())
    if not payload:
        raise HTTPException(status_code=404, detail="User not found")
    return payload


@router.patch("/users/me/featured-milestones")
def patch_my_featured_milestones(
    body: FeaturedMilestonesIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Equip up to 3 unlocked prestige milestones on your public identity."""
    keys = set_user_featured_keys(db, current_user, body.keys)
    agent = db.query(Agent).filter(Agent.slug == current_user.username).first()
    milestone_list: list[dict] = []
    if agent:
        rows = (
            db.query(ReputationMilestone)
            .filter(ReputationMilestone.agent_id == agent.id)
            .all()
        )
        milestone_list = _milestone_dicts(rows)
        block = agent_featured_payload(agent, milestone_list)
    else:
        block = {
            "featured_milestones": [],
            "featured_reputation_marks": [],
        }
    profile = current_user.profile
    if profile:
        profile.featured_milestone_keys = keys
        db.commit()
    return {"featured_milestone_keys": keys, **block}
