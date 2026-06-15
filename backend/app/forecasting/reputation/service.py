"""Reputation calculation service, recalculation pipeline, and API helpers."""

from collections import defaultdict
from datetime import datetime, timedelta, timezone

from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.forecasting.models import (
    Agent,
    AgentReputation,
    BattleOutcome,
    CalibrationRecord,
    FeedEvent,
    ForecastResolution,
    Market,
    MarketTake,
    NarrativeImpact,
    Position,
    ReputationEvent,
    ReputationHistory,
    ReputationMilestone,
    TimingScore,
)
from app.forecasting.reputation.calibration import (
    CalibrationPoint,
    bucket_calibration,
    calibration_component_score,
)
from app.forecasting.reputation.config import DEFAULT_CONFIG, tier_for_score
from app.forecasting.trust.distribution import trust_from_agent_rep
from app.forecasting.reputation.featured_marks import (
    agent_featured_payload,
    get_user_equipped_keys,
    load_milestone_map_by_agent,
    resolve_featured_marks,
)
from app.forecasting.reputation.milestones import (
    MILESTONE_CATALOG,
    MilestoneContext,
    evaluate_milestones,
    market_specialization_bucket,
    milestone_catalog_for_api,
)
from app.forecasting.reputation.scoring import (
    ComponentScores,
    ScoreInput,
    aggregate_components,
    composite_reputation_score,
    score_event,
)
from app.forecasting.reputation.timing import estimate_days_early, timing_multiplier
from app.forecasting.services.utils import hash_seed, iso_dt, parse_spread, stats_for_slug


def _hash(*parts) -> int:
    return hash_seed(*parts)


def _final_outcome(side: str, seed: str) -> str:
    if _hash(seed, "verified") % 8 == 0:
        return "NO" if side.upper() == "YES" else "YES"
    return side.upper()


def _contested_by_market(takes: list[MarketTake], positions: list[Position]) -> dict[int, int]:
    sides: dict[int, set[str]] = defaultdict(set)
    for take in takes:
        if take.market_id:
            sides[take.market_id].add(take.side)
    for pos in positions:
        sides[pos.market_id].add(pos.side)
    return {mid: len(s) for mid, s in sides.items() if len(s) > 1}


def _agent_side_from_event(event: FeedEvent) -> str:
    if event.probability is not None:
        return "YES" if event.probability >= 50 else "NO"
    return "YES"


