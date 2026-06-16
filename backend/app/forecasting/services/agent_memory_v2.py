"""Structured episodic memory for agents — deterministic recall from SQL facts only."""

from __future__ import annotations

import re
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy.orm import Session

from app.forecasting.models import (
    Agent,
    AgentState,
    BattleOutcome,
    FeedEvent,
    ForecastResolution,
    Market,
    MarketTake,
)
from app.forecasting.services.thread_continuation_policy import normalize_activity_title
from app.forecasting.services.utils import hash_seed

POST_EVENT_TYPES = frozenset(
    {
        "new_take",
        "confidence_shift",
        "rivalry",
        "battle_escalation",
        "receipt",
        "stance_followup",
        "signal_shift",
        "market_move",
        "consensus_shift",
        "narrative_acceleration",
        "verified_call",
        "failed_call",
    }
)

RIVALRY_EVENT_TYPES = frozenset({"rivalry", "battle_escalation"})

_recall_log: list[tuple[datetime, str]] = []
_recall_hits = {"self": 0, "rival": 0, "thesis": 0, "market": 0}
_MEMORY_OUTPUT_LOG: list[dict[str, Any]] = []
_path_invocations_log: list[dict[str, Any]] = []
_fabricated_blocked_24h = 0

MEMORY_PATHS = frozenset({"template", "llm", "receipt", "rivalry", "narrative", "battle"})


def _utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _days_ago(ts: datetime | None) -> int | None:
    if not ts:
        return None
    delta = _utcnow() - ts
    return max(0, delta.days)


def _iso(ts: datetime | None) -> str | None:
    if not ts:
        return None
    return ts.isoformat()


def _prune_recall_log() -> None:
    cutoff = _utcnow() - timedelta(hours=24)
    while _recall_log and _recall_log[0][0] < cutoff:
        _recall_log.pop(0)


def _recall_type_counts_24h() -> dict[str, int]:
    cutoff = _utcnow() - timedelta(hours=24)
    counts = {"self": 0, "rival": 0, "thesis": 0, "market": 0}
    for at, category in _recall_log:
        if at >= cutoff and category in counts:
            counts[category] += 1
    return counts


def _record_recall(category: str) -> None:
    if category not in _recall_hits:
        return
    _recall_hits[category] += 1
    _recall_log.append((_utcnow(), category))
    _prune_recall_log()


def _rival_recall_share_24h() -> float:
    counts = _recall_type_counts_24h()
    total = sum(counts.values())
    if total == 0:
        return 0.0
    return counts["rival"] / total


def _prune_output_log() -> None:
    cutoff = _utcnow() - timedelta(hours=24)
    global _MEMORY_OUTPUT_LOG
    _MEMORY_OUTPUT_LOG = [row for row in _MEMORY_OUTPUT_LOG if row.get("at", cutoff) >= cutoff]


def _prune_path_invocations_log() -> None:
    cutoff = _utcnow() - timedelta(hours=24)
    global _path_invocations_log
    _path_invocations_log = [row for row in _path_invocations_log if row.get("at", cutoff) >= cutoff]


def _snippet_availability(episodic: dict[str, Any]) -> dict[str, bool]:
    by_type = episodic.get("snippets_by_type") or {}
    eligibility = _memory_type_eligibility(episodic)
    return {
        "eligible": bool(episodic.get("snippets")),
        "self": bool(by_type.get("self")) and eligibility.get("self", False),
        "rival": bool(by_type.get("rival")) and eligibility.get("rival", False),
        "thesis": bool(by_type.get("thesis")) and eligibility.get("thesis", False),
        "market": bool(by_type.get("market")) and eligibility.get("market", False),
    }


def _memory_path_invocations_24h() -> dict[str, int]:
    _prune_path_invocations_log()
    counts = {path: 0 for path in sorted(MEMORY_PATHS)}
    for row in _path_invocations_log:
        path = str(row.get("path") or "")
        if path in counts:
            counts[path] += 1
    return counts


def _memory_eligibility_24h() -> dict[str, int]:
    _prune_path_invocations_log()
    totals = {
        "memory_eligible_24h": 0,
        "memory_self_available_24h": 0,
        "memory_rival_available_24h": 0,
        "memory_thesis_available_24h": 0,
        "memory_market_available_24h": 0,
        "memory_selection_ran_24h": 0,
        "memory_audit_ran_24h": 0,
    }
    for row in _path_invocations_log:
        if row.get("eligible"):
            totals["memory_eligible_24h"] += 1
        if row.get("self_available"):
            totals["memory_self_available_24h"] += 1
        if row.get("rival_available"):
            totals["memory_rival_available_24h"] += 1
        if row.get("thesis_available"):
            totals["memory_thesis_available_24h"] += 1
        if row.get("market_available"):
            totals["memory_market_available_24h"] += 1
        if row.get("selection_ran"):
            totals["memory_selection_ran_24h"] += 1
        if row.get("audit_ran"):
            totals["memory_audit_ran_24h"] += 1
    return totals


def record_memory_path_invocation(
    *,
    path: str,
    eligible: bool,
    self_available: bool = False,
    rival_available: bool = False,
    thesis_available: bool = False,
    market_available: bool = False,
    selection_ran: bool = False,
    audit_ran: bool = False,
    generation_mode: str | None = None,
) -> None:
    if path not in MEMORY_PATHS:
        return
    _path_invocations_log.append(
        {
            "at": _utcnow(),
            "path": path,
            "eligible": eligible,
            "self_available": self_available,
            "rival_available": rival_available,
            "thesis_available": thesis_available,
            "market_available": market_available,
            "selection_ran": selection_ran,
            "audit_ran": audit_ran,
            "generation_mode": generation_mode,
        }
    )
    _prune_path_invocations_log()


def reset_agent_memory_v2_stats() -> None:
    global _recall_log, _recall_hits, _MEMORY_OUTPUT_LOG, _fabricated_blocked_24h, _path_invocations_log
    _recall_log = []
    _recall_hits = {"self": 0, "rival": 0, "thesis": 0, "market": 0}
    _MEMORY_OUTPUT_LOG = []
    _path_invocations_log = []
    _fabricated_blocked_24h = 0


