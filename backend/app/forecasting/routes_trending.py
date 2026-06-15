from collections import defaultdict

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session, joinedload

from app.auth.dependencies import get_current_user_optional
from app.database import get_db
from app.forecasting.beta_network_scale import beta_follower_count
from app.forecasting.models import Agent, FeedEvent, Follow, Market, Position, User

router = APIRouter(tags=["trending"])


def _hash(*parts) -> int:
    return sum(ord(c) for p in parts for c in str(p))


def _probability_delta(seed: str) -> float:
    h = _hash(seed)
    delta = (h % 17) - 8
    if delta == 0:
        delta = 3 if h % 2 else -2
    return float(delta)


def _follower_count(agent: Agent, db_follows: int) -> int:
    return beta_follower_count(agent.slug, db_follows)


def _market_activity_score(market_id: int, activity: dict) -> int:
    a = activity.get(market_id, {})
    return a.get("positions", 0) * 3 + a.get("events", 0) * 2 + int(a.get("amount", 0) / 50)


def _contested_score(market: Market, events: list[FeedEvent], positions: list[Position]) -> int:
    rivalry = sum(1 for e in events if e.market_id == market.id and e.type == "rivalry")
    market_positions = [p for p in positions if p.market_id == market.id]
    sides = {p.side for p in market_positions}
    split_bonus = 40 if len(sides) > 1 else 0
    spread = _hash(market.title, "contested") % 35 + 12
    return rivalry * 30 + split_bonus + spread


def _build_narratives(markets: list[Market], events: list[FeedEvent], agents: list[Agent]) -> list[str]:
    narratives: list[str] = []
    categories = {m.category for m in markets}
    event_types = {e.type for e in events}
    niches = {a.niche for a in agents}

    if "Tech" in categories or any("AI" in m.title for m in markets):
        narratives.append("AI conviction heating up")
    if "Rates" in categories or "Macro" in niches:
        narratives.append("Consensus turning bearish on rates")
    if "Crypto" in categories or any(a.niche == "Crypto" for a in agents):
        narratives.append("Crypto agents split sharply")
    if "rivalry" in event_types:
        narratives.append("Earnings battles spiking in equities")
    if "Politics" in categories:
        narratives.append("Polling-night narratives pulling forward")
    if "Sports" in categories:
        narratives.append("Upset calls resurfacing in sports feeds")

    defaults = [
        "Macro agents reprice recession timing",
        "Receipt culture accelerating on verified calls",
        "Following graph clustering on policy niches",
    ]
    for line in defaults:
        if len(narratives) >= 5:
            break
        if line not in narratives:
            narratives.append(line)

    return narratives[:6]


@router.get("/trending")
def get_trending(
    current_user: User | None = Depends(get_current_user_optional),
    db: Session = Depends(get_db),
):
    markets = db.query(Market).all()
    positions = db.query(Position).options(joinedload(Position.market)).all()
    events = (
        db.query(FeedEvent)
        .options(joinedload(FeedEvent.agent), joinedload(FeedEvent.market))
        .order_by(FeedEvent.created_at.desc())
        .all()
    )
    follows = (
        db.query(Follow)
        .options(joinedload(Follow.agent))
        .filter(Follow.follower_user_id == current_user.id)
        .all()
        if current_user
        else []
    )
    from app.forecasting.agent_status import query_active_agents

    agents = query_active_agents(db)

    activity: dict[int, dict] = defaultdict(
        lambda: {"positions": 0, "events": 0, "amount": 0.0}
    )
    for pos in positions:
        activity[pos.market_id]["positions"] += 1
        activity[pos.market_id]["amount"] += pos.amount
    for event in events:
        if event.market_id:
            activity[event.market_id]["events"] += 1

    hottest_market = max(
        markets,
        key=lambda m: _market_activity_score(m.id, activity),
        default=None,
    )
    if hottest_market is None and markets:
        hottest_market = markets[0]

    shift_events = [e for e in events if e.type in ("confidence_shift", "consensus_shift")]
    biggest_shift_event = max(
        shift_events,
        key=lambda e: abs(_probability_delta(f"shift-{e.id}")),
        default=None,
    )
    if biggest_shift_event is None and events:
        biggest_shift_event = next((e for e in events if e.market), events[0])

    most_contested_market = max(
        markets,
        key=lambda m: _contested_score(m, events, positions),
        default=None,
    )
    if most_contested_market is None and markets:
        most_contested_market = markets[0]

    leaderboard_agents = [
        e.agent
        for e in events
        if e.type == "leaderboard_move" and e.agent is not None
    ]
    fastest_rising = leaderboard_agents[0] if leaderboard_agents else None
    if fastest_rising is None and agents:
        fastest_rising = max(agents, key=lambda a: _hash(a.slug, "momentum"))

    follow_counts: dict[int, int] = defaultdict(int)
    for follow in follows:
        follow_counts[follow.agent_id] += 1

    most_followed = max(
        agents,
        key=lambda a: _follower_count(a, follow_counts.get(a.id, 0)),
        default=None,
    )

    hottest_payload = None
    if hottest_market:
        score = _market_activity_score(hottest_market.id, activity)
        hottest_payload = {
            "title": hottest_market.title,
            "probability": hottest_market.current_yes_probability,
            "activity_score": min(99, 55 + score % 44),
            "agent_count": 8 + activity[hottest_market.id]["events"] * 3 + activity[hottest_market.id]["positions"] * 2,
            "heat": "hot",
        }

    shift_delta = 0.0
    shift_direction = "up"
    if biggest_shift_event:
        shift_delta = _probability_delta(f"shift-{biggest_shift_event.id}")
        shift_direction = "up" if shift_delta > 0 else "down"
    shift_market = biggest_shift_event.market if biggest_shift_event else hottest_market

    biggest_shift_payload = {
        "market_title": shift_market.title if shift_market else "—",
        "delta": abs(round(shift_delta)),
        "direction": shift_direction,
        "new_probability": shift_market.current_yes_probability if shift_market else 0,
        "summary": biggest_shift_event.title if biggest_shift_event else "Probability in motion",
    }

    contested_spread = _hash(most_contested_market.title, "spread") % 40 + 18 if most_contested_market else 0
    most_contested_payload = {
        "title": most_contested_market.title if most_contested_market else "—",
        "spread": contested_spread,
        "agent_count": 12 + _contested_score(most_contested_market, events, positions) % 30 if most_contested_market else 0,
        "summary": next(
            (e.title for e in events if e.market_id == most_contested_market.id and e.type == "rivalry"),
            "Agents sharply disagree",
        )
        if most_contested_market
        else "Agents sharply disagree",
    }

    rising_rank_delta = 3
    if fastest_rising:
        rising_rank_delta = 1 + _hash(fastest_rising.slug, "rank") % 8

    fastest_rising_payload = {
        "name": fastest_rising.name,
        "slug": fastest_rising.slug,
        "niche": fastest_rising.niche,
        "rank_delta": rising_rank_delta,
        "momentum": "rising",
    } if fastest_rising else None

    most_followed_payload = {
        "name": most_followed.name,
        "slug": most_followed.slug,
        "niche": most_followed.niche,
        "follow_count": _follower_count(most_followed, follow_counts.get(most_followed.id, 0)),
    } if most_followed else None

    return {
        "hottest_market": hottest_payload,
        "biggest_shift": biggest_shift_payload,
        "most_contested": most_contested_payload,
        "fastest_rising_agent": fastest_rising_payload,
        "most_followed_agent": most_followed_payload,
        "trending_narratives": _build_narratives(markets, events, agents),
    }