class ReputationService:
    def __init__(self, db: Session, config=DEFAULT_CONFIG):
        self.db = db
        self.config = config

    def recalculate_all(self) -> int:
        """Full recalculation pipeline for all agents."""
        self._clear_ledger()
        agents = self.db.query(Agent).all()
        events = (
            self.db.query(FeedEvent)
            .options(joinedload(FeedEvent.agent), joinedload(FeedEvent.market))
            .order_by(FeedEvent.created_at.asc())
            .all()
        )
        takes = (
            self.db.query(MarketTake)
            .options(joinedload(MarketTake.agent), joinedload(MarketTake.market))
            .all()
        )
        positions = self.db.query(Position).all()
        contested = _contested_by_market(takes, positions)

        agent_scores: dict[int, list[ComponentScores]] = defaultdict(list)
        agent_deltas: dict[int, list[float]] = defaultdict(list)
        agent_events: dict[int, list[ReputationEvent]] = defaultdict(list)
        calibration_points: dict[int, list[CalibrationPoint]] = defaultdict(list)
        battle_stats: dict[int, dict] = defaultdict(
            lambda: {"wins": 0, "total": 0, "streak": 0, "max_streak": 0, "upsets": 0}
        )
        verified: dict[int, int] = defaultdict(int)
        consensus_breaks: dict[int, int] = defaultdict(int)
        max_days_early: dict[int, int] = defaultdict(int)
        early_signals: dict[int, int] = defaultdict(int)
        ahead_consensus: dict[int, int] = defaultdict(int)
        narrative_leads: dict[int, int] = defaultdict(int)
        macro_verified: dict[int, int] = defaultdict(int)
        category_verified: dict[int, dict[str, int]] = defaultdict(
            lambda: {"crypto": 0, "macro": 0, "sports": 0, "ai": 0}
        )
        battle_wins: dict[int, int] = defaultdict(int)
        legendary_beats: dict[int, int] = defaultdict(int)
        split_dominance: dict[int, int] = defaultdict(int)
        macro_battle_wins: dict[int, int] = defaultdict(int)
        call_streak: dict[int, int] = defaultdict(int)
        call_streak_best: dict[int, int] = defaultdict(int)
        last_active: dict[int, datetime] = {}

        agent_by_id = {a.id: a for a in agents}
        rep_by_agent: dict[int, float] = {a.id: 38.0 + (_hash(a.slug) % 12) for a in agents}

        def _record_rep_event(
            agent_id: int,
            *,
            category: str,
            delta: float,
            reason: str,
            source_type: str,
            source_id: int | None,
            market_id: int | None,
            components: ComponentScores | None,
            breakdown: dict | None,
        ) -> None:
            ev = ReputationEvent(
                agent_id=agent_id,
                category=category,
                delta=delta,
                reason=reason,
                source_type=source_type,
                source_id=source_id,
                market_id=market_id,
                components_json=components.__dict__ if components else None,
                breakdown_json=breakdown,
            )
            self.db.add(ev)
            agent_events[agent_id].append(ev)
            agent_deltas[agent_id].append(delta)
            if components:
                agent_scores[agent_id].append(components)

        for event in events:
            if not event.agent_id or not event.agent:
                continue
            if event.metadata_json and event.metadata_json.get("generated"):
                continue
            aid = event.agent_id
            last_active[aid] = event.created_at
            market = event.market
            contested_n = contested.get(event.market_id or 0, 0)

            if event.type == "receipt" and market:
                seed = f"rep-event-{event.id}"
                side = _agent_side_from_event(event)
                verified_side = _final_outcome(side, seed)
                correct = verified_side == side
                days_early = estimate_days_early(event.id, event.market_id)
                max_days_early[aid] = max(max_days_early[aid], days_early)
                confidence = event.confidence or 85.0
                prob = event.probability or market.current_yes_probability

                inp = ScoreInput(
                    event_type="forecast_resolution",
                    correct=correct,
                    confidence=confidence,
                    days_early=days_early,
                    seed=event.id,
                    market_id=event.market_id,
                    market_probability=market.current_yes_probability,
                    agent_side=side,
                    contested_sides=contested_n,
                    narrative_lead=days_early >= 14,
                )
                result = score_event(inp, config=self.config)
                if correct:
                    verified[aid] += 1
                    call_streak[aid] += 1
                    call_streak_best[aid] = max(call_streak_best[aid], call_streak[aid])
                    if result.category == "consensus_break":
                        consensus_breaks[aid] += 1
                    if days_early >= 10:
                        early_signals[aid] += 1
                    if days_early >= 14:
                        ahead_consensus[aid] += 1
                    bucket = market_specialization_bucket(
                        market.category, event.agent.niche
                    )
                    if bucket:
                        category_verified[aid][bucket] += 1
                    if market.category.lower() == "macro":
                        macro_verified[aid] += 1
                else:
                    call_streak[aid] = 0

                timing_mult, _ = timing_multiplier(
                    days_early,
                    config=self.config.timing,
                    consensus_formed=prob >= 62 or prob <= 38,
                    broke_consensus=result.category == "consensus_break",
                )
                res = ForecastResolution(
                    agent_id=aid,
                    market_id=event.market_id,
                    source_type="feed_event",
                    source_id=event.id,
                    side=side,
                    predicted_probability=prob,
                    confidence=confidence,
                    outcome_yes=verified_side == "YES",
                    correct=correct,
                    days_early=days_early,
                    resolved_at=event.created_at,
                )
                self.db.add(res)
                self.db.flush()
                self.db.add(
                    TimingScore(
                        agent_id=aid,
                        resolution_id=res.id,
                        days_early=days_early,
                        timing_multiplier=timing_mult,
                        consensus_formed=prob >= 62 or prob <= 38,
                        broke_consensus=result.category == "consensus_break",
                        early_signal_bonus=timing_mult * 2.0,
                    )
                )
                calibration_points[aid].append(
                    CalibrationPoint(predicted_probability=prob, outcome_yes=verified_side == "YES")
                )
                self.db.add(
                    CalibrationRecord(
                        agent_id=aid,
                        market_id=event.market_id,
                        predicted_probability=prob,
                        confidence=confidence,
                        outcome_yes=verified_side == "YES",
                    )
                )
                short = market.title.split(" by ")[0][:40]
                reason = (
                    f"Called {short} {days_early}d early"
                    if correct
                    else f"Missed {short} reversal"
                )
                _record_rep_event(
                    aid,
                    category=result.category,
                    delta=result.delta,
                    reason=reason,
                    source_type="feed_event",
                    source_id=event.id,
                    market_id=event.market_id,
                    components=result.components,
                    breakdown=result.breakdown,
                )

            elif event.type == "rivalry" and market:
                spread = parse_spread(event.body)
                won = _hash(event.agent.slug, market.title, "win") % 3 != 0
                opp_rep = 50.0
                for other in agents:
                    if other.id != aid and other.niche == event.agent.niche:
                        opp_rep = max(opp_rep, rep_by_agent.get(other.id, 50.0))
                inp = ScoreInput(
                    event_type="battle",
                    confidence=event.confidence or 70.0,
                    contested_sides=contested_n,
                    opponent_reputation=opp_rep,
                    opponent_conviction=72.0,
                    spread=spread,
                    battle_won=won,
                    seed=event.id,
                )
                result = score_event(inp, config=self.config)
                bs = battle_stats[aid]
                bs["total"] += 1
                if won:
                    bs["wins"] += 1
                    battle_wins[aid] += 1
                    bs["streak"] += 1
                    bs["max_streak"] = max(bs["max_streak"], bs["streak"])
                    if opp_rep >= 65:
                        bs["upsets"] += 1
                    if opp_rep >= 72:
                        legendary_beats[aid] += 1
                    if spread and spread >= 25:
                        split_dominance[aid] += 1
                    if market.category.lower() in ("macro", "rates", "credit"):
                        macro_battle_wins[aid] += 1
                else:
                    bs["streak"] = 0

                self.db.add(
                    BattleOutcome(
                        agent_id=aid,
                        market_id=event.market_id,
                        won=won,
                        reputation_delta=result.delta,
                        upset=won and opp_rep >= 65,
                        dominance_score=result.breakdown.get("battle", {}).get("dominance", 0),
                        contested_level=contested_n,
                        source_id=event.id,
                        recorded_at=event.created_at,
                    )
                )
                short = market.title.split(" by ")[0][:40]
                _record_rep_event(
                    aid,
                    category=result.category,
                    delta=result.delta,
                    reason=f"{'Won' if won else 'Lost'} contested {short}",
                    source_type="feed_event",
                    source_id=event.id,
                    market_id=event.market_id,
                    components=result.components,
                    breakdown=result.breakdown,
                )

            elif event.type == "consensus_shift" and market:
                days = estimate_days_early(event.id, event.market_id)
                if days >= 10:
                    narrative_leads[aid] += 1
                    self.db.add(
                        NarrativeImpact(
                            agent_id=aid,
                            market_id=event.market_id,
                            narrative_key=market.category.lower(),
                            lead_days=days,
                            impact_score=3.0 + days / 10.0,
                            recorded_at=event.created_at,
                        )
                    )

            elif event.type == "leaderboard_move":
                result = score_event(
                    ScoreInput(event_type="leaderboard_move", seed=event.id),
                    config=self.config,
                )
                _record_rep_event(
                    aid,
                    category="leaderboard_move",
                    delta=result.delta,
                    reason=f"Climbed on {event.agent.niche} leaderboard",
                    source_type="feed_event",
                    source_id=event.id,
                    market_id=event.market_id,
                    components=result.components,
                    breakdown=result.breakdown,
                )

        for take in takes:
            if not take.agent_id or not take.agent or not take.market:
                continue
            aid = take.agent_id
            last_active[aid] = max(last_active.get(aid, take.created_at), take.created_at)
            seed = f"rep-take-{take.id}"
            verified_side = _final_outcome(take.side, seed)
            correct = verified_side.upper() == take.side.upper()
            days_early = estimate_days_early(take.id, take.market_id)
            contested_n = contested.get(take.market_id, 0)

            if take.confidence >= 70:
                inp = ScoreInput(
                    event_type="forecast_resolution",
                    correct=correct,
                    confidence=take.confidence,
                    days_early=days_early,
                    seed=take.id,
                    market_id=take.market_id,
                    market_probability=take.market.current_yes_probability,
                    agent_side=take.side,
                    contested_sides=contested_n,
                )
                result = score_event(inp, config=self.config)
                if correct and take.confidence >= 85:
                    verified[aid] += 1
                if result.category == "consensus_break":
                    consensus_breaks[aid] += 1
                short = take.market.title.split(" by ")[0][:40]
                if take.confidence >= 78 or (correct and contested_n >= 2):
                    _record_rep_event(
                        aid,
                        category=result.category,
                        delta=result.delta,
                        reason=f"{'Called' if correct else 'Missed'} {short}",
                        source_type="market_take",
                        source_id=take.id,
                        market_id=take.market_id,
                        components=result.components,
                        breakdown=result.breakdown,
                    )

        for agent in agents:
            stats = stats_for_slug(agent.slug)
            streak_weeks = stats.get("streak", 3)
            if streak_weeks >= 4:
                result = score_event(
                    ScoreInput(event_type="streak", streak_weeks=streak_weeks),
                    config=self.config,
                )
                _record_rep_event(
                    agent.id,
                    category="streak",
                    delta=result.delta,
                    reason=f"Maintained {streak_weeks}-week calibration streak",
                    source_type="system",
                    source_id=None,
                    market_id=None,
                    components=result.components,
                    breakdown=result.breakdown,
                )

        now = datetime.utcnow()
        for agent in agents:
            aid = agent.id
            comps = aggregate_components(agent_scores.get(aid, []))
            seed_acc = float(stats_for_slug(agent.slug)["accuracy_score"])
            cal_pts = calibration_points.get(aid, [])
            cal_score, cal_bd = calibration_component_score(cal_pts, seed_accuracy=seed_acc)
            comps.calibration = cal_score

            cumulative_delta = sum(agent_deltas.get(aid, []))
            score = composite_reputation_score(comps, base=self.config.base_score, config=self.config)
            score = round(max(0.0, min(100.0, score + cumulative_delta * 0.12)), 1)

            recent = agent_deltas.get(aid, [])[-8:]
            velocity = round(sum(recent) / max(len(recent), 1), 2) if recent else 0.0
            trend = "rising" if velocity > 1.5 else "cooling" if velocity < -1.0 else "stable"

            bs = battle_stats[aid]
            win_rate = (bs["wins"] / bs["total"] * 100.0) if bs["total"] else 50.0 + (_hash(agent.slug) % 20)

            inactive_days = 0
            if aid in last_active:
                inactive_days = (now - last_active[aid]).days
            elif agent.created_at:
                inactive_days = (now - agent.created_at).days

            if inactive_days > self.config.decay.inactive_days_threshold:
                decay = min(
                    self.config.decay.max_decay_per_cycle,
                    inactive_days * self.config.decay.daily_decay_rate * 0.1,
                )
                score = max(0.0, score - decay)
                _record_rep_event(
                    aid,
                    category="decay",
                    delta=-round(decay, 2),
                    reason="Inactivity decay — stale forecasting",
                    source_type="system",
                    source_id=None,
                    market_id=None,
                    components=None,
                    breakdown={"inactive_days": inactive_days},
                )

            timing_q = min(100.0, 55.0 + comps.timing * 4.0 + max_days_early[aid] * 0.5)
            cat_v = category_verified[aid]
            mctx = MilestoneContext(
                score=score,
                verified_calls=verified[aid],
                consensus_breaks=consensus_breaks[aid],
                max_days_early=max_days_early[aid],
                early_signal_count=early_signals[aid],
                ahead_consensus_count=ahead_consensus[aid],
                calibration_label=cal_bd.get("label", "estimated"),
                calibration_score=cal_score,
                call_streak=call_streak_best[aid],
                streak_weeks=stats_for_slug(agent.slug).get("streak", 0),
                battle_wins=battle_wins[aid],
                battle_win_streak=bs["max_streak"],
                legendary_beats=legendary_beats[aid],
                split_dominance_wins=split_dominance[aid],
                macro_battle_wins=macro_battle_wins[aid],
                narrative_leads=narrative_leads[aid],
                contrarian_component=comps.contrarian,
                timing_quality=timing_q,
                crypto_verified=cat_v["crypto"],
                macro_verified=max(macro_verified[aid], cat_v["macro"]),
                sports_verified=cat_v["sports"],
                ai_verified=cat_v["ai"],
                agent_slug=agent.slug,
            )
            milestones = evaluate_milestones(mctx)
            self._sync_milestones(agent.id, milestones)

            tier_key, tier_label = tier_for_score(
                score,
                contrarian_component=comps.contrarian,
                has_consensus_break_milestone=any(
                    m["key"] == "consensus_breaker" for m in milestones
                ),
            )
            if "contrarian" in (agent.conviction_style or "").lower() and score >= 72:
                tier_key, tier_label = "consensus_breaker", "Consensus Breaker"

            rep = self.db.query(AgentReputation).filter(AgentReputation.agent_id == aid).first()
            if not rep:
                rep = AgentReputation(agent_id=aid)
                self.db.add(rep)

            prev_score = rep.score if rep.score else score
            rep.score = score
            rep.tier_key = tier_key
            rep.tier_label = tier_label
            rep.velocity = abs(velocity)
            rep.trend = trend
            rep.accuracy_component = round(comps.accuracy, 2)
            rep.timing_component = round(comps.timing, 2)
            rep.conviction_component = round(comps.conviction, 2)
            rep.battle_component = round(comps.battle, 2)
            rep.calibration_component = round(comps.calibration, 2)
            rep.consistency_component = round(comps.consistency, 2)
            rep.contrarian_component = round(comps.contrarian, 2)
            rep.narrative_component = round(comps.narrative, 2)
            rep.timing_quality = round(timing_q, 1)
            rep.calibration_score = round(cal_score, 1)
            rep.battle_win_rate = round(win_rate, 1)
            rep.battle_streak = bs["streak"]
            rep.verified_calls = verified[aid]
            rep.consensus_breaks = consensus_breaks[aid]
            rep.last_active_at = last_active.get(aid)
            rep.updated_at = now

            self.db.add(
                ReputationHistory(
                    agent_id=aid,
                    score=score,
                    delta=round(score - prev_score, 2),
                    recorded_at=now,
                )
            )
            rep_by_agent[aid] = score

        self.db.commit()
        return len(agents)

    def _clear_ledger(self) -> None:
        for model in (
            ReputationEvent,
            ReputationHistory,
            ForecastResolution,
            TimingScore,
            CalibrationRecord,
            BattleOutcome,
            NarrativeImpact,
            ReputationMilestone,
        ):
            self.db.query(model).delete()
        self.db.query(AgentReputation).delete()
        self.db.commit()

    def _sync_milestones(self, agent_id: int, milestones: list[dict]) -> None:
        existing = {
            m.milestone_key
            for m in self.db.query(ReputationMilestone)
            .filter(ReputationMilestone.agent_id == agent_id)
            .all()
        }
        for m in milestones:
            if m["key"] in existing:
                continue
            self.db.add(
                ReputationMilestone(
                    agent_id=agent_id,
                    milestone_key=m["key"],
                    title=m["title"],
                    description=m["description"],
                    category=m["category"],
                )
            )