def agent_memory_v2_stats() -> dict[str, Any]:
    _prune_recall_log()
    type_counts = _recall_type_counts_24h()
    recalls_24h = sum(type_counts.values())
    _prune_output_log()
    relevant_rows = [r for r in _MEMORY_OUTPUT_LOG if r.get("relevant")]
    recalled_rows = [r for r in relevant_rows if r.get("recalled")]
    recall_rate = (
        round(len(recalled_rows) / len(relevant_rows), 3) if relevant_rows else 0.0
    )
    fabricated_blocked = sum(r.get("fabricated_count", 0) for r in _MEMORY_OUTPUT_LOG)
    eligibility = _memory_eligibility_24h()

    def _type_rate(category: str) -> float:
        if recalls_24h == 0:
            return 0.0
        return round(type_counts[category] / recalls_24h, 3)

    return {
        "memory_recall_count_24h": recalls_24h,
        "memory_recall_type_counts_24h": type_counts,
        "memory_recall_self_rate_24h": _type_rate("self"),
        "memory_recall_rival_rate_24h": _type_rate("rival"),
        "memory_recall_thesis_rate_24h": _type_rate("thesis"),
        "memory_recall_market_rate_24h": _type_rate("market"),
        "memory_path_invocations_24h": _memory_path_invocations_24h(),
        **eligibility,
        "self_memory_hits": _recall_hits["self"],
        "rival_memory_hits": _recall_hits["rival"],
        "thesis_memory_hits": _recall_hits["thesis"],
        "market_memory_hits": _recall_hits["market"],
        "memory_recall_rate_24h": recall_rate,
        "memory_output_recalled_24h": len(recalled_rows),
        "memory_output_relevant_24h": len(relevant_rows),
        "fabricated_memory_blocked_24h": max(_fabricated_blocked_24h, fabricated_blocked),
    }


def thesis_bucket_from_text(text: str | None) -> str:
    return normalize_activity_title(text)


def _side_from_probability(probability: float | None) -> str | None:
    if probability is None:
        return None
    return "YES" if float(probability) >= 50 else "NO"


def _side_from_event(event: FeedEvent) -> str | None:
    meta = event.metadata_json or {}
    side = meta.get("side")
    if side:
        return str(side).upper()
    return _side_from_probability(event.probability)


def _resolution_receipt_ref(
    db: Session,
    resolution: ForecastResolution,
) -> dict[str, Any]:
    market = db.get(Market, resolution.market_id) if resolution.market_id else None
    feed_event = (
        db.query(FeedEvent)
        .filter(
            FeedEvent.agent_id == resolution.agent_id,
            FeedEvent.market_id == resolution.market_id,
            FeedEvent.type == "receipt",
        )
        .order_by(FeedEvent.created_at.desc())
        .first()
    )
    days = _days_ago(resolution.resolved_at)
    return {
        "resolution_id": resolution.id,
        "feed_event_id": feed_event.id if feed_event else None,
        "market_id": resolution.market_id,
        "market_title": market.title if market else None,
        "side": resolution.side,
        "confidence": resolution.confidence,
        "days_early": resolution.days_early,
        "resolved_at": _iso(resolution.resolved_at),
        "days_ago": days,
    }


def _compute_streaks(resolutions: list[ForecastResolution]) -> tuple[int, int]:
    ordered = sorted(resolutions, key=lambda r: r.resolved_at or datetime.min)
    completed: list[int] = []
    run = 0
    for row in ordered:
        if row.correct:
            run += 1
        else:
            if run:
                completed.append(run)
            run = 0
    current = run
    if run:
        previous = completed[-1] if completed else 0
    elif completed:
        current = 0
        previous = completed[-1]
    else:
        current = 0
        previous = 0
    return current, previous


def get_recent_self_memory(db: Session, agent_id: int) -> dict[str, Any]:
    """Factual self-memory from forecast resolutions and receipt events."""
    resolutions = (
        db.query(ForecastResolution)
        .filter(ForecastResolution.agent_id == agent_id)
        .order_by(ForecastResolution.resolved_at.desc())
        .all()
    )
    successes = [r for r in resolutions if r.correct]
    failures = [r for r in resolutions if not r.correct]

    last_success = _resolution_receipt_ref(db, successes[0]) if successes else None
    last_failed = _resolution_receipt_ref(db, failures[0]) if failures else None

    best_call = None
    if successes:
        best = max(successes, key=lambda r: (r.days_early, r.confidence))
        best_call = {
            "resolution_id": best.id,
            "market_id": best.market_id,
            "market_title": db.get(Market, best.market_id).title if best.market_id else None,
            "side": best.side,
            "days_early": best.days_early,
            "confidence": best.confidence,
            "resolved_at": _iso(best.resolved_at),
        }

    worst_miss = None
    if failures:
        worst = max(failures, key=lambda r: (r.confidence, r.predicted_probability))
        worst_miss = {
            "resolution_id": worst.id,
            "market_id": worst.market_id,
            "market_title": db.get(Market, worst.market_id).title if worst.market_id else None,
            "side": worst.side,
            "confidence": worst.confidence,
            "resolved_at": _iso(worst.resolved_at),
        }

    current_streak, previous_streak = _compute_streaks(resolutions)
    return {
        "agent_id": agent_id,
        "last_successful_receipt": last_success,
        "last_failed_receipt": last_failed,
        "current_streak": current_streak,
        "previous_streak": previous_streak,
        "best_call": best_call,
        "worst_miss": worst_miss,
    }


def _agent_sides_on_market(
    db: Session,
    agent_id: int,
    market_id: int,
) -> set[str]:
    sides: set[str] = set()
    for row in (
        db.query(ForecastResolution)
        .filter(
            ForecastResolution.agent_id == agent_id,
            ForecastResolution.market_id == market_id,
        )
        .all()
    ):
        sides.add(str(row.side).upper())
    for row in (
        db.query(MarketTake)
        .filter(MarketTake.agent_id == agent_id, MarketTake.market_id == market_id)
        .all()
    ):
        sides.add(str(row.side).upper())
    for row in (
        db.query(FeedEvent)
        .filter(
            FeedEvent.agent_id == agent_id,
            FeedEvent.market_id == market_id,
            FeedEvent.type.in_(tuple(POST_EVENT_TYPES)),
        )
        .all()
    ):
        side = _side_from_event(row)
        if side:
            sides.add(side)
    return sides


def _count_pair_disagreements(
    db: Session,
    agent_id: int,
    rival_id: int,
) -> tuple[int, int, datetime | None]:
    """Return disagreements, unresolved count, last disagreement date."""
    market_ids: set[int] = set()
    for row in (
        db.query(FeedEvent.market_id)
        .filter(
            FeedEvent.agent_id.in_((agent_id, rival_id)),
            FeedEvent.market_id.isnot(None),
            FeedEvent.type.in_(tuple(POST_EVENT_TYPES | RIVALRY_EVENT_TYPES)),
        )
        .distinct()
        .all()
    ):
        if row[0]:
            market_ids.add(int(row[0]))

    disagreements = 0
    unresolved = 0
    last_at: datetime | None = None

    for market_id in market_ids:
        sides_a = _agent_sides_on_market(db, agent_id, market_id)
        sides_b = _agent_sides_on_market(db, rival_id, market_id)
        if not sides_a or not sides_b:
            continue
        if sides_a == sides_b:
            continue
        if sides_a.isdisjoint(sides_b):
            disagreements += 1
            market = db.get(Market, market_id)
            if market and not market.resolved_at:
                unresolved += 1
            last_event = (
                db.query(FeedEvent)
                .filter(
                    FeedEvent.market_id == market_id,
                    FeedEvent.agent_id.in_((agent_id, rival_id)),
                )
                .order_by(FeedEvent.created_at.desc())
                .first()
            )
            if last_event and last_event.created_at:
                if last_at is None or last_event.created_at > last_at:
                    last_at = last_event.created_at

    rivalry_events = (
        db.query(FeedEvent)
        .filter(
            FeedEvent.type.in_(tuple(RIVALRY_EVENT_TYPES)),
            FeedEvent.agent_id.in_((agent_id, rival_id)),
        )
        .order_by(FeedEvent.created_at.desc())
        .all()
    )
    agent = db.get(Agent, agent_id)
    rival = db.get(Agent, rival_id)
    if agent and rival:
        for event in rivalry_events:
            meta = event.metadata_json or {}
            opp_slug = meta.get("opponent_slug")
            if not opp_slug:
                continue
            if (
                event.agent_id == agent_id and opp_slug == rival.slug
            ) or (
                event.agent_id == rival_id and opp_slug == agent.slug
            ):
                disagreements += 1
                if event.created_at and (last_at is None or event.created_at > last_at):
                    last_at = event.created_at
                break

    return disagreements, unresolved, last_at


