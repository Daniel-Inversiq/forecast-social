"""Scry Reputation Milestones — prestige earned on the public record, not gamification."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class MilestoneDefinition:
    key: str
    title: str
    description: str
    category: str
    prestige: int = 50  # higher = more featured / cabinet priority


@dataclass
class MilestoneContext:
    """Signals gathered during reputation recalculation."""

    score: float = 0.0
    tier_key: str = "emerging"
    verified_calls: int = 0
    consensus_breaks: int = 0
    max_days_early: int = 0
    early_signal_count: int = 0
    ahead_consensus_count: int = 0
    calibration_label: str = "estimated"
    calibration_score: float = 0.0
    call_streak: int = 0
    streak_weeks: int = 0
    battle_wins: int = 0
    battle_win_streak: int = 0
    legendary_beats: int = 0
    split_dominance_wins: int = 0
    macro_battle_wins: int = 0
    narrative_leads: int = 0
    contrarian_component: float = 0.0
    timing_quality: float = 0.0
    crypto_verified: int = 0
    macro_verified: int = 0
    sports_verified: int = 0
    ai_verified: int = 0
    agent_slug: str = ""


MILESTONE_CATALOG: tuple[MilestoneDefinition, ...] = (
    # Timing
    MilestoneDefinition(
        "early_signal",
        "Early Signal",
        "Verified call issued before the network formed a view",
        "timing",
        prestige=62,
    ),
    MilestoneDefinition(
        "ahead_of_consensus",
        "Ahead of Consensus",
        "Correct call 14+ days before consensus crystallized",
        "timing",
        prestige=72,
    ),
    MilestoneDefinition(
        "timing_edge",
        "Timing Edge",
        "Sustained timing quality on contested markets",
        "timing",
        prestige=78,
    ),
    MilestoneDefinition(
        "first_mover",
        "First Mover",
        "Led narrative formation before the crowd followed",
        "timing",
        prestige=85,
    ),
    # Accuracy
    MilestoneDefinition(
        "verified_forecaster",
        "Verified Forecaster",
        "Five or more verified calls on the public ledger",
        "accuracy",
        prestige=58,
    ),
    MilestoneDefinition(
        "calibration_locked",
        "Calibration Locked",
        "Probability buckets align with realized outcomes",
        "accuracy",
        prestige=76,
    ),
    MilestoneDefinition(
        "five_call_streak",
        "5 Call Streak",
        "Five consecutive verified calls without a miss",
        "accuracy",
        prestige=74,
    ),
    MilestoneDefinition(
        "precision_desk",
        "Precision Desk",
        "Elite calibration across a deep verified sample",
        "accuracy",
        prestige=82,
    ),
    # Contrarian
    MilestoneDefinition(
        "consensus_breaker",
        "Consensus Breaker",
        "Three verified consensus-breaking calls",
        "contrarian",
        prestige=80,
    ),
    MilestoneDefinition(
        "crowd_fade",
        "Crowd Fade",
        "Repeated correct fades against crowded consensus",
        "contrarian",
        prestige=77,
    ),
    MilestoneDefinition(
        "lone_wolf",
        "Lone Wolf",
        "High-conviction divergence validated on record",
        "contrarian",
        prestige=73,
    ),
    MilestoneDefinition(
        "narrative_divergence",
        "Narrative Divergence",
        "Identified narrative splits before network repricing",
        "contrarian",
        prestige=71,
    ),
    # Battles
    MilestoneDefinition(
        "battle_winner",
        "Battle Winner",
        "Three or more contested battle victories",
        "battle",
        prestige=64,
    ),
    MilestoneDefinition(
        "beat_a_legendary",
        "Beat a Legendary",
        "Defeated a legendary-tier forecaster in open battle",
        "battle",
        prestige=88,
    ),
    MilestoneDefinition(
        "split_dominator",
        "Split Dominator",
        "Won high-spread battles with decisive conviction edge",
        "battle",
        prestige=79,
    ),
    MilestoneDefinition(
        "macro_slayer",
        "Macro Slayer",
        "Battle dominance on macro and rates markets",
        "battle",
        prestige=81,
    ),
    # Reputation tiers (earned prestige)
    MilestoneDefinition(
        "trusted",
        "Trusted",
        "Reputation crossed the trusted threshold on Scry",
        "reputation",
        prestige=55,
    ),
    MilestoneDefinition(
        "proven",
        "Proven",
        "Sustained public record at proven tier",
        "reputation",
        prestige=68,
    ),
    MilestoneDefinition(
        "elite",
        "Elite",
        "Elite standing among network forecasters",
        "reputation",
        prestige=84,
    ),
    MilestoneDefinition(
        "legendary",
        "Legendary",
        "Legendary reputation — top echelon of the trust graph",
        "reputation",
        prestige=95,
    ),
    # Market specialization
    MilestoneDefinition(
        "crypto_specialist",
        "Crypto Specialist",
        "Dominant verified record in crypto markets",
        "specialization",
        prestige=70,
    ),
    MilestoneDefinition(
        "macro_desk",
        "Macro Desk",
        "Institutional-grade macro and rates verification",
        "specialization",
        prestige=75,
    ),
    MilestoneDefinition(
        "sports_edge",
        "Sports Edge",
        "Verified edge in sports forecasting markets",
        "specialization",
        prestige=66,
    ),
    MilestoneDefinition(
        "ai_forecaster",
        "AI Forecaster",
        "Leading verified calls on AI and tech catalysts",
        "specialization",
        prestige=72,
    ),
)

_CATALOG = {m.key: m for m in MILESTONE_CATALOG}

# Scarcity gate: agents below this composite score cannot unlock prestige battle/tier peaks
_ELITE_SCORE_FLOOR = 70.0
_LEGENDARY_SCORE_FLOOR = 84.0


def _category_bucket(market_category: str, agent_niche: str) -> str | None:
    c = market_category.lower()
    n = agent_niche.lower()
    if "crypto" in c or n == "crypto":
        return "crypto"
    if any(x in c for x in ("macro", "rates", "credit", "equities", "commodities")) or n in (
        "macro",
        "rates",
        "credit",
        "equities",
        "multi",
    ):
        return "macro"
    if "sport" in c or n == "sports":
        return "sports"
    if any(x in c for x in ("tech", "ai")) or n in ("tech",):
        return "ai"
    return None


def market_specialization_bucket(market_category: str, agent_niche: str) -> str | None:
    """Map a market + agent niche to specialization bucket."""
    return _category_bucket(market_category, agent_niche)


def evaluate_milestones(ctx: MilestoneContext) -> list[dict]:
    """Return newly eligible milestones. Thresholds are strict — scarcity is intentional."""
    unlocked: list[dict] = []

    checks: list[tuple[str, bool]] = [
        # Timing — rare without real early calls
        ("early_signal", ctx.early_signal_count >= 2 or ctx.max_days_early >= 10),
        (
            "ahead_of_consensus",
            ctx.ahead_consensus_count >= 1 or ctx.max_days_early >= 16,
        ),
        (
            "timing_edge",
            ctx.timing_quality >= 78.0 and ctx.verified_calls >= 4,
        ),
        (
            "first_mover",
            ctx.narrative_leads >= 2 and ctx.max_days_early >= 12,
        ),
        # Accuracy
        ("verified_forecaster", ctx.verified_calls >= 5),
        (
            "calibration_locked",
            ctx.calibration_label == "well_calibrated" and ctx.verified_calls >= 4,
        ),
        ("five_call_streak", ctx.call_streak >= 5 or ctx.streak_weeks >= 5),
        (
            "precision_desk",
            ctx.calibration_score >= 76.0 and ctx.verified_calls >= 8,
        ),
        # Contrarian — requires demonstrated breaks
        ("consensus_breaker", ctx.consensus_breaks >= 3),
        (
            "crowd_fade",
            ctx.consensus_breaks >= 4 and ctx.contrarian_component >= 8.0,
        ),
        (
            "lone_wolf",
            ctx.consensus_breaks >= 2
            and ctx.verified_calls >= 6
            and ctx.contrarian_component >= 10.0,
        ),
        ("narrative_divergence", ctx.narrative_leads >= 3),
        # Battles
        ("battle_winner", ctx.battle_wins >= 3),
        ("beat_a_legendary", ctx.legendary_beats >= 1),
        ("split_dominator", ctx.split_dominance_wins >= 2),
        (
            "macro_slayer",
            ctx.macro_battle_wins >= 1
            or (ctx.macro_verified >= 6 and ctx.battle_wins >= 2),
        ),
        # Reputation tiers
        ("trusted", ctx.score >= 42.0),
        ("proven", ctx.score >= 58.0),
        ("elite", ctx.score >= 72.0 and ctx.verified_calls >= 3),
        (
            "legendary",
            ctx.score >= _LEGENDARY_SCORE_FLOOR and ctx.verified_calls >= 6,
        ),
        # Specialization — dominant category sample
        ("crypto_specialist", ctx.crypto_verified >= 4),
        ("macro_desk", ctx.macro_verified >= 5),
        ("sports_edge", ctx.sports_verified >= 4),
        ("ai_forecaster", ctx.ai_verified >= 4),
    ]

    # Scarcity: cap elite battle milestones unless score supports prestige
    if ctx.score < _ELITE_SCORE_FLOOR:
        elite_only = {
            "beat_a_legendary",
            "legendary",
            "precision_desk",
            "first_mover",
            "timing_edge",
        }
        checks = [(k, met and k not in elite_only) for k, met in checks]

    for key, met in checks:
        if not met:
            continue
        m = _CATALOG[key]
        unlocked.append({
            "key": m.key,
            "title": m.title,
            "description": m.description,
            "category": m.category,
            "prestige": m.prestige,
        })
    return unlocked


def select_featured_milestones(
    milestones: list[dict],
    *,
    max_count: int = 3,
) -> list[dict]:
    """Pick cabinet-featured milestones by prestige rank."""
    if not milestones:
        return []
    ranked = sorted(
        milestones,
        key=lambda m: (-m.get("prestige", 50), m.get("unlocked_at") or ""),
    )
    return ranked[:max_count]


def milestone_catalog_for_api() -> list[dict]:
    """Public catalog for UI — locked milestones shown as aspirational."""
    return [
        {
            "key": m.key,
            "title": m.title,
            "description": m.description,
            "category": m.category,
            "prestige": m.prestige,
        }
        for m in MILESTONE_CATALOG
    ]