def ensure_reputation_initialized(db: Session) -> None:
    count = db.query(AgentReputation).count()
    if count == 0:
        ReputationService(db).recalculate_all()


def recalculate_all(db: Session) -> int:
    return ReputationService(db).recalculate_all()


def get_agent_reputation(db: Session, slug: str) -> dict | None:
    agent = db.query(Agent).filter(Agent.slug == slug).first()
    if not agent:
        return None
    rep = (
        db.query(AgentReputation)
        .filter(AgentReputation.agent_id == agent.id)
        .first()
    )
    if not rep:
        ensure_reputation_initialized(db)
        rep = (
            db.query(AgentReputation)
            .filter(AgentReputation.agent_id == agent.id)
            .first()
        )
    if not rep:
        return None

    history_rows = (
        db.query(ReputationHistory)
        .filter(ReputationHistory.agent_id == agent.id)
        .order_by(ReputationHistory.recorded_at.desc())
        .limit(24)
        .all()
    )
    events = (
        db.query(ReputationEvent)
        .filter(ReputationEvent.agent_id == agent.id)
        .order_by(ReputationEvent.created_at.desc())
        .limit(20)
        .all()
    )
    milestones = (
        db.query(ReputationMilestone)
        .filter(ReputationMilestone.agent_id == agent.id)
        .order_by(ReputationMilestone.unlocked_at.desc())
        .all()
    )
    cal_records = (
        db.query(CalibrationRecord)
        .filter(CalibrationRecord.agent_id == agent.id)
        .all()
    )
    cal_points = [
        CalibrationPoint(predicted_probability=r.predicted_probability, outcome_yes=r.outcome_yes)
        for r in cal_records
    ]

    return _reputation_payload(agent, rep, history_rows, events, milestones, cal_points)


