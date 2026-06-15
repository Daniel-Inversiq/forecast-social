import re

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.auth.dependencies import get_current_user
from app.database import get_db
from app.forecasting.market_credibility import build_market_intelligence
from app.forecasting.market_resolution import is_market_resolved, market_outcome_yes
from app.forecasting.services.resolution_horizon import resolution_horizon_for_market
from app.forecasting.models import (
    Agent,
    ConvictionPosition,
    FeedEvent,
    Market,
    User,
)
from app.forecasting.services.conviction_ledger import append_ledger_entry, get_or_create_balance
from app.forecasting.request_schemas import CreatePositionIn
from app.forecasting.services.conviction_limits import (
    open_market_exposure,
    open_user_exposure,
    validate_exposure_limits,
)
from app.security.rate_limit import limit_requests

router = APIRouter(tags=["markets"])

_CATEGORY_NARRATIVE = {
    "Macro": "Macro agents are repricing recession and growth risk as new data lands.",
    "Rates": "Fed path conviction is clustering — timing disagreements are the story.",
    "Equities": "Earnings narrative is splitting bulls and bears on margin vs. demand.",
    "Crypto": "On-chain flows and macro headwinds are pulling year-end targets both ways.",
    "Sports": "Upset thesis vs. consensus favorite — receipts are already circulating.",
    "Politics": "Polling and conviction dynamics are moving implied odds faster than headlines.",
    "Tech": "Breakthrough timing is the wedge — agents disagree on how soon, not if.",
    "Commodities": "Supply shock thesis meets demand-destruction pushback in the thread.",
    "Climate": "Policy shift odds reflect a long-horizon conviction battle among specialists.",
}


def _hash(title: str, market_id: int) -> int:
    return sum(ord(c) for c in title) + market_id


def _title_to_slug(title: str) -> str:
    slug = title.lower()
    slug = re.sub(r"[^a-z0-9]+", "-", slug)
    return slug.strip("-")


def _find_market_by_slug(db: Session, slug: str) -> Market | None:
    for market in db.query(Market).all():
        if _title_to_slug(market.title) == slug:
            return market
    return None


def _agent_count(db: Session, market: Market) -> int:
    count = (
        db.query(func.count(func.distinct(FeedEvent.agent_id)))
        .filter(FeedEvent.market_id == market.id)
        .scalar()
    )
    if count and count > 0:
        return int(count)
    return 8 + _hash(market.title, market.id) % 35


def _narrative(db: Session, market: Market) -> str:
    event = (
        db.query(FeedEvent)
        .filter(FeedEvent.market_id == market.id)
        .order_by(FeedEvent.created_at.desc())
        .first()
    )
    if event and event.body:
        body = event.body.strip()
        if len(body) > 160:
            return body[:157] + "..."
        return body
    return _CATEGORY_NARRATIVE.get(
        market.category,
        f"Forecasters are building conviction on {market.title} — the thread is heating up.",
    )


def _urgency(market: Market, agent_count: int) -> str:
    p = market.current_yes_probability
    if 46 <= p <= 54 and agent_count >= 8:
        return "contested"
    if agent_count >= 20:
        return "hot"
    if p >= 62:
        return "rising"
    if p <= 38:
        return "cooling"
    options = ["hot", "rising", "contested", "cooling"]
    return options[_hash(market.title, market.id) % 4]


def _why_moved(market: Market, agent_count: int) -> str:
    p = round(market.current_yes_probability)
    if 46 <= p <= 54:
        return (
            f"Odds sit near a coin flip ({p}% YES) as agents split on timing and magnitude — "
            "the last shift came from rival theses, not a single data print."
        )
    if p >= 60:
        return (
            f"YES climbed to {p}% after macro agents aligned on deteriorating leading indicators; "
            "dissenters are fading but still posting."
        )
    return (
        f"YES eased to {p}% as soft-landing reads gained traction — "
        f"{agent_count} agents are still debating whether the move sticks."
    )


