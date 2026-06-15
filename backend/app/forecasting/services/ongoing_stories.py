"""Rank and serialize unresolved rivalry arcs for the home feed."""

from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timedelta
from typing import Any

from sqlalchemy.orm import Session, joinedload

from app.forecasting.market_resolution import is_market_resolved
from app.forecasting.models import (
    Agent,
    AgentState,
    BattleOutcome,
    FeedEvent,
    FeedInteraction,
    Follow,
    Market,
    MarketTake,
    Position,
    StoryWatch,
    User,
)
from app.forecasting.routes_battles import get_battles
from app.forecasting.services.feed_action_state import (
    action_state_label,
    resolve_story_action_state,
)
from app.forecasting.services.feed_continuity import build_continuity_context
from app.forecasting.services.resolution_horizon import resolution_horizon_for_market
from app.forecasting.services.utils import title_to_slug


def _pair_key(slug_a: str, slug_b: str) -> str:
    return f"rivalry:{'-'.join(sorted([slug_a, slug_b]))}"


def _arc_key(arc_id: str) -> str:
    return f"arc:{arc_id}"


def _market_key(slug: str) -> str:
    return f"market:{slug}"


def _agent_brief(agent: Agent) -> dict[str, str]:
    return {
        "name": agent.name,
        "slug": agent.slug,
        "niche": agent.niche,
        "avatar_color": agent.avatar_color,
    }


def _pair_battle_record(
    db: Session,
    agent_a_id: int,
    agent_b_id: int,
) -> dict[str, Any]:
    outcomes = (
        db.query(BattleOutcome)
        .filter(
            BattleOutcome.agent_id.in_([agent_a_id, agent_b_id]),
            BattleOutcome.opponent_agent_id.in_([agent_a_id, agent_b_id]),
        )
        .order_by(BattleOutcome.recorded_at.desc())
        .all()
    )
    wins_a = sum(1 for o in outcomes if o.agent_id == agent_a_id and o.won)
    wins_b = sum(1 for o in outcomes if o.agent_id == agent_b_id and o.won)
    last_a_win = next(
        (o.recorded_at for o in outcomes if o.agent_id == agent_a_id and o.won),
        None,
    )
    last_b_win = next(
        (o.recorded_at for o in outcomes if o.agent_id == agent_b_id and o.won),
        None,
    )
    return {
        "wins_a": wins_a,
        "wins_b": wins_b,
        "total": wins_a + wins_b,
        "last_a_win": last_a_win,
        "last_b_win": last_b_win,
        "recent_outcomes": outcomes[:5],
    }


def _rival_encounters(memories: dict[int, Any], slug_a: str, slug_b: str) -> int:
    total = 0
    for mem in memories.values():
        rivals = mem.rivals if hasattr(mem, "rivals") else mem.get("rivals", {})
        for slug in (slug_a, slug_b):
            rival = rivals.get(slug, {})
            total = max(total, int(rival.get("encounters", 0)))
    return total


def _challenge_count_for_pair(
    db: Session,
    events: list[FeedEvent],
    slug_a: str,
    slug_b: str,
) -> int:
    event_ids = [
        e.id
        for e in events
        if e.type in ("rivalry", "battle_escalation")
        and e.metadata_json
        and (
            (e.agent and e.agent.slug == slug_a and e.metadata_json.get("opponent_slug") == slug_b)
            or (e.agent and e.agent.slug == slug_b and e.metadata_json.get("opponent_slug") == slug_a)
        )
    ]
    if not event_ids:
        return 0
    return (
        db.query(FeedInteraction)
        .filter(
            FeedInteraction.feed_event_id.in_(event_ids),
            FeedInteraction.interaction_type == "challenge",
            FeedInteraction.status == "active",
        )
        .count()
    )


