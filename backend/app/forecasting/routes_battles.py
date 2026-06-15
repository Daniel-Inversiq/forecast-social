import re
from collections import defaultdict
from itertools import combinations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from app.auth.dependencies import get_current_user, get_current_user_optional
from app.database import get_db
from app.forecasting.agent_status import CORE_AGENT_SLUGS, query_active_agents
from app.forecasting.beta_network_scale import beta_follower_count
from app.forecasting.market_resolution import is_market_resolved
from app.forecasting.models import (
    Agent,
    ConvictionPosition,
    FeedEvent,
    Follow,
    Market,
    MarketTake,
    Position,
    User,
)
from app.forecasting.request_schemas import CreateBattlePositionIn
from app.forecasting.services.conviction_ledger import append_ledger_entry, get_or_create_balance
from app.forecasting.services.conviction_limits import (
    open_market_exposure,
    open_user_exposure,
    validate_exposure_limits,
)
from app.security.rate_limit import limit_requests
from app.forecasting.reputation.featured_marks import load_milestone_map_by_agent, resolve_featured_marks
from app.forecasting.services.resolution_horizon import resolution_horizon_for_market

router = APIRouter(tags=["battles"])


def _hash(*parts) -> int:
    return sum(ord(c) for p in parts for c in str(p))


def _title_to_slug(title: str) -> str:
    slug = title.lower()
    slug = re.sub(r"[^a-z0-9]+", "-", slug)
    return slug.strip("-")


def _stats_for_slug(slug: str) -> dict[str, int]:
    h = _hash(slug)
    return {
        "streak": 3 + h % 14,
        "accuracy_pct": 78 + h % 18,
    }


def _follower_count(agent: Agent, db_follows: int) -> int:
    return beta_follower_count(agent.slug, db_follows)


def _agent_brief(agent: Agent) -> dict:
    return {
        "name": agent.name,
        "slug": agent.slug,
        "niche": agent.niche,
        "avatar_color": agent.avatar_color,
    }


def _agent_with_stats(
    agent: Agent,
    *,
    follow_counts: dict[int, int],
    receipt_counts: dict[int, int],
    conviction: dict[int, float],
    rank_by_id: dict[int, int],
    milestone_map: dict[int, dict[str, dict]] | None = None,
) -> dict:
    stats = _stats_for_slug(agent.slug)
    marks: list[dict] = []
    if milestone_map is not None:
        keys = agent.featured_milestone_keys if isinstance(agent.featured_milestone_keys, list) else []
        by_key = milestone_map.get(agent.id, {})
        ml = list(by_key.values())
        marks = resolve_featured_marks(keys, by_key, fallback_milestones=ml)
    return {
        **_agent_brief(agent),
        "accuracy_pct": stats["accuracy_pct"],
        "receipt_count": receipt_counts.get(agent.id, 1 + _hash(agent.slug, "rcpt") % 9),
        "avg_conviction": conviction.get(agent.id, 68.0 + _hash(agent.slug, "conf") % 28),
        "follower_count": _follower_count(agent, follow_counts.get(agent.id, 0)),
        "leaderboard_rank": rank_by_id.get(agent.id, 5 + _hash(agent.slug, "rank") % 12),
        "featured_reputation_marks": marks,
    }


def _battle_strength(score: float) -> str:
    if score >= 80:
        return "legendary"
    if score >= 60:
        return "heated"
    if score >= 40:
        return "active"
    return "emerging"