def _agent_takes(db: Session, market: Market) -> list[dict]:
    events = (
        db.query(FeedEvent)
        .options(joinedload(FeedEvent.agent))
        .filter(FeedEvent.market_id == market.id)
        .order_by(FeedEvent.created_at.desc())
        .limit(6)
        .all()
    )
    takes: list[dict] = []
    seen_slugs: set[str] = set()

    for event in events:
        if not event.agent or event.agent.slug in seen_slugs:
            continue
        seen_slugs.add(event.agent.slug)
        p = market.current_yes_probability
        side = "YES" if (event.probability or p) >= 50 else "NO"
        if event.type == "rivalry" and event.agent.personality in ("bearish", "skeptical"):
            side = "NO"
        confidence = event.confidence or (event.probability or p)
        takes.append(
            {
                "name": event.agent.name,
                "slug": event.agent.slug,
                "side": side,
                "confidence": round(float(confidence), 1),
                "reasoning": event.body[:140] + ("..." if len(event.body) > 140 else ""),
            }
        )
        if len(takes) >= 5:
            return takes

    from app.forecasting.agent_status import active_agents_query

    niche_agents = (
        active_agents_query(db)
        .filter(Agent.niche.in_([market.category, "Multi"]))
        .order_by(Agent.name)
        .limit(8)
        .all()
    )
    if not niche_agents:
        niche_agents = active_agents_query(db).order_by(Agent.name).limit(8).all()

    h = _hash(market.title, market.id)
    reasons_yes = [
        "Leading indicators still point to downside risk — thesis unchanged, odds nudged up.",
        "Consensus is lagging the data; I'm holding YES until the next print.",
        "Cross-asset signals align with the base case — conviction is steady.",
    ]
    reasons_no = [
        "Headline risk is overstated — base rates favor NO here.",
        "Positioning is crowded on YES; I'm fading the move.",
        "Timing window is too wide — probability should be lower.",
    ]

    for i, agent in enumerate(niche_agents):
        if agent.slug in seen_slugs:
            continue
        side = "YES" if (h + i) % 3 != 0 else "NO"
        conf = market.current_yes_probability + (12 if side == "YES" else -12) + (i * 3) % 9
        conf = max(22, min(88, conf))
        reasoning = reasons_yes[i % len(reasons_yes)] if side == "YES" else reasons_no[i % len(reasons_no)]
        takes.append(
            {
                "name": agent.name,
                "slug": agent.slug,
                "side": side,
                "confidence": round(conf, 1),
                "reasoning": reasoning,
            }
        )
        if len(takes) >= 5:
            break

    return takes[:5]


def _recent_activity(db: Session, market: Market) -> list[dict]:
    events = (
        db.query(FeedEvent)
        .options(joinedload(FeedEvent.agent))
        .filter(FeedEvent.market_id == market.id)
        .order_by(FeedEvent.created_at.desc())
        .limit(8)
        .all()
    )
    activity = []
    for event in events:
        activity.append(
            {
                "type": event.type,
                "agent_name": event.agent.name if event.agent else "Unknown",
                "agent_slug": event.agent.slug if event.agent else "unknown",
                "title": event.title,
                "body": event.body,
                "probability": event.probability,
                "confidence": event.confidence,
                "created_at": event.created_at.isoformat(),
            }
        )
    if activity:
        return activity

    h = _hash(market.title, market.id)
    synthetic_types = ["confidence_shift", "rivalry", "consensus_shift"]
    return [
        {
            "type": synthetic_types[h % 3],
            "agent_name": "Macro Oracle",
            "agent_slug": "macro-oracle",
            "title": f"Conviction building on {market.title}",
            "body": _narrative(db, market),
            "probability": market.current_yes_probability,
            "confidence": 75.0 + (h % 15),
            "created_at": "2026-05-20T10:00:00",
        }
    ]


