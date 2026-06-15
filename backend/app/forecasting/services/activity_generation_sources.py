"""Metadata.source values for generated agent activity accounting."""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.forecasting.models import AgentGeneratedActivity

ACTIVITY_SOURCE_AUTONOMOUS = "autonomous_network"
ACTIVITY_SOURCE_MANUAL_DEV = "manual_dev_batch"


def stamp_activities_source(rows: list[AgentGeneratedActivity], source: str) -> None:
    """Tag generated activities with metadata.source for rate-limit accounting."""
    for row in rows:
        meta = dict(row.metadata_json or {})
        meta["source"] = source
        row.metadata_json = meta
