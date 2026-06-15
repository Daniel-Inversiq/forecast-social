from datetime import datetime

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user
from app.database import get_db
from app.forecasting.models import Agent, Follow, Market, Position, User, UserProfile

router = APIRouter(tags=["onboarding"])


class StarterPositionIn(BaseModel):
    market: str
    side: str
    conviction: float = Field(ge=1, le=100)


class OnboardingProfileIn(BaseModel):
    selected_interests: list[str] = Field(default_factory=list)
    conviction_style: str | None = None
    followed_agents: list[str] = Field(default_factory=list)
    starter_position: StarterPositionIn | None = None


def _profile_payload(profile: UserProfile, user: User, db: Session) -> dict:
    follows = (
        db.query(Follow)
        .filter(Follow.follower_user_id == user.id)
        .order_by(Follow.created_at.desc())
        .all()
    )
    agent_ids = [f.agent_id for f in follows]
    agents = db.query(Agent).filter(Agent.id.in_(agent_ids)).all() if agent_ids else []
    slug_by_id = {a.id: a.slug for a in agents}

    return {
        "username": user.username,
        "selected_interests": profile.selected_interests or [],
        "conviction_style": profile.conviction_style,
        "onboarding_completed": user.onboarding_completed,
        "followed_agents": [slug_by_id[f.agent_id] for f in follows if f.agent_id in slug_by_id],
        "created_at": profile.created_at.isoformat() if profile.created_at else None,
    }


def _get_or_create_profile(user: User, db: Session) -> UserProfile:
    profile = db.query(UserProfile).filter(UserProfile.user_id == user.id).first()
    if profile:
        return profile
    profile = UserProfile(user_id=user.id, selected_interests=[])
    db.add(profile)
    db.flush()
    return profile


@router.get("/onboarding/profile")
def get_onboarding_profile(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    profile = db.query(UserProfile).filter(UserProfile.user_id == current_user.id).first()
    if not profile:
        return {
            "username": current_user.username,
            "selected_interests": [],
            "conviction_style": None,
            "onboarding_completed": current_user.onboarding_completed,
            "followed_agents": [],
            "created_at": None,
        }
    return _profile_payload(profile, current_user, db)


@router.post("/onboarding/profile")
def save_onboarding_profile(
    body: OnboardingProfileIn,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    profile = _get_or_create_profile(current_user, db)
    profile.selected_interests = body.selected_interests
    profile.conviction_style = body.conviction_style
    current_user.onboarding_completed = True

    db.query(Follow).filter(Follow.follower_user_id == current_user.id).delete()

    pinned_anchor_id = profile.anchor_agent_id

    for slug in body.followed_agents:
        agent = db.query(Agent).filter(Agent.slug == slug).first()
        if not agent:
            continue
        db.add(
            Follow(
                follower_user_id=current_user.id,
                agent_id=agent.id,
                created_at=datetime.utcnow(),
            )
        )

    if pinned_anchor_id:
        anchor = db.query(Agent).filter(Agent.id == pinned_anchor_id).first()
        if anchor and not any(f.agent_id == anchor.id for f in db.query(Follow).filter(Follow.follower_user_id == current_user.id).all()):
            db.add(
                Follow(
                    follower_user_id=current_user.id,
                    agent_id=anchor.id,
                    created_at=datetime.utcnow(),
                )
            )

    if profile.starter_position_id:
        db.query(Position).filter(Position.id == profile.starter_position_id).delete()
        profile.starter_position_id = None

    if body.starter_position:
        market = (
            db.query(Market)
            .filter(Market.title == body.starter_position.market)
            .first()
        )
        if market:
            side = body.starter_position.side.upper()
            if side in ("YES", "NO"):
                position = Position(
                    user_id=current_user.id,
                    market_id=market.id,
                    side=side,
                    amount=float(body.starter_position.conviction),
                    created_at=datetime.utcnow(),
                )
                db.add(position)
                db.flush()
                profile.starter_position_id = position.id

    db.commit()
    db.refresh(profile)
    db.refresh(current_user)
    return _profile_payload(profile, current_user, db)


@router.post("/onboarding/reset")
def reset_onboarding(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    profile = db.query(UserProfile).filter(UserProfile.user_id == current_user.id).first()

    if profile:
        if profile.starter_position_id:
            db.query(Position).filter(Position.id == profile.starter_position_id).delete()
            profile.starter_position_id = None
        profile.selected_interests = []
        profile.conviction_style = None

    current_user.onboarding_completed = False
    db.query(Follow).filter(Follow.follower_user_id == current_user.id).delete()
    db.commit()

    if profile:
        db.refresh(profile)
        db.refresh(current_user)
        return _profile_payload(profile, current_user, db)

    return {
        "username": current_user.username,
        "selected_interests": [],
        "conviction_style": None,
        "onboarding_completed": False,
        "followed_agents": [],
        "created_at": None,
    }
