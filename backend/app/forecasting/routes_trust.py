from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.forecasting.models import Agent, User
from app.forecasting.reputation.service import ensure_reputation_initialized, get_agent_reputation
from app.forecasting.trust.config import (
    DISTRIBUTION_PHILOSOPHY,
    DISTRIBUTION_TAGLINE,
    TRUSTED_REQUIREMENTS,
    TRUST_TIERS,
)
from app.forecasting.trust.distribution import account_age_days, trust_from_agent_rep
from app.forecasting.trust.distribution import resolve_trust_tier, TrustInputs

router = APIRouter(tags=["trust"])


@router.get("/trust/config")
def get_trust_config():
    """Public trust distribution policy — earned through forecasting quality."""
    req = TRUSTED_REQUIREMENTS
    return {
        "tagline": DISTRIBUTION_TAGLINE,
        "philosophy": DISTRIBUTION_PHILOSOPHY,
        "trusted_requirements": {
            "resolved_calls": req.resolved_calls,
            "credibility": req.credibility,
            "account_age_days": req.account_age_days,
            "abuse_flags_max": req.abuse_flags_max,
        },
        "tiers": [
            {
                "key": t.key,
                "label": t.label,
                "distribution_weight": t.distribution_weight,
                "utilities": list(t.utilities),
            }
            for t in TRUST_TIERS
            if t.key != "verified"
        ],
        "verified_layer": {
            "key": "verified",
            "label": "Verified",
            "description": "Identity verification layer — stacks on earned trust tiers.",
        },
    }


@router.get("/trust/agents/{slug}")
def get_agent_trust(slug: str, db: Session = Depends(get_db)):
    rep_payload = get_agent_reputation(db, slug)
    if not rep_payload:
        raise HTTPException(status_code=404, detail="Agent not found")
    agent = db.query(Agent).filter(Agent.slug == slug).first()
    evaluation = trust_from_agent_rep(
        verified_calls=rep_payload.get("verified_calls") or 0,
        reputation_score=rep_payload.get("score") or 0,
        calibration_score=rep_payload.get("calibration_score") or 50,
        created_at=agent.created_at if agent else None,
    )
    return {
        "agent_slug": slug,
        **evaluation.to_dict(),
        "reputation_score": rep_payload.get("score"),
    }


@router.get("/trust/users/{username}")
def get_user_trust(username: str, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == username.lower()).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    ensure_reputation_initialized(db)
    resolved = 0
    credibility = 0.0
    calibration = 50.0
    agent = db.query(Agent).filter(Agent.slug == user.username).first()
    if agent:
        rep_payload = get_agent_reputation(db, agent.slug)
        if rep_payload:
            resolved = rep_payload.get("verified_calls") or 0
            credibility = float(rep_payload.get("score") or 0)
            calibration = float(rep_payload.get("calibration_score") or 50)
    evaluation = resolve_trust_tier(
        TrustInputs(
            resolved_calls=resolved,
            credibility=credibility,
            account_age_days=account_age_days(user.created_at),
            abuse_flags=0,
            calibration_score=calibration,
            reputation_score=credibility,
            identity_verified=bool(user.wallet_verified),
        )
    )
    return {
        "username": user.username,
        **evaluation.to_dict(),
    }
