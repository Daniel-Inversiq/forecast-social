"""Structured failure metadata for autonomous activity generation."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class ActivityFailure:
    """Why an activity could not be created."""

    code: str
    source: str
    missing_prerequisite: str | None = None
    recoverable: bool = True

    def as_decision_log(self) -> dict[str, Any]:
        return {
            "code": self.code,
            "source": self.source,
            "missing_prerequisite": self.missing_prerequisite,
            "recoverable": self.recoverable,
        }


def record_failure(
    sink: dict[str, Any] | None,
    failure: ActivityFailure,
) -> None:
    """Write failure metadata into an optional caller-provided dict."""
    if sink is not None:
        sink.clear()
        sink.update(failure.as_decision_log())


THREAD_LIMIT_FAILURE_CODES = frozenset({"thread_depth_limit", "thread_agent_limit"})

RIVAL_QUALITY_FAILURE_CODES = frozenset(
    {
        "quality_gate_exhausted",
        "missing_context_reference",
        "generic_disagreement",
        "generic_agreement",
    }
)

DUPLICATE_HASH_FAILURE_CODE = "duplicate_body_hash"

RECOVERY_ACTIONS = frozenset(
    {
        "created_network_pulse",
        "started_new_thread",
        "safe_agent_post",
        "conviction_update",
        "rival_reply_retry",
    }
)
