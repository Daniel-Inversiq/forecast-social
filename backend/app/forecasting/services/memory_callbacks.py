from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any

from sqlalchemy.orm import Session

from app.forecasting.models import (
    Agent,
    AgentSeasonStat,
    AgentState,
    FeedEvent,
    ForecastResolution,
    Market,
    NarrativeSeason,
    ReputationEvent,
)
from app.forecasting.services.utils import parse_spread

MEMORY_PRIORITY = ("receipt", "rivalry", "failed_call", "season")


def _days_ago(ts: datetime | None) -> int | None:
    if not ts:
        return None
    return max(1, (datetime.utcnow() - ts).days)


def _sum_rep_delta(db: Session, *, agent_id: int, resolution_id: int | None = None) -> float:
    q = db.query(ReputationEvent).filter(ReputationEvent.agent_id == agent_id)
    if resolution_id is not None:
        q = q.filter(ReputationEvent.source_id == resolution_id)
    rows = q.order_by(ReputationEvent.created_at.desc()).limit(8).all()
    return round(sum(float(r.delta or 0.0) for r in rows), 2)


def _receipt_memory(db: Session, event: FeedEvent) -> dict[str, Any] | None:
    if not event.market_id:
        return None
    resolution = (
        db.query(ForecastResolution)
        .filter(
            ForecastResolution.market_id == event.market_id,
            ForecastResolution.correct.is_(True),
            ForecastResolution.resolved_at <= (event.created_at or datetime.utcnow()),
        )
        .order_by(ForecastResolution.resolved_at.asc())
        .first()
    )
    if not resolution:
        return None
    caller = db.get(Agent, resolution.agent_id)
    if not caller:
        return None
    days = _days_ago(resolution.resolved_at)
    rep_impact = _sum_rep_delta(db, agent_id=caller.id, resolution_id=resolution.id)
    later_consensus = (
        db.query(FeedEvent)
        .filter(
            FeedEvent.market_id == event.market_id,
            FeedEvent.created_at >= resolution.resolved_at,
            FeedEvent.type.in_(("consensus_shift", "narrative_acceleration", "market_move", "signal_shift")),
        )
        .order_by(FeedEvent.created_at.desc())
        .limit(20)
        .all()
    )
    toward = False
    for row in later_consensus:
        if row.probability is None:
            continue
        if resolution.side == "YES" and float(row.probability) >= 55:
            toward = True
            break
        if resolution.side == "NO" and float(row.probability) <= 45:
            toward = True
            break
    return {
        "source_type": "ForecastResolution",
        "source_id": resolution.id,
        "resolution_id": resolution.id,
        "agent_id": caller.id,
        "agent_name": caller.name,
        "agent_slug": caller.slug,
        "days_ago": days,
        "rep_impact": rep_impact,
        "consensus_moved_toward": toward,
        "line": f"{caller.name} first pressed this {days}d ago; consensus is only now moving.",
    }


def _failed_call_memory(db: Session, event: FeedEvent) -> dict[str, Any] | None:
    market: Market | None = event.market
    q = db.query(ForecastResolution).filter(
        ForecastResolution.agent_id == event.agent_id,
        ForecastResolution.correct.is_(False),
        ForecastResolution.resolved_at >= datetime.utcnow() - timedelta(days=180),
    )
    failures = q.order_by(ForecastResolution.resolved_at.desc()).limit(6).all()
    if not failures:
        return None
    target = failures[0]
    if market:
        for row in failures:
            row_market = db.get(Market, row.market_id) if row.market_id else None
            if row_market and row_market.category == market.category:
                target = row
                break
    days = _days_ago(target.resolved_at)
    net_rep = _sum_rep_delta(db, agent_id=event.agent_id)
    clear_scar = len(failures) >= 2 and net_rep <= -1.0
    return {
        "source_type": "ForecastResolution",
        "source_id": target.id,
        "resolution_id": target.id,
        "days_ago": days,
        "clear_scar": clear_scar,
        "line": f"{event.agent.name} missed this lane {days}d ago and is still trading that scar.",
    }


