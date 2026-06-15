"""Weekly standings — top forecasters, timing edge, consensus breaks."""

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.forecasting.models import (
    Agent,
    AgentReputation,
    ForecastResolution,
    Market,
    ReputationEvent,
)
from app.forecasting.market_resolution import title_to_slug

router = APIRouter(tags=["standings"])


def _week_start() -> datetime:
    now = datetime.now(timezone.utc)
    return now - timedelta(days=7)


@router.get("/standings/weekly")
def weekly_standings(db: Session = Depends(get_db)):
    since = _week_start()

    rep_events = (
        db.query(ReputationEvent)
        .options(joinedload(ReputationEvent.agent))
        .filter(ReputationEvent.created_at >= since)
        .all()
    )

    agent_gains: dict[int, float] = {}
    timing_scores: dict[int, float] = {}
    consensus_breaks: dict[int, int] = {}
    macro_scores: dict[int, float] = {}

    for ev in rep_events:
        if not ev.agent_id:
            continue
        agent_gains[ev.agent_id] = agent_gains.get(ev.agent_id, 0.0) + ev.delta
        if ev.category == "consensus_break":
            consensus_breaks[ev.agent_id] = consensus_breaks.get(ev.agent_id, 0) + 1
        if ev.category in ("verified_receipt", "consensus_break") and ev.delta > 0:
            timing_scores[ev.agent_id] = timing_scores.get(ev.agent_id, 0.0) + ev.delta

    resolutions = (
        db.query(ForecastResolution)
        .options(joinedload(ForecastResolution.market))
        .filter(
            ForecastResolution.resolved_at >= since,
            ForecastResolution.correct.is_(True),
        )
        .all()
    )
    for res in resolutions:
        if res.market and res.market.category.lower() in ("macro", "rates"):
            macro_scores[res.agent_id] = macro_scores.get(res.agent_id, 0.0) + 1.0

    reps = {
        r.agent_id: r
        for r in db.query(AgentReputation)
        .options(joinedload(AgentReputation.agent))
        .all()
    }
    from app.forecasting.agent_status import query_active_agents

    agents = {a.id: a for a in query_active_agents(db)}

    def _agent_row(aid: int, score: float, label: str) -> dict:
        agent = agents.get(aid)
        rep = reps.get(aid)
        return {
            "agent_name": agent.name if agent else "Unknown",
            "agent_slug": agent.slug if agent else "unknown",
            "avatar_color": agent.avatar_color if agent else "#71717a",
            "score": round(score, 1),
            "label": label,
            "reputation_score": rep.score if rep else 0,
            "tier_label": rep.tier_label if rep else "Emerging",
        }

    top_forecasters = sorted(agent_gains.items(), key=lambda x: -x[1])[:8]
    best_timing = sorted(timing_scores.items(), key=lambda x: -x[1])[:6]
    biggest_breaks = sorted(consensus_breaks.items(), key=lambda x: -x[1])[:6]
    macro_desk = sorted(macro_scores.items(), key=lambda x: -x[1])[:6]

    resolved_this_week = (
        db.query(Market)
        .filter(Market.resolved_at >= since, Market.status == "resolved")
        .count()
    )

    return {
        "week_start": since.isoformat(),
        "markets_resolved": resolved_this_week,
        "top_forecasters": [
            _agent_row(aid, gain, f"+{gain:.0f} rep this week") for aid, gain in top_forecasters
        ],
        "best_timing_edge": [
            _agent_row(aid, sc, "Timing edge leader") for aid, sc in best_timing
        ],
        "biggest_consensus_breaks": [
            _agent_row(aid, float(cnt), f"{cnt} consensus breaks")
            for aid, cnt in biggest_breaks
        ],
        "most_accurate_macro_desk": [
            _agent_row(aid, sc, "Macro desk accuracy") for aid, sc in macro_desk
        ],
    }
