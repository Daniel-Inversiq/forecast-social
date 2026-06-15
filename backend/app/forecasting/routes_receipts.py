import re

from collections import defaultdict

from datetime import datetime, timezone



from fastapi import APIRouter, Depends, HTTPException

from sqlalchemy.orm import Session, joinedload



from app.database import get_db

from app.forecasting.market_resolution import is_market_resolved, market_outcome_yes

from app.forecasting.models import (

    ConvictionPosition,

    FeedEvent,

    Market,

    MarketTake,

    Position,

    User,

)

from app.forecasting.reputation.receipt_impact import (

    biggest_reputation_gains,

    enrich_receipts_with_reputation,

)



router = APIRouter(tags=["receipts"])





def _hash(*parts) -> int:

    return sum(ord(c) for p in parts for c in str(p))





def _title_to_slug(title: str) -> str:

    slug = title.lower()

    slug = re.sub(r"[^a-z0-9]+", "-", slug)

    return slug.strip("-")





def _contested_scores(

    takes: list[MarketTake], positions: list[Position]

) -> dict[int, int]:

    sides_by_market: dict[int, set[str]] = defaultdict(set)

    for take in takes:

        if take.market_id:

            sides_by_market[take.market_id].add(take.side)

    for pos in positions:

        sides_by_market[pos.market_id].add(pos.side)

    scores: dict[int, int] = defaultdict(int)

    for take in takes:

        if take.market_id and len(sides_by_market[take.market_id]) > 1:

            scores[take.market_id] += 1

    return scores





def _days_early(seed: str) -> int:

    return 3 + _hash(seed, "early") % 25





def _original_probability(market: Market, side: str, seed: str) -> float:

    consensus = market.current_yes_probability

    h = _hash(seed, "prob")

    if side == "YES":

        return round(max(8.0, min(consensus - 12 - h % 28, consensus - 5)), 1)

    return round(min(92.0, max(consensus + 5, consensus + 12 + h % 22)), 1)





def _final_outcome(side: str, seed: str, market: Market | None = None) -> str:

    if market and is_market_resolved(market):

        outcome = "YES" if market_outcome_yes(market) else "NO"

        return outcome

    if _hash(seed, "verified") % 8 == 0:

        return "NO" if side == "YES" else "YES"

    return side





def _receipt_strength(confidence: float, days_early: int, contested: int) -> str:

    if confidence >= 90 and days_early >= 12:

        return "legendary"

    if contested >= 2 and confidence >= 70:

        return "contested"

    if days_early >= 10 and confidence >= 75:

        return "early"

    if confidence >= 82 or days_early >= 7:

        return "strong"

    return "strong"





def _receipt_payload(

    *,

    receipt_id: str,

    agent_name: str,

    agent_slug: str,

    avatar_color: str,

    market: Market,

    side: str,

    confidence: float,

    original_take: str,

    original_probability: float,

    final_outcome: str,

    days_early: int,

    created_at: datetime,

    receipt_strength: str,

    subject_type: str = "agent",

    conviction_payout: float | None = None,

) -> dict:

    payload = {

        "id": receipt_id,

        "agent_name": agent_name,

        "agent_slug": agent_slug,

        "avatar_color": avatar_color,

        "market_title": market.title,

        "market_slug": _title_to_slug(market.title),

        "side": side,

        "confidence": confidence,

        "original_take": original_take,

        "original_probability": original_probability,

        "final_outcome": final_outcome,

        "days_early": days_early,

        "created_at": created_at.replace(tzinfo=timezone.utc).isoformat()

        if created_at.tzinfo is None

        else created_at.isoformat(),

        "receipt_strength": receipt_strength,

        "subject_type": subject_type,

    }

    if conviction_payout is not None:

        payload["conviction_payout"] = conviction_payout

    return payload





def _display_receipt_id(canonical_id: str) -> str:

    digits = re.sub(r"\D", "", canonical_id)[-6:] or "0"

    return f"SCR-{digits.zfill(6)}"





def _resolve_receipt_id(receipt_id: str, receipts: list[dict]) -> dict | None:

    decoded = receipt_id.strip()

    for r in receipts:

        if r["id"] == decoded:

            return r

    upper = decoded.upper()

    if re.match(r"^SCR-\d{6}$", upper):

        for r in receipts:

            if _display_receipt_id(r["id"]).upper() == upper:

                return r

    return None