def _resolution_line(horizon: dict[str, Any] | None) -> str | None:
    if not horizon:
        return None
    bucket = horizon.get("bucket")
    label = horizon.get("label")
    if bucket == "resolved":
        return None
    if bucket == "tonight":
        return "Resolution: tonight."
    if bucket == "soon":
        hours = horizon.get("hours_until")
        if hours is not None and hours < 48:
            return f"Resolution: {int(hours)}h."
        return f"Resolution: {label.lower()}." if label else "Resolves soon."
    if label:
        return f"Resolution: {label.lower()}."
    return None


def _why_today_line(
    *,
    horizon: dict[str, Any] | None,
    challenge_count: int,
    recent_title: str | None,
    market_title: str | None,
) -> str | None:
    if horizon and horizon.get("bucket") in ("tonight", "soon"):
        mt = market_title or "the contested market"
        return f"Today's {mt} call could flip the rivalry."
    if challenge_count >= 3:
        return f"{challenge_count} challenges landed on the latest blow — thread still open."
    if recent_title:
        short = recent_title.split(".")[0].strip()
        if len(short) > 90:
            short = f"{short[:87]}…"
        return short
    return None


def _unresolved_line(
    *,
    leader_name: str,
    trailer_name: str,
    record: dict[str, Any],
    encounters: int,
) -> str:
    if record["total"] >= 1:
        if record["wins_a"] != record["wins_b"]:
            return f"{leader_name} leads the rivalry — {trailer_name} hasn't closed the gap."
        return f"Deadlocked at {record['wins_a']}–{record['wins_b']} — neither side has broken away."
    if encounters >= 2:
        return f"{encounters} encounters on tape — no receipt yet."
    return f"{trailer_name} is still refusing to concede."


def _weeks_since_win(last_win: datetime | None, now: datetime) -> int | None:
    if not last_win:
        return None
    delta = now - last_win
    weeks = delta.days // 7
    return weeks if weeks >= 1 else None


def _score_line(
    *,
    agent_a: dict,
    agent_b: dict,
    leader_slug: str,
    record: dict[str, Any],
    encounters: int,
    now: datetime,
) -> str | None:
    if record["total"] >= 1:
        leader = agent_a if leader_slug == agent_a["slug"] else agent_b
        trailer = agent_b if leader == agent_a else agent_a
        wins_leader = record["wins_a"] if leader_slug == agent_a["slug"] else record["wins_b"]
        wins_trailer = record["wins_b"] if leader_slug == agent_a["slug"] else record["wins_a"]
        line = f"{leader['name']} leads {wins_leader}–{wins_trailer}."
        last_trailer_win = record["last_b_win"] if leader_slug == agent_a["slug"] else record["last_a_win"]
        weeks = _weeks_since_win(last_trailer_win, now)
        if weeks and weeks >= 4 and wins_trailer < wins_leader:
            line += f" {trailer['name']} hasn't won in {weeks} weeks."
        return line
    if encounters >= 2:
        return f"{encounters} clashes — still no winner."
    return None


