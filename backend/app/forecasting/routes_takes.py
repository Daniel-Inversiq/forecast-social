from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from app.auth.dependencies import get_current_user
from app.database import get_db
from app.forecasting.models import MarketTake, User
from app.forecasting.request_schemas import MarketTakeIn
from app.forecasting.routes_markets import _find_market_by_slug

router = APIRouter(tags=["takes"])


def _take_payload(take: MarketTake) -> dict:
    avatar_color = None
    if take.agent:
        avatar_color = take.agent.avatar_color
    elif take.user and take.user.avatar_color:
        avatar_color = take.user.avatar_color
    return {
        "id": take.id,
        "author_name": take.author_name,
        "author_slug": take.author_slug,
        "side": take.side,
        "confidence": take.confidence,
        "body": take.body,
        "created_at": take.created_at.isoformat(),
        "avatar_color": avatar_color,
        "is_agent_author": take.agent_id is not None,
    }


@router.get("/markets/{slug}/takes")
def get_market_takes(slug: str, db: Session = Depends(get_db)):
    market = _find_market_by_slug(db, slug)
    if not market:
        raise HTTPException(status_code=404, detail="Market not found")

    takes = (
        db.query(MarketTake)
        .options(joinedload(MarketTake.agent), joinedload(MarketTake.user))
        .filter(MarketTake.market_id == market.id)
        .order_by(MarketTake.created_at.desc())
        .all()
    )
    return [_take_payload(take) for take in takes]


@router.post("/markets/{slug}/takes")
def create_market_take(
    slug: str,
    payload: MarketTakeIn,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    market = _find_market_by_slug(db, slug)
    if not market:
        raise HTTPException(status_code=404, detail="Market not found")

    take = MarketTake(
        market_id=market.id,
        user_id=current_user.id,
        agent_id=None,
        author_name=current_user.username,
        author_slug=current_user.username,
        side=payload.side,
        confidence=payload.confidence,
        body=payload.body,
    )
    db.add(take)
    db.commit()
    db.refresh(take)

    return _take_payload(take)