def _milestone_dicts(milestones: list) -> list[dict]:
    prestige_by_key = {m.key: m.prestige for m in MILESTONE_CATALOG}
    return [
        {
            "key": m.milestone_key,
            "title": m.title,
            "description": m.description,
            "category": m.category,
            "unlocked_at": iso_dt(m.unlocked_at),
            "prestige": prestige_by_key.get(m.milestone_key, 50),
        }
        for m in milestones
    ]


def _reputation_payload(agent, rep, history_rows, events, milestones, cal_points) -> dict:
    sparkline = [round(h.score, 1) for h in reversed(history_rows[-12:])]
    if len(sparkline) < 2:
        h = _hash(agent.slug)
        base = rep.score
        sparkline = [round(base - 4 + (h % 3), 1), round(base - 2, 1), round(base, 1)]

    recent_delta = history_rows[0].delta if history_rows else 0.0
    milestone_list = _milestone_dicts(milestones)
    featured_block = agent_featured_payload(agent, milestone_list)
    recent_unlocks = sorted(
        milestone_list,
        key=lambda m: m.get("unlocked_at") or "",
        reverse=True,
    )[:5]

    trust = trust_from_agent_rep(
        verified_calls=rep.verified_calls,
        reputation_score=rep.score,
        calibration_score=rep.calibration_score,
        created_at=agent.created_at,
    )

    return {
        "agent": {
            "name": agent.name,
            "slug": agent.slug,
            "niche": agent.niche,
            "avatar_color": agent.avatar_color,
            "conviction_style": agent.conviction_style,
        },
        "score": rep.score,
        "tier_key": rep.tier_key,
        "tier_label": rep.tier_label,
        **trust.to_dict(),
        "velocity": rep.velocity,
        "trend": rep.trend,
        "reputation_delta": recent_delta,
        "components": {
            "accuracy": rep.accuracy_component,
            "timing": rep.timing_component,
            "conviction": rep.conviction_component,
            "battle": rep.battle_component,
            "calibration": rep.calibration_component,
            "consistency": rep.consistency_component,
            "contrarian": rep.contrarian_component,
            "narrative": rep.narrative_component,
        },
        "timing_quality": rep.timing_quality,
        "calibration_score": rep.calibration_score,
        "calibration_buckets": bucket_calibration(cal_points),
        "battle_win_rate": rep.battle_win_rate,
        "battle_streak": rep.battle_streak,
        "verified_calls": rep.verified_calls,
        "consensus_breaks": rep.consensus_breaks,
        "sparkline": sparkline,
        "recent_events": [
            {
                "category": e.category,
                "delta": e.delta,
                "reason": e.reason,
                "created_at": iso_dt(e.created_at),
            }
            for e in events
        ],
        "milestones": milestone_list,
        **featured_block,
        "recent_milestone_unlocks": recent_unlocks,
        "milestone_catalog": milestone_catalog_for_api(),
        "weights": {
            k: getattr(DEFAULT_CONFIG.weights, k)
            for k in (
                "accuracy",
                "timing",
                "conviction",
                "battle",
                "calibration",
                "consistency",
                "contrarian",
                "narrative",
            )
        },
    }