def _resolution_payload(market: Market) -> dict:
    if not is_market_resolved(market):
        return {
            "resolved_at": None,
            "resolved_outcome": None,
            "resolution_source": None,
            "resolution_confidence": None,
            "outcome_yes": None,
        }
    return {
        "resolved_at": market.resolved_at.isoformat() if market.resolved_at else None,
        "resolved_outcome": market.resolved_outcome,
        "resolution_source": market.resolution_source,
        "resolution_confidence": market.resolution_confidence,
        "outcome_yes": market_outcome_yes(market),
    }


def _market_payload(db: Session, market: Market) -> dict:
    agent_count = _agent_count(db, market)
    agent_takes = _agent_takes(db, market)
    recent_activity = _recent_activity(db, market)
    intelligence = build_market_intelligence(
        db,
        market,
        agent_takes=agent_takes,
        recent_activity=recent_activity,
    )
    total_yes = sum(
        p.amount
        for p in db.query(ConvictionPosition)
        .filter(ConvictionPosition.market_id == market.id, ConvictionPosition.status == "open")
        .all()
        if p.side == "YES"
    )
    total_no = sum(
        p.amount
        for p in db.query(ConvictionPosition)
        .filter(ConvictionPosition.market_id == market.id, ConvictionPosition.status == "open")
        .all()
        if p.side == "NO"
    )
    total = total_yes + total_no
    crowd_imbalance = round(abs(total_yes - total_no), 2)
    conviction_pressure = "balanced"
    if total > 0:
        dominant_share = max(total_yes, total_no) / total
        if dominant_share >= 0.75:
            conviction_pressure = "crowded"
        elif dominant_share <= 0.58:
            conviction_pressure = "contested"

    return {
        "slug": _title_to_slug(market.title),
        "title": market.title,
        "category": market.category,
        "status": market.status,
        "current_yes_probability": market.current_yes_probability,
        "horizon_type": market.horizon_type,
        "expected_resolution_at": (
            market.expected_resolution_at.isoformat() if market.expected_resolution_at else None
        ),
        "resolution_horizon": resolution_horizon_for_market(market),
        **_resolution_payload(market),
        "agent_count": agent_count,
        "narrative": _narrative(db, market),
        "urgency": _urgency(market, agent_count),
        "why_moved": _why_moved(market, agent_count),
        "agent_takes": intelligence["agent_takes"],
        "recent_activity": recent_activity,
        "credibility_split": intelligence["credibility_split"],
        "why_moving": intelligence["why_moving"],
        "verified_calls": intelligence["verified_calls"],
        "public_exposure": round(total, 2),
        "crowd_imbalance": crowd_imbalance,
        "conviction_pressure": conviction_pressure,
        "narrative_pressure_label": (
            "Against consensus"
            if conviction_pressure == "contested"
            else "Crowd piling in"
            if conviction_pressure == "crowded"
            else "High conviction"
        ),
    }


@router.get("/markets")
def get_markets(db: Session = Depends(get_db)):
    markets = db.query(Market).order_by(Market.title).all()
    result = []
    for market in markets:
        agent_count = _agent_count(db, market)
        result.append(
            {
                "slug": _title_to_slug(market.title),
                "title": market.title,
                "category": market.category,
                "status": market.status,
                "current_yes_probability": market.current_yes_probability,
                "horizon_type": market.horizon_type,
                "expected_resolution_at": (
                    market.expected_resolution_at.isoformat() if market.expected_resolution_at else None
                ),
                "resolution_horizon": resolution_horizon_for_market(market),
                **_resolution_payload(market),
                "agent_count": agent_count,
                "narrative": _narrative(db, market),
                "urgency": _urgency(market, agent_count),
            }
        )
    return result


@router.get("/markets/{slug}")
def get_market(slug: str, db: Session = Depends(get_db)):
    market = _find_market_by_slug(db, slug)
    if not market:
        raise HTTPException(status_code=404, detail="Market not found")
    return _market_payload(db, market)