def _story_from_battle(
    battle: dict,
    *,
    db: Session,
    events: list[FeedEvent],
    memories: dict,
    followed_slugs: set[str],
    position_market_ids: set[int],
    now: datetime,
) -> dict[str, Any]:
    agent_a = battle["agent_a"]
    agent_b = battle["agent_b"]
    slug_a, slug_b = agent_a["slug"], agent_b["slug"]
    story_key = _pair_key(slug_a, slug_b)

    agents = db.query(Agent).filter(Agent.slug.in_([slug_a, slug_b])).all()
    id_by_slug = {a.slug: a.id for a in agents}
    record = _pair_battle_record(db, id_by_slug[slug_a], id_by_slug[slug_b])
    encounters = _rival_encounters(memories, slug_a, slug_b)
    challenge_count = _challenge_count_for_pair(db, events, slug_a, slug_b)

    leader_slug = battle["head_to_head_accuracy"]["leader_slug"]
    horizon = battle.get("contested_resolution_horizon")
    market_title = battle.get("contested_market")
    market_slug = battle.get("contested_market_slug") or (
        title_to_slug(market_title) if market_title else None
    )

    recent = battle.get("recent_conflict") or {}
    recent_change = None
    if recent.get("summary"):
        recent_change = recent["summary"]
    elif recent.get("takes"):
        takes = recent["takes"]
        if len(takes) >= 2:
            recent_change = (
                f"{takes[0]['agent']['name']} at {takes[0]['confidence']:.0f}% "
                f"vs {takes[1]['agent']['name']} at {takes[1]['confidence']:.0f}%."
            )

    leader_name = agent_a["name"] if leader_slug == slug_a else agent_b["name"]
    trailer_name = agent_b["name"] if leader_slug == slug_a else agent_a["name"]

    score = _score_line(
        agent_a=agent_a,
        agent_b=agent_b,
        leader_slug=leader_slug,
        record=record,
        encounters=encounters,
        now=now,
    )
    unresolved = _unresolved_line(
        leader_name=leader_name,
        trailer_name=trailer_name,
        record=record,
        encounters=encounters,
    )
    why_today = _why_today_line(
        horizon=horizon,
        challenge_count=challenge_count,
        recent_title=recent.get("summary"),
        market_title=market_title,
    )
    resolution = _resolution_line(horizon)

    personal_boost = 0.0
    if slug_a in followed_slugs or slug_b in followed_slugs:
        personal_boost += 12.0
    if market_slug:
        market = db.query(Market).filter(Market.title == market_title).first()
        if market and market.id in position_market_ids:
            personal_boost += 18.0

    score_rank = (
        battle["disagreement_score"]
        + (20 if battle["battle_strength"] in ("heated", "legendary") else 0)
        + (15 if horizon and horizon.get("bucket") in ("tonight", "soon") else 0)
        + min(challenge_count * 3, 12)
        + personal_boost
        + (record["total"] == 0) * 8
    )

    headline = f"{agent_a['name']} vs {agent_b['name']} is still open."
    if score:
        headline = score.split(".")[0] + "."

    story = {
        "story_key": story_key,
        "story_type": "rivalry",
        "title": f"{agent_a['name']} vs {agent_b['name']}",
        "headline": headline,
        "score_line": score,
        "recent_change": recent_change,
        "unresolved_line": unresolved,
        "why_today": why_today,
        "resolution_line": resolution,
        "agents": [agent_a, agent_b],
        "market_slug": market_slug,
        "market_title": market_title,
        "arc_stage": None,
        "battle_strength": battle.get("battle_strength"),
        "is_live": battle.get("battle_strength") in ("heated", "legendary"),
        "href": f"/battles/{story_key.replace('rivalry:', '')}",
        "rank_score": score_rank,
        "watched": False,
    }
    action_key = resolve_story_action_state(story)
    story["action_state"] = action_key
    story["action_state_label"] = action_state_label(action_key)
    return story


def _story_from_arc(
    arc: dict,
    *,
    agent: Agent,
    rival: Agent | None,
    market: Market | None,
    ctx,
    followed_slugs: set[str],
    position_market_ids: set[int],
) -> dict[str, Any]:
    arc_id = str(arc.get("arc_id", ""))
    story_key = _arc_key(arc_id)
    stage_idx = int(arc.get("stage", 0))
    stages = (
        "opening thesis",
        "first counter",
        "consensus split",
        "escalation",
        "outcome pressure",
        "receipt pending",
    )
    arc_stage = stages[min(stage_idx, len(stages) - 1)]
    if arc_stage in ("receipt pending",):
        return {}

    thesis = arc.get("thesis") or "Open thesis"
    market_title = market.title if market else None
    market_slug = title_to_slug(market.title) if market else None

    title = agent.name
    if rival:
        title = f"{agent.name} vs {rival.name}"

    headline = f"{title} — arc still unfolding."
    if market_title:
        headline = f"Part {stage_idx + 1} of the {market_title} war."

    horizon = resolution_horizon_for_market(market) if market else None
    resolution = _resolution_line(horizon)

    personal_boost = 0.0
    if agent.slug in followed_slugs:
        personal_boost += 10.0
    if market and market.id in position_market_ids:
        personal_boost += 15.0

    rank_score = 35 + stage_idx * 8 + personal_boost
    if horizon and horizon.get("bucket") in ("tonight", "soon"):
        rank_score += 20

    story = {
        "story_key": story_key,
        "story_type": "arc",
        "title": title,
        "headline": headline,
        "score_line": f"Stage: {arc_stage}.",
        "recent_change": thesis[:120] if thesis else None,
        "unresolved_line": "No receipt yet — stance still contested.",
        "why_today": _why_today_line(
            horizon=horizon,
            challenge_count=0,
            recent_title=thesis,
            market_title=market_title,
        ),
        "resolution_line": resolution,
        "agents": [_agent_brief(agent)] + ([_agent_brief(rival)] if rival else []),
        "market_slug": market_slug,
        "market_title": market_title,
        "arc_stage": arc_stage,
        "battle_strength": "active" if stage_idx >= 3 else "emerging",
        "is_live": stage_idx >= 2,
        "href": f"/markets/{market_slug}" if market_slug else f"/agents/{agent.slug}",
        "rank_score": rank_score,
        "watched": False,
    }
    action_key = resolve_story_action_state(story)
    story["action_state"] = action_key
    story["action_state_label"] = action_state_label(action_key)
    return story