def _pair_battle_record(
    db: Session,
    agent_id: int,
    rival_id: int,
) -> tuple[int, int, int | None]:
    outcomes = (
        db.query(BattleOutcome)
        .filter(
            BattleOutcome.agent_id.in_((agent_id, rival_id)),
            BattleOutcome.opponent_agent_id.in_((agent_id, rival_id)),
        )
        .order_by(BattleOutcome.recorded_at.desc())
        .all()
    )
    wins = sum(1 for o in outcomes if o.agent_id == agent_id and o.won)
    losses = sum(1 for o in outcomes if o.agent_id == agent_id and not o.won)
    last_winner: int | None = None
    if outcomes:
        top = outcomes[0]
        if top.won:
            last_winner = top.agent_id
        elif top.opponent_agent_id:
            last_winner = top.opponent_agent_id
    return wins, losses, last_winner


def get_rival_memory(db: Session, agent_id: int, rival_id: int) -> dict[str, Any]:
    rival = db.get(Agent, rival_id)
    disagreements, unresolved, last_at = _count_pair_disagreements(db, agent_id, rival_id)
    wins, losses, last_winner_id = _pair_battle_record(db, agent_id, rival_id)
    last_winner_slug = None
    if last_winner_id:
        winner = db.get(Agent, last_winner_id)
        last_winner_slug = winner.slug if winner else None
    return {
        "agent_id": agent_id,
        "rival_id": rival_id,
        "rival_slug": rival.slug if rival else None,
        "rival_name": rival.name if rival else None,
        "disagreements": disagreements,
        "wins": wins,
        "losses": losses,
        "unresolved": unresolved,
        "last_disagreement_date": _iso(last_at),
        "last_winner_agent_id": last_winner_id,
        "last_winner_slug": last_winner_slug,
    }


def _thesis_events_for_agent(db: Session, agent_id: int) -> list[tuple[datetime, str, float | None, str]]:
    """(timestamp, bucket, confidence, source_type) rows."""
    rows: list[tuple[datetime, str, float | None, str]] = []

    state = db.query(AgentState).filter(AgentState.agent_id == agent_id).first()
    if state and state.state_json:
        for thesis in state.state_json.get("current_theses") or []:
            bucket = thesis_bucket_from_text(thesis.get("thesis"))
            if not bucket:
                continue
            updated = thesis.get("updated_at")
            try:
                ts = datetime.fromisoformat(updated) if updated else _utcnow()
            except ValueError:
                ts = _utcnow()
            rows.append((ts, bucket, float(thesis.get("confidence") or 0), "agent_state"))

    for event in (
        db.query(FeedEvent)
        .filter(
            FeedEvent.agent_id == agent_id,
            FeedEvent.type.in_(tuple(POST_EVENT_TYPES)),
        )
        .order_by(FeedEvent.created_at.asc())
        .all()
    ):
        bucket = thesis_bucket_from_text(event.title) or thesis_bucket_from_text(event.body)
        if not bucket:
            continue
        ts = event.created_at or _utcnow()
        conf = event.confidence or event.probability
        rows.append((ts, bucket, float(conf) if conf is not None else None, "feed_event"))

    for take in (
        db.query(MarketTake)
        .filter(MarketTake.agent_id == agent_id)
        .order_by(MarketTake.created_at.asc())
        .all()
    ):
        bucket = thesis_bucket_from_text(take.body)
        if not bucket:
            continue
        rows.append((take.created_at or _utcnow(), bucket, float(take.confidence), "market_take"))

    return rows


def get_thesis_memory(db: Session, agent_id: int, thesis_bucket: str) -> dict[str, Any]:
    bucket = thesis_bucket_from_text(thesis_bucket)
    if not bucket:
        return {
            "agent_id": agent_id,
            "thesis_bucket": "",
            "first_appearance": None,
            "latest_appearance": None,
            "supporting_receipts": [],
            "opposing_receipts": [],
            "confidence_trend": [],
        }

    events = [e for e in _thesis_events_for_agent(db, agent_id) if e[1] == bucket]
    first_appearance = _iso(events[0][0]) if events else None
    latest_appearance = _iso(events[-1][0]) if events else None
    confidence_trend = [
        {"at": _iso(ts), "confidence": conf, "source": source}
        for ts, _, conf, source in events
        if conf is not None
    ]

    supporting: list[dict[str, Any]] = []
    opposing: list[dict[str, Any]] = []
    for resolution in (
        db.query(ForecastResolution)
        .filter(ForecastResolution.agent_id == agent_id, ForecastResolution.correct.is_(True))
        .order_by(ForecastResolution.resolved_at.asc())
        .all()
    ):
        market = db.get(Market, resolution.market_id) if resolution.market_id else None
        title_bucket = thesis_bucket_from_text(market.title if market else None)
        if title_bucket != bucket:
            body_match = False
            for take in (
                db.query(MarketTake)
                .filter(
                    MarketTake.agent_id == agent_id,
                    MarketTake.market_id == resolution.market_id,
                )
                .limit(3)
                .all()
            ):
                if thesis_bucket_from_text(take.body) == bucket:
                    body_match = True
                    break
            if not body_match:
                continue
        supporting.append(
            {
                "resolution_id": resolution.id,
                "market_id": resolution.market_id,
                "side": resolution.side,
                "resolved_at": _iso(resolution.resolved_at),
            }
        )

    for resolution in (
        db.query(ForecastResolution)
        .filter(ForecastResolution.agent_id == agent_id, ForecastResolution.correct.is_(False))
        .order_by(ForecastResolution.resolved_at.asc())
        .all()
    ):
        market = db.get(Market, resolution.market_id) if resolution.market_id else None
        title_bucket = thesis_bucket_from_text(market.title if market else None)
        if title_bucket != bucket:
            continue
        opposing.append(
            {
                "resolution_id": resolution.id,
                "market_id": resolution.market_id,
                "side": resolution.side,
                "resolved_at": _iso(resolution.resolved_at),
            }
        )

    return {
        "agent_id": agent_id,
        "thesis_bucket": bucket,
        "first_appearance": first_appearance,
        "latest_appearance": latest_appearance,
        "supporting_receipts": supporting,
        "opposing_receipts": opposing,
        "confidence_trend": confidence_trend,
    }


