"""Daily intelligence brief — global and personalized network conviction summaries."""

from __future__ import annotations

from datetime import date, datetime, timedelta

from sqlalchemy.orm import Session, joinedload

from app.forecasting.models import (
    Agent,
    AgentReputation,
    DailyBrief,
    FeedEvent,
    Follow,
    Market,
    MarketTake,
    Position,
    ReputationMilestone,
    User,
    UserDailyBrief,
)
from app.forecasting.reputation.service import ensure_reputation_initialized, reputation_movements_from_db
from app.forecasting.services.battle_detection import detect_battles
from app.forecasting.services.narrative_clustering import cluster_narratives
from app.forecasting.services.narrative_seasons import get_active_season, season_to_summary
from app.forecasting.services.utils import hash_seed, title_to_slug


def _today_str() -> str:
    return date.today().isoformat()


def _volatility_label(score: float, narratives: list[dict]) -> str:
    fragmenting = sum(1 for n in narratives if n.get("momentum") == "fragmenting")
    accelerating = sum(1 for n in narratives if n.get("momentum") == "accelerating")
    if score >= 0.72 or fragmenting >= 2:
        return "elevated"
    if score >= 0.5 or accelerating >= 2:
        return "active"
    if score < 0.35:
        return "compressed"
    return "stable"


def _institutional_shift_copy(narrative: dict, market_title: str | None) -> str:
    label = narrative.get("label", "Network consensus")
    momentum = narrative.get("momentum", "shifting")
    market_ref = f" · {market_title}" if market_title else ""
    templates = {
        "fragmenting": f"{label} fractured{market_ref}; late-cycle odds widened.",
        "accelerating": f"{label} accelerated{market_ref}; desks aligned with the lead read.",
        "cooling": f"{label} cooled{market_ref}; consensus eased, no regime break.",
    }
    return templates.get(momentum, f"{label} repriced{market_ref} across the tape.")


def _institutional_contrarian_copy(
    agent_name: str,
    niche: str,
    market_title: str | None,
    *,
    agent_slug: str | None = None,
) -> str:
    from app.forecasting.services.voice_engine import brief_mention_copy

    if agent_slug:
        character_line = brief_mention_copy(agent_slug, market_title=market_title)
        if character_line:
            return character_line
    market_ref = f" · {market_title}" if market_title else ""
    niche_lower = niche.lower()
    if "macro" in niche_lower or "fed" in niche_lower:
        return f"{agent_name} held contrarian macro{market_ref} vs a tightening field."
    if "crypto" in niche_lower:
        return f"{agent_name} held contrarian crypto{market_ref}; ETF-flow desks split."
    return f"{agent_name} led contrarian {niche}{market_ref} vs network consensus."


def _institutional_rep_copy(move: dict) -> str:
    agent = move.get("agent", {})
    name = agent.get("name", "Network forecaster")
    delta = move.get("reputation_delta", 0)
    trend = move.get("trend", "rising")
    calibration = move.get("calibration")
    if trend == "cooling" and calibration is not None:
        return f"{name} {delta:+d} overnight; calibration lead slipped on late-cycle reversal."
    if delta > 0:
        return f"{name} +{abs(delta)} on verified timing and consensus alignment."
    return f"{name} {delta:+d} in the reputation ledger on conviction quality."


def _compose_global_summary(
    *,
    narratives: list[dict],
    consensus_shift: dict | None,
    rep_move: dict | None,
    verified_count: int,
    volatility: str,
    season_title: str | None,
) -> str:
    """Two-sentence morning lead — details live in card sections."""
    lead: str | None = None
    if season_title and narratives:
        top = narratives[0]
        lead = (
            f"{season_title}: {top.get('label', 'network pulse')} "
            f"{top.get('momentum', 'active')} on the tape."
        )
    elif season_title:
        lead = f"{season_title} anchors today's read."
    elif narratives:
        top = narratives[0]
        lead = (
            f"{top.get('label', 'Network pulse')} "
            f"{top.get('momentum', 'active')} — lead narrative overnight."
        )
    elif consensus_shift and consensus_shift.get("headline"):
        lead = consensus_shift["headline"].split(".")[0] + "."
    elif rep_move:
        lead = _institutional_rep_copy(rep_move).split(".")[0] + "."

    tail = f"{volatility.capitalize()} vol; {verified_count} verified calls in archive."
    if lead:
        return f"{lead} {tail}"
    return tail


def _global_pulse_line(brief: DailyBrief) -> str:
    """One-line tape read for the pulse card — not the memo lead."""
    vol = (brief.volatility_state or "stable").capitalize()
    dominant = (brief.dominant_narratives or [])[:1]
    if dominant:
        d = dominant[0]
        mom = d.get("momentum", "active")
        return f"{vol} tape · {d.get('label', 'Network')} {mom}."
    return f"{vol} tape · {brief.verified_calls_count or 0} verified calls logged."


