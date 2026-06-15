"""Receipt pipeline observability for dev network-status and tick debugging."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy.orm import Session

from app.forecasting.agent_status import CORE_AGENT_SLUGS
from app.forecasting.models import AgentGeneratedActivity, ForecastResolution, MarketTake
from app.forecasting.services.activity_generation_sources import ACTIVITY_SOURCE_AUTONOMOUS
from app.forecasting.services.resolution_receipt_status import (
    count_pending_resolutions,
    scan_resolution_receipt_status,
)

RECEIPT_PIPELINE_LOG_MAX = 500
_receipt_attempt_log: list[dict[str, Any]] = []


def _utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _activity_source_expr(source: str):
    return AgentGeneratedActivity.metadata_json["source"].as_string() == source


def record_receipt_generation_attempt(
    *,
    outcome: str,
    reason: str | None = None,
    resolution_id: int | None = None,
    agent_slug: str | None = None,
) -> None:
    """Append to in-process ring buffer (newest first)."""
    global _receipt_attempt_log
    entry: dict[str, Any] = {
        "at": _utcnow().isoformat(),
        "outcome": outcome,
    }
    if reason:
        entry["reason"] = reason
    if resolution_id is not None:
        entry["resolution_id"] = resolution_id
    if agent_slug:
        entry["agent_slug"] = agent_slug
    _receipt_attempt_log.insert(0, entry)
    del _receipt_attempt_log[RECEIPT_PIPELINE_LOG_MAX:]


def clear_receipt_attempt_log() -> None:
    global _receipt_attempt_log
    _receipt_attempt_log = []


def _attempts_since(*, hours: int = 24) -> list[dict[str, Any]]:
    cutoff = _utcnow() - timedelta(hours=hours)
    out: list[dict[str, Any]] = []
    for entry in _receipt_attempt_log:
        at_raw = entry.get("at")
        if not at_raw:
            continue
        try:
            at = datetime.fromisoformat(str(at_raw))
        except ValueError:
            continue
        if at >= cutoff:
            out.append(entry)
    return out


def count_forecast_claims_since(db: Session, *, hours: int = 24) -> int:
    """MarketTake rows plus autonomous agent_post / conviction_update in the window."""
    cutoff = _utcnow() - timedelta(hours=hours)
    takes = (
        db.query(MarketTake)
        .filter(MarketTake.created_at >= cutoff)
        .count()
    )
    autonomous_forecasts = (
        db.query(AgentGeneratedActivity)
        .filter(
            AgentGeneratedActivity.created_at >= cutoff,
            AgentGeneratedActivity.activity_type.in_(("agent_post", "conviction_update")),
            AgentGeneratedActivity.agent_slug.in_(CORE_AGENT_SLUGS),
            _activity_source_expr(ACTIVITY_SOURCE_AUTONOMOUS),
        )
        .count()
    )
    return takes + autonomous_forecasts


def count_resolutions_since(db: Session, *, hours: int = 24) -> int:
    cutoff = _utcnow() - timedelta(hours=hours)
    return (
        db.query(ForecastResolution)
        .filter(ForecastResolution.resolved_at >= cutoff)
        .count()
    )


@dataclass(frozen=True)
class ReceiptPipelineMetrics:
    pending_resolutions: int
    resolution_candidates_last_24h: int
    forecast_claims_last_24h: int
    resolved_predictions_last_24h: int
    receipt_generation_attempts_last_24h: int
    receipt_generation_successes_last_24h: int
    receipt_generation_failures_last_24h: int
    receipt_generation_cooling_gate_failures_last_24h: int
    last_receipt_failure_reason: str | None
    pending_resolution_ids: list[int]
    handled_resolution_ids: list[int]
    unresolved_resolution_ids: list[int]

    def to_dict(self) -> dict[str, Any]:
        return {
            "pending_resolutions": self.pending_resolutions,
            "resolution_candidates_last_24h": self.resolution_candidates_last_24h,
            "forecast_claims_last_24h": self.forecast_claims_last_24h,
            "resolved_predictions_last_24h": self.resolved_predictions_last_24h,
            "receipt_generation_attempts_last_24h": self.receipt_generation_attempts_last_24h,
            "receipt_generation_successes_last_24h": self.receipt_generation_successes_last_24h,
            "receipt_generation_failures_last_24h": self.receipt_generation_failures_last_24h,
            "receipt_generation_cooling_gate_failures_last_24h": (
                self.receipt_generation_cooling_gate_failures_last_24h
            ),
            "last_receipt_failure_reason": self.last_receipt_failure_reason,
            "pending_resolution_ids": self.pending_resolution_ids,
            "handled_resolution_ids": self.handled_resolution_ids,
            "unresolved_resolution_ids": self.unresolved_resolution_ids,
        }


def compute_receipt_pipeline_metrics(db: Session) -> ReceiptPipelineMetrics:
    attempts = _attempts_since(hours=24)
    successes = sum(1 for a in attempts if a.get("outcome") == "success")
    failures = sum(1 for a in attempts if a.get("outcome") == "failure")
    cooling_gate_failures = sum(
        1 for a in attempts if a.get("outcome") == "failure" and a.get("reason") == "cooling_gate"
    )
    attempt_count = successes + failures
    last_failure: str | None = None
    for entry in attempts:
        if entry.get("outcome") == "failure":
            last_failure = str(entry.get("reason") or "unknown")
            break

    resolved_24h = count_resolutions_since(db, hours=24)
    resolution_status = scan_resolution_receipt_status(db)
    return ReceiptPipelineMetrics(
        pending_resolutions=count_pending_resolutions(db),
        resolution_candidates_last_24h=resolved_24h,
        forecast_claims_last_24h=count_forecast_claims_since(db, hours=24),
        resolved_predictions_last_24h=resolved_24h,
        receipt_generation_attempts_last_24h=attempt_count,
        receipt_generation_successes_last_24h=successes,
        receipt_generation_failures_last_24h=failures,
        receipt_generation_cooling_gate_failures_last_24h=cooling_gate_failures,
        last_receipt_failure_reason=last_failure,
        pending_resolution_ids=resolution_status.pending_resolution_ids,
        handled_resolution_ids=resolution_status.handled_resolution_ids,
        unresolved_resolution_ids=resolution_status.unresolved_resolution_ids,
    )