@router.get("/battles")
def get_battles(
    current_user: User | None = Depends(get_current_user_optional),
    db: Session = Depends(get_db),
):
    agents = query_active_agents(db)
    agent_by_id = {a.id: a for a in agents}
    milestone_map = load_milestone_map_by_agent(db)
    events = (
        db.query(FeedEvent)
        .options(joinedload(FeedEvent.agent), joinedload(FeedEvent.market))
        .order_by(FeedEvent.created_at.desc())
        .all()
    )
    takes = (
        db.query(MarketTake)
        .options(joinedload(MarketTake.agent), joinedload(MarketTake.market))
        .order_by(MarketTake.created_at.desc())
        .all()
    )
    positions = db.query(Position).all()
    markets = db.query(Market).all()
    market_by_id = {m.id: m for m in markets}
    follows = (
        db.query(Follow).filter(Follow.follower_user_id == current_user.id).all()
        if current_user
        else []
    )

    follow_counts: dict[int, int] = defaultdict(int)
    for follow in follows:
        follow_counts[follow.agent_id] += 1

    receipt_counts: dict[int, int] = defaultdict(int)
    for event in events:
        if event.type == "receipt" and event.agent_id:
            receipt_counts[event.agent_id] += 1
    for take in takes:
        if take.agent_id and take.confidence >= 80:
            receipt_counts[take.agent_id] += 1

    take_confidence: dict[int, list[float]] = defaultdict(list)
    event_confidence: dict[int, list[float]] = defaultdict(list)
    for take in takes:
        if take.agent_id:
            take_confidence[take.agent_id].append(take.confidence)
    for event in events:
        if event.confidence is not None:
            event_confidence[event.agent_id].append(event.confidence)

    def _avg_confidence(agent_id: int) -> float:
        vals = take_confidence.get(agent_id, []) + event_confidence.get(agent_id, [])
        if not vals:
            agent = agent_by_id.get(agent_id)
            slug = agent.slug if agent else str(agent_id)
            return round(68.0 + _hash(slug, "conf") % 28, 1)
        return round(sum(vals) / len(vals), 1)

    conviction = {a.id: _avg_confidence(a.id) for a in agents}
    accuracy_sorted = sorted(
        agents,
        key=lambda a: (_stats_for_slug(a.slug)["accuracy_pct"], _stats_for_slug(a.slug)["streak"]),
        reverse=True,
    )
    rank_by_id = {a.id: i + 1 for i, a in enumerate(accuracy_sorted)}

    latest_take_by_agent_market: dict[tuple[int, int], MarketTake] = {}
    for take in takes:
        if not take.agent_id or not take.market_id:
            continue
        key = (take.agent_id, take.market_id)
        if key not in latest_take_by_agent_market:
            latest_take_by_agent_market[key] = take

    takes_by_market: dict[int, list[MarketTake]] = defaultdict(list)
    for take in latest_take_by_agent_market.values():
        takes_by_market[take.market_id].append(take)

    pair_data: dict[tuple[int, int], dict] = {}

    def _pair_key(a_id: int, b_id: int) -> tuple[int, int]:
        return (min(a_id, b_id), max(a_id, b_id))

    for market_id, market_takes in takes_by_market.items():
        market = market_by_id.get(market_id)
        if not market or len(market_takes) < 2:
            continue
        for take_a, take_b in combinations(market_takes, 2):
            if take_a.side == take_b.side:
                continue
            a_id, b_id = take_a.agent_id, take_b.agent_id
            if a_id not in agent_by_id or b_id not in agent_by_id:
                continue
            key = _pair_key(a_id, b_id)
            spread = abs(take_a.confidence - take_b.confidence)
            entry = pair_data.setdefault(
                key,
                {
                    "markets": {},
                    "rivalry_events": 0,
                    "max_spread": 0,
                    "high_confidence_clashes": 0,
                },
            )
            entry["markets"][market_id] = {
                "title": market.title,
                "slug": _title_to_slug(market.title),
                "spread": spread,
                "take_a": take_a,
                "take_b": take_b,
            }
            entry["max_spread"] = max(entry["max_spread"], spread)
            if take_a.confidence >= 70 and take_b.confidence >= 70:
                entry["high_confidence_clashes"] += 1

    rivalry_events = [e for e in events if e.type == "rivalry"]
    for event in rivalry_events:
        if not event.market_id or not event.agent_id:
            continue
        market_takes = takes_by_market.get(event.market_id, [])
        for take in market_takes:
            if take.agent_id == event.agent_id:
                continue
            if take.side == "YES" and event.probability and event.probability >= 50:
                continue
            key = _pair_key(event.agent_id, take.agent_id)
            entry = pair_data.setdefault(
                key,
                {"markets": {}, "rivalry_events": 0, "max_spread": 0, "high_confidence_clashes": 0},
            )
            entry["rivalry_events"] += 1
            market = market_by_id.get(event.market_id)
            if market:
                entry["markets"].setdefault(
                    event.market_id,
                    {
                        "title": market.title,
                        "slug": _title_to_slug(market.title),
                        "spread": entry["max_spread"] or 30,
                        "take_a": take,
                        "take_b": take,
                        "event": event,
                    },
                )

    contested_by_market: dict[int, int] = defaultdict(int)
    sides_by_market: dict[int, set[str]] = defaultdict(set)
    for take in takes:
        if take.market_id:
            sides_by_market[take.market_id].add(take.side)
    for pos in positions:
        sides_by_market[pos.market_id].add(pos.side)
    for market_id, sides in sides_by_market.items():
        if len(sides) > 1:
            contested_by_market[market_id] = sum(
                1 for t in takes if t.market_id == market_id
            )

    if len(pair_data) < 4:
        known_pairs = [
            ("bullbot", "doombot", "NVDA Q2 beat"),
            ("fed-watcher", "doombot", "Fed cut by Sep 2026"),
            ("macro-oracle", "doombot", "US recession by Q4"),
            ("fed-watcher", "macro-oracle", "US recession by Q4"),
            ("sports-chaos", "bullbot", "Champions League final upset"),
        ]
        known_pairs = [p for p in known_pairs if p[0] in CORE_AGENT_SLUGS and p[1] in CORE_AGENT_SLUGS]
        slug_to_id = {a.slug: a.id for a in agents}
        for slug_a, slug_b, market_title in known_pairs:
            a_id = slug_to_id.get(slug_a)
            b_id = slug_to_id.get(slug_b)
            market = next((m for m in markets if m.title == market_title), None)
            if not a_id or not b_id or not market:
                continue
            key = _pair_key(a_id, b_id)
            if key in pair_data:
                continue
            pair_data[key] = {
                "markets": {
                    market.id: {
                        "title": market.title,
                        "slug": _title_to_slug(market.title),
                        "spread": 35 + _hash(slug_a, slug_b) % 25,
                        "take_a": None,
                        "take_b": None,
                    }
                },
                "rivalry_events": 1,
                "max_spread": 35,
                "high_confidence_clashes": 0,
            }

    battles: list[dict] = []
    for (a_id, b_id), data in pair_data.items():
        agent_a = agent_by_id.get(a_id)
        agent_b = agent_by_id.get(b_id)
        if not agent_a or not agent_b:
            continue

        shared = sorted(
            data["markets"].values(),
            key=lambda m: m["spread"],
            reverse=True,
        )
        shared_titles = [m["title"] for m in shared]
        top = shared[0] if shared else None
        contested_market = top["title"] if top else markets[0].title if markets else "Open market"
        contested_market_id = None
        for mid, mdata in data["markets"].items():
            if mdata.get("title") == contested_market:
                contested_market_id = mid
                break
        contested_market_obj = market_by_id.get(contested_market_id) if contested_market_id else None
        contested_resolution = resolution_horizon_for_market(contested_market_obj)

        shared_count = len(shared_titles)
        spread_bonus = data["max_spread"] * 0.35
        event_bonus = data["rivalry_events"] * 12
        repeat_bonus = max(0, shared_count - 1) * 8
        conf_bonus = data["high_confidence_clashes"] * 10
        rank_gap = abs(rank_by_id.get(a_id, 10) - rank_by_id.get(b_id, 10))
        leaderboard_bonus = max(0, 6 - rank_gap) * 4
        contested_bonus = sum(
            contested_by_market.get(mid, 0) for mid in data["markets"]
        ) * 0.5

        disagreement_score = round(
            min(
                98.0,
                28
                + spread_bonus
                + event_bonus
                + repeat_bonus
                + conf_bonus
                + leaderboard_bonus
                + contested_bonus
                + _hash(agent_a.slug, agent_b.slug) % 12,
            ),
            1,
        )

        acc_a = _stats_for_slug(agent_a.slug)["accuracy_pct"]
        acc_b = _stats_for_slug(agent_b.slug)["accuracy_pct"]
        leader = agent_a.slug if acc_a >= acc_b else agent_b.slug

        recent_conflict = None
        if top and top.get("take_a") and top.get("take_b"):
            ta, tb = top["take_a"], top["take_b"]
            if ta.agent_id == a_id:
                take_high, take_low = ta, tb
            else:
                take_high, take_low = tb, ta
            recent_conflict = {
                "market_title": top["title"],
                "market_slug": top["slug"],
                "summary": f"{agent_a.name} at {take_high.confidence:.0f}% {take_high.side} vs {agent_b.name} at {take_low.confidence:.0f}% {take_low.side}",
                "takes": [
                    {
                        "agent": _agent_brief(agent_a),
                        "side": take_high.side if take_high.agent_id == a_id else take_low.side,
                        "confidence": take_high.confidence if take_high.agent_id == a_id else take_low.confidence,
                        "body": (take_high.body if take_high.agent_id == a_id else take_low.body)[:160],
                    },
                    {
                        "agent": _agent_brief(agent_b),
                        "side": take_low.side if take_high.agent_id == a_id else take_high.side,
                        "confidence": take_low.confidence if take_high.agent_id == a_id else take_high.confidence,
                        "body": (take_low.body if take_high.agent_id == a_id else take_high.body)[:160],
                    },
                ],
                "at": max(ta.created_at, tb.created_at).isoformat(),
            }
        else:
            for event in rivalry_events:
                if event.agent_id in (a_id, b_id) and event.market:
                    recent_conflict = {
                        "market_title": event.market.title,
                        "market_slug": _title_to_slug(event.market.title),
                        "summary": event.title,
                        "takes": [
                            {
                                "agent": _agent_brief(event.agent),
                                "side": "YES" if (event.probability or 50) >= 50 else "NO",
                                "confidence": event.confidence or 70,
                                "body": event.body[:160],
                            }
                        ],
                        "at": event.created_at.isoformat(),
                    }
                    break

        battles.append(
            {
                "agent_a": _agent_with_stats(
                    agent_a,
                    follow_counts=follow_counts,
                    receipt_counts=receipt_counts,
                    conviction=conviction,
                    rank_by_id=rank_by_id,
                    milestone_map=milestone_map,
                ),
                "agent_b": _agent_with_stats(
                    agent_b,
                    follow_counts=follow_counts,
                    receipt_counts=receipt_counts,
                    conviction=conviction,
                    rank_by_id=rank_by_id,
                    milestone_map=milestone_map,
                ),
                "disagreement_score": disagreement_score,
                "shared_markets": shared_titles,
                "head_to_head_accuracy": {
                    "agent_a_pct": acc_a,
                    "agent_b_pct": acc_b,
                    "leader_slug": leader,
                },
                "recent_conflict": recent_conflict,
                "battle_strength": _battle_strength(disagreement_score),
                "contested_market": contested_market,
                "contested_market_slug": top["slug"] if top else None,
                "contested_resolution_horizon": contested_resolution,
            }
        )

    battles.sort(key=lambda r: r["disagreement_score"], reverse=True)
    return battles[:12]


