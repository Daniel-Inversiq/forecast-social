"""Market resolution engine — settles positions, reputation, receipts, and feed events."""

from __future__ import annotations

import re
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session, joinedload

from app.forecasting.models import (
    Agent,
    AgentReputation,
    CalibrationRecord,
    ConvictionPosition,
    FeedEvent,
    ForecastResolution,
    Market,
    MarketTake,
    ReputationEvent,
    ReputationMilestone,
    TimingScore,
)
from app.forecasting.services.conviction_ledger import append_ledger_entry, get_or_create_balance
from app.forecasting.services.conviction_limits import open_user_exposure
from app.forecasting.reputation.milestones import (
    MILESTONE_CATALOG,
    MilestoneContext,
    evaluate_milestones,
)
from app.forecasting.reputation.scoring import ScoreInput, score_event
from app.forecasting.reputation.service import ReputationService
from app.forecasting.reputation.timing import consensus_state, timing_multiplier


def title_to_slug(title: str) -> str:
    slug = title.lower()
    slug = re.sub(r"[^a-z0-9]+", "-", slug)
    return slug.strip("-")


def market_outcome_yes(market: Market) -> bool:
    if market.resolved_outcome:
        return market.resolved_outcome.upper() == "YES"
    return market.current_yes_probability >= 50


def is_market_resolved(market: Market) -> bool:
    return market.status in ("resolved", "closed") and market.resolved_at is not None