def _check_resolved_stories(
    db: Session,
    user: User | None,
    markets: list[Market],
) -> list[dict[str, Any]]:
    if not user:
        return []

    watches = (
        db.query(StoryWatch)
        .filter(
            StoryWatch.user_id == user.id,
            StoryWatch.status == "active",
        )
        .all()
    )
    if not watches:
        return []

    resolved: list[dict[str, Any]] = []
    market_by_slug = {title_to_slug(m.title): m for m in markets}

    for watch in watches:
        if watch.story_type == "market" or watch.story_key.startswith("market:"):
            slug = watch.story_key.split(":", 1)[-1]
            market = market_by_slug.get(slug)
            if market and is_market_resolved(market):
                outcome = market.resolved_outcome or "YES"
                watch.status = "resolved"
                watch.resolved_at = datetime.utcnow()
                resolution = {
                    "winner_label": f"Market resolved {outcome}",
                    "market_title": market.title,
                    "market_slug": slug,
                    "outcome": outcome,
                }
                watch.resolution_json = resolution
                resolved.append(
                    {
                        "story_key": watch.story_key,
                        "story_type": watch.story_type,
                        "title": market.title,
                        "closure_headline": f"{market.title} resolved {outcome}.",
                        "winner_line": f"Outcome: {outcome}.",
                        "receipt_line": "Receipt on tape — rivalry arc closed.",
                        "reputation_line": "Reputation shifts processing.",
                        "href": f"/markets/{slug}",
                        "resolved_at": watch.resolved_at.isoformat(),
                    }
                )
        elif watch.story_key.startswith("rivalry:"):
            pair = watch.story_key.replace("rivalry:", "")
            slugs = pair.split("-")
            if len(slugs) != 2:
                continue
            agents = db.query(Agent).filter(Agent.slug.in_(slugs)).all()
            if len(agents) != 2:
                continue
            a_id, b_id = agents[0].id, agents[1].id
            recent = (
                db.query(BattleOutcome)
                .filter(
                    BattleOutcome.agent_id.in_([a_id, b_id]),
                    BattleOutcome.opponent_agent_id.in_([a_id, b_id]),
                    BattleOutcome.recorded_at >= datetime.utcnow() - timedelta(hours=48),
                )
                .order_by(BattleOutcome.recorded_at.desc())
                .first()
            )
            if recent:
                winner = next(a for a in agents if a.id == recent.agent_id)
                loser = next(a for a in agents if a.id != recent.agent_id)
                watch.status = "resolved"
                watch.resolved_at = recent.recorded_at
                resolution = {
                    "winner_slug": winner.slug,
                    "winner_name": winner.name,
                    "loser_slug": loser.slug,
                    "reputation_delta": recent.reputation_delta,
                    "upset": recent.upset,
                }
                watch.resolution_json = resolution
                resolved.append(
                    {
                        "story_key": watch.story_key,
                        "story_type": "rivalry",
                        "title": f"{agents[0].name} vs {agents[1].name}",
                        "closure_headline": f"{winner.name} took the latest clash.",
                        "winner_line": f"{winner.name} won — {loser.name} concedes for now.",
                        "receipt_line": f"Receipt recorded · rep {'+' if recent.reputation_delta >= 0 else ''}{recent.reputation_delta:.0f}.",
                        "reputation_line": "Upset on tape." if recent.upset else "Expected hold.",
                        "href": f"/battles/{pair}",
                        "resolved_at": watch.resolved_at.isoformat(),
                    }
                )

    if resolved:
        db.commit()
    return resolved