def _rivalry_memory(db: Session, event: FeedEvent) -> dict[str, Any] | None:
    if event.type not in ("rivalry", "battle_escalation"):
        return None
    meta = event.metadata_json or {}
    opp_slug = meta.get("opponent_slug")
    if not opp_slug:
        return None
    opp = db.query(Agent).filter(Agent.slug == str(opp_slug)).first()
    if not opp:
        return None
    rows = (
        db.query(FeedEvent)
        .filter(
            FeedEvent.type.in_(("rivalry", "battle_escalation")),
            FeedEvent.created_at <= (event.created_at or datetime.utcnow()),
        )
        .order_by(FeedEvent.created_at.desc())
        .limit(60)
        .all()
    )
    pair = [
        r
        for r in rows
        if (
            (r.agent_id == event.agent_id and (r.metadata_json or {}).get("opponent_slug") == opp.slug)
            or (r.agent_id == opp.id and (r.metadata_json or {}).get("opponent_slug") == event.agent.slug)
        )
    ]
    if len(pair) < 2:
        return None
    last = pair[1]
    curr_spread = meta.get("spread") or parse_spread(event.body) or 0
    prev_spread = (last.metadata_json or {}).get("spread") or parse_spread(last.body) or 0
    spread_change = int(curr_spread) - int(prev_spread)
    winner = event.agent.name if spread_change >= 0 else opp.name
    flipped = event.agent.name if spread_change > 0 else opp.name
    refused = opp.name if spread_change > 0 else event.agent.name
    return {
        "source_type": "FeedEvent",
        "source_id": int(last.id) if last.id else None,
        "history_count": len(pair),
        "line": (
            f"Rivalry rematch: {winner} took the last clash; spread {prev_spread}->{curr_spread}pt. "
            f"{refused} still refuses to concede."
        ),
        "last_clash_winner": winner,
        "spread_change": spread_change,
        "who_flipped": flipped,
        "who_refused_to_concede": refused,
    }


def _season_echo(db: Session, event: FeedEvent) -> dict[str, Any] | None:
    seasons = (
        db.query(NarrativeSeason)
        .filter(NarrativeSeason.status != "active")
        .order_by(NarrativeSeason.started_at.desc())
        .limit(8)
        .all()
    )
    if not seasons:
        return None
    market_category = (event.market.category if event.market else "").lower()
    event_ts = event.created_at or datetime.utcnow()
    for season in seasons:
        if not season.ended_at:
            continue
        if (event_ts - season.ended_at).days > 420:
            continue
        title = (season.title or "").lower()
        if market_category and market_category in title:
            stat = (
                db.query(AgentSeasonStat)
                .filter(AgentSeasonStat.season_id == season.id, AgentSeasonStat.agent_id == event.agent_id)
                .first()
            )
            if not stat or (stat.consensus_breaks or 0) < 2:
                continue
            moved = int((stat.consensus_breaks or 0) * 7)
            return {
                "source_type": "NarrativeSeason",
                "source_id": season.id,
                "season_id": season.id,
                "season_slug": season.slug,
                "season_title": season.title,
                "line": f"Echoes {season.title} — the last time this bloc formed, consensus moved {moved}pt.",
            }
    return None


def _tier_for_score(score: float) -> str:
    if score >= 75:
        return "major"
    if score >= 52:
        return "strong"
    if score >= 32:
        return "subtle"
    return "none"


def _pick_primary_callback(
    receipt: dict[str, Any] | None,
    rivalry: dict[str, Any] | None,
    failed: dict[str, Any] | None,
    season: dict[str, Any] | None,
) -> tuple[str | None, dict[str, Any] | None]:
    candidates = {
        "receipt": receipt,
        "rivalry": rivalry,
        "failed_call": failed,
        "season": season,
    }
    for key in MEMORY_PRIORITY:
        value = candidates.get(key)
        if value:
            return key, value
    return None, None


