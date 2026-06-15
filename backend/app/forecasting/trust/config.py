"""SCRY trust tiers — distribution earned through forecasting quality."""

from dataclasses import dataclass


DISTRIBUTION_TAGLINE = "Distribution unlocked through trust."

DISTRIBUTION_PHILOSOPHY = [
    "Distribution is earned through forecasting quality — not payment or activity volume.",
    "Resolved calls, credibility, calibration, and clean participation unlock trust tiers.",
    "Higher trust tiers receive greater feed distribution weight.",
]


@dataclass(frozen=True)
class TrustedRequirements:
    resolved_calls: int = 20
    credibility: float = 100.0
    account_age_days: int = 14
    abuse_flags_max: int = 0


@dataclass(frozen=True)
class RankedRequirements:
    resolved_calls: int = 35
    credibility: float = 140.0
    calibration_min: float = 60.0


@dataclass(frozen=True)
class EliteRequirements:
    resolved_calls: int = 50
    credibility: float = 180.0
    reputation_score_min: float = 72.0
    calibration_min: float = 65.0


TRUSTED_REQUIREMENTS = TrustedRequirements()
RANKED_REQUIREMENTS = RankedRequirements()
ELITE_REQUIREMENTS = EliteRequirements()


@dataclass(frozen=True)
class TrustTierDef:
    key: str
    label: str
    distribution_weight: float
    utilities: tuple[str, ...]


TRUST_TIERS: tuple[TrustTierDef, ...] = (
    TrustTierDef(
        "observer",
        "Observer",
        0.35,
        (
            "Can forecast",
            "Can challenge",
            "Minimal distribution",
        ),
    ),
    TrustTierDef(
        "emerging",
        "Emerging",
        0.65,
        (
            "Limited feed distribution",
            "Appears in Rising section",
        ),
    ),
    TrustTierDef(
        "trusted",
        "Trusted",
        1.0,
        (
            "Eligible for For You feed",
            "Can start narratives",
            "Can appear in Public Reads",
            "Eligible for Ranked Battles",
        ),
    ),
    TrustTierDef(
        "ranked",
        "Ranked",
        1.35,
        (
            "Featured in leaderboards",
            "Increased distribution weight",
        ),
    ),
    TrustTierDef(
        "elite",
        "Elite",
        1.65,
        (
            "Priority feed distribution",
            "Featured forecaster",
        ),
    ),
    TrustTierDef(
        "verified",
        "Verified",
        1.0,
        ("Identity verification layer",),
    ),
)

TIER_BY_KEY = {t.key: t for t in TRUST_TIERS}
