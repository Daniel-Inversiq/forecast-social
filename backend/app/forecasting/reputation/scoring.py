"""Weighted reputation scoring — combines all signal components."""

from dataclasses import dataclass, field

from app.forecasting.reputation.battles import BattleContext, battle_score_delta
from app.forecasting.reputation.calibration import CalibrationPoint, calibration_component_score
from app.forecasting.reputation.config import ReputationEngineConfig, DEFAULT_CONFIG
from app.forecasting.reputation.conviction import conviction_amplifier
from app.forecasting.reputation.timing import (
    consensus_state,
    estimate_days_early,
    timing_multiplier,
)


@dataclass
class ScoreInput:
    """Single scoring event (forecast resolution, battle, streak, etc.)."""
    event_type: str
    correct: bool | None = None
    confidence: float = 70.0
    days_early: int | None = None
    seed: int = 0
    market_id: int | None = None
    market_probability: float | None = None
    agent_side: str = "YES"
    contested_sides: int = 1
    opponent_reputation: float = 50.0
    opponent_conviction: float = 70.0
    spread: int | None = None
    battle_won: bool | None = None
    narrative_lead: bool = False
    streak_weeks: int = 0


@dataclass
class ComponentScores:
    accuracy: float = 0.0
    timing: float = 0.0
    conviction: float = 0.0
    battle: float = 0.0
    calibration: float = 0.0
    consistency: float = 0.0
    contrarian: float = 0.0
    narrative: float = 0.0

    def weighted_total(self, config: ReputationEngineConfig = DEFAULT_CONFIG) -> float:
        w = config.weights
        return (
            self.accuracy * w.accuracy
            + self.timing * w.timing
            + self.conviction * w.conviction
            + self.battle * w.battle
            + self.calibration * w.calibration
            + self.consistency * w.consistency
            + self.contrarian * w.contrarian
            + self.narrative * w.narrative
        ) / (
            w.accuracy
            + w.timing
            + w.conviction
            + w.battle
            + w.calibration
            + w.consistency
            + w.contrarian
            + w.narrative
        )


@dataclass
class ScoreResult:
    delta: float
    components: ComponentScores
    breakdown: dict = field(default_factory=dict)
    category: str = "forecast_resolution"


def score_event(
    inp: ScoreInput,
    *,
    config: ReputationEngineConfig = DEFAULT_CONFIG,
) -> ScoreResult:
    """Compute reputation delta for a single event."""
    components = ComponentScores()
    breakdown: dict = {"event_type": inp.event_type}

    if inp.event_type == "battle":
        ctx = BattleContext(
            opponent_reputation=inp.opponent_reputation,
            opponent_conviction=inp.opponent_conviction,
            contested_level=inp.contested_sides,
            spread=inp.spread,
            won=inp.battle_won or False,
            agent_conviction=inp.confidence,
        )
        delta, battle_bd = battle_score_delta(ctx)
        components.battle = abs(delta) if delta > 0 else 0
        breakdown["battle"] = battle_bd
        return ScoreResult(
            delta=delta,
            components=components,
            breakdown=breakdown,
            category="contested_win" if delta > 0 else "missed_call",
        )

    if inp.event_type == "streak":
        bonus = min(6.0, 1.5 + inp.streak_weeks * 0.4)
        components.consistency = bonus
        return ScoreResult(
            delta=round(bonus, 2),
            components=components,
            breakdown={"streak_weeks": inp.streak_weeks},
            category="streak",
        )

    if inp.event_type == "leaderboard_move":
        delta = 2.0 + min(5.0, inp.seed % 6)
        components.consistency = delta * 0.5
        return ScoreResult(
            delta=round(delta, 2),
            components=components,
            breakdown={"rank_climb": delta},
            category="leaderboard_move",
        )

    # Forecast resolution path (receipt, take, verified call)
    correct = inp.correct if inp.correct is not None else True
    days_early = inp.days_early if inp.days_early is not None else estimate_days_early(inp.seed, inp.market_id)
    consensus_formed, broke_consensus = consensus_state(
        inp.market_probability,
        inp.agent_side,
        contested_sides=inp.contested_sides,
    )

    timing_mult, timing_bd = timing_multiplier(
        days_early,
        config=config.timing,
        consensus_formed=consensus_formed,
        broke_consensus=broke_consensus,
    )
    conv_mult, conv_bd = conviction_amplifier(inp.confidence, correct, config=config.conviction)

    if correct:
        base = 3.0 + timing_mult * 4.0
        if broke_consensus:
            base += config.timing.consensus_break_bonus * 0.35
            components.contrarian = min(15.0, base * 0.4)
        components.accuracy = base * 0.35
        components.timing = timing_mult * 5.0
        components.conviction = conv_mult * 2.5
        if inp.narrative_lead:
            components.narrative = 4.0 + min(4.0, days_early / 8.0)
        delta = (base + components.narrative) * conv_mult
        delta = min(delta, 22.0)
        category = "verified_receipt"
        if broke_consensus:
            category = "consensus_break"
    else:
        base = -(2.5 + timing_mult * 0.8)
        components.accuracy = abs(base) * 0.3
        components.timing = timing_mult * 0.5
        components.conviction = conv_mult * 2.0
        delta = base * conv_mult
        delta = max(delta, -14.0)
        category = "missed_call"

    breakdown["timing"] = timing_bd
    breakdown["conviction"] = conv_bd
    breakdown["days_early"] = days_early
    breakdown["consensus_break"] = broke_consensus

    return ScoreResult(
        delta=round(delta, 2),
        components=components,
        breakdown=breakdown,
        category=category,
    )


def composite_reputation_score(
    components: ComponentScores,
    *,
    base: float = 38.0,
    config: ReputationEngineConfig = DEFAULT_CONFIG,
) -> float:
    """Map accumulated components to 0–100 public reputation score."""
    weighted = components.weighted_total(config)
    raw = base + weighted * 0.55
    return round(max(0.0, min(100.0, raw)), 1)


def aggregate_components(events: list[ComponentScores]) -> ComponentScores:
    if not events:
        return ComponentScores()
    n = len(events)
    return ComponentScores(
        accuracy=sum(e.accuracy for e in events) / n,
        timing=sum(e.timing for e in events) / n,
        conviction=sum(e.conviction for e in events) / n,
        battle=sum(e.battle for e in events) / n,
        calibration=sum(e.calibration for e in events) / n,
        consistency=sum(e.consistency for e in events) / n,
        contrarian=sum(e.contrarian for e in events) / n,
        narrative=sum(e.narrative for e in events) / n,
    )


def calibration_from_points(
    points: list[CalibrationPoint],
    seed_accuracy: float,
) -> tuple[float, dict]:
    score, bd = calibration_component_score(points, seed_accuracy=seed_accuracy)
    return score, bd
