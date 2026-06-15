"""Narrative seasons — era detection, stats, feed synthesis, historical memory."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session, joinedload

from app.forecasting.models import (
    Agent,
    AgentReputation,
    AgentSeasonStat,
    BattleOutcome,
    CalibrationRecord,
    FeedEvent,
    ForecastResolution,
    Market,
    NarrativeImpact,
    NarrativeSeason,
    ReputationEvent,
    SeasonShift,
)
from app.forecasting.seed_data.seasons import SEASON_DEFINITIONS, SHIFT_TEMPLATES
from app.forecasting.services.narrative_clustering import NARRATIVE_TEMPLATES, cluster_narratives
from app.forecasting.services.utils import hash_seed, title_to_slug


def ensure_seasons_initialized(db: Session) -> None:
    """Seed narrative seasons and shifts if the table is empty."""
    if db.query(NarrativeSeason).count() > 0:
        refresh_active_season_metrics(db)
        return

    seasons_by_slug: dict[str, NarrativeSeason] = {}
    for defn in SEASON_DEFINITIONS:
        season = NarrativeSeason(
            slug=defn["slug"],
            title=defn["title"],
            category=defn["category"],
            started_at=defn["started_at"],
            ended_at=defn.get("ended_at"),
            status=defn["status"],
            dominant_narratives=defn["dominant_narratives"],
            volatility_score=defn["volatility_score"],
            consensus_state=defn["consensus_state"],
            summary=defn.get("summary"),
            trigger_reason=defn.get("trigger_reason"),
        )
        db.add(season)
        seasons_by_slug[defn["slug"]] = season

    db.flush()

    agents = {a.slug: a for a in db.query(Agent).all()}
    now = datetime.utcnow()
    for tmpl in SHIFT_TEMPLATES:
        season = seasons_by_slug.get(tmpl["season_slug"])
        if not season:
            continue
        agent = agents.get(tmpl["agent_slug"]) if tmpl.get("agent_slug") else None
        db.add(
            SeasonShift(
                season_id=season.id,
                title=tmpl["title"],
                body=tmpl["body"],
                shift_type=tmpl["shift_type"],
                agent_id=agent.id if agent else None,
                occurred_at=now - timedelta(days=tmpl.get("days_ago", 0)),
            )
        )

    db.commit()
    for season in seasons_by_slug.values():
        compute_season_stats(db, season)
    db.commit()


def get_active_season(db: Session) -> NarrativeSeason | None:
    return (
        db.query(NarrativeSeason)
        .filter(NarrativeSeason.status == "active")
        .order_by(NarrativeSeason.started_at.desc())
        .first()
    )


def _season_window(season: NarrativeSeason) -> tuple[datetime, datetime]:
    start = season.started_at
    end = season.ended_at or datetime.utcnow()
    return start, end


def compute_season_stats(db: Session, season: NarrativeSeason) -> None:
    """Aggregate per-agent metrics for a season from reputation ledger."""
    start, end = _season_window(season)
    agents = db.query(Agent).all()
    agent_ids = [a.id for a in agents]

    db.query(AgentSeasonStat).filter(AgentSeasonStat.season_id == season.id).delete()

    rep_events = (
        db.query(ReputationEvent)
        .filter(
            ReputationEvent.agent_id.in_(agent_ids),
            ReputationEvent.created_at >= start,
            ReputationEvent.created_at <= end,
        )
        .all()
    )

    gains: dict[int, float] = {}
    breaks: dict[int, int] = {}
    timing: dict[int, float] = {}
    for ev in rep_events:
        gains[ev.agent_id] = gains.get(ev.agent_id, 0.0) + ev.delta
        if ev.category == "consensus_break":
            breaks[ev.agent_id] = breaks.get(ev.agent_id, 0) + 1
        if ev.category in ("verified_receipt", "consensus_break") and ev.delta > 0:
            timing[ev.agent_id] = timing.get(ev.agent_id, 0.0) + ev.delta

    resolutions = (
        db.query(ForecastResolution)
        .filter(
            ForecastResolution.agent_id.in_(agent_ids),
            ForecastResolution.resolved_at >= start,
            ForecastResolution.resolved_at <= end,
        )
        .all()
    )
    correct: dict[int, int] = {}
    for res in resolutions:
        if res.correct:
            correct[res.agent_id] = correct.get(res.agent_id, 0) + 1

    calibrations = (
        db.query(CalibrationRecord)
        .filter(
            CalibrationRecord.agent_id.in_(agent_ids),
            CalibrationRecord.recorded_at >= start,
            CalibrationRecord.recorded_at <= end,
        )
        .all()
    )
    cal_scores: dict[int, list[float]] = {}
    for cal in calibrations:
        pred = cal.predicted_probability / 100.0 if cal.predicted_probability > 1 else cal.predicted_probability
        hit = 1.0 if cal.outcome_yes == (pred >= 0.5) else 0.0
        cal_scores.setdefault(cal.agent_id, []).append(hit)

    battles = (
        db.query(BattleOutcome)
        .filter(
            BattleOutcome.agent_id.in_(agent_ids),
            BattleOutcome.recorded_at >= start,
            BattleOutcome.recorded_at <= end,
            BattleOutcome.won.is_(True),
        )
        .all()
    )
    battle_wins: dict[int, int] = {}
    for b in battles:
        battle_wins[b.agent_id] = battle_wins.get(b.agent_id, 0) + 1

    narratives = (
        db.query(NarrativeImpact)
        .filter(
            NarrativeImpact.agent_id.in_(agent_ids),
            NarrativeImpact.recorded_at >= start,
            NarrativeImpact.recorded_at <= end,
        )
        .all()
    )
    narrative_part: dict[int, int] = {}
    for n in narratives:
        narrative_part[n.agent_id] = narrative_part.get(n.agent_id, 0) + 1

    reps = {r.agent_id: r for r in db.query(AgentReputation).all()}

    stats_rows: list[AgentSeasonStat] = []
    for agent in agents:
        aid = agent.id
        rep = reps.get(aid)
        verified = rep.verified_calls if rep else 0
        if season.status == "archived":
            h = hash_seed(season.slug, agent.slug)
            verified = max(0, (h % 5) + (1 if gains.get(aid, 0) > 8 else 0))

        cal_list = cal_scores.get(aid, [])
        cal_score = (sum(cal_list) / len(cal_list) * 100) if cal_list else (rep.calibration_score if rep else 50.0)

        stat = AgentSeasonStat(
            season_id=season.id,
            agent_id=aid,
            reputation_delta=round(gains.get(aid, 0.0), 1),
            calibration_score=round(cal_score, 1),
            accuracy_score=float(correct.get(aid, 0)),
            narrative_participation=narrative_part.get(aid, 0),
            battle_wins=battle_wins.get(aid, 0),
            verified_calls=verified if season.status == "active" else max(0, verified // 2),
            consensus_breaks=breaks.get(aid, 0),
            timing_edge_score=round(timing.get(aid, 0.0), 1),
            badges_json=_agent_season_badges(season, agent, gains.get(aid, 0), breaks.get(aid, 0)),
        )
        stats_rows.append(stat)
        db.add(stat)

    db.flush()
    ranked = sorted(stats_rows, key=lambda s: -s.reputation_delta)
    for rank, stat in enumerate(ranked, start=1):
        stat.season_rank = rank

    season.highlights_json = _build_season_highlights(db, season, ranked)
    db.flush()


def _agent_season_badges(
    season: NarrativeSeason,
    agent: Agent,
    rep_delta: float,
    breaks: int,
) -> list[str]:
    badges: list[str] = []
    h = hash_seed(season.slug, agent.slug)
    template_labels = {t["id"]: t["label"] for t in NARRATIVE_TEMPLATES}
    for nid in season.dominant_narratives[:2]:
        label = template_labels.get(nid, nid.replace("-", " ").title())
        if h % 7 == 0 and nid in ("ai-acceleration", "soft-landing", "crypto-supercycle"):
            badges.append(f"Called {label}")
    if rep_delta >= 12:
        badges.append(f"Dominated {season.title}")
    if breaks >= 2:
        badges.append("Consensus breaker")
    if rep_delta < -8:
        badges.append("Collapsed after regime reversal")
    if not badges and h % 3 == 0:
        badges.append(f"Active in {season.title}")
    return badges[:3]


def _build_season_highlights(
    db: Session,
    season: NarrativeSeason,
    ranked: list[AgentSeasonStat],
) -> dict:
    agents = {a.id: a for a in db.query(Agent).all()}
    top = ranked[:5]
    top_forecasters = [
        {
            "agent_name": agents[s.agent_id].name,
            "agent_slug": agents[s.agent_id].slug,
            "avatar_color": agents[s.agent_id].avatar_color,
            "reputation_delta": s.reputation_delta,
            "rank": s.season_rank,
        }
        for s in top
        if s.agent_id in agents
    ]
    biggest_breaks = sorted(ranked, key=lambda s: -s.consensus_breaks)[:4]
    consensus_breaks = [
        {
            "agent_name": agents[s.agent_id].name,
            "agent_slug": agents[s.agent_id].slug,
            "count": s.consensus_breaks,
        }
        for s in biggest_breaks
        if s.agent_id in agents and s.consensus_breaks > 0
    ]
    best_timing = sorted(ranked, key=lambda s: -s.timing_edge_score)[:4]
    timing_leaders = [
        {
            "agent_name": agents[s.agent_id].name,
            "agent_slug": agents[s.agent_id].slug,
            "score": s.timing_edge_score,
        }
        for s in best_timing
        if s.agent_id in agents and s.timing_edge_score > 0
    ]
    best_cal = sorted(ranked, key=lambda s: -s.calibration_score)[:3]
    return {
        "top_forecasters": top_forecasters,
        "biggest_consensus_breaks": consensus_breaks,
        "timing_leaders": timing_leaders,
        "highest_calibration": [
            {
                "agent_name": agents[s.agent_id].name,
                "agent_slug": agents[s.agent_id].slug,
                "score": s.calibration_score,
            }
            for s in best_cal
            if s.agent_id in agents
        ],
        "biggest_collapses": [
            {
                "agent_name": agents[s.agent_id].name,
                "agent_slug": agents[s.agent_id].slug,
                "delta": s.reputation_delta,
            }
            for s in sorted(ranked, key=lambda s: s.reputation_delta)[:2]
            if s.agent_id in agents and s.reputation_delta < 0
        ],
    }


def refresh_active_season_metrics(db: Session) -> None:
    """Recompute active season stats and check for era transitions."""
    active = get_active_season(db)
    if active:
        compute_season_stats(db, active)
        maybe_transition_season(db, active)
    db.commit()


def maybe_transition_season(db: Session, active: NarrativeSeason) -> NarrativeSeason | None:
    """Detect regime change signals and optionally open a new season."""
    signals = detect_era_signals(db)
    if not signals.get("should_transition"):
        return None

    if signals["volatility_score"] > active.volatility_score + 15:
        active.volatility_score = signals["volatility_score"]
    if signals.get("consensus_state") and signals["consensus_state"] != active.consensus_state:
        active.consensus_state = signals["consensus_state"]
        dominant = signals.get("dominant_narratives") or active.dominant_narratives
        if dominant != active.dominant_narratives:
            now = datetime.utcnow()
            db.add(
                SeasonShift(
                    season_id=active.id,
                    title=f"{_narrative_label(dominant[0])} enters {signals['consensus_state']} phase",
                    body=signals.get("transition_copy", "Narrative cluster shift detected across the network."),
                    shift_type="narrative_shift",
                    occurred_at=now,
                )
            )
            active.dominant_narratives = dominant
    return active


def detect_era_signals(db: Session) -> dict:
    """Heuristic era detection from markets, events, and narrative clusters."""
    since = datetime.utcnow() - timedelta(days=14)
    events = (
        db.query(FeedEvent)
        .options(joinedload(FeedEvent.market), joinedload(FeedEvent.agent))
        .filter(FeedEvent.created_at >= since)
        .all()
    )
    markets = db.query(Market).all()
    from app.forecasting.agent_status import query_active_agents
    from app.forecasting.models import MarketTake

    agents = query_active_agents(db)
    takes = db.query(MarketTake).order_by(MarketTake.created_at.desc()).limit(80).all()
    narratives = cluster_narratives(markets, events, takes, agents)

    shift_events = [e for e in events if e.type in ("consensus_shift", "market_move", "signal_shift")]
    volatility = min(100.0, len(shift_events) * 4.5 + len(events) * 0.3)

    consensus_shifts = sum(1 for e in events if e.type == "consensus_shift")
    consensus_state = "unified"
    if consensus_shifts >= 6:
        consensus_state = "fragmenting"
    elif consensus_shifts >= 3:
        consensus_state = "polarized"
    if volatility >= 85:
        consensus_state = "collapsing"

    dominant = [n["id"] for n in narratives[:3]] if narratives else ["soft-landing"]
    rising = next((n for n in narratives if n.get("momentum") == "accelerating"), None)
    transition_copy = None
    if rising:
        transition_copy = (
            f"{rising['label']} narrative accelerating — "
            f"{rising.get('agent_count', 0)} forecasters engaged."
        )

    should_transition = (
        volatility >= 75
        or consensus_shifts >= 5
        or (rising and rising.get("change_24h", 0) > 6)
    )

    return {
        "should_transition": should_transition,
        "volatility_score": round(volatility, 1),
        "consensus_state": consensus_state,
        "dominant_narratives": dominant,
        "transition_copy": transition_copy,
        "narrative_clusters": narratives[:4],
    }


def _narrative_label(nid: str) -> str:
    for t in NARRATIVE_TEMPLATES:
        if t["id"] == nid:
            return t["label"]
    return nid.replace("-", " ").title()


def season_to_summary(season: NarrativeSeason) -> dict:
    template_labels = {t["id"]: t["label"] for t in NARRATIVE_TEMPLATES}
    narratives = [
        {"id": nid, "label": template_labels.get(nid, nid.replace("-", " ").title())}
        for nid in (season.dominant_narratives or [])
    ]
    return {
        "slug": season.slug,
        "title": season.title,
        "category": season.category,
        "started_at": season.started_at.isoformat() if season.started_at else None,
        "ended_at": season.ended_at.isoformat() if season.ended_at else None,
        "status": season.status,
        "dominant_narratives": narratives,
        "volatility_score": season.volatility_score,
        "consensus_state": season.consensus_state,
        "summary": season.summary,
        "trigger_reason": season.trigger_reason,
        "highlights": season.highlights_json or {},
    }


def season_detail_payload(db: Session, season: NarrativeSeason) -> dict:
    """Full season page payload."""
    compute_season_stats(db, season)
    db.commit()

    stats = (
        db.query(AgentSeasonStat)
        .options(joinedload(AgentSeasonStat.agent))
        .filter(AgentSeasonStat.season_id == season.id)
        .order_by(AgentSeasonStat.season_rank.asc())
        .all()
    )
    agents = {s.agent_id: s.agent for s in stats}
    shifts = (
        db.query(SeasonShift)
        .options(joinedload(SeasonShift.season))
        .filter(SeasonShift.season_id == season.id)
        .order_by(SeasonShift.occurred_at.desc())
        .all()
    )

    template_labels = {t["id"]: t["label"] for t in NARRATIVE_TEMPLATES}
    verified_calls = _season_verified_calls(db, season, stats, agents)

    payload = season_to_summary(season)
    payload["top_forecasters"] = [
        {
            "agent_name": agents[s.agent_id].name,
            "agent_slug": agents[s.agent_id].slug,
            "avatar_color": agents[s.agent_id].avatar_color,
            "reputation_delta": s.reputation_delta,
            "calibration_score": s.calibration_score,
            "verified_calls": s.verified_calls,
            "badges": s.badges_json or [],
            "rank": s.season_rank,
        }
        for s in stats[:8]
        if s.agent_id in agents
    ]
    payload["timeline"] = [
        {
            "title": sh.title,
            "body": sh.body,
            "shift_type": sh.shift_type,
            "occurred_at": sh.occurred_at.isoformat() if sh.occurred_at else None,
            "agent_slug": agents[sh.agent_id].slug if sh.agent_id and sh.agent_id in agents else None,
        }
        for sh in shifts
    ]
    payload["verified_calls"] = verified_calls
    payload["narrative_winners"] = [
        {
            "narrative": template_labels.get(nid, nid),
            "leader": stats[0].agent.name if stats else None,
            "leader_slug": stats[0].agent.slug if stats else None,
        }
        for nid in (season.dominant_narratives or [])[:3]
    ]
    highlights = season.highlights_json or {}
    payload["biggest_consensus_breaks"] = highlights.get("biggest_consensus_breaks", [])
    payload["timing_leaders"] = highlights.get("timing_leaders", [])
    payload["biggest_collapses"] = highlights.get("biggest_collapses", [])
    return payload


def _season_verified_calls(
    db: Session,
    season: NarrativeSeason,
    stats: list[AgentSeasonStat],
    agents: dict[int, Agent],
) -> list[dict]:
    """Synthesize notable verified calls for a season from top performers."""
    calls: list[dict] = []
    markets = db.query(Market).limit(20).all()
    for stat in sorted(stats, key=lambda s: -s.verified_calls)[:5]:
        if stat.verified_calls <= 0:
            continue
        agent = agents.get(stat.agent_id)
        if not agent:
            continue
        h = hash_seed(season.slug, agent.slug, "call")
        market = markets[h % len(markets)] if markets else None
        template = NARRATIVE_TEMPLATES[h % len(NARRATIVE_TEMPLATES)]
        calls.append(
            {
                "agent_name": agent.name,
                "agent_slug": agent.slug,
                "market_title": market.title if market else "Network conviction market",
                "market_slug": title_to_slug(market.title) if market else "market",
                "narrative": template["label"],
                "days_early": 8 + h % 22,
                "reputation_delta": round(stat.reputation_delta * 0.4, 1),
            }
        )
    return calls


def agent_season_performance(db: Session, agent: Agent) -> dict:
    """Season performance block for agent profiles."""
    stats = (
        db.query(AgentSeasonStat)
        .options(joinedload(AgentSeasonStat.season))
        .filter(AgentSeasonStat.agent_id == agent.id)
        .all()
    )
    if not stats:
        return {"seasons": [], "best_season": None, "legendary_cycle": None, "badges": []}

    ranked = sorted(stats, key=lambda s: -s.reputation_delta)
    best = ranked[0]
    seasons_out = []
    for s in sorted(stats, key=lambda x: x.season.started_at if x.season else datetime.min, reverse=True):
        if not s.season:
            continue
        seasons_out.append(
            {
                "slug": s.season.slug,
                "title": s.season.title,
                "status": s.season.status,
                "reputation_delta": s.reputation_delta,
                "rank": s.season_rank,
                "verified_calls": s.verified_calls,
                "badges": s.badges_json or [],
                "calibration_score": s.calibration_score,
            }
        )

    all_badges: list[str] = []
    for s in ranked:
        all_badges.extend(s.badges_json or [])

    return {
        "seasons": seasons_out,
        "best_season": {
            "title": best.season.title if best.season else None,
            "slug": best.season.slug if best.season else None,
            "reputation_delta": best.reputation_delta,
            "rank": best.season_rank,
        },
        "legendary_cycle": seasons_out[0]["title"] if seasons_out and seasons_out[0]["reputation_delta"] >= 15 else None,
        "badges": list(dict.fromkeys(all_badges))[:6],
    }


def build_season_feed_events(db: Session, limit: int = 3) -> list[dict]:
    """Synthetic feed events for seasonal narrative memory."""
    active = get_active_season(db)
    if not active:
        return []

    stats = (
        db.query(AgentSeasonStat)
        .options(joinedload(AgentSeasonStat.agent))
        .filter(AgentSeasonStat.season_id == active.id)
        .order_by(AgentSeasonStat.reputation_delta.desc())
        .limit(3)
        .all()
    )
    shifts = (
        db.query(SeasonShift)
        .filter(SeasonShift.season_id == active.id)
        .order_by(SeasonShift.occurred_at.desc())
        .limit(2)
        .all()
    )

    events: list[dict] = []
    now = datetime.now(timezone.utc).isoformat()

    if shifts:
        sh = shifts[0]
        events.append(
            {
                "id": -1000 - sh.id,
                "type": "season_shift",
                "agent": {
                    "name": "Scry Archive",
                    "slug": "scry-archive",
                    "niche": "Historical memory",
                    "avatar_color": "#52525b",
                },
                "title": sh.title,
                "body": sh.body,
                "probability": None,
                "confidence": None,
                "created_at": sh.occurred_at.isoformat() if sh.occurred_at else now,
                "season_slug": active.slug,
                "season_title": active.title,
                "intelligence_tags": ["season", "narrative-shift"],
            }
        )

    if stats:
        leader = stats[0]
        agent = leader.agent
        events.append(
            {
                "id": -2000 - leader.id,
                "type": "season_lead",
                "agent": {
                    "name": agent.name,
                    "slug": agent.slug,
                    "niche": agent.niche,
                    "avatar_color": agent.avatar_color,
                },
                "title": f"{agent.name} leads {active.title}",
                "body": f"+{leader.reputation_delta:.0f} reputation this season · rank #{leader.season_rank}",
                "probability": None,
                "confidence": leader.calibration_score,
                "created_at": now,
                "season_slug": active.slug,
                "season_title": active.title,
                "reputation_delta": round(leader.reputation_delta),
                "intelligence_tags": ["season", "reputation"],
            }
        )

    label = _narrative_label(active.dominant_narratives[0]) if active.dominant_narratives else active.title
    events.append(
        {
            "id": -3000,
            "type": "season_arc",
            "agent": {
                "name": "Scry Archive",
                "slug": "scry-archive",
                "niche": "Historical memory",
                "avatar_color": "#52525b",
            },
            "title": f"{label} enters {active.consensus_state} phase",
            "body": active.summary or f"Volatility {active.volatility_score:.0f} · {active.consensus_state} consensus",
            "probability": active.volatility_score,
            "confidence": None,
            "created_at": now,
            "season_slug": active.slug,
            "season_title": active.title,
            "intelligence_tags": ["season", "narrative-shift"],
        }
    )

    for stat in stats:
        for badge in stat.badges_json or []:
            if "collapse" in badge.lower():
                agent = stat.agent
                events.append(
                    {
                        "id": -4000 - stat.id,
                        "type": "season_collapse",
                        "agent": {
                            "name": agent.name,
                            "slug": agent.slug,
                            "niche": agent.niche,
                            "avatar_color": agent.avatar_color,
                        },
                        "title": f"{agent.name} collapses after regime reversal",
                        "body": badge,
                        "probability": None,
                        "confidence": None,
                        "created_at": now,
                        "season_slug": active.slug,
                        "season_title": active.title,
                        "reputation_delta": round(stat.reputation_delta),
                        "intelligence_tags": ["season", "contrarian"],
                    }
                )
                break

    return events[:limit]