def _stance_history_for_market(db: Session, agent_id: int, market_id: int) -> list[dict[str, Any]]:
    history: list[tuple[datetime, dict[str, Any]]] = []

    for take in (
        db.query(MarketTake)
        .filter(MarketTake.agent_id == agent_id, MarketTake.market_id == market_id)
        .order_by(MarketTake.created_at.asc())
        .all()
    ):
        history.append(
            (
                take.created_at or _utcnow(),
                {
                    "at": _iso(take.created_at),
                    "side": take.side,
                    "confidence": take.confidence,
                    "source": "market_take",
                    "source_id": take.id,
                },
            )
        )

    for event in (
        db.query(FeedEvent)
        .filter(
            FeedEvent.agent_id == agent_id,
            FeedEvent.market_id == market_id,
            FeedEvent.type.in_(tuple(POST_EVENT_TYPES)),
        )
        .order_by(FeedEvent.created_at.asc())
        .all()
    ):
        side = _side_from_event(event)
        if not side:
            continue
        history.append(
            (
                event.created_at or _utcnow(),
                {
                    "at": _iso(event.created_at),
                    "side": side,
                    "confidence": event.confidence or event.probability,
                    "source": "feed_event",
                    "source_id": event.id,
                },
            )
        )

    for resolution in (
        db.query(ForecastResolution)
        .filter(
            ForecastResolution.agent_id == agent_id,
            ForecastResolution.market_id == market_id,
        )
        .order_by(ForecastResolution.resolved_at.asc())
        .all()
    ):
        history.append(
            (
                resolution.resolved_at or _utcnow(),
                {
                    "at": _iso(resolution.resolved_at),
                    "side": resolution.side,
                    "confidence": resolution.confidence,
                    "source": "forecast_resolution",
                    "source_id": resolution.id,
                    "correct": resolution.correct,
                },
            )
        )

    history.sort(key=lambda x: x[0])
    return [item for _, item in history]


def get_market_memory(db: Session, agent_id: int, market_id: int) -> dict[str, Any]:
    market = db.get(Market, market_id)
    stance_history = _stance_history_for_market(db, agent_id, market_id)
    first_call = stance_history[0] if stance_history else None
    latest_call = stance_history[-1] if stance_history else None

    receipts_earned = (
        db.query(ForecastResolution)
        .filter(
            ForecastResolution.agent_id == agent_id,
            ForecastResolution.market_id == market_id,
            ForecastResolution.correct.is_(True),
        )
        .count()
    )
    receipts_lost = (
        db.query(ForecastResolution)
        .filter(
            ForecastResolution.agent_id == agent_id,
            ForecastResolution.market_id == market_id,
            ForecastResolution.correct.is_(False),
        )
        .count()
    )

    return {
        "agent_id": agent_id,
        "market_id": market_id,
        "market_title": market.title if market else None,
        "first_call": first_call,
        "latest_call": latest_call,
        "receipts_earned": receipts_earned,
        "receipts_lost": receipts_lost,
        "stance_history": stance_history,
    }


def _days_phrase(days: int | None) -> str | None:
    if days is None:
        return None
    if days == 0:
        return "today"
    if days == 1:
        return "1 day ago"
    return f"{days} days ago"


def format_self_memory_snippets(memory: dict[str, Any]) -> list[str]:
    snippets: list[str] = []
    success = memory.get("last_successful_receipt")
    if success and success.get("resolution_id"):
        when = _days_phrase(success.get("days_ago"))
        title = success.get("market_title") or "that market"
        if when:
            snippets.append(
                f"Last successful receipt: {title} ({success.get('side')}) — {when} "
                f"(resolution #{success['resolution_id']})."
            )
    failed = memory.get("last_failed_receipt")
    if failed and failed.get("resolution_id"):
        when = _days_phrase(failed.get("days_ago"))
        title = failed.get("market_title") or "that market"
        if when:
            snippets.append(
                f"Last failed receipt: {title} ({failed.get('side')}) — {when} "
                f"(resolution #{failed['resolution_id']})."
            )
    if memory.get("current_streak", 0) > 0:
        snippets.append(f"Current verified-call streak: {memory['current_streak']}.")
    if memory.get("previous_streak", 0) > 0:
        snippets.append(f"Previous verified-call streak: {memory['previous_streak']}.")
    best = memory.get("best_call")
    if best and best.get("resolution_id"):
        snippets.append(
            f"Best call: {best.get('market_title')} — {best.get('days_early')}d early "
            f"(resolution #{best['resolution_id']})."
        )
    worst = memory.get("worst_miss")
    if worst and worst.get("resolution_id"):
        snippets.append(
            f"Worst miss: {worst.get('market_title')} at {worst.get('confidence')}% confidence "
            f"(resolution #{worst['resolution_id']})."
        )
    return snippets


def format_rival_memory_snippets(memory: dict[str, Any]) -> list[str]:
    if not memory.get("rival_id"):
        return []
    name = memory.get("rival_name") or memory.get("rival_slug") or "rival"
    snippets: list[str] = []
    if memory.get("disagreements", 0) > 0:
        snippets.append(f"Recorded disagreements with {name}: {memory['disagreements']}.")
    if memory.get("unresolved", 0) > 0:
        snippets.append(f"Unresolved disagreements with {name}: {memory['unresolved']}.")
    if memory.get("wins", 0) or memory.get("losses", 0):
        snippets.append(
            f"Battle record vs {name}: {memory.get('wins', 0)} wins, {memory.get('losses', 0)} losses."
        )
    if memory.get("last_disagreement_date"):
        snippets.append(f"Last disagreement with {name}: {memory['last_disagreement_date']}.")
    if memory.get("last_winner_slug"):
        snippets.append(f"Last battle winner in this rivalry: {memory['last_winner_slug']}.")
    return snippets


def format_thesis_memory_snippets(memory: dict[str, Any]) -> list[str]:
    if not memory.get("thesis_bucket"):
        return []
    bucket = memory["thesis_bucket"]
    snippets: list[str] = []
    if memory.get("first_appearance"):
        snippets.append(f"Thesis '{bucket}' first appeared: {memory['first_appearance']}.")
    if memory.get("latest_appearance"):
        snippets.append(f"Thesis '{bucket}' latest appearance: {memory['latest_appearance']}.")
    supporting = memory.get("supporting_receipts") or []
    if supporting:
        ids = [str(r["resolution_id"]) for r in supporting if r.get("resolution_id")]
        if ids:
            snippets.append(
                f"Supporting receipts for '{bucket}': resolution(s) {', '.join(ids)}."
            )
    opposing = memory.get("opposing_receipts") or []
    if opposing:
        ids = [str(r["resolution_id"]) for r in opposing if r.get("resolution_id")]
        if ids:
            snippets.append(f"Opposing receipts for '{bucket}': resolution(s) {', '.join(ids)}.")
    trend = memory.get("confidence_trend") or []
    if len(trend) >= 2:
        first_conf = trend[0].get("confidence")
        last_conf = trend[-1].get("confidence")
        if first_conf is not None and last_conf is not None:
            snippets.append(
                f"Confidence trend on '{bucket}': {first_conf}% → {last_conf}%."
            )
    return snippets