def rank_leaderboard_entries(entries: list[dict]) -> list[dict]:
    """Assign global ranks from primary reputation score (highest first)."""
    ordered = sorted(entries, key=lambda e: (-e["reputation_score"], e["slug"]))
    return [{**row, "rank": rank} for rank, row in enumerate(ordered, start=1)]


def get_all_agent_reputations(db: Session) -> list[dict]:
    ensure_reputation_initialized(db)
    reps = (
        db.query(AgentReputation)
        .options(joinedload(AgentReputation.agent))
        .order_by(AgentReputation.score.desc())
        .all()
    )
    milestone_rows = (
        db.query(
            ReputationMilestone.agent_id,
            func.count(ReputationMilestone.id),
        )
        .group_by(ReputationMilestone.agent_id)
        .all()
    )
    milestone_counts = {aid: cnt for aid, cnt in milestone_rows}
    milestone_map = load_milestone_map_by_agent(db)
    top_milestones: dict[int, str] = {}
    for m in (
        db.query(ReputationMilestone)
        .order_by(ReputationMilestone.unlocked_at.desc())
        .all()
    ):
        if m.agent_id not in top_milestones:
            top_milestones[m.agent_id] = m.title

    from app.forecasting.agent_status import is_active_agent

    entries: list[dict] = []
    for r in reps:
        agent = r.agent
        if not is_active_agent(agent):
            continue
        ml = list(milestone_map.get(agent.id, {}).values())
        marks = resolve_featured_marks(
            agent.featured_milestone_keys if isinstance(agent.featured_milestone_keys, list) else [],
            milestone_map.get(agent.id, {}),
            fallback_milestones=ml,
        )
        trust = trust_from_agent_rep(
            verified_calls=r.verified_calls,
            reputation_score=r.score,
            calibration_score=r.calibration_score,
            created_at=agent.created_at,
        )
        trust_fields = trust.to_dict()
        entries.append(
        {
            "name": r.agent.name,
            "slug": r.agent.slug,
            "niche": r.agent.niche,
            "avatar_color": r.agent.avatar_color,
            "conviction_style": r.agent.conviction_style,
            "reputation_score": round(r.score),
            "tier_key": r.tier_key,
            "tier_label": r.tier_label,
            "velocity": r.velocity,
            "trend": r.trend,
            "reputation_delta": round(
                r.velocity * (1 if r.trend == "rising" else -1 if r.trend == "cooling" else 0),
                1,
            ),
            "timing_quality": r.timing_quality,
            "calibration_score": r.calibration_score,
            "battle_win_rate": r.battle_win_rate,
            "verified_calls": r.verified_calls,
            "consensus_breaks": r.consensus_breaks,
            "accuracy_pct": round(r.calibration_score),
            "streak": r.battle_streak,
            "milestones_count": milestone_counts.get(r.agent_id, 0),
            "top_milestone": top_milestones.get(r.agent_id),
            "featured_milestone_keys": (
                agent.featured_milestone_keys
                if isinstance(agent.featured_milestone_keys, list)
                else []
            ),
            "featured_reputation_marks": marks,
            "featured_milestones": [m["title"] for m in marks],
            **trust_fields,
        }
        )

    return rank_leaderboard_entries(entries)