@router.get("/markets/{slug}/my-position")
def get_my_position_on_market(
    slug: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    market = _find_market_by_slug(db, slug)
    if not market:
        raise HTTPException(status_code=404, detail="Market not found")

    position = (
        db.query(ConvictionPosition)
        .filter(
            ConvictionPosition.user_id == current_user.id,
            ConvictionPosition.market_id == market.id,
            ConvictionPosition.status == "open",
        )
        .order_by(ConvictionPosition.opened_at.desc())
        .first()
    )
    if not position:
        return {
            "position": None,
            "your_exposure": round(open_market_exposure(db, current_user.id, market.id), 2),
            "global_exposure": round(open_user_exposure(db, current_user.id), 2),
        }

    return {
        "position": {
            "side": position.side,
            "amount": position.amount,
            "created_at": position.opened_at.isoformat() if position.opened_at else None,
        },
        "your_exposure": round(open_market_exposure(db, current_user.id, market.id), 2),
        "global_exposure": round(open_user_exposure(db, current_user.id), 2),
    }


@router.post("/positions")
def create_position(
    payload: CreatePositionIn,
    _: None = Depends(limit_requests(limit=10, window_seconds=60, scope="positions-create")),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    market = _find_market_by_slug(db, payload.market_slug)
    if not market:
        raise HTTPException(status_code=404, detail="Market not found")
    if is_market_resolved(market):
        raise HTTPException(status_code=400, detail="Market is resolved — positioning closed")

    amount = payload.amount
    side = payload.side

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
        note=f"Opened {side} conviction allocation",
        metadata_json={
            "market_exposure": open_market_exposure(db, current_user.id, market.id),
            "global_exposure": balance.total_exposure,
        },
    )
    market_total_yes = sum(
        p.amount
        for p in db.query(ConvictionPosition)
        .filter(ConvictionPosition.market_id == market.id, ConvictionPosition.status == "open")
        .all()
        if p.side == "YES"
    )
    market_total_no = sum(
        p.amount
        for p in db.query(ConvictionPosition)
        .filter(ConvictionPosition.market_id == market.id, ConvictionPosition.status == "open")
        .all()
        if p.side == "NO"
    )
    total_market_exposure = market_total_yes + market_total_no
    dominant_side = "YES" if market_total_yes >= market_total_no else "NO"
    isolated = side != dominant_side and total_market_exposure >= 10
    from app.forecasting.agent_status import active_agents_query

    feed_agent = active_agents_query(db).order_by(Agent.id.asc()).first()
    feed_agent_id = feed_agent.id if feed_agent else None
    if feed_agent_id and total_market_exposure > 0 and amount >= total_market_exposure * 0.45:
        db.add(
            FeedEvent(
                type="largest_public_position",
                agent_id=feed_agent_id,
                market_id=market.id,
                title=f"Largest exposure opened on {market.title}",
                body=f"{current_user.username} committed the largest public position ({amount:.2f} USDC).",
                metadata_json={"user_id": current_user.id, "amount": amount, "side": side},
            )
        )
    if feed_agent_id:
        db.add(
            FeedEvent(
                type="opened_conviction_exposure",
                agent_id=feed_agent_id,
                market_id=market.id,
                title=f"{current_user.username} opened conviction exposure",
                body=f"Public risk posted: {side} {amount:.2f} USDC on {market.title}.",
                metadata_json={"user_id": current_user.id, "amount": amount, "side": side},
            )
        )
    if feed_agent_id and isolated:
        db.add(
            FeedEvent(
                type="isolated_against_consensus",
                agent_id=feed_agent_id,
                market_id=market.id,
                title=f"Isolated position on {market.title}",
                body=f"{current_user.username} moved against consensus with a public {side} allocation.",
                metadata_json={"user_id": current_user.id, "amount": amount, "side": side},
            )
        )
    if feed_agent_id and total_market_exposure >= 20:
        db.add(
            FeedEvent(
                type="crowd_piling_in",
                agent_id=feed_agent_id,
                market_id=market.id,
                title=f"Crowd piling into {market.title}",
                body=f"Public exposure reached {total_market_exposure:.2f} USDC.",
            )
        )
    db.commit()

    return {
        "success": True,
        "market": market.title,
        "side": side,
        "amount": amount,
        "public_exposure": open_market_exposure(db, current_user.id, market.id),
    }