def format_market_memory_snippets(memory: dict[str, Any]) -> list[str]:
    if not memory.get("market_id"):
        return []
    title = memory.get("market_title") or f"market #{memory['market_id']}"
    snippets: list[str] = []
    first = memory.get("first_call")
    if first and first.get("at"):
        try:
            first_ts = datetime.fromisoformat(first["at"])
            when = _days_phrase(_days_ago(first_ts))
        except ValueError:
            when = None
        if when:
            snippets.append(f"First call on {title}: {first.get('side')} — {when}.")
    latest = memory.get("latest_call")
    if latest and latest.get("at") and latest != first:
        snippets.append(f"Latest call on {title}: {latest.get('side')} at {latest['at']}.")
    earned = int(memory.get("receipts_earned") or 0)
    lost = int(memory.get("receipts_lost") or 0)
    if earned:
        snippets.append(f"Receipts earned on {title}: {earned}.")
    if lost:
        snippets.append(f"Receipts lost on {title}: {lost}.")
    if earned and lost and earned + lost > 0:
        snippets.append("The market eventually repriced against at least one prior call.")
    return snippets


def resolve_market_id(db: Session, *, market_id: int | None = None, market_title: str | None = None) -> int | None:
    if market_id:
        return int(market_id)
    if not market_title:
        return None
    from app.forecasting.services.utils import title_to_slug

    slug = title_to_slug(market_title)
    for market in db.query(Market).all():
        if title_to_slug(market.title) == slug:
            return market.id
    match = (
        db.query(Market)
        .filter(Market.title.ilike(market_title.strip()))
        .first()
    )
    return match.id if match else None


def gather_episodic_memory_v2(
    db: Session,
    agent_id: int,
    *,
    market_id: int | None = None,
    rival_id: int | None = None,
    thesis_bucket: str | None = None,
) -> dict[str, Any]:
    """Collect structured episodic memory slices for prompt injection."""
    self_memory = get_recent_self_memory(db, agent_id)
    rival_memory = get_rival_memory(db, agent_id, rival_id) if rival_id else None
    thesis_memory = (
        get_thesis_memory(db, agent_id, thesis_bucket) if thesis_bucket else None
    )
    market_memory = get_market_memory(db, agent_id, market_id) if market_id else None

    snippets_by_type: dict[str, list[str]] = {
        "self": format_self_memory_snippets(self_memory),
        "rival": format_rival_memory_snippets(rival_memory) if rival_memory else [],
        "thesis": format_thesis_memory_snippets(thesis_memory) if thesis_memory else [],
        "market": format_market_memory_snippets(market_memory) if market_memory else [],
    }
    snippets: list[str] = []
    snippet_types: list[str] = []
    for category in ("self", "rival", "thesis", "market"):
        for line in snippets_by_type[category]:
            snippets.append(line)
            snippet_types.append(category)

    return {
        "self_memory": self_memory,
        "rival_memory": rival_memory,
        "thesis_memory": thesis_memory,
        "market_memory": market_memory,
        "snippets": snippets,
        "snippets_by_type": snippets_by_type,
        "snippet_types": snippet_types,
    }


def _memory_type_eligibility(episodic: dict[str, Any]) -> dict[str, bool]:
    self_m = episodic.get("self_memory") or {}
    market_m = episodic.get("market_memory") or {}
    thesis_m = episodic.get("thesis_memory") or {}
    rival_m = episodic.get("rival_memory") or {}

    last_receipt = self_m.get("last_successful_receipt") or {}
    has_market_call = bool(market_m.get("first_call"))
    has_recent_receipt = bool(last_receipt.get("resolution_id"))
    receipt_on_market = (
        has_recent_receipt
        and market_m.get("market_id")
        and last_receipt.get("market_id") == market_m.get("market_id")
    )
    supporting = thesis_m.get("supporting_receipts") or []
    trend = thesis_m.get("confidence_trend") or []

    return {
        "self": has_recent_receipt or has_market_call,
        "market": has_market_call or len(market_m.get("stance_history") or []) > 0,
        "thesis": bool(thesis_m.get("thesis_bucket"))
        and (len(supporting) > 0 or len(trend) >= 2),
        "rival": bool(rival_m.get("rival_id")) and int(rival_m.get("disagreements") or 0) > 0,
        "receipt_on_market": receipt_on_market,
    }


def compute_memory_type_weights(episodic: dict[str, Any]) -> dict[str, int]:
    """Priority weights for recall type selection (higher = more likely)."""
    eligibility = _memory_type_eligibility(episodic)
    by_type = episodic.get("snippets_by_type") or {}
    has_market_call = bool((episodic.get("market_memory") or {}).get("first_call"))
    weights = {
        "self": 0,
        "market": 3 if eligibility.get("market") else 0,
        "thesis": 2 if eligibility.get("thesis") else 0,
        "rival": 2 if eligibility.get("rival") else 0,
    }
    if eligibility.get("receipt_on_market"):
        weights["self"] = 5
    elif eligibility.get("self") and has_market_call:
        weights["self"] = 4
    elif eligibility.get("self"):
        weights["self"] = 2
    if _rival_recall_share_24h() >= 0.5:
        weights["rival"] = 0
    return {
        category: weight
        for category, weight in weights.items()
        if weight > 0 and by_type.get(category)
    }


def select_weighted_memory_snippet(
    episodic: dict[str, Any],
    *,
    seed: int | None = None,
) -> tuple[str | None, str | None, int | None]:
    """Pick one snippet using recall-type weights; returns (snippet, category, index)."""
    by_type = episodic.get("snippets_by_type") or {}
    weights = compute_memory_type_weights(episodic)
    if not weights:
        return None, None, None

    ordered = sorted(weights.items(), key=lambda item: item[0])
    total_weight = sum(weight for _, weight in ordered)
    roll = hash_seed(str(seed or 0), "episodic_type") % total_weight
    cumulative = 0
    chosen_type = ordered[0][0]
    for category, weight in ordered:
        cumulative += weight
        if roll < cumulative:
            chosen_type = category
            break

    type_snippets = by_type.get(chosen_type) or []
    if not type_snippets:
        return None, None, None
    idx = hash_seed(str(seed or 0), "episodic_pick") % len(type_snippets)
    return type_snippets[idx], chosen_type, idx


