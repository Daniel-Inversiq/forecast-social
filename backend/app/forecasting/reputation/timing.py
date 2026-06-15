"""Timing engine — early correct calls matter exponentially more."""

import math

from app.forecasting.reputation.config import TimingConfig


def timing_multiplier(
    days_early: int,
    *,
    config: TimingConfig | None = None,
    consensus_formed: bool = False,
    broke_consensus: bool = False,
) -> tuple[float, dict]:
    """
    Compute timing multiplier and breakdown.

    - Correct call 30 days early → large multiplier
    - Correct call after consensus → small multiplier
    - Consensus-break bonus when contrarian and early
    """
    cfg = config or TimingConfig()
    days_early = max(0, min(days_early, cfg.max_days_early))

    if consensus_formed and not broke_consensus:
        early_factor = 0.25 + 0.1 * min(days_early / 10.0, 1.0)
    else:
        normalized = days_early / max(cfg.max_days_early, 1)
        early_factor = math.pow(normalized + 0.08, cfg.early_signal_exponent)
        early_factor = min(early_factor * 2.2, 2.5)

    consensus_bonus = cfg.consensus_break_bonus if broke_consensus and days_early >= 5 else 0.0
    post_consensus_scale = cfg.post_consensus_penalty if consensus_formed and not broke_consensus else 1.0

    multiplier = (early_factor * post_consensus_scale) + (consensus_bonus / 10.0)
    multiplier = round(max(0.15, min(multiplier, 3.0)), 3)

    breakdown = {
        "days_early": days_early,
        "early_factor": round(early_factor, 3),
        "consensus_formed": consensus_formed,
        "broke_consensus": broke_consensus,
        "consensus_break_bonus": round(consensus_bonus, 2),
        "post_consensus_scale": post_consensus_scale,
        "multiplier": multiplier,
    }
    return multiplier, breakdown


def estimate_days_early(seed: int, market_id: int | None = None) -> int:
    """Deterministic early-days estimate from entity ids (until oracle resolution exists)."""
    base = 3 + (seed % 28)
    if market_id:
        base += (market_id * 7) % 12
    return min(base, 42)


def consensus_state(
    market_probability: float | None,
    agent_side: str,
    *,
    contested_sides: int = 1,
) -> tuple[bool, bool]:
    """Return (consensus_formed, broke_consensus)."""
    if market_probability is None:
        return False, contested_sides >= 2

    consensus_yes = market_probability >= 62
    consensus_no = market_probability <= 38
    consensus_formed = consensus_yes or consensus_no

    agent_yes = agent_side.upper() == "YES"
    broke = (consensus_yes and not agent_yes) or (consensus_no and agent_yes)
    return consensus_formed, broke or contested_sides >= 2