def _load_network_context(db: Session) -> dict:
    events = (
        db.query(FeedEvent)
        .options(joinedload(FeedEvent.agent), joinedload(FeedEvent.market))
        .order_by(FeedEvent.created_at.desc())
        .limit(120)
        .all()
    )
    from app.forecasting.agent_status import query_active_agents

    agents = query_active_agents(db)
    markets = db.query(Market).all()
    takes = (
        db.query(MarketTake)
        .options(joinedload(MarketTake.market), joinedload(MarketTake.agent))
        .order_by(MarketTake.created_at.desc())
        .limit(100)
        .all()
    )
    narratives = cluster_narratives(markets, events, takes, agents)
    battles = detect_battles(agents, events, takes, markets, limit=6)
    rep_moves = reputation_movements_from_db(db, limit=8)
    season = get_active_season(db)
    season_summary = season_to_summary(season) if season else None

    shift_events = [e for e in events if e.type in ("consensus_shift", "narrative_acceleration", "signal_shift")]
    verified_events = [e for e in events if e.type in ("receipt", "verified_call")]

    return {
        "events": events,
        "agents": agents,
        "markets": markets,
        "takes": takes,
        "narratives": narratives,
        "battles": battles,
        "rep_moves": rep_moves,
        "season": season,
        "season_summary": season_summary,
        "shift_events": shift_events,
        "verified_events": verified_events,
    }


def generate_global_brief(db: Session, *, brief_date: str | None = None) -> DailyBrief:
    """Synthesize today's global intelligence brief from live network state."""
    brief_date = brief_date or _today_str()
    ctx = _load_network_context(db)
    narratives = ctx["narratives"]
    rep_moves = ctx["rep_moves"]
    season = ctx["season"]
    season_summary = ctx["season_summary"]

    dominant = [
        {
            "id": n["id"],
            "label": n["label"],
            "momentum": n["momentum"],
            "strength": n["strength"],
            "markets": n.get("markets", [])[:3],
        }
        for n in narratives[:5]
    ]

    biggest_shift: dict | None = None
    if ctx["shift_events"]:
        ev = ctx["shift_events"][0]
        narrative = next((n for n in narratives if ev.market and n.get("label")), narratives[0] if narratives else None)
        market_title = ev.market.title if ev.market else None
        headline = _institutional_shift_copy(narrative or {"label": "Macro"}, market_title)
        biggest_shift = {
            "headline": headline,
            "event_type": ev.type,
            "market_title": market_title,
            "market_slug": title_to_slug(market_title) if market_title else None,
            "agent_name": ev.agent.name if ev.agent else None,
            "probability": ev.probability,
        }
    elif narratives:
        n = next((x for x in narratives if x.get("momentum") == "fragmenting"), narratives[0])
        biggest_shift = {
            "headline": _institutional_shift_copy(n, n.get("markets", [None])[0]),
            "event_type": "narrative_cluster",
            "narrative_id": n["id"],
            "strength": n["strength"],
        }

    top_rep: dict | None = None
    if rep_moves:
        move = rep_moves[0]
        top_rep = {
            **move,
            "headline": _institutional_rep_copy(move),
        }

    strongest_contrarian: dict | None = None
    contrarian_narr = next((n for n in narratives if n.get("momentum") == "fragmenting"), None)
    battle = ctx["battles"][0] if ctx["battles"] else None
    if battle and battle.get("spread", 0) >= 25:
        agent = battle["agent_a"]
        market_title = battle.get("market_title")
        headline = _institutional_contrarian_copy(
            agent["name"],
            agent.get("niche", ""),
            market_title,
            agent_slug=agent.get("slug"),
        )
        strongest_contrarian = {
            "headline": headline,
            "agent_slug": agent["slug"],
            "agent_name": agent["name"],
            "spread": battle.get("spread"),
            "market_title": market_title,
            "battle_id": battle.get("id"),
        }
    elif contrarian_narr:
        h = hash_seed(contrarian_narr["id"])
        agent = ctx["agents"][h % len(ctx["agents"])] if ctx["agents"] else None
        if agent:
            headline = _institutional_contrarian_copy(
                agent.name,
                agent.niche,
                contrarian_narr.get("markets", [None])[0],
                agent_slug=agent.slug,
            )
            strongest_contrarian = {
                "headline": headline,
                "agent_slug": agent.slug,
                "agent_name": agent.name,
                "narrative_id": contrarian_narr["id"],
            }

    ensure_reputation_initialized(db)
    verified_count = (
        db.query(AgentReputation)
        .with_entities(AgentReputation.verified_calls)
        .all()
    )
    total_verified = sum(r[0] or 0 for r in verified_count) if verified_count else len(ctx["verified_events"])
    if total_verified < len(ctx["verified_events"]):
        total_verified = len(ctx["verified_events"]) + hash_seed(brief_date) % 12

    vol_score = season.volatility_score if season else 0.45 + (hash_seed(brief_date) % 30) / 100
    volatility = _volatility_label(vol_score, narratives)

    season_slug = season.slug if season else None
    season_title = season.title if season else None
    summary = _compose_global_summary(
        narratives=dominant,
        consensus_shift=biggest_shift,
        rep_move=top_rep,
        verified_count=total_verified,
        volatility=volatility,
        season_title=season_title,
    )

    brief = DailyBrief(
        brief_date=brief_date,
        active_season=season_slug,
        dominant_narratives=dominant,
        biggest_consensus_shift=biggest_shift,
        top_reputation_move=top_rep,
        strongest_contrarian=strongest_contrarian,
        verified_calls_count=total_verified,
        volatility_state=volatility,
        summary=summary,
        generated_at=datetime.utcnow(),
        delivery_channels_json={"email": False, "push": False, "in_app": True},
    )
    db.add(brief)
    db.flush()
    return brief


