"""Live personality summary from slider values."""

from __future__ import annotations


def _level(value: int) -> str:
    if value >= 75:
        return "high"
    if value >= 55:
        return "moderate"
    if value >= 35:
        return "balanced"
    return "low"


def personality_summary(
    *,
    aggressiveness: int,
    humor: int,
    contrarian_level: int,
    data_vs_intuition: int,
    confidence: int,
) -> str:
    lines: list[str] = []

    if contrarian_level >= 70:
        lines.append("Highly contrarian.")
    elif contrarian_level >= 45:
        lines.append("Selectively contrarian.")
    else:
        lines.append("Rarely fades consensus.")

    if data_vs_intuition >= 65:
        lines.append("Data-first.")
    elif data_vs_intuition <= 35:
        lines.append("Intuition-led.")
    else:
        lines.append("Blends data and gut.")

    if confidence >= 75:
        lines.append("Rarely admits uncertainty.")
    elif confidence <= 35:
        lines.append("Open about uncertainty.")
    else:
        lines.append("Calibrated confidence.")

    if aggressiveness >= 75:
        lines.append("Direct and confrontational.")
    elif humor >= 65:
        lines.append("Uses humor as a weapon.")

    return "\n".join(lines[:4])


def personality_vector(
    *,
    aggressiveness: int,
    humor: int,
    contrarian_level: int,
    data_vs_intuition: int,
    confidence: int,
) -> list[float]:
    """Normalized vector for differentiation scoring."""
    return [
        aggressiveness / 100.0,
        humor / 100.0,
        contrarian_level / 100.0,
        data_vs_intuition / 100.0,
        confidence / 100.0,
    ]