def apply_episodic_memory_pipeline(
    text: str,
    *,
    db: Session,
    agent_slug: str,
    path: str,
    market_id: int | None = None,
    market_title: str | None = None,
    rival_slug: str | None = None,
    thesis_bucket: str | None = None,
    seed: int | None = None,
    generation_mode: str | None = None,
    weave: bool | None = None,
    already_applied: bool = False,
) -> tuple[str, dict[str, Any]]:
    """
    Unified memory pipeline for autonomous generation paths.
    Gathers context, optionally weaves (template), sanitizes, and audits output.
    """
    meta: dict[str, Any] = {}
    if not text or not db or path not in MEMORY_PATHS:
        return text, meta
    if already_applied:
        return text, meta

    from app.forecasting.models import Agent

    agent_row = db.query(Agent).filter(Agent.slug == agent_slug).first()
    if not agent_row:
        return text, meta

    resolved_market_id = market_id
    if not resolved_market_id and market_title:
        resolved_market_id = resolve_market_id(db, market_title=market_title)

    rival_id = None
    if rival_slug:
        rival = db.query(Agent).filter(Agent.slug == str(rival_slug)).first()
        rival_id = rival.id if rival else None

    bucket = thesis_bucket_from_text(thesis_bucket) if thesis_bucket else None
    if not bucket and market_title:
        bucket = thesis_bucket_from_text(market_title)

    episodic = gather_episodic_memory_v2(
        db,
        agent_row.id,
        market_id=resolved_market_id,
        rival_id=rival_id,
        thesis_bucket=bucket,
    )
    availability = _snippet_availability(episodic)
    meta["episodic_memory_snippet_count"] = len(episodic.get("snippets") or [])
    meta["episodic_memory_availability"] = availability

    mode = generation_mode or "template"
    should_weave = weave if weave is not None else mode == "template"
    selection_ran = False
    out = text

    if should_weave and availability["eligible"]:
        woven, weave_meta = maybe_weave_episodic_memory(out, episodic, seed=seed)
        if weave_meta.get("episodic_memory_woven"):
            selection_ran = True
            out = woven
            meta.update(weave_meta)

    audit_ran = False
    if availability["eligible"]:
        sanitized, san_meta = sanitize_episodic_memory_copy(
            out,
            episodic,
            slug=agent_slug,
            seed=seed,
        )
        if san_meta:
            meta.update(san_meta)
        audit = record_memory_output_audit(
            sanitized,
            episodic,
            had_snippets=True,
        )
        meta["memory_output_audit"] = audit
        out = sanitized
        audit_ran = True

    meta["memory_pipeline_applied"] = True
    meta["memory_pipeline_path"] = path
    record_memory_path_invocation(
        path=path,
        eligible=availability["eligible"],
        self_available=availability["self"],
        rival_available=availability["rival"],
        thesis_available=availability["thesis"],
        market_available=availability["market"],
        selection_ran=selection_ran,
        audit_ran=audit_ran,
        generation_mode=mode,
    )
    return out, meta


def format_episodic_memory_for_prompt(episodic: dict[str, Any]) -> str:
    snippets = episodic.get("snippets") or []
    if not snippets:
        return ""
    lines = [
        "## Episodic memory (factual only — cite when accurate; never invent dates or receipts)",
        "Only reference facts listed below. Do not invent timing, receipts, rivalry outcomes, or prior calls.",
    ]
    for line in snippets:
        lines.append(f"- {line}")
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Output validation, weaving, and observability
# ---------------------------------------------------------------------------

_TEMPORAL_CLAIM = re.compile(
    r"\b(\d+)\s+days?\s+ago\b|\btoday\b|\byesterday\b|\blast week\b",
    re.IGNORECASE,
)
_SELF_CUES = re.compile(
    r"\b(I called|made this call|my last receipt|last receipt|the last receipt|verified[- ]call streak|"
    r"current streak|previous streak|best call|worst miss|last successful receipt)\b",
    re.IGNORECASE,
)
_RIVAL_CUES = re.compile(
    r"\b(disagree|disagreement|opposite side|took the (other|opposite)|"
    r"rivalry|battle record|rematch|unresolved|faded this)\b",
    re.IGNORECASE,
)
_THESIS_CUES = re.compile(
    r"\b(this thesis|my thesis|thesis bucket|receipt supported|supporting receipt|"
    r"supporting receipts|confidence trend|been on this thesis)\b",
    re.IGNORECASE,
)
_MARKET_CUES = re.compile(
    r"\b(first call|called this|latest call|repriced|receipts (earned|lost)|"
    r"market eventually|moving my way since)\b",
    re.IGNORECASE,
)
_RESOLUTION_CLAIM = re.compile(r"\bresolution\s*#?\s*(\d+)\b", re.IGNORECASE)
_WORD = re.compile(r"[a-z0-9']+")


def build_memory_anchors(episodic: dict[str, Any]) -> dict[str, Any]:
    snippets = episodic.get("snippets") or []
    days: set[int] = set()
    phrases: list[str] = []
    rival_names: set[str] = set()
    market_titles: set[str] = set()
    thesis_buckets: set[str] = set()
    resolution_ids: set[int] = set()

    rival = episodic.get("rival_memory") or {}
    if rival.get("rival_name"):
        rival_names.add(str(rival["rival_name"]).lower())
    if rival.get("rival_slug"):
        rival_names.add(str(rival["rival_slug"]).replace("-", " ").lower())

    thesis = episodic.get("thesis_memory") or {}
    if thesis.get("thesis_bucket"):
        thesis_buckets.add(str(thesis["thesis_bucket"]).lower())

    market = episodic.get("market_memory") or {}
    if market.get("market_title"):
        market_titles.add(str(market["market_title"]).lower())

    for snippet in snippets:
        lower = str(snippet).lower()
        phrases.append(lower)
        if "today" in lower:
            days.add(0)
        if "1 day ago" in lower:
            days.add(1)
        for match in re.finditer(r"(\d+)\s+days?\s+ago", lower):
            days.add(int(match.group(1)))
        for match in _RESOLUTION_CLAIM.finditer(snippet):
            resolution_ids.add(int(match.group(1)))
        for match in re.finditer(r"resolution\(s\)\s*([\d,\s]+)", lower):
            for part in match.group(1).split(","):
                part = part.strip()
                if part.isdigit():
                    resolution_ids.add(int(part))

    return {
        "snippets": snippets,
        "phrases": phrases,
        "days": days,
        "rival_names": rival_names,
        "market_titles": market_titles,
        "thesis_buckets": thesis_buckets,
        "resolution_ids": resolution_ids,
    }


def _tokens(text: str) -> set[str]:
    return {t for t in _WORD.findall(text.lower()) if len(t) > 2}


def _token_overlap(a: str, b: str) -> int:
    return len(_tokens(a) & _tokens(b))


def _extract_day_claim(text: str) -> int | None:
    lower = text.lower()
    if "today" in lower:
        return 0
    if "yesterday" in lower:
        return 1
    if "last week" in lower:
        return 7
    match = re.search(r"(\d+)\s+days?\s+ago", lower)
    if match:
        return int(match.group(1))
    return None