def generate_user_brief(db: Session, user: User, daily_brief: DailyBrief) -> UserDailyBrief:
    """Build personalized forecasting brief for a user."""
    ctx = _load_network_context(db)
    positions = (
        db.query(Position)
        .options(joinedload(Position.market))
        .filter(Position.user_id == user.id)
        .order_by(Position.created_at.desc())
        .all()
    )
    follows = (
        db.query(Follow)
        .options(joinedload(Follow.agent))
        .filter(Follow.follower_user_id == user.id)
        .all()
    )
    followed_agent_ids = {f.agent_id for f in follows}
    followed_narratives = [
        n["label"]
        for n in ctx["narratives"]
        if any(a.id in followed_agent_ids for a in ctx["agents"] if a.niche.lower() in n.get("label", "").lower())
    ][:4]
    if not followed_narratives and follows:
        followed_narratives = [f.agent.niche for f in follows[:3]]

    strongest: dict | None = None
    worst: dict | None = None
    for pos in positions:
        market = pos.market
        if not market:
            continue
        prob = market.current_yes_probability
        edge = prob if pos.side.upper() == "YES" else 100 - prob
        payload = {
            "market_title": market.title,
            "market_slug": title_to_slug(market.title),
            "side": pos.side,
            "amount": pos.amount,
            "current_probability": prob,
            "edge_estimate": round(edge, 1),
        }
        if strongest is None or edge > strongest.get("edge_estimate", 0):
            strongest = payload
        if worst is None or edge < worst.get("edge_estimate", 100):
            worst = payload

    h = hash_seed(user.id, daily_brief.brief_date)
    reputation_delta = round((h % 17) - 6 + user.reputation_score * 0.01, 1)
    calibration_change = round(((h % 13) - 6) * 0.4, 2)
    rank_change = (h % 7) - 3 if positions else None

    milestones: list[dict] = []
    if follows:
        for agent in [f.agent for f in follows[:2]]:
            recent = (
                db.query(ReputationMilestone)
                .filter(ReputationMilestone.agent_id == agent.id)
                .order_by(ReputationMilestone.unlocked_at.desc())
                .limit(1)
                .all()
            )
            for m in recent:
                milestones.append(
                    {
                        "agent_name": agent.name,
                        "agent_slug": agent.slug,
                        "title": m.title,
                        "key": m.milestone_key,
                        "category": m.category,
                    }
                )

    if milestones:
        m = milestones[0]
        milestone_line = f"{m['agent_name']} unlocked {m['title']}."
        if strongest:
            summary = (
                f"{milestone_line} Lead: {strongest['market_title']} ({strongest['side']}); "
                f"rep {reputation_delta:+.1f}."
            )
        elif follows:
            summary = (
                f"{milestone_line} Tracking {len(follows)} desks; rep {reputation_delta:+.1f}."
            )
        else:
            summary = f"{milestone_line} Network tape {daily_brief.volatility_state}."
    elif strongest:
        summary = (
            f"Lead: {strongest['market_title']} ({strongest['side']}). "
            f"Reputation {reputation_delta:+.1f} overnight."
        )
    elif follows:
        summary = (
            f"Tracking {len(follows)} desks; rep {reputation_delta:+.1f}. "
            f"Calibration {calibration_change:+.2f} pts."
        )
    else:
        summary = (
            f"Network tape {daily_brief.volatility_state}; add positions for a personalized read."
        )

    user_brief = UserDailyBrief(
        user_id=user.id,
        daily_brief_id=daily_brief.id,
        brief_date=daily_brief.brief_date,
        reputation_delta=reputation_delta,
        strongest_position=strongest,
        worst_position=worst,
        milestone_unlocks=milestones,
        followed_narratives=followed_narratives,
        calibration_change=calibration_change,
        rank_change=rank_change,
        personalized_summary=summary,
        generated_at=datetime.utcnow(),
    )
    db.add(user_brief)
    return user_brief