def build_receipts_list(db: Session) -> tuple[list[dict], dict[int, int]]:

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

    contested = _contested_scores(takes, positions)



    receipts: list[dict] = []

    seen_keys: set[str] = set()



    def _add(key: str, payload: dict) -> None:

        if key in seen_keys:

            return

        seen_keys.add(key)

        receipts.append(payload)



    for event in events:

        if event.type != "receipt" or not event.market or not event.agent:

            continue

        seed = f"event-{event.id}"

        confidence = event.confidence or 85.0

        side = "YES" if (event.probability or 0) >= 50 else "NO"

        days = _days_early(seed)

        contested_n = contested.get(event.market_id, 0)

        strength = _receipt_strength(confidence, days, contested_n)

        _add(

            f"{event.agent_id}-{event.market_id}",

            _receipt_payload(

                receipt_id=f"receipt-event-{event.id}",

                agent_name=event.agent.name,

                agent_slug=event.agent.slug,

                avatar_color=event.agent.avatar_color,

                market=event.market,

                side=side,

                confidence=confidence,

                original_take=event.body,

                original_probability=_original_probability(event.market, side, seed),

                final_outcome=_final_outcome(side, seed, event.market),

                days_early=days,

                created_at=event.created_at,

                receipt_strength=strength,

            ),

        )



    for take in takes:

        if not take.market or take.confidence < 72:

            continue

        agent = take.agent

        agent_name = agent.name if agent else take.author_name

        agent_slug = agent.slug if agent else take.author_slug

        avatar_color = agent.avatar_color if agent else "#71717a"

        key = f"{take.agent_id or take.author_slug}-{take.market_id}"

        if key in seen_keys:

            continue

        seed = f"take-{take.id}"

        days = _days_early(seed)

        contested_n = contested.get(take.market_id, 0)

        strength = _receipt_strength(take.confidence, days, contested_n)

        _add(

            key,

            _receipt_payload(

                receipt_id=f"receipt-take-{take.id}",

                agent_name=agent_name,

                agent_slug=agent_slug,

                avatar_color=avatar_color,

                market=take.market,

                side=take.side,

                confidence=take.confidence,

                original_take=take.body,

                original_probability=_original_probability(take.market, take.side, seed),

                final_outcome=_final_outcome(take.side, seed, take.market),

                days_early=days,

                created_at=take.created_at,

                receipt_strength=strength,

            ),

        )



    won_positions = (

        db.query(ConvictionPosition)

        .options(joinedload(ConvictionPosition.market))

        .filter(ConvictionPosition.status == "won")

        .order_by(ConvictionPosition.resolved_at.desc())

        .limit(40)

        .all()

    )

    user_ids = {p.user_id for p in won_positions}

    users_by_id: dict[int, User] = {}

    if user_ids:

        users = db.query(User).filter(User.id.in_(user_ids)).all()

        users_by_id = {u.id: u for u in users}



    for pos in won_positions:

        if not pos.market:

            continue

        user = users_by_id.get(pos.user_id)

        if not user:

            continue

        key = f"user-{pos.user_id}-{pos.market_id}"

        if key in seen_keys:

            continue

        seed = f"position-{pos.id}"

        days = max(1, _days_early(seed) // 2)

        contested_n = contested.get(pos.market_id, 0)

        confidence = min(95.0, 68.0 + (pos.amount or 0) / 5)

        strength = _receipt_strength(confidence, days, contested_n)

        display = user.username

        _add(

            key,

            _receipt_payload(

                receipt_id=f"receipt-position-{pos.id}",

                agent_name=display,

                agent_slug=user.username,

                avatar_color=user.avatar_color or "#7c3aed",

                market=pos.market,

                side=pos.side,

                confidence=confidence,

                original_take=f"Conviction {pos.side} — ${int(pos.amount or 0)} allocated before resolution.",

                original_probability=_original_probability(pos.market, pos.side, seed),

                final_outcome=_final_outcome(pos.side, seed, pos.market),

                days_early=days,

                created_at=pos.opened_at,

                receipt_strength=strength,

                subject_type="user",

                conviction_payout=pos.payout_amount,

            ),

        )



    if len(receipts) < 6:

        for event in events:

            if not event.market or not event.agent or event.confidence is None:

                continue

            if event.confidence < 80:

                continue

            key = f"{event.agent_id}-{event.market_id}"

            if key in seen_keys:

                continue

            seed = f"fallback-{event.id}"

            side = "YES" if (event.probability or event.confidence) >= 50 else "NO"

            days = _days_early(seed)

            contested_n = contested.get(event.market_id, 0)

            _add(

                key,

                _receipt_payload(

                    receipt_id=f"receipt-fallback-{event.id}",

                    agent_name=event.agent.name,

                    agent_slug=event.agent.slug,

                    avatar_color=event.agent.avatar_color,

                    market=event.market,

                    side=side,

                    confidence=event.confidence,

                    original_take=event.body,

                    original_probability=_original_probability(event.market, side, seed),

                    final_outcome=_final_outcome(side, seed, event.market),

                    days_early=days,

                    created_at=event.created_at,

                    receipt_strength=_receipt_strength(event.confidence, days, contested_n),

                ),

            )

            if len(receipts) >= 10:

                break



    strength_order = {"legendary": 0, "early": 1, "contested": 2, "strong": 3}

    receipts.sort(

        key=lambda r: (

            strength_order.get(r["receipt_strength"], 4),

            -r["days_early"],

            -r["confidence"],

        )

    )

    return receipts, contested





@router.get("/receipts")

def get_receipts(db: Session = Depends(get_db)):

    receipts, contested = build_receipts_list(db)

    enriched = enrich_receipts_with_reputation(

        db, receipts, contested_by_market=contested

    )

    return {

        "receipts": enriched,

        "biggest_reputation_gains": biggest_reputation_gains(enriched),

    }





@router.get("/receipts/{receipt_id}")

def get_receipt_by_id(receipt_id: str, db: Session = Depends(get_db)):

    receipts, contested = build_receipts_list(db)

    match = _resolve_receipt_id(receipt_id, receipts)

    if not match:

        raise HTTPException(status_code=404, detail="Receipt not found")

    enriched = enrich_receipts_with_reputation(

        db, [match], contested_by_market=contested

    )

    return enriched[0]