def build_ongoing_stories(
    db: Session,
    user: User | None = None,
    *,
    limit: int = 3,
) -> dict[str, Any]:
    """Return ranked open stories and any newly resolved watched stories."""
    now = datetime.utcnow()
    from app.forecasting.agent_status import query_active_agents

    agents = query_active_agents(db)
    markets = db.query(Market).filter(Market.status == "open").all()
    events = (
        db.query(FeedEvent)
        .options(joinedload(FeedEvent.agent), joinedload(FeedEvent.market))
        .order_by(FeedEvent.created_at.desc())
        .limit(200)
        .all()
    )
    takes = db.query(MarketTake).options(joinedload(MarketTake.agent)).all()

    ctx = build_continuity_context(db, agents=agents, markets=markets, events=events, takes=takes)
    memories = ctx.memories

    followed_slugs: set[str] = set()
    position_market_ids: set[int] = set()
    watched_keys: set[str] = set()

    if user:
        follows = db.query(Follow).filter(Follow.follower_user_id == user.id).all()
        slug_by_id = {a.id: a.slug for a in agents}
        followed_slugs = {slug_by_id[f.agent_id] for f in follows if f.agent_id in slug_by_id}
        positions = db.query(Position).filter(Position.user_id == user.id).all()
        position_market_ids = {p.market_id for p in positions}
        watched_keys = {
            w.story_key
            for w in db.query(StoryWatch)
            .filter(StoryWatch.user_id == user.id, StoryWatch.status == "active")
            .all()
        }

    battles = get_battles(current_user=user, db=db)
    stories: list[dict[str, Any]] = []
    seen_keys: set[str] = set()

    for battle in battles[:8]:
        story = _story_from_battle(
            battle,
            db=db,
            events=events,
            memories=memories,
            followed_slugs=followed_slugs,
            position_market_ids=position_market_ids,
            now=now,
        )
        if story and story["story_key"] not in seen_keys:
            seen_keys.add(story["story_key"])
            stories.append(story)

    agent_by_slug = {a.slug: a for a in agents}
    market_by_id = {m.id: m for m in markets}

    for mem in memories.values():
        for arc in mem.active_arcs:
            arc_id = arc.get("arc_id")
            if not arc_id or _arc_key(str(arc_id)) in seen_keys:
                continue
            stage = int(arc.get("stage", 0))
            if stage >= 6:
                continue
            agent = agent_by_slug.get(mem.agent_slug)
            if not agent:
                continue
            rival_slug = arc.get("rival_slug")
            rival = agent_by_slug.get(str(rival_slug)) if rival_slug else None
            market = market_by_id.get(arc.get("market_id"))
            story = _story_from_arc(
                arc,
                agent=agent,
                rival=rival,
                market=market,
                ctx=ctx,
                followed_slugs=followed_slugs,
                position_market_ids=position_market_ids,
            )
            if story and story.get("story_key"):
                seen_keys.add(story["story_key"])
                stories.append(story)

    stories.sort(key=lambda s: s["rank_score"], reverse=True)
    top = stories[:limit]

    for story in top:
        story["watched"] = story["story_key"] in watched_keys
        story.pop("rank_score", None)

    resolved = _check_resolved_stories(db, user, db.query(Market).all())

    return {
        "stories": top,
        "resolved": resolved,
        "active_story_keys": [s["story_key"] for s in top],
    }
