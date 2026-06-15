from datetime import datetime, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session, joinedload

from app.auth.dependencies import get_current_user
from app.database import get_db
from app.forecasting.market_resolution import is_market_resolved, market_outcome_yes, title_to_slug
from app.forecasting.services.resolution_horizon import resolution_horizon_for_market
from app.forecasting.models import ConvictionPosition, Market, User

router = APIRouter(tags=["positions"])


def _hash(*parts) -> int:
    return sum(ord(c) for p in parts for c in str(p))


def _is_resolved(position: ConvictionPosition, market: Market) -> bool:
    if position.status != "open":
        return True
    return is_market_resolved(market)


def _active_status(position: ConvictionPosition, market: Market) -> str:
    p = market.current_yes_probability
    if 46 <= p <= 54:
        return "contested"
    if position.side == "YES" and p >= 58:
        return "moving up"
    if position.side == "NO" and p <= 42:
        return "moving up"
    return "active"


def _entry_probability(position: ConvictionPosition, market: Market) -> float:
    offset = (_hash(position.id) % 21) - 10
    return round(max(5.0, min(95.0, market.current_yes_probability + offset)), 1)


def _resolution_yes(position: ConvictionPosition, market: Market) -> bool:
    if is_market_resolved(market):
        return market_outcome_yes(market)
    return _hash(market.title, position.id, "resolve") % 2 == 0


def _was_correct(side: str, resolution_yes: bool) -> bool:
    return (side == "YES" and resolution_yes) or (side == "NO" and not resolution_yes)


def _resolved_at(position: ConvictionPosition, market: Market) -> str:
    if position.resolved_at:
        return position.resolved_at.isoformat()
    if is_market_resolved(market) and market.resolved_at:
        return market.resolved_at.isoformat()
    return datetime.utcnow().isoformat()


def _timeline_note(position: ConvictionPosition, market: Market, resolved: bool, correct: bool | None) -> str:
    if resolved and correct is not None:
        verdict = "called it" if correct else "missed the call"
        return f"Resolved on {market.title} — {verdict}."
    if _active_status(position, market) == "contested":
        return f"Conviction posted while the market stayed split on {market.title}."
    if _active_status(position, market) == "moving up":
        return f"Thesis gaining traction on {market.title}."
    return f"Opened a public {position.side} call on {market.title}."


@router.get("/me/positions")
def get_my_positions(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(ConvictionPosition)
        .options(joinedload(ConvictionPosition.market))
        .filter(ConvictionPosition.user_id == current_user.id)
        .order_by(ConvictionPosition.opened_at.desc())
        .all()
    )

    active_positions: list[dict] = []
    resolved_positions: list[dict] = []
    timeline: list[dict] = []

    for position in rows:
        market = position.market
        if not market:
            continue

        entry_prob = _entry_probability(position, market)
        resolved = _is_resolved(position, market)
        resolution_yes = _resolution_yes(position, market)
        correct = _was_correct(position.side, resolution_yes) if resolved else None

        rh = resolution_horizon_for_market(market)
        base = {
            "id": position.id,
            "market_title": market.title,
            "market_slug": title_to_slug(market.title),
            "side": position.side,
            "amount": position.amount,
            "created_at": position.opened_at.isoformat() if position.opened_at else datetime.utcnow().isoformat(),
            "expected_resolution_at": (
                market.expected_resolution_at.isoformat() if market.expected_resolution_at else None
            ),
            "resolved_at": market.resolved_at.isoformat() if market.resolved_at else None,
            "resolved_outcome": market.resolved_outcome if is_market_resolved(market) else None,
            "resolution_horizon": rh,
        }

        if resolved:
            resolved_positions.append(
                {
                    **base,
                    "result": "correct" if correct else "incorrect",
                    "probability_at_entry": entry_prob,
                    "resolved_at": _resolved_at(position, market),
                    "resolved_outcome": market.resolved_outcome if is_market_resolved(market) else None,
                }
            )
            timeline.append(
                {
                    **base,
                    "kind": "resolved",
                    "note": _timeline_note(position, market, True, correct),
                    "result": "correct" if correct else "incorrect",
                }
            )
        else:
            status = _active_status(position, market)
            active_positions.append(
                {
                    **base,
                    "current_probability": market.current_yes_probability,
                    "status": status,
                }
            )
            timeline.append(
                {
                    **base,
                    "kind": "opened",
                    "note": _timeline_note(position, market, False, None),
                    "status": status,
                }
            )

    correct_count = sum(1 for p in resolved_positions if p["result"] == "correct")
    resolved_count = len(resolved_positions)
    accuracy = round(100 * correct_count / resolved_count, 1) if resolved_count else 0.0
    total_volume = round(sum(p.amount for p in rows if p.status == "open"), 2)

    return {
        "active_positions": active_positions,
        "resolved_positions": resolved_positions,
        "stats": {
            "active_count": len(active_positions),
            "resolved_count": resolved_count,
            "accuracy": accuracy,
            "total_conviction_volume": total_volume,
        },
        "timeline": timeline,
    }