def days_before_resolution(created_at: datetime | None, resolved_at: datetime) -> int:
    if not created_at:
        return 0
    if created_at.tzinfo is None:
        created_at = created_at.replace(tzinfo=timezone.utc)
    if resolved_at.tzinfo is None:
        resolved_at = resolved_at.replace(tzinfo=timezone.utc)
    delta = resolved_at - created_at
    return max(0, min(int(delta.total_seconds() // 86400), 60))


@dataclass
class ParticipantSettlement:
    agent_id: int
    agent_name: str
    agent_slug: str
    side: str
    confidence: float
    correct: bool
    days_early: int
    reputation_delta: float
    category: str
    broke_consensus: bool
    source_type: str
    source_id: int | None = None


@dataclass
class ResolutionResult:
    market_id: int
    market_slug: str
    outcome: str
    outcome_yes: bool
    resolved_at: str
    settlements: list[ParticipantSettlement] = field(default_factory=list)
    feed_events_created: int = 0
    receipts_created: int = 0
    milestones_unlocked: list[dict] = field(default_factory=list)
    timeline: list[dict] = field(default_factory=list)


class MarketResolutionEngine:
    def __init__(self, db: Session):
        self.db = db

    def resolve_market(
        self,
        market: Market,
        *,
        outcome: str,
        source: str = "oracle",
        confidence: float = 0.95,
        resolved_at: datetime | None = None,
    ) -> ResolutionResult:
        if is_market_resolved(market):
            raise ValueError("Market already resolved")

        outcome = outcome.upper()
        if outcome not in ("YES", "NO"):
            raise ValueError("outcome must be YES or NO")

        now = resolved_at or datetime.utcnow()
        outcome_yes = outcome == "YES"

        market.status = "resolved"
        market.resolved_outcome = outcome
        market.resolved_at = now
        market.resolution_source = source
        market.resolution_confidence = confidence
        if outcome_yes:
            market.current_yes_probability = min(99.0, max(market.current_yes_probability, 92.0))
        else:
            market.current_yes_probability = min(market.current_yes_probability, 8.0)

        takes = (
            self.db.query(MarketTake)
            .options(joinedload(MarketTake.agent))
            .filter(MarketTake.market_id == market.id)
            .order_by(MarketTake.created_at.asc())
            .all()
        )
        positions = (
            self.db.query(ConvictionPosition)
            .filter(ConvictionPosition.market_id == market.id, ConvictionPosition.status == "open")
            .all()
        )
        contested_sides = len({t.side for t in takes} | {p.side for p in positions})

        settlements: list[ParticipantSettlement] = []
        feed_count = 0
        receipt_count = 0
        milestones: list[dict] = []
        agent_stats: dict[int, dict] = defaultdict(
            lambda: {
                "verified": 0,
                "consensus_breaks": 0,
                "max_days_early": 0,
                "early_signals": 0,
                "call_streak": 0,
            }
        )

        prob_at_resolution = market.current_yes_probability

        for take in takes:
            if not take.agent_id or not take.agent:
                continue
            settlement = self._settle_take(
                take, market, outcome_yes, now, prob_at_resolution, contested_sides
            )
            settlements.append(settlement)
            feed_count += self._emit_settlement_events(market, take.agent, settlement, take)
            if settlement.correct and take.confidence >= 70:
                receipt_count += 1
                self._create_receipt_event(market, take, settlement)
            self._persist_resolution_records(market, take, settlement, now, outcome_yes)
            stats = agent_stats[take.agent_id]
            if settlement.correct:
                stats["verified"] += 1
                stats["call_streak"] += 1
                stats["max_days_early"] = max(stats["max_days_early"], settlement.days_early)
                if settlement.broke_consensus:
                    stats["consensus_breaks"] += 1
                if settlement.days_early >= 10:
                    stats["early_signals"] += 1
            else:
                stats["call_streak"] = 0

        # Admin/manual USDC settlement for user conviction allocations.
        for position in positions:
            if position.status != "open":
                continue
            correct = (position.side == "YES" and outcome_yes) or (
                position.side == "NO" and not outcome_yes
            )
            position.status = "won" if correct else "lost"
            position.resolved_at = now
            position.payout_amount = round(position.amount * 2.0, 2) if correct else 0.0

            balance = get_or_create_balance(position.user_id, self.db)
            balance.locked_balance = max(0.0, balance.locked_balance - position.amount)
            append_ledger_entry(
                db=self.db,
                balance=balance,
                entry_type="position_close",
                amount=position.amount,
                market_id=market.id,
                position_id=position.id,
                note=f"Closed {position.side} conviction allocation",
            )
            if correct and position.payout_amount:
                balance.available_balance += position.payout_amount
                append_ledger_entry(
                    db=self.db,
                    balance=balance,
                    entry_type="payout",
                    amount=position.payout_amount,
                    market_id=market.id,
                    position_id=position.id,
                    note="Admin settlement payout",
                )
            balance.total_exposure = open_user_exposure(self.db, position.user_id)

            if correct:
                try:
                    from app.forecasting.services.public_status_moments import (
                        evaluate_conviction_resolution_moments,
                    )

                    evaluate_conviction_resolution_moments(self.db, market, position)
                except Exception:
                    pass

        for event in (
            self.db.query(FeedEvent)
            .options(joinedload(FeedEvent.agent))
            .filter(FeedEvent.market_id == market.id, FeedEvent.type.in_(("receipt", "verified_call")))
            .all()
        ):
            if not event.agent:
                continue
            side = "YES" if (event.probability or prob_at_resolution) >= 50 else "NO"
            correct = (side == "YES" and outcome_yes) or (side == "NO" and not outcome_yes)
            days_early = days_before_resolution(event.created_at, now)
            confidence_val = event.confidence or 85.0
            consensus_formed, broke = consensus_state(
                prob_at_resolution, side, contested_sides=contested_sides
            )
            inp = ScoreInput(
                event_type="forecast_resolution",
                correct=correct,
                confidence=confidence_val,
                days_early=days_early,
                seed=event.id,
                market_id=market.id,
                market_probability=prob_at_resolution,
                agent_side=side,
                contested_sides=contested_sides,
                narrative_lead=days_early >= 14,
            )
            result = score_event(inp)
            settlements.append(
                ParticipantSettlement(
                    agent_id=event.agent_id,
                    agent_name=event.agent.name,
                    agent_slug=event.agent.slug,
                    side=side,
                    confidence=confidence_val,
                    correct=correct,
                    days_early=days_early,
                    reputation_delta=result.delta,
                    category=result.category,
                    broke_consensus=broke,
                    source_type="feed_event",
                    source_id=event.id,
                )
            )

        for aid, stats in agent_stats.items():
            agent = self.db.get(Agent, aid)
            if not agent:
                continue
            rep = self.db.query(AgentReputation).filter(AgentReputation.agent_id == aid).first()
            ctx = MilestoneContext(
                score=rep.score if rep else 50.0,
                tier_key=rep.tier_key if rep else "emerging",
                verified_calls=stats["verified"],
                consensus_breaks=stats["consensus_breaks"],
                max_days_early=stats["max_days_early"],
                early_signal_count=stats["early_signals"],
                call_streak=stats["call_streak"],
                agent_slug=agent.slug,
            )
            for ms in evaluate_milestones(ctx):
                ms_key = ms["key"]
                existing = (
                    self.db.query(ReputationMilestone)
                    .filter(
                        ReputationMilestone.agent_id == aid,
                        ReputationMilestone.milestone_key == ms_key,
                    )
                    .first()
                )
                if existing:
                    continue
                self.db.add(
                    ReputationMilestone(
                        agent_id=aid,
                        milestone_key=ms_key,
                        title=ms["title"],
                        description=ms["description"],
                        category=ms["category"],
                    )
                )
                milestones.append(
                    {"agent_slug": agent.slug, "key": ms_key, "title": ms["title"]}
                )
                self._emit_milestone_event(market, agent, ms["title"], ms_key)
                feed_count += 1

        self.db.commit()
        ReputationService(self.db).recalculate_all()

        slug = title_to_slug(market.title)
        timeline = self.build_resolution_timeline(market, settlements)

        return ResolutionResult(
            market_id=market.id,
            market_slug=slug,
            outcome=outcome,
            outcome_yes=outcome_yes,
            resolved_at=now.replace(tzinfo=timezone.utc).isoformat()
            if now.tzinfo is None
            else now.isoformat(),
            settlements=sorted(settlements, key=lambda s: -abs(s.reputation_delta)),
            feed_events_created=feed_count,
            receipts_created=receipt_count,
            milestones_unlocked=milestones,
            timeline=timeline,
        )

    def _settle_take(
        self,
        take: MarketTake,
        market: Market,
        outcome_yes: bool,
        resolved_at: datetime,
        prob: float,
        contested_sides: int,
    ) -> ParticipantSettlement:
        side = take.side.upper()
        correct = (side == "YES" and outcome_yes) or (side == "NO" and not outcome_yes)
        days_early = days_before_resolution(take.created_at, resolved_at)
        consensus_formed, broke = consensus_state(prob, side, contested_sides=contested_sides)
        inp = ScoreInput(
            event_type="forecast_resolution",
            correct=correct,
            confidence=take.confidence,
            days_early=days_early,
            seed=take.id,
            market_id=market.id,
            market_probability=prob,
            agent_side=side,
            contested_sides=contested_sides,
            narrative_lead=days_early >= 14,
        )
        result = score_event(inp)
        agent = take.agent
        return ParticipantSettlement(
            agent_id=take.agent_id or 0,
            agent_name=agent.name if agent else take.author_name,
            agent_slug=agent.slug if agent else take.author_slug,
            side=side,
            confidence=take.confidence,
            correct=correct,
            days_early=days_early,
            reputation_delta=result.delta,
            category=result.category,
            broke_consensus=broke,
            source_type="market_take",
            source_id=take.id,
        )

    def _persist_resolution_records(
        self,
        market: Market,
        take: MarketTake,
        settlement: ParticipantSettlement,
        resolved_at: datetime,
        outcome_yes: bool,
    ) -> None:
        if not take.agent_id:
            return
        prob = market.current_yes_probability
        fr = ForecastResolution(
            agent_id=take.agent_id,
            market_id=market.id,
            source_type="market_take",
            source_id=take.id,
            side=settlement.side,
            predicted_probability=prob if settlement.side == "YES" else 100 - prob,
            confidence=take.confidence,
            outcome_yes=outcome_yes,
            correct=settlement.correct,
            days_early=settlement.days_early,
            resolved_at=resolved_at,
        )
        self.db.add(fr)
        self.db.flush()

        timing_mult, _ = timing_multiplier(
            settlement.days_early,
            consensus_formed=not settlement.broke_consensus,
            broke_consensus=settlement.broke_consensus,
        )
        self.db.add(
            TimingScore(
                agent_id=take.agent_id,
                resolution_id=fr.id,
                days_early=settlement.days_early,
                timing_multiplier=timing_mult,
                consensus_formed=not settlement.broke_consensus,
                broke_consensus=settlement.broke_consensus,
            )
        )
        self.db.add(
            CalibrationRecord(
                agent_id=take.agent_id,
                market_id=market.id,
                predicted_probability=prob if settlement.side == "YES" else 100 - prob,
                confidence=take.confidence,
                outcome_yes=outcome_yes,
            )
        )
        self.db.add(
            ReputationEvent(
                agent_id=take.agent_id,
                category=settlement.category,
                delta=settlement.reputation_delta,
                reason=f"Market resolved {market.resolved_outcome} on {market.title}",
                source_type="market_resolution",
                source_id=take.id,
                market_id=market.id,
            )
        )

    def _emit_settlement_events(
        self,
        market: Market,
        agent: Agent,
        settlement: ParticipantSettlement,
        take: MarketTake,
    ) -> int:
        count = 0
        if settlement.correct and settlement.days_early >= 7:
            from app.forecasting.services.voice_engine import generate_win_reaction, is_core_character

            win_body = (
                generate_win_reaction(agent.slug, market_title=market.title)
                if is_core_character(agent.slug)
                else (
                    f"{agent.name} locked a verified {market.category.lower()} call "
                    f"before consensus repriced on {market.title}."
                )
            )
            self.db.add(
                FeedEvent(
                    type="verified_call",
                    agent_id=agent.id,
                    market_id=market.id,
                    title=f"{agent.name} locked a verified call",
                    body=win_body,
                    probability=market.current_yes_probability,
                    confidence=take.confidence,
                    metadata_json={
                        "resolution": True,
                        "days_early": settlement.days_early,
                        "reputation_delta": settlement.reputation_delta,
                    },
                )
            )
            count += 1
        elif settlement.correct and not settlement.broke_consensus:
            from app.forecasting.services.voice_engine import generate_win_reaction, is_core_character

            receipt_body = (
                generate_win_reaction(agent.slug, market_title=market.title)
                if is_core_character(agent.slug)
                else f"{agent.name} called {settlement.side} correctly as the market settled."
            )
            self.db.add(
                FeedEvent(
                    type="receipt",
                    agent_id=agent.id,
                    market_id=market.id,
                    title=f"Verified receipt — {market.title}",
                    body=receipt_body,
                    probability=market.current_yes_probability,
                    confidence=take.confidence,
                    metadata_json={"resolution": True, "reputation_delta": settlement.reputation_delta},
                )
            )
            count += 1

        if settlement.broke_consensus and settlement.correct:
            self.db.add(
                FeedEvent(
                    type="consensus_shift",
                    agent_id=agent.id,
                    market_id=market.id,
                    title=f"{agent.name} broke consensus",
                    body=(
                        f"{agent.name} earned a consensus-break win on {market.title} — "
                        f"+{abs(settlement.reputation_delta):.0f} reputation."
                    ),
                    probability=market.current_yes_probability,
                    confidence=take.confidence,
                    metadata_json={
                        "resolution": True,
                        "consensus_break": True,
                        "reputation_delta": settlement.reputation_delta,
                    },
                )
            )
            count += 1

        if settlement.reputation_delta >= 8:
            self.db.add(
                FeedEvent(
                    type="reputation_move",
                    agent_id=agent.id,
                    market_id=market.id,
                    title=f"Reputation surge",
                    body=(
                        f"{agent.name} gained {settlement.reputation_delta:+.0f} reputation "
                        f"after {market.title} resolved {market.resolved_outcome}."
                    ),
                    metadata_json={
                        "resolution": True,
                        "reputation_delta": settlement.reputation_delta,
                        "surge": True,
                    },
                )
            )
            count += 1

        if not settlement.correct and take.confidence >= 80:
            from app.forecasting.services.voice_engine import generate_loss_reaction, is_core_character

            loss_body = (
                generate_loss_reaction(agent.slug, market_title=market.title)
                if is_core_character(agent.slug)
                else (
                    f"{agent.name} lost {abs(settlement.reputation_delta):.0f} reputation "
                    f"after high-conviction miss on {market.title}."
                )
            )
            self.db.add(
                FeedEvent(
                    type="failed_high_conviction_call",
                    agent_id=agent.id,
                    market_id=market.id,
                    title=f"High-conviction miss",
                    body=loss_body,
                    confidence=take.confidence,
                    metadata_json={
                        "resolution": True,
                        "reputation_delta": settlement.reputation_delta,
                    },
                )
            )
            count += 1

        if settlement.correct and settlement.days_early >= 10:
            timing_title = next(
                (m.title for m in MILESTONE_CATALOG if m.key == "timing_edge"),
                "Timing Edge",
            )
            self.db.add(
                FeedEvent(
                    type="calibration_jump",
                    agent_id=agent.id,
                    market_id=market.id,
                    title=f"{agent.name} earned {timing_title}",
                    body=f"{agent.name} earned Timing Edge with an early correct call on {market.title}.",
                    metadata_json={"resolution": True, "milestone_hint": "timing_edge"},
                )
            )
            count += 1

        return count

    def _create_receipt_event(
        self, market: Market, take: MarketTake, settlement: ParticipantSettlement
    ) -> None:
        if not take.agent_id:
            return
        existing = (
            self.db.query(FeedEvent)
            .filter(
                FeedEvent.market_id == market.id,
                FeedEvent.agent_id == take.agent_id,
                FeedEvent.type == "receipt",
            )
            .first()
        )
        if existing:
            return
        agent = take.agent
        self.db.add(
            FeedEvent(
                type="receipt",
                agent_id=take.agent_id,
                market_id=market.id,
                title=f"Receipt minted — {market.title}",
                body=f"{agent.name if agent else take.author_name} verified {settlement.side} on resolution.",
                probability=market.current_yes_probability,
                confidence=take.confidence,
                metadata_json={"resolution": True, "auto_receipt": True},
            )
        )

    def _emit_milestone_event(self, market: Market, agent: Agent, title: str, key: str) -> None:
        self.db.add(
            FeedEvent(
                type="milestone_unlock",
                agent_id=agent.id,
                market_id=market.id,
                title=f"{agent.name} unlocked {title}",
                body=f"Prestige milestone earned on resolution of {market.title}.",
                metadata_json={"milestone_key": key, "resolution": True},
            )
        )

    def build_resolution_timeline(
        self, market: Market, settlements: list[ParticipantSettlement] | None = None
    ) -> list[dict]:
        if settlements is None:
            settlements = []
            takes = (
                self.db.query(MarketTake)
                .options(joinedload(MarketTake.agent))
                .filter(MarketTake.market_id == market.id)
                .all()
            )
            outcome_yes = market_outcome_yes(market)
            resolved_at = market.resolved_at or datetime.utcnow()
            for take in takes:
                if take.agent_id:
                    settlements.append(
                        self._settle_take(
                            take,
                            market,
                            outcome_yes,
                            resolved_at,
                            market.current_yes_probability,
                            2,
                        )
                    )

        first_movers = sorted(
            [s for s in settlements if s.correct],
            key=lambda s: (-s.days_early, -s.confidence),
        )[:5]
        biggest_winners = sorted(
            [s for s in settlements if s.correct],
            key=lambda s: -s.reputation_delta,
        )[:5]
        biggest_shifts = sorted(settlements, key=lambda s: -abs(s.reputation_delta))[:8]

        return [
            {
                "kind": "resolution",
                "at": market.resolved_at.isoformat() if market.resolved_at else None,
                "outcome": market.resolved_outcome,
                "source": market.resolution_source,
                "confidence": market.resolution_confidence,
            },
            {
                "kind": "first_movers",
                "entries": [
                    {
                        "agent_name": s.agent_name,
                        "agent_slug": s.agent_slug,
                        "side": s.side,
                        "days_early": s.days_early,
                        "reputation_delta": s.reputation_delta,
                    }
                    for s in first_movers
                ],
            },
            {
                "kind": "biggest_winners",
                "entries": [
                    {
                        "agent_name": s.agent_name,
                        "agent_slug": s.agent_slug,
                        "reputation_delta": s.reputation_delta,
                        "category": s.category,
                    }
                    for s in biggest_winners
                ],
            },
            {
                "kind": "reputation_shifts",
                "entries": [
                    {
                        "agent_name": s.agent_name,
                        "agent_slug": s.agent_slug,
                        "reputation_delta": s.reputation_delta,
                        "correct": s.correct,
                        "category": s.category,
                    }
                    for s in biggest_shifts
                ],
            },
        ]

    def user_settlement(self, market: Market, user_id: int) -> dict | None:
        position = (
            self.db.query(ConvictionPosition)
            .filter(
                ConvictionPosition.market_id == market.id,
                ConvictionPosition.user_id == user_id,
            )
            .order_by(ConvictionPosition.opened_at.desc())
            .first()
        )
        if not position or not is_market_resolved(market):
            return None

        outcome_yes = market_outcome_yes(market)
        correct = (position.side == "YES" and outcome_yes) or (
            position.side == "NO" and not outcome_yes
        )
        days_held = days_before_resolution(position.created_at, market.resolved_at)
        amount_factor = min(2.0, 1.0 + position.amount / 500)
        if correct:
            rep_delta = round((6.0 + days_held * 0.35) * amount_factor, 1)
            if days_held >= 14:
                rep_delta = round(rep_delta * 1.4, 1)
        else:
            rep_delta = round(-(4.0 + days_held * 0.15) * amount_factor, 1)

        calibration_before = 0.62 + (user_id % 17) / 100
        calibration_after = calibration_before + (0.04 if correct else -0.06)
        calibration_after = max(0.35, min(0.95, calibration_after))

        milestones: list[dict] = []
        if correct and days_held >= 10:
            milestones.append({"key": "timing_edge", "title": "Timing Edge"})
        if correct and amount_factor >= 1.5:
            milestones.append({"key": "conviction_holder", "title": "Conviction Holder"})

        return {
            "market_slug": title_to_slug(market.title),
            "market_title": market.title,
            "side": position.side,
            "amount": position.amount,
            "outcome": market.resolved_outcome,
            "correct": correct,
            "reputation_delta": rep_delta,
            "calibration_before": round(calibration_before, 3),
            "calibration_after": round(calibration_after, 3),
            "calibration_delta": round(calibration_after - calibration_before, 3),
            "days_early": days_held,
            "milestones_unlocked": milestones,
            "resolved_at": market.resolved_at.isoformat() if market.resolved_at else None,
        }


def resolve_market_by_slug(
    db: Session,
    slug: str,
    *,
    outcome: str,
    source: str = "oracle",
    confidence: float = 0.95,
) -> ResolutionResult:
    market = None
    for m in db.query(Market).all():
        if title_to_slug(m.title) == slug:
            market = m
            break
    if not market:
        raise LookupError("Market not found")
    return MarketResolutionEngine(db).resolve_market(
        market, outcome=outcome, source=source, confidence=confidence
    )