def memory_for_feed_event(db: Session, event: FeedEvent) -> dict[str, Any]:
    receipt = _receipt_memory(db, event)
    failed = _failed_call_memory(db, event)
    rivalry = _rivalry_memory(db, event)
    season = _season_echo(db, event)
    scar_relevance = 1.0 if failed and failed.get("clear_scar") else 0.0
    consensus_failure_echo = 1.0 if failed and receipt and not receipt.get("consensus_moved_toward") else 0.0

    score = 0.0
    if receipt:
        score += 46.0
        if receipt.get("consensus_moved_toward"):
            score += 12.0
    if rivalry:
        score += 32.0
        if int(rivalry.get("history_count") or 0) >= 3:
            score += 9.0
    if failed and failed.get("clear_scar"):
        score += 24.0
    if season:
        score += 18.0
    score += scar_relevance * 5.0 + consensus_failure_echo * 7.0
    score = round(min(100.0, score), 1)

    # Major callbacks only when high-quality evidence exists.
    tier = _tier_for_score(score)
    major_eligible = bool(
        receipt
        or (rivalry and int(rivalry.get("history_count") or 0) >= 3)
        or (failed and failed.get("clear_scar"))
        or season
    )
    if tier == "major" and not major_eligible:
        tier = "strong"

    source_type, source_obj = _pick_primary_callback(receipt, rivalry, failed if failed and failed.get("clear_scar") else None, season)
    source_id = source_obj.get("source_id") if source_obj else None
    primary_line = source_obj.get("line") if source_obj else None
    if tier == "none":
        primary_line = None
        source_type = None
        source_id = None

    label_map = {
        "receipt": "Receipt resurfaced",
        "rivalry": "Rivalry rematch",
        "failed_call": "Old thesis returning",
        "season": "Season echo",
    }
    labels: list[str] = []
    if tier != "none" and source_type in label_map:
        labels.append(label_map[source_type])
    if tier in ("strong", "major") and receipt and source_type != "receipt":
        labels.append("Receipt resurfaced")

    return {
        "memory_value_score": score,
        "memory_tier": tier,
        "memory_source_type": source_type,
        "memory_source_id": source_id,
        "memory_labels": labels[:2],
        "primary_memory_callback": primary_line,
        "receipt_resurfaced": receipt if tier != "none" and source_type == "receipt" else None,
        "failed_call_memory": failed.get("line") if (tier != "none" and source_type == "failed_call") else None,
        "rivalry_callback": rivalry if tier != "none" and source_type == "rivalry" else None,
        "season_echo": season if tier != "none" and source_type == "season" else None,
        "consensus_failure_echo": bool(consensus_failure_echo),
    }


def memory_preview_for_candidate(db: Session, *, agent_id: int, market_id: int | None, title: str) -> dict[str, Any]:
    agent = db.get(Agent, agent_id)
    if not agent:
        return {}
    dummy = FeedEvent(
        type="signal_shift",
        agent_id=agent_id,
        market_id=market_id,
        title=title[:255],
        body=title[:255],
        probability=None,
        confidence=None,
        metadata_json={},
        created_at=datetime.utcnow(),
    )
    dummy.agent = agent
    if market_id:
        market = db.get(Market, market_id)
        dummy.market = market
    memory = memory_for_feed_event(db, dummy)
    return {
        "possible_old_receipts": [memory["receipt_resurfaced"]] if memory.get("receipt_resurfaced") else [],
        "possible_failed_calls": [memory["failed_call_memory"]] if memory.get("failed_call_memory") else [],
        "possible_rivalry_callbacks": [memory["rivalry_callback"]] if memory.get("rivalry_callback") else [],
        "possible_season_echoes": [memory["season_echo"]] if memory.get("season_echo") else [],
        "memory_value_score": memory.get("memory_value_score", 0.0),
        "memory_tier": memory.get("memory_tier", "none"),
        "memory_source_type": memory.get("memory_source_type"),
        "memory_source_id": memory.get("memory_source_id"),
        "primary_memory_callback": memory.get("primary_memory_callback"),
    }