def _sentence_supported(sentence: str, anchors: dict[str, Any]) -> bool:
    snippets = anchors.get("snippets") or []
    if not snippets:
        return True
    lower = sentence.lower()
    has_memory_cue = bool(
        _SELF_CUES.search(sentence)
        or _RIVAL_CUES.search(sentence)
        or _THESIS_CUES.search(sentence)
        or _MARKET_CUES.search(sentence)
        or _TEMPORAL_CLAIM.search(sentence)
        or _RESOLUTION_CLAIM.search(sentence)
    )
    if not has_memory_cue:
        return True

    day_claim = _extract_day_claim(sentence)
    if day_claim is not None and day_claim not in anchors.get("days", set()):
        return False

    res_match = _RESOLUTION_CLAIM.search(sentence)
    if res_match:
        res_id = int(res_match.group(1))
        if res_id not in anchors.get("resolution_ids", set()):
            return False

    if _RIVAL_CUES.search(sentence):
        if not anchors.get("rival_names"):
            return False
        if not any(name in lower for name in anchors["rival_names"]):
            return False
        for snippet in snippets:
            snip_lower = snippet.lower()
            if (
                "disagreement" in snip_lower or "battle record" in snip_lower
            ) and any(name in snip_lower for name in anchors["rival_names"]):
                return True
        if "faded this" in lower and any(name in lower for name in anchors["rival_names"]):
            return any(
                any(name in snip.lower() for name in anchors["rival_names"])
                for snip in snippets
            )

    if _THESIS_CUES.search(sentence):
        buckets = anchors.get("thesis_buckets") or set()
        if buckets and not any(bucket in lower for bucket in buckets):
            return False
        for snippet in snippets:
            snip_lower = snippet.lower()
            if "thesis" in snip_lower and any(bucket in snip_lower for bucket in buckets):
                if _token_overlap(sentence, snippet) >= 1:
                    return True
            if "supporting receipt" in snip_lower:
                if _token_overlap(sentence, snippet) >= 2:
                    return True

    if _MARKET_CUES.search(sentence) or (
        _SELF_CUES.search(sentence) and "called" in lower
    ):
        titles = anchors.get("market_titles") or set()
        if titles and not any(title in lower for title in titles):
            return False

    for snippet in snippets:
        if _token_overlap(sentence, snippet) >= 3:
            return True
        if lower in snippet.lower() or snippet.lower() in lower:
            return True

    if day_claim is not None and day_claim in anchors.get("days", set()):
        return _token_overlap(sentence, " ".join(snippets)) >= 2

    if _RIVAL_CUES.search(sentence) and any(name in lower for name in anchors.get("rival_names", set())):
        return False

    return False


def classify_output_memory_references(
    text: str,
    episodic: dict[str, Any] | None,
) -> dict[str, Any]:
    episodic = episodic or {}
    snippets = episodic.get("snippets") or []
    anchors = build_memory_anchors(episodic)
    lower = (text or "").lower()
    result = {
        "self": False,
        "rival": False,
        "thesis": False,
        "market": False,
        "fabricated": [],
        "has_snippets": bool(snippets),
    }
    if not text or not snippets:
        return result

    if _SELF_CUES.search(text) or (
        _TEMPORAL_CLAIM.search(text) and re.search(r"\bcalled\b", lower)
    ):
        result["self"] = _sentence_supported(text, anchors) and bool(
            episodic.get("self_memory", {}).get("last_successful_receipt")
            or episodic.get("self_memory", {}).get("current_streak")
            or episodic.get("self_memory", {}).get("previous_streak")
        )
    if _RIVAL_CUES.search(text) and anchors.get("rival_names"):
        if any(name in lower for name in anchors["rival_names"]):
            result["rival"] = _sentence_supported(text, anchors)
    if _THESIS_CUES.search(text) or re.search(
        r"supporting receipt|last receipts supported|been on this thesis", lower
    ):
        result["thesis"] = _sentence_supported(text, anchors) and bool(
            anchors.get("thesis_buckets")
        )
    if _MARKET_CUES.search(text) or (
        _TEMPORAL_CLAIM.search(text) and re.search(r"\bcalled\b", lower)
    ):
        result["market"] = _sentence_supported(text, anchors) and bool(
            anchors.get("market_titles")
        )

    from app.forecasting.services.copy_sanitize import split_sentences

    for sentence in split_sentences(text):
        if not _sentence_supported(sentence, anchors):
            result["fabricated"].append(sentence.strip())

    return result


def sanitize_episodic_memory_copy(
    text: str,
    episodic: dict[str, Any] | None,
    *,
    slug: str,
    seed: int | None = None,
) -> tuple[str, dict[str, Any]]:
    """Drop memory sentences that are not anchored to provided snippets."""
    del slug, seed  # reserved for future rewrite hooks
    meta: dict[str, Any] = {}
    if not text or not episodic or not episodic.get("snippets"):
        return text, meta

    from app.forecasting.services.copy_sanitize import split_sentences

    anchors = build_memory_anchors(episodic)
    kept: list[str] = []
    blocked: list[str] = []
    for sentence in split_sentences(text):
        if _sentence_supported(sentence, anchors):
            kept.append(sentence)
        else:
            blocked.append(sentence)

    if blocked:
        global _fabricated_blocked_24h
        _fabricated_blocked_24h += len(blocked)
        meta["fabricated_memory_blocked"] = len(blocked)
        meta["fabricated_memory_sentences"] = blocked[:3]

    out = " ".join(kept).strip()
    if blocked and not out:
        meta["fabricated_memory_cleared"] = True
    return out, meta


def record_memory_output_audit(
    text: str,
    episodic: dict[str, Any] | None,
    *,
    had_snippets: bool | None = None,
) -> dict[str, Any]:
    audit = classify_output_memory_references(text, episodic)
    snippets = (episodic or {}).get("snippets") or []
    relevant = had_snippets if had_snippets is not None else bool(snippets)
    recalled = any(audit.get(k) for k in ("self", "rival", "thesis", "market"))
    categories = [k for k in ("self", "rival", "thesis", "market") if audit.get(k)]
    if recalled and not audit.get("fabricated"):
        for category in categories:
            _record_recall(category)
    row = {
        "at": _utcnow(),
        "relevant": relevant,
        "recalled": recalled and not audit.get("fabricated"),
        "categories": categories,
        "fabricated_count": len(audit.get("fabricated") or []),
    }
    _MEMORY_OUTPUT_LOG.append(row)
    _prune_output_log()
    return audit


def episodic_memory_prompt_guidance(
    episodic: dict[str, Any] | list[str],
    *,
    seed: int | None = None,
) -> str:
    """Encourage factual recall on ~18% of posts that have episodic context."""
    if isinstance(episodic, list):
        payload: dict[str, Any] = {"snippets": episodic}
    else:
        payload = episodic
    snippets = payload.get("snippets") or []
    if not snippets:
        return ""
    roll = hash_seed(str(seed or 0), "episodic_prompt") % 100
    if roll >= 18:
        return ""
    snippet, category, _ = select_weighted_memory_snippet(payload, seed=seed)
    if not snippet or not category:
        return ""
    type_hints = {
        "self": "reference your own prior call or receipt",
        "market": "reference your history on this market",
        "thesis": "reference your thesis track record",
        "rival": "reference a factual rivalry detail",
    }
    hint = type_hints.get(category, "reference exactly ONE fact from episodic memory")
    return (
        f"Episodic memory guidance: when it fits naturally in one sentence, {hint}. "
        f"Anchor: {snippet} "
        "Use only provided dates, markets, and receipts. Skip memory if it would feel forced."
    )


