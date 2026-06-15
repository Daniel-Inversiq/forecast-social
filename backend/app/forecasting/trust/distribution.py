"""Trust tier resolution and feed distribution weights."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

from app.forecasting.trust.config import (
    DISTRIBUTION_TAGLINE,
    ELITE_REQUIREMENTS,
    RANKED_REQUIREMENTS,
    TIER_BY_KEY,
    TRUSTED_REQUIREMENTS,
    TrustTierDef,
)


@dataclass(frozen=True)
class TrustInputs:
    resolved_calls: int = 0
    credibility: float = 0.0
    account_age_days: int = 0
    abuse_flags: int = 0
    calibration_score: float = 50.0
    reputation_score: float = 0.0
    identity_verified: bool = False


@dataclass(frozen=True)
class TrustEvaluation:
    tier_key: str
    tier_label: str
    distribution_weight: float
    utilities: tuple[str, ...]
    identity_verified: bool
    meets_trusted: bool
    trusted_progress: dict
    tagline: str = DISTRIBUTION_TAGLINE

    def to_dict(self) -> dict:
        return {
            "trust_tier_key": self.tier_key,
            "trust_tier_label": self.tier_label,
            "trust_distribution_weight": self.distribution_weight,
            "trust_utilities": list(self.utilities),
            "trust_identity_verified": self.identity_verified,
            "trust_meets_trusted_requirements": self.meets_trusted,
            "trust_trusted_progress": self.trusted_progress,
            "trust_tagline": self.tagline,
            "trust_for_you_eligible": self.tier_key in ("trusted", "ranked", "elite"),
            "trust_rising_eligible": self.tier_key in ("emerging", "trusted", "ranked", "elite"),
            "trust_leaderboard_featured": self.tier_key in ("ranked", "elite"),
            "trust_priority_distribution": self.tier_key == "elite",
            "trust_can_start_narratives": self.meets_trusted,
            "trust_public_reads_eligible": self.meets_trusted,
            "trust_ranked_battles_eligible": self.meets_trusted,
        }


def account_age_days(created_at: datetime | None, *, now: datetime | None = None) -> int:
    if not created_at:
        return 0
    ref = now or datetime.utcnow()
    delta = ref - created_at
    return max(0, delta.days)


def meets_trusted_requirements(inp: TrustInputs) -> bool:
    req = TRUSTED_REQUIREMENTS
    return (
        inp.resolved_calls >= req.resolved_calls
        and inp.credibility >= req.credibility
        and inp.account_age_days >= req.account_age_days
        and inp.abuse_flags <= req.abuse_flags_max
    )


def _trusted_progress(inp: TrustInputs) -> dict:
    req = TRUSTED_REQUIREMENTS
    return {
        "resolved_calls": {"current": inp.resolved_calls, "required": req.resolved_calls},
        "credibility": {"current": round(inp.credibility, 1), "required": req.credibility},
        "account_age_days": {"current": inp.account_age_days, "required": req.account_age_days},
        "abuse_flags": {"current": inp.abuse_flags, "required": req.abuse_flags_max},
    }


def _tier_def(key: str) -> TrustTierDef:
    return TIER_BY_KEY.get(key, TIER_BY_KEY["observer"])


def resolve_trust_tier(inp: TrustInputs) -> TrustEvaluation:
    """Map forecasting record to a trust tier and distribution weight."""
    meets_trusted = meets_trusted_requirements(inp)

    if inp.resolved_calls < 3:
        tier_key = "observer"
    elif not meets_trusted:
        tier_key = "emerging"
    elif (
        inp.resolved_calls >= ELITE_REQUIREMENTS.resolved_calls
        and inp.credibility >= ELITE_REQUIREMENTS.credibility
        and inp.reputation_score >= ELITE_REQUIREMENTS.reputation_score_min
        and inp.calibration_score >= ELITE_REQUIREMENTS.calibration_min
    ):
        tier_key = "elite"
    elif (
        inp.resolved_calls >= RANKED_REQUIREMENTS.resolved_calls
        and inp.credibility >= RANKED_REQUIREMENTS.credibility
        and inp.calibration_score >= RANKED_REQUIREMENTS.calibration_min
    ):
        tier_key = "ranked"
    else:
        tier_key = "trusted"

    tier = _tier_def(tier_key)
    utilities = list(tier.utilities)
    if inp.identity_verified:
        utilities.append("Verified identity layer")

    return TrustEvaluation(
        tier_key=tier.key,
        tier_label=tier.label,
        distribution_weight=tier.distribution_weight,
        utilities=tuple(utilities),
        identity_verified=inp.identity_verified,
        meets_trusted=meets_trusted,
        trusted_progress=_trusted_progress(inp),
    )


def trust_from_agent_rep(
    *,
    verified_calls: int,
    reputation_score: float,
    calibration_score: float,
    created_at: datetime | None,
    abuse_flags: int = 0,
    identity_verified: bool = False,
) -> TrustEvaluation:
    return resolve_trust_tier(
        TrustInputs(
            resolved_calls=verified_calls,
            credibility=float(reputation_score),
            account_age_days=account_age_days(created_at),
            abuse_flags=abuse_flags,
            calibration_score=calibration_score,
            reputation_score=reputation_score,
            identity_verified=identity_verified,
        )
    )
