"""Market resolution and settlement API."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from app.auth.dependencies import get_current_user, require_admin
from app.database import get_db
from app.forecasting.market_resolution import (
    MarketResolutionEngine,
    is_market_resolved,
    market_outcome_yes,
    resolve_market_by_slug,
)
from app.forecasting.models import MarketTake, User
from app.forecasting.request_schemas import ResolveMarketIn
from app.forecasting.routes_markets import _find_market_by_slug, _market_payload
from app.security.rate_limit import limit_requests

router = APIRouter(tags=["resolution"])


def _resolution_fields(market) -> dict:
    if not is_market_resolved(market):
        return {
            "resolved_at": None,
            "resolved_outcome": None,
            "resolution_source": None,
            "resolution_confidence": None,
            "outcome_yes": None,
        }
    return {
        "resolved_at": market.resolved_at.isoformat() if market.resolved_at else None,
        "resolved_outcome": market.resolved_outcome,
        "resolution_source": market.resolution_source,
        "resolution_confidence": market.resolution_confidence,
        "outcome_yes": market_outcome_yes(market),
    }


@router.get("/markets/{slug}/resolution")
def get_market_resolution(slug: str, db: Session = Depends(get_db)):
    market = _find_market_by_slug(db, slug)
    if not market:
        raise HTTPException(status_code=404, detail="Market not found")

    engine = MarketResolutionEngine(db)
    events: list[dict] = []
    timeline: list[dict] = []

    if is_market_resolved(market):
        outcome_yes = market_outcome_yes(market)
        resolved_at = market.resolved_at
        take_rows = (
            db.query(MarketTake)
            .options(joinedload(MarketTake.agent))
            .filter(MarketTake.market_id == market.id)
            .all()
        )
        contested = len({t.side for t in take_rows})
        for take in take_rows:
            if not take.agent_id:
                continue
            s = engine._settle_take(
                take,
                market,
                outcome_yes,
                resolved_at,
                market.current_yes_probability,
                max(contested, 1),
            )
            events.append(
                {
                    "agent_name": s.agent_name,
                    "agent_slug": s.agent_slug,
                    "side": s.side,
                    "confidence": s.confidence,
                    "correct": s.correct,
                    "days_early": s.days_early,
                    "reputation_delta": s.reputation_delta,
                    "category": s.category,
                }
            )
        timeline = engine.build_resolution_timeline(market, None)

    return {
        "slug": slug,
        "status": market.status,
        **_resolution_fields(market),
        "timeline": timeline,
        "settlements": sorted(events, key=lambda e: -abs(e.get("reputation_delta", 0))),
    }


@router.get("/markets/{slug}/my-settlement")
def get_my_settlement(
    slug: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    market = _find_market_by_slug(db, slug)
    if not market:
        raise HTTPException(status_code=404, detail="Market not found")
    if not is_market_resolved(market):
        return {"settlement": None, "pending": True}
    settlement = MarketResolutionEngine(db).user_settlement(market, current_user.id)
    return {"settlement": settlement, "pending": False}


@router.post("/markets/{slug}/resolve")
def resolve_market(
    slug: str,
    payload: ResolveMarketIn,
    _: None = Depends(limit_requests(limit=10, window_seconds=60, scope="markets-resolve")),
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Resolve a market (demo/oracle)."""
    try:
        result = resolve_market_by_slug(
            db,
            slug,
            outcome=payload.outcome,
            source=payload.source,
            confidence=payload.confidence,
        )
    except LookupError:
        raise HTTPException(status_code=404, detail="Market not found")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    market = _find_market_by_slug(db, slug)
    payload = _market_payload(db, market) if market else {}
    return {
        "success": True,
        "resolution": {
            "market_slug": result.market_slug,
            "outcome": result.outcome,
            "outcome_yes": result.outcome_yes,
            "resolved_at": result.resolved_at,
            "feed_events_created": result.feed_events_created,
            "receipts_created": result.receipts_created,
            "milestones_unlocked": result.milestones_unlocked,
            "timeline": result.timeline,
            "top_settlements": [
                {
                    "agent_slug": s.agent_slug,
                    "agent_name": s.agent_name,
                    "reputation_delta": s.reputation_delta,
                    "correct": s.correct,
                    "category": s.category,
                }
                for s in result.settlements[:10]
            ],
        },
        "market": payload,
    }
