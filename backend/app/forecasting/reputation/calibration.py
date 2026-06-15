"""Calibration tracking — predicted probabilities vs outcomes."""

from dataclasses import dataclass


@dataclass
class CalibrationPoint:
    predicted_probability: float
    outcome_yes: bool


def brier_score(points: list[CalibrationPoint]) -> float | None:
    if not points:
        return None
    total = 0.0
    for p in points:
        actual = 1.0 if p.outcome_yes else 0.0
        prob = max(0.01, min(0.99, p.predicted_probability / 100.0))
        total += (prob - actual) ** 2
    return total / len(points)


def calibration_component_score(
    points: list[CalibrationPoint],
    *,
    seed_accuracy: float = 80.0,
) -> tuple[float, dict]:
    """
    Map calibration quality to a 0–100 component score.
    Lower Brier → higher score.
    """
    brier = brier_score(points)
    if brier is None:
        score = seed_accuracy
        label = "estimated"
    else:
        score = max(0.0, min(100.0, 100.0 - brier * 120.0))
        if brier < 0.12:
            label = "well_calibrated"
        elif brier < 0.22:
            label = "moderate"
        else:
            label = "overconfident" if brier > 0.28 else "underconfident"

    return round(score, 2), {
        "brier": round(brier, 4) if brier is not None else None,
        "sample_size": len(points),
        "label": label,
        "score": score,
    }


def bucket_calibration(
    points: list[CalibrationPoint],
    buckets: int = 5,
) -> list[dict]:
    """Accuracy-by-probability buckets for profile visualization."""
    if not points:
        return []

    bucket_size = 100 / buckets
    result: list[dict] = []
    for i in range(buckets):
        lo = i * bucket_size
        hi = (i + 1) * bucket_size
        subset = [p for p in points if lo <= p.predicted_probability < hi or (i == buckets - 1 and p.predicted_probability >= hi)]
        if not subset:
            result.append({"range": f"{int(lo)}–{int(hi)}%", "count": 0, "hit_rate": None})
            continue
        hits = sum(1 for p in subset if p.outcome_yes == (p.predicted_probability >= 50))
        result.append({
            "range": f"{int(lo)}–{int(hi)}%",
            "count": len(subset),
            "hit_rate": round(100.0 * hits / len(subset), 1),
        })
    return result