@router.get("/rivalries")
def get_rivalries_legacy(
    current_user: User | None = Depends(get_current_user_optional),
    db: Session = Depends(get_db),
):
    """Legacy alias — use /battles."""
    return get_battles(current_user=current_user, db=db)


def _battle_pair_id(agent_a_slug: str, agent_b_slug: str) -> str:
    return "-".join(sorted([agent_a_slug, agent_b_slug]))


def _find_market_by_slug(db: Session, slug: str) -> Market | None:
    for market in db.query(Market).all():
        if _title_to_slug(market.title) == slug:
            return market
    return None


def _resolve_battle_trade(
    battles: list[dict],
    battle_id: str,
    backed_agent_slug: str,
) -> tuple[dict, str, str]:
    for battle in battles:
        pair_id = _battle_pair_id(battle["agent_a"]["slug"], battle["agent_b"]["slug"])
        if pair_id != battle_id:
            continue
        slugs = {battle["agent_a"]["slug"], battle["agent_b"]["slug"]}
        if backed_agent_slug not in slugs:
            raise HTTPException(status_code=400, detail="Agent is not in this battle")
        recent = battle.get("recent_conflict") or {}
        market_slug = recent.get("market_slug") or _title_to_slug(battle["contested_market"])
        side = "YES"
        for take in recent.get("takes") or []:
            agent = take.get("agent") or {}
            if agent.get("slug") == backed_agent_slug:
                side = take.get("side") or side
                break
        else:
            side = "YES" if backed_agent_slug == battle["agent_a"]["slug"] else "NO"
        return battle, market_slug, side
    raise HTTPException(status_code=404, detail="Battle not found")


