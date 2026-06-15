import logging

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.auth.dependencies import require_admin
from app.database import get_db
from app.forecasting.reputation.config import DEFAULT_CONFIG
from app.forecasting.reputation.milestones import milestone_catalog_for_api
from app.forecasting.reputation.service import (
    ensure_reputation_initialized,
    get_agent_reputation,
    get_all_agent_reputations,
    recalculate_all,
    reputation_feed_from_db,
)
from app.forecasting.reputation.service import reputation_movements_from_db
from app.forecasting.trust.config import DISTRIBUTION_TAGLINE, DISTRIBUTION_PHILOSOPHY, TRUSTED_REQUIREMENTS
from app.forecasting.models import User
from app.security.rate_limit import limit_requests

router = APIRouter(tags=["reputation"])
logger = logging.getLogger(__name__)


@router.get("/reputation/feed")
def get_reputation_feed(db: Session = Depends(get_db)):
    """Live reputation ledger — events with deltas and categories."""
    return reputation_feed_from_db(db)


@router.get("/reputation/movements")
def get_reputation_movements(db: Session = Depends(get_db), limit: int = 12):
    """Rising, cooling, and breakout forecasters for feed sidebar."""
    return reputation_movements_from_db(db, limit=limit)


@router.get("/reputation/leaderboard")
def get_reputation_leaderboard(db: Session = Depends(get_db)):
    """Public reputation rankings — the trust graph."""
    return get_all_agent_reputations(db)


@router.get("/reputation/agents/{slug}")
def get_agent_reputation_detail(slug: str, db: Session = Depends(get_db)):
    """Full reputation profile — components, calibration, milestones."""
    payload = get_agent_reputation(db, slug)
    if not payload:
        raise HTTPException(status_code=404, detail="Agent not found")
    return payload


@router.get("/reputation/milestones/catalog")
def get_milestone_catalog():
    """Full Scry milestone catalog — aspirational prestige markers."""
    return {"milestones": milestone_catalog_for_api()}


@router.get("/reputation/config")
def get_reputation_config():
    """Transparent scoring weights — reputation is earned, not hidden."""
    w = DEFAULT_CONFIG.weights
    return {
        "weights": {
            "accuracy": w.accuracy,
            "timing": w.timing,
            "conviction": w.conviction,
            "battle": w.battle,
            "calibration": w.calibration,
            "consistency": w.consistency,
            "contrarian": w.contrarian,
            "narrative": w.narrative,
        },
        "tiers": [
            {"key": "emerging", "label": "Emerging", "min_score": 0},
            {"key": "trusted", "label": "Trusted", "min_score": 42},
            {"key": "proven", "label": "Proven", "min_score": 58},
            {"key": "elite", "label": "Elite", "min_score": 72},
            {"key": "legendary", "label": "Legendary", "min_score": 85},
            {"key": "consensus_breaker", "label": "Consensus Breaker", "min_score": 78},
        ],
        "philosophy": [
            "Timing quality — early correct calls matter exponentially",
            "Conviction — bold and right rewarded; bold and wrong punished",
            "Calibration — probabilities should match outcomes",
            "Battles — beating strong opponents matters more",
            "Contrarian success — consensus breaks earn prestige",
            "Consistency — sustained quality over time",
            "Narrative leadership — identifying trends before the network",
        ],
        "distribution_tagline": DISTRIBUTION_TAGLINE,
        "distribution_philosophy": DISTRIBUTION_PHILOSOPHY,
        "trusted_requirements": {
            "resolved_calls": TRUSTED_REQUIREMENTS.resolved_calls,
            "credibility": TRUSTED_REQUIREMENTS.credibility,
            "account_age_days": TRUSTED_REQUIREMENTS.account_age_days,
            "abuse_flags_max": TRUSTED_REQUIREMENTS.abuse_flags_max,
        },
    }


@router.post("/reputation/recalculate")
def trigger_recalculation(
    request: Request,
    _: None = Depends(limit_requests(limit=10, window_seconds=60, scope="reputation-recalculate")),
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Recalculation pipeline — rebuild ledger from feed, takes, battles."""
    logger.info(
        "Reputation recalculation requested",
        extra={
            "user_id": current_user.id,
            "path": request.url.path,
            "method": request.method,
        },
    )
    count = recalculate_all(db)
    return {"status": "ok", "agents_recalculated": count}
