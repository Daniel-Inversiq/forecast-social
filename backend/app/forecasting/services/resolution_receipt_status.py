"""Resolution-specific receipt handling status for the autonomous pipeline."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy.orm import Session

from app.forecasting.models import AgentGeneratedActivity, ForecastResolution

# Activity types that can handle a ForecastResolution when tagged with resolution_id.
RESOLUTION_RECEIPT_ACTIVITY_TYPES = (
    "receipt_victory",
    "receipt_reaction",
    "receipt_challenge",
)

RESOLUTION_LOOKBACK_HOURS = 6
RESOLUTION_SCAN_LIMIT = 12
UNRESOLVED_LOOKBACK_HOURS = 24


def _utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _resolution_id_expr(resolution_id: int):
    return AgentGeneratedActivity.metadata_json["resolution_id"].as_integer() == resolution_id


def resolution_has_handling_receipt(db: Session, resolution: ForecastResolution) -> bool:
    """True when a receipt activity explicitly references this resolution."""
    return (
        db.query(AgentGeneratedActivity)
        .filter(
            AgentGeneratedActivity.activity_type.in_(RESOLUTION_RECEIPT_ACTIVITY_TYPES),
            _resolution_id_expr(resolution.id),
        )
        .first()
        is not None
    )


def _recent_resolutions(
    db: Session,
    *,
    lookback_hours: int,
    limit: int,
) -> list[ForecastResolution]:
    cutoff = _utcnow() - timedelta(hours=lookback_hours)
    return (
        db.query(ForecastResolution)
        .filter(ForecastResolution.resolved_at >= cutoff)
        .order_by(ForecastResolution.resolved_at.desc())
        .limit(limit)
        .all()
    )


@dataclass(frozen=True)
class ResolutionReceiptStatus:
    pending_resolution_ids: list[int]
    handled_resolution_ids: list[int]
    unresolved_resolution_ids: list[int]

    @property
    def has_pending(self) -> bool:
        return bool(self.pending_resolution_ids)

    def to_dict(self) -> dict[str, Any]:
        return {
            "pending_resolution_ids": self.pending_resolution_ids,
            "handled_resolution_ids": self.handled_resolution_ids,
            "unresolved_resolution_ids": self.unresolved_resolution_ids,
        }


def scan_resolution_receipt_status(
    db: Session,
    *,
    pending_lookback_hours: int = RESOLUTION_LOOKBACK_HOURS,
    pending_limit: int = RESOLUTION_SCAN_LIMIT,
    unresolved_lookback_hours: int = UNRESOLVED_LOOKBACK_HOURS,
) -> ResolutionReceiptStatus:
    """Classify recent resolutions by resolution-specific receipt handling."""
    pending: list[int] = []
    handled: list[int] = []
    for resolution in _recent_resolutions(
        db, lookback_hours=pending_lookback_hours, limit=pending_limit
    ):
        if resolution_has_handling_receipt(db, resolution):
            handled.append(resolution.id)
        else:
            pending.append(resolution.id)

    unresolved: list[int] = []
    unresolved_cutoff_ids = {
        r.id
        for r in db.query(ForecastResolution)
        .filter(ForecastResolution.resolved_at >= _utcnow() - timedelta(hours=unresolved_lookback_hours))
        .order_by(ForecastResolution.resolved_at.desc())
        .all()
    }
    for resolution_id in sorted(unresolved_cutoff_ids, reverse=True):
        resolution = db.get(ForecastResolution, resolution_id)
        if resolution and not resolution_has_handling_receipt(db, resolution):
            unresolved.append(resolution_id)

    return ResolutionReceiptStatus(
        pending_resolution_ids=pending,
        handled_resolution_ids=handled,
        unresolved_resolution_ids=unresolved,
    )


def has_pending_resolution(db: Session) -> bool:
    """True when a recent forecast resolution lacks a resolution-specific receipt."""
    return scan_resolution_receipt_status(db).has_pending


def count_pending_resolutions(
    db: Session,
    *,
    lookback_hours: int = RESOLUTION_LOOKBACK_HOURS,
) -> int:
    """Count resolutions in lookback window lacking resolution-specific receipts."""
    status = scan_resolution_receipt_status(
        db,
        pending_lookback_hours=lookback_hours,
        pending_limit=RESOLUTION_SCAN_LIMIT,
    )
    return len(status.pending_resolution_ids)
