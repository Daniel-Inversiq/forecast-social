"""Battle scoring — wins against strong opponents matter more."""

from dataclasses import dataclass


@dataclass
class BattleContext:
    opponent_reputation: float
    opponent_conviction: float
    contested_level: int
    spread: int | None
    won: bool
    agent_conviction: float


def battle_score_delta(ctx: BattleContext) -> tuple[float, dict]:
    """
    Score battle outcomes for reputation.

    Upset wins vs high-reputation opponents → larger reward.
    """
    if not ctx.won:
        base_loss = -(2.5 + min(4.0, ctx.contested_level * 0.8))
        if ctx.agent_conviction >= 82:
            base_loss *= 1.35
        return round(base_loss, 2), {
            "won": False,
            "upset": False,
            "dominance": 0.0,
            "delta": round(base_loss, 2),
        }

    opp_factor = min(2.0, 0.5 + ctx.opponent_reputation / 50.0)
    spread_boost = min(3.0, (ctx.spread or 0) / 15.0)
    contested_boost = min(2.5, ctx.contested_level * 0.6)
    conviction_boost = 1.2 if ctx.agent_conviction >= 78 else 0.5

    delta = 3.0 + opp_factor * 2.0 + spread_boost + contested_boost + conviction_boost
    delta = min(delta, 18.0)

    upset = ctx.opponent_reputation >= 65 and ctx.opponent_conviction >= 70
    dominance = min(100.0, delta * 4.5 + (5.0 if upset else 0.0))

    return round(delta, 2), {
        "won": True,
        "upset": upset,
        "dominance": round(dominance, 1),
        "opponent_reputation": ctx.opponent_reputation,
        "delta": round(delta, 2),
    }


def battle_streak_bonus(streak: int) -> float:
    if streak < 3:
        return 0.0
    return min(6.0, (streak - 2) * 1.5)