def get_user_public_profile(db: Session, username: str) -> dict | None:
    """Public user profile — milestones when username maps to an agent slug."""
    from app.forecasting.models import User
    from app.wallet.service import wallet_identity_dict

    user = db.query(User).filter(User.username == username.lower()).first()
    if not user:
        agent = db.query(Agent).filter(Agent.slug == username.lower()).first()
        if agent:
            rep_payload = get_agent_reputation(db, agent.slug)
            if rep_payload:
                return {
                    "username": agent.slug,
                    "display_name": agent.name,
                    "avatar_color": agent.avatar_color,
                    "bio": None,
                    "reputation_score": rep_payload["score"],
                    "tier_key": rep_payload["tier_key"],
                    "tier_label": rep_payload["tier_label"],
                    "is_agent": True,
                    "agent_slug": agent.slug,
                    **{
                        k: rep_payload[k]
                        for k in (
                            "milestones",
                            "featured_milestones",
                            "featured_milestone_keys",
                            "featured_reputation_marks",
                            "recent_milestone_unlocks",
                            "milestone_catalog",
                        )
                        if k in rep_payload
                    },
                }
        return None

    agent = db.query(Agent).filter(Agent.slug == user.username).first()
    milestone_block: dict = {
        "milestones": [],
        "featured_milestones": [],
        "recent_milestone_unlocks": [],
        "milestone_catalog": milestone_catalog_for_api(),
    }
    tier_key, tier_label = "emerging", "Emerging"
    rep_score = float(user.reputation_score)

    equipped_keys: list[str] = []
    if user.profile:
        equipped_keys = get_user_equipped_keys(user.profile)

    if agent:
        rep_payload = get_agent_reputation(db, agent.slug)
        if rep_payload:
            milestone_block = {
                k: rep_payload[k]
                for k in (
                    "milestones",
                    "featured_milestones",
                    "featured_reputation_marks",
                    "recent_milestone_unlocks",
                    "milestone_catalog",
                    "score",
                    "tier_key",
                    "tier_label",
                )
                if k in rep_payload
            }
            rep_score = rep_payload.get("score", rep_score)
            tier_key = rep_payload.get("tier_key", tier_key)
            tier_label = rep_payload.get("tier_label", tier_label)
            if equipped_keys:
                by_key = {m["key"]: m for m in rep_payload.get("milestones", [])}
                marks = resolve_featured_marks(
                    equipped_keys, by_key, fallback_milestones=rep_payload.get("milestones")
                )
                milestone_block["featured_milestone_keys"] = equipped_keys
                milestone_block["featured_reputation_marks"] = marks
                milestone_block["featured_milestones"] = [
                    {**by_key[k], "symbol": marks[i]["symbol"]}
                    for i, k in enumerate(equipped_keys)
                    if k in by_key
                ] or milestone_block.get("featured_milestones", [])

    from app.forecasting.services.feed_interactions import user_interaction_history

    feed_reads = user_interaction_history(db, user.id, limit=5)

    from app.forecasting.services.public_status_moments import status_moments_for_profile

    public_status = status_moments_for_profile(db, user.id)

    from app.forecasting.services.anchor_agent import build_anchor_payload

    anchor = build_anchor_payload(user, db)
    anchor_block: dict = {}
    if anchor.get("has_anchor") and anchor.get("agent"):
        agent_summary = anchor["agent"]
        anchor_block = {
            "anchor_agent": agent_summary,
            "anchor_agent_slug": agent_summary.get("slug"),
            "anchor_mood": anchor.get("mood"),
            "anchor_mood_label": anchor.get("mood_label"),
            "tracks_label": f"Tracks {agent_summary.get('name')}",
        }

    return {
        "username": user.username,
        "display_name": user.username,
        "avatar_color": user.avatar_color or "#7c3aed",
        "bio": user.bio,
        "reputation_score": rep_score,
        "tier_key": tier_key,
        "tier_label": tier_label,
        "is_agent": False,
        "agent_slug": agent.slug if agent else None,
        **wallet_identity_dict(user),
        **milestone_block,
        **anchor_block,
        "feed_reads": feed_reads,
        "public_status": public_status,
    }


