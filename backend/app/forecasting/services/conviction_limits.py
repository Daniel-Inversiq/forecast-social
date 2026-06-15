from sqlalchemy import func
from sqlalchemy.orm import Session

from app.forecasting.models import ConvictionBalance, ConvictionPosition
from app.settings import max_market_exposure_usdc, max_user_exposure_usdc

MAX_MARKET_EXPOSURE_USDC = max_market_exposure_usdc()
DEFAULT_USER_EXPOSURE_CAP_USDC = max_user_exposure_usdc()


def user_exposure_cap(balance: ConvictionBalance | None) -> float:
    if not balance or balance.user_exposure_cap <= 0:
        return DEFAULT_USER_EXPOSURE_CAP_USDC
    return float(balance.user_exposure_cap)


def open_market_exposure(db: Session, user_id: int, market_id: int) -> float:
    value = (
        db.query(func.coalesce(func.sum(ConvictionPosition.amount), 0.0))
        .filter(
            ConvictionPosition.user_id == user_id,
            ConvictionPosition.market_id == market_id,
            ConvictionPosition.status == "open",
        )
        .scalar()
    )
    return float(value or 0.0)


def open_user_exposure(db: Session, user_id: int) -> float:
    value = (
        db.query(func.coalesce(func.sum(ConvictionPosition.amount), 0.0))
        .filter(
            ConvictionPosition.user_id == user_id,
            ConvictionPosition.status == "open",
        )
        .scalar()
    )
    return float(value or 0.0)


def validate_exposure_limits(
    *,
    db: Session,
    user_id: int,
    market_id: int,
    amount: float,
    balance: ConvictionBalance | None,
) -> None:
    next_market_exposure = open_market_exposure(db, user_id, market_id) + amount
    if next_market_exposure > MAX_MARKET_EXPOSURE_USDC:
        raise ValueError(
            f"Per-market exposure cap exceeded ({MAX_MARKET_EXPOSURE_USDC:.0f} USDC max)"
        )

    next_total_exposure = open_user_exposure(db, user_id) + amount
    cap = user_exposure_cap(balance)
    if next_total_exposure > cap:
        raise ValueError(f"Global exposure cap exceeded ({cap:.0f} USDC max)")