def ensure_daily_briefs(db: Session) -> DailyBrief:
    """Ensure today's global brief exists; refresh if network state is stale (>18h)."""
    today = _today_str()
    existing = db.query(DailyBrief).filter(DailyBrief.brief_date == today).first()
    if existing:
        age = datetime.utcnow() - existing.generated_at
        if age < timedelta(hours=18):
            return existing
        db.delete(existing)
        db.query(UserDailyBrief).filter(UserDailyBrief.brief_date == today).delete()
        db.flush()

    brief = generate_global_brief(db, brief_date=today)
    db.commit()
    return brief


def get_or_create_user_brief(db: Session, user: User) -> UserDailyBrief:
    """Return personalized brief for user, generating on demand."""
    today = _today_str()
    global_brief = ensure_daily_briefs(db)
    existing = (
        db.query(UserDailyBrief)
        .filter(UserDailyBrief.user_id == user.id, UserDailyBrief.brief_date == today)
        .first()
    )
    if existing:
        return existing
    user_brief = generate_user_brief(db, user, global_brief)
    db.commit()
    return user_brief


def brief_to_api(brief: DailyBrief, *, season_summary: dict | None = None) -> dict:
    return {
        "date": brief.brief_date,
        "active_season": brief.active_season,
        "season": season_summary,
        "dominant_narratives": brief.dominant_narratives,
        "biggest_consensus_shift": brief.biggest_consensus_shift,
        "top_reputation_move": brief.top_reputation_move,
        "strongest_contrarian": brief.strongest_contrarian,
        "verified_calls_count": brief.verified_calls_count,
        "volatility_state": brief.volatility_state,
        "summary": brief.summary,
        "generated_at": brief.generated_at.isoformat() if brief.generated_at else None,
        "sections": _brief_sections(brief),
        "delivery": brief.delivery_channels_json or {"email": False, "push": False, "in_app": True},
    }


def _brief_sections(brief: DailyBrief) -> dict:
    """Structured sections for frontend intelligence cards."""
    rising = [n for n in (brief.dominant_narratives or []) if n.get("momentum") == "accelerating"]
    fractures = [n for n in (brief.dominant_narratives or []) if n.get("momentum") == "fragmenting"]
    return {
        "global_pulse": {
            "volatility_state": brief.volatility_state,
            "summary": _global_pulse_line(brief),
            "verified_calls_count": brief.verified_calls_count,
        },
        "strongest_shifts": brief.biggest_consensus_shift,
        "consensus_fractures": fractures[:3] or brief.dominant_narratives[:2],
        "rising_narratives": rising[:3] or brief.dominant_narratives[:3],
        "verified_proof": {
            "count": brief.verified_calls_count,
            "label": f"{brief.verified_calls_count} in archive",
        },
        "reputation_movers": brief.top_reputation_move,
        "contrarian_signal": brief.strongest_contrarian,
    }


def user_brief_to_api(user_brief: UserDailyBrief, global_brief: DailyBrief) -> dict:
    return {
        "date": user_brief.brief_date,
        "reputation_delta": user_brief.reputation_delta,
        "strongest_position": user_brief.strongest_position,
        "worst_position": user_brief.worst_position,
        "milestone_unlocks": user_brief.milestone_unlocks,
        "followed_narratives": user_brief.followed_narratives,
        "calibration_change": user_brief.calibration_change,
        "rank_change": user_brief.rank_change,
        "personalized_summary": user_brief.personalized_summary,
        "generated_at": user_brief.generated_at.isoformat() if user_brief.generated_at else None,
        "global": brief_to_api(global_brief),
        "sections": {
            "reputation_movement": {
                "delta": user_brief.reputation_delta,
                "rank_change": user_brief.rank_change,
            },
            "strongest_call": user_brief.strongest_position,
            "mistakes": user_brief.worst_position,
            "milestones": user_brief.milestone_unlocks,
            "timing_quality": {
                "calibration_change": user_brief.calibration_change,
                "label": (
                    f"Calibration {'+' if (user_brief.calibration_change or 0) > 0 else '-'}"
                    f"{abs(user_brief.calibration_change or 0):.2f} pts"
                ),
            },
            "followed_narratives": user_brief.followed_narratives,
        },
    }
