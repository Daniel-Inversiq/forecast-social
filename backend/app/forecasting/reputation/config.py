"""Configurable weights and tier thresholds for the reputation engine."""

from dataclasses import dataclass, field


@dataclass(frozen=True)
class ReputationWeights:
    accuracy: float = 1.0
    timing: float = 1.4
    conviction: float = 1.2
    battle: float = 1.1
    calibration: float = 1.0
    consistency: float = 0.9
    contrarian: float = 1.15
    narrative: float = 1.05


@dataclass(frozen=True)
class TimingConfig:
    """Early calls compound — exponential decay of reward by lateness."""
    max_days_early: int = 45
    early_signal_exponent: float = 1.35
    consensus_break_bonus: float = 8.0
    post_consensus_penalty: float = 0.35


@dataclass(frozen=True)
class ConvictionConfig:
    low_threshold: float = 55.0
    high_threshold: float = 82.0
    correct_high_multiplier: float = 1.85
    wrong_high_multiplier: float = 1.65
    low_conviction_dampener: float = 0.45


@dataclass(frozen=True)
class DecayConfig:
    inactive_days_threshold: int = 21
    daily_decay_rate: float = 0.15
    max_decay_per_cycle: float = 3.0


@dataclass(frozen=True)
class ReputationTier:
    key: str
    label: str
    min_score: float


REPUTATION_TIERS: tuple[ReputationTier, ...] = (
    ReputationTier("emerging", "Emerging", 0),
    ReputationTier("trusted", "Trusted", 42),
    ReputationTier("proven", "Proven", 58),
    ReputationTier("elite", "Elite", 72),
    ReputationTier("legendary", "Legendary", 85),
    ReputationTier("consensus_breaker", "Consensus Breaker", 78),
)

# Consensus Breaker is a special tier — high contrarian success unlocks it
CONSENSUS_BREAKER_CONTRARIAN_MIN: float = 12.0


@dataclass
class ReputationEngineConfig:
    weights: ReputationWeights = field(default_factory=ReputationWeights)
    timing: TimingConfig = field(default_factory=TimingConfig)
    conviction: ConvictionConfig = field(default_factory=ConvictionConfig)
    decay: DecayConfig = field(default_factory=DecayConfig)
    base_score: float = 38.0


DEFAULT_CONFIG = ReputationEngineConfig()


def tier_for_score(
    score: float,
    *,
    contrarian_component: float = 0.0,
    has_consensus_break_milestone: bool = False,
) -> tuple[str, str]:
    """Return (tier_key, tier_label) for a composite reputation score."""
    if has_consensus_break_milestone or contrarian_component >= CONSENSUS_BREAKER_CONTRARIAN_MIN:
        if score >= REPUTATION_TIERS[3].min_score:
            return "consensus_breaker", "Consensus Breaker"

    tier = REPUTATION_TIERS[0]
    for t in REPUTATION_TIERS:
        if t.key == "consensus_breaker":
            continue
        if score >= t.min_score:
            tier = t
    return tier.key, tier.label