def recent_milestone_unlock_feed(db: Session, *, limit: int = 6) -> list[dict]:
    """Recent unlocks across the network for feed injection."""
    rows = (
        db.query(ReputationMilestone)
        .options(joinedload(ReputationMilestone.agent))
        .order_by(ReputationMilestone.unlocked_at.desc())
        .limit(limit)
        .all()
    )
    prestige_by_key = {m.key: m.prestige for m in MILESTONE_CATALOG}
    out: list[dict] = []
    for row in rows:
        if not row.agent:
            continue
        out.append({
            "type": "milestone_unlock",
            "agent": {
                "name": row.agent.name,
                "slug": row.agent.slug,
                "niche": row.agent.niche,
                "avatar_color": row.agent.avatar_color,
            },
            "title": f"{row.agent.name} earned {row.title}",
            "body": row.description,
            "milestone": {
                "key": row.milestone_key,
                "title": row.title,
                "category": row.category,
                "prestige": prestige_by_key.get(row.milestone_key, 50),
            },
            "created_at": iso_dt(row.unlocked_at),
            "live": True,
            "intelligence_tags": ["milestone", "reputation"],
        })
    return out


def reputation_movements_from_db(db: Session, *, limit: int = 8) -> list[dict]:
    ensure_reputation_initialized(db)
    reps = (
        db.query(AgentReputation)
        .options(joinedload(AgentReputation.agent))
        .order_by(AgentReputation.velocity.desc())
        .all()
    )
    from app.forecasting.agent_status import is_active_agent

    movements = []
    for rep in reps:
        agent = rep.agent
        if not is_active_agent(agent):
            continue
        stats = stats_for_slug(agent.slug)
        movements.append(
            {
                "agent": {
                    "name": agent.name,
                    "slug": agent.slug,
                    "niche": agent.niche,
                    "avatar_color": agent.avatar_color,
                    **stats,
                    "reputation_score": round(rep.score),
                    "tier_label": rep.tier_label,
                },
                "reputation_delta": round(
                    rep.velocity * (1 if rep.trend == "rising" else -1 if rep.trend == "cooling" else 0.3)
                ),
                "velocity": rep.velocity,
                "trend": rep.trend,
                "consistency": round(rep.consistency_component + 50, 1),
                "timing_quality": rep.timing_quality,
                "calibration": rep.calibration_score,
                "verified_calls": rep.verified_calls,
                "tier_key": rep.tier_key,
                "label": rep.tier_label if rep.tier_key != "emerging" else (
                    "Early signal" if rep.trend == "rising" else "Strong conviction"
                ),
            }
        )
    movements.sort(key=lambda x: (-x["velocity"], -abs(x["reputation_delta"])))
    return movements[:limit]


def reputation_feed_from_db(db: Session, *, limit: int = 40) -> list[dict]:
    ensure_reputation_initialized(db)
    events = (
        db.query(ReputationEvent)
        .options(joinedload(ReputationEvent.agent))
        .order_by(ReputationEvent.created_at.desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "agent_slug": e.agent.slug,
            "agent_name": e.agent.name,
            "delta": round(e.delta, 1),
            "reason": e.reason,
            "category": e.category,
            "created_at": iso_dt(e.created_at),
            "components": e.components_json,
            "breakdown": e.breakdown_json,
        }
        for e in events
    ]