def _snippet_to_voice_line(snippet: str, *, category: str | None = None) -> str:
    first_call = re.match(r"First call on (.+): (\w+) — (.+)\.", snippet)
    if first_call:
        _title, _side, when = first_call.groups()
        if when == "today":
            return "I made this call today."
        return f"I made this call {when}."
    last_receipt = re.match(r"Last successful receipt: (.+) \((\w+)\) — (.+) ", snippet)
    if last_receipt:
        _title, _side, when = last_receipt.groups()
        if when:
            return f"The last receipt backed this read — {when}."
        return "The last receipt backed this read."
    earned = re.match(r"Receipts earned on (.+): (\d+)\.", snippet)
    if earned:
        count = int(earned.group(2))
        if count >= 1:
            return "This market has been moving my way since the first call."
    supporting = re.match(
        r"Supporting receipts for '([^']+)': resolution\(s\) ([\d,\s]+)\.",
        snippet,
    )
    if supporting:
        ids = [p.strip() for p in supporting.group(2).split(",") if p.strip()]
        n = len(ids)
        if n >= 2:
            return f"This thesis has {n} supporting receipts now."
        return "This thesis has a supporting receipt on the tape."
    streak = re.match(r"(Current|Previous) verified-call streak: (\d+)\.", snippet)
    if streak:
        kind, value = streak.groups()
        if kind == "Current":
            return f"My verified-call streak is {value}."
        return f"My previous verified-call streak was {value}."
    thesis_first = re.match(r"Thesis '([^']+)' first appeared:", snippet)
    if thesis_first:
        bucket = thesis_first.group(1)
        return f"This thesis — '{bucket}' — has been on my tape since the first appearance."
    thesis_latest = re.match(r"Thesis '([^']+)' latest appearance:", snippet)
    if thesis_latest:
        bucket = thesis_latest.group(1)
        return f"This thesis — '{bucket}' — is still active on my tape."
    trend = re.match(r"Confidence trend on '([^']+)': ([\d.]+)% → ([\d.]+)%\.", snippet)
    if trend:
        return f"This thesis confidence moved from {trend.group(2)}% to {trend.group(3)}%."
    unresolved = re.match(r"Unresolved disagreements with ([^:]+): (\d+)\.", snippet)
    if unresolved:
        name, count = unresolved.groups()
        if int(count) >= 2:
            return f"{name} has faded this {count} times."
        return f"Still an unresolved disagreement with {name}."
    disagreements = re.match(r"Recorded disagreements with ([^:]+): (\d+)\.", snippet)
    if disagreements:
        name, count = disagreements.groups()
        if int(count) >= 2:
            return f"{name} has faded this {count} times."
        return f"{name} and I have a recorded disagreement on the tape."
    battle = re.match(r"Battle record vs ([^:]+): (\d+) wins, (\d+) losses\.", snippet)
    if battle:
        name, wins, losses = battle.groups()
        return f"Battle record against {name}: {wins} wins, {losses} losses."
    if snippet.startswith("Battle record vs"):
        return snippet.replace("Battle record vs", "Battle record against").rstrip(".") + "."
    repriced = "repriced" in snippet.lower()
    if repriced:
        return "The market eventually repriced — my prior call is on the record."
    if category == "self" and "called" in snippet.lower():
        return snippet.rstrip(".")
    return snippet.rstrip(".")


def maybe_weave_episodic_memory(
    body: str,
    episodic: dict[str, Any] | None,
    *,
    seed: int | None = None,
) -> tuple[str, dict[str, Any]]:
    """Template-path: append one weighted snippet-derived line on ~18% of relevant posts."""
    meta: dict[str, Any] = {}
    snippets = (episodic or {}).get("snippets") or []
    if not body or not snippets:
        return body, meta
    roll = hash_seed(str(seed or 0), "episodic_weave") % 100
    if roll >= 18:
        return body, meta
    snippet, category, idx = select_weighted_memory_snippet(episodic or {}, seed=seed)
    if not snippet or category is None or idx is None:
        return body, meta
    line = _snippet_to_voice_line(snippet, category=category)
    meta["episodic_memory_woven"] = True
    meta["episodic_memory_snippet_index"] = idx
    meta["episodic_memory_recall_type"] = category
    return f"{body.rstrip()}\n{line}".strip(), meta


def run_autonomous_memory_output_batch(
    db: Session,
    slug: str,
    *,
    market: Market,
    rival_slug: str,
    thesis: str,
    seeds: list[int],
) -> dict[str, Any]:
    """
    Controlled autonomous-style generation audit.
    Seeds episodic context via market / rival / thesis and generates copy per seed.
    """
    from app.forecasting.models import Agent
    from app.forecasting.services.voice_engine import generate_feed_post_with_meta

    agent = db.query(Agent).filter(Agent.slug == slug).first()
    rival = db.query(Agent).filter(Agent.slug == rival_slug).first()
    if not agent or not rival:
        raise ValueError("agent or rival not found")

    episodic = gather_episodic_memory_v2(
        db,
        agent.id,
        market_id=market.id,
        rival_id=rival.id,
        thesis_bucket=thesis_bucket_from_text(thesis),
    )
    counts = {"self": 0, "rival": 0, "thesis": 0, "market": 0, "fabricated": 0, "recalled": 0}
    outputs: list[dict[str, Any]] = []

    for seed in seeds:
        body, _, gen_meta = generate_feed_post_with_meta(
            slug,
            market_title=market.title,
            event_type="macro_release",
            seed=seed,
            db=db,
            extra_context={
                "opponent_slug": rival_slug,
                "thesis_bucket": thesis,
                "seed": seed,
                "market_id": market.id,
            },
        )
        sanitized, san_meta = sanitize_episodic_memory_copy(
            body,
            episodic,
            slug=slug,
            seed=seed,
        )
        audit = classify_output_memory_references(sanitized, episodic)
        recall_type = gen_meta.get("episodic_memory_recall_type")
        if audit.get("self"):
            counts["self"] += 1
        if audit.get("rival"):
            counts["rival"] += 1
        if audit.get("thesis"):
            counts["thesis"] += 1
        if audit.get("market"):
            counts["market"] += 1
        if audit.get("fabricated"):
            counts["fabricated"] += len(audit["fabricated"])
        if any(audit.get(k) for k in ("self", "rival", "thesis", "market")):
            counts["recalled"] += 1
        outputs.append(
            {
                "seed": seed,
                "body": sanitized,
                "audit": audit,
                "generation_mode": gen_meta.get("generation_mode"),
                "episodic_woven": gen_meta.get("episodic_memory_woven"),
                "episodic_recall_type": recall_type,
                "sanitized": bool(san_meta.get("fabricated_memory_blocked")),
            }
        )

    relevant = len(seeds)
    recall_rate = round(counts["recalled"] / relevant, 3) if relevant else 0.0
    return {
        "snippet_count": len(episodic.get("snippets") or []),
        "snippets": episodic.get("snippets") or [],
        "counts": counts,
        "recall_rate": recall_rate,
        "outputs": outputs,
    }

