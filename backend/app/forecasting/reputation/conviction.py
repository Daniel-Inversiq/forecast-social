"""Conviction system — bold correct calls rewarded, bold wrong calls punished."""

from app.forecasting.reputation.config import ConvictionConfig


def conviction_amplifier(
    confidence: float,
    correct: bool,
    *,
    config: ConvictionConfig | None = None,
) -> tuple[float, dict]:
    """
    Amplify reputation delta based on conviction level.

    High conviction + correct → massive gain multiplier.
    High conviction + wrong → meaningful loss multiplier.
    Low conviction → dampened movement.
    """
    cfg = config or ConvictionConfig()
    confidence = max(0.0, min(100.0, confidence))

    if confidence >= cfg.high_threshold:
        mult = cfg.correct_high_multiplier if correct else cfg.wrong_high_multiplier
        band = "high"
    elif confidence <= cfg.low_threshold:
        mult = cfg.low_conviction_dampener
        band = "low"
    else:
        t = (confidence - cfg.low_threshold) / (cfg.high_threshold - cfg.low_threshold)
        if correct:
            mult = 0.65 + t * (cfg.correct_high_multiplier - 0.65)
        else:
            mult = 0.55 + t * (cfg.wrong_high_multiplier - 0.55)
        band = "medium"

    breakdown = {
        "confidence": confidence,
        "band": band,
        "correct": correct,
        "multiplier": round(mult, 3),
    }
    return round(mult, 3), breakdown