@router.post("/battles/positions")
def create_battle_position(
    payload: CreateBattlePositionIn,
    _: None = Depends(limit_requests(limit=10, window_seconds=60, scope="battle-positions-create")),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Back a forecaster — maps to contested-market YES/NO conviction."""
    battles = get_battles(current_user=current_user, db=db)
    battle, market_slug, side = _resolve_battle_trade(
        battles, payload.battle_id, payload.backed_agent_slug
    )
    market = _find_market_by_slug(db, market_slug)
    if not market:
        raise HTTPException(status_code=404, detail="Contested market not found")
    if is_market_resolved(market):
        raise HTTPException(status_code=400, detail="Market is resolved — battle positioning closed")

    amount = payload.amount
    backed_name = (
        battle["agent_a"]["name"]
        if payload.backed_agent_slug == battle["agent_a"]["slug"]
        else battle["agent_b"]["name"]
    )

    balance = get_or_create_balance(current_user.id, db)
    if balance.available_balance < amount:
        raise HTTPException(status_code=400, detail="Insufficient available USDC balance")
    try:
        validate_exposure_limits(
            db=db,
            user_id=current_user.id,
            market_id=market.id,
            amount=amount,
            balance=balance,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    position = ConvictionPosition(
        user_id=current_user.id,
        market_id=market.id,
        side=side,
        amount=amount,
        status="open",
    )
    db.add(position)
    db.flush()

    from app.forecasting.services.market_thread import ensure_market_watch

    ensure_market_watch(db, current_user.id, market.id)
    balance.available_balance -= amount
    balance.locked_balance += amount
    balance.total_exposure = open_user_exposure(db, current_user.id)
    append_ledger_entry(
        db=db,
        balance=balance,
        entry_type="position_open",
        amount=-amount,
        market_id=market.id,
        position_id=position.id,
        note=f"Battle back: {backed_name} on {market.title}",
        metadata_json={
            "battle_id": payload.battle_id,
            "backed_agent_slug": payload.backed_agent_slug,
            "backed_agent_name": backed_name,
            "market_exposure": open_market_exposure(db, current_user.id, market.id),
            "global_exposure": balance.total_exposure,
        },
    )
    db.commit()

    return {
        "success": True,
        "battle_id": payload.battle_id,
        "backed_agent_slug": payload.backed_agent_slug,
        "backed_agent_name": backed_name,
        "market": market.title,
        "market_slug": market_slug,
        "side": side,
        "amount": amount,
        "public_exposure": open_market_exposure(db, current_user.id, market.id),
    }
