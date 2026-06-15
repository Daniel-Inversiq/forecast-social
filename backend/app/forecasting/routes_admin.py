from datetime import datetime, timedelta
from typing import Literal

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.auth.dependencies import require_admin
from app.auth.routes import _user_out
from app.auth.schemas import UserOut
from app.database import get_db
from app.forecasting.event_engine import (
    _is_dev_environment,
    event_to_summary,
    generate_feed_events,
    simulate_network_hour,
)
from app.forecasting.market_resolution import resolve_market_by_slug, title_to_slug
from app.forecasting.agent_status import (
    AGENT_STATUS_ACTIVE,
    AGENT_STATUS_DORMANT,
    CORE_AGENT_SLUGS,
    agent_status_payload,
)
from app.forecasting.models import (
    Agent,
    ConvictionLedgerEntry,
    ConvictionPosition,
    CreatorForecaster,
    DepositRequest,
    EventCandidate,
    FeedInteraction,
    Market,
    MarketThreadPost,
    ScheduledEventArc,
    User,
    WithdrawalRequest,
)
from app.forecasting.services.feed_interactions import (
    get_interaction_or_404,
    interaction_to_payload,
    soft_remove_interaction,
)
from app.forecasting.services.market_thread import post_to_payload, soft_remove_thread_post
from app.forecasting.services.conviction_ledger import append_ledger_entry, get_or_create_balance
from app.forecasting.services.deposit_scanner import sync_base_deposits
from app.forecasting.services.event_duration import duration_label, suggested_resolution_date
from app.forecasting.services.world_events import (
    apply_duration_fields,
    arc_to_payload,
    candidate_to_payload,
    configured_event_sources,
    create_candidate,
    ingest_world_sources,
    ingest_single_world_source,
    list_event_sources_with_status,
    preview_candidate_reactions,
    publish_candidate,
)
from app.security.rate_limit import limit_requests

router = APIRouter(
    tags=["admin"],
    dependencies=[
        Depends(require_admin),
        Depends(limit_requests(limit=5, window_seconds=60, scope="admin")),
    ],
)


class IntelligenceTierIn(BaseModel):
    tier: Literal["free", "intelligence_access"]


class AdminCreditIn(BaseModel):
    amount: float
    note: str | None = None


class EventCandidateManualIn(BaseModel):
    title: str
    summary: str
    source_url: str
    source_name: str
    category: str | None = None


class CandidateStatusIn(BaseModel):
    status: Literal["pending", "approved", "rejected", "published"]


class AgentStatusIn(BaseModel):
    status: Literal["active", "dormant"]


class CandidateDurationIn(BaseModel):
    duration_type: Literal["daily", "weekly", "monthly", "anchor"]
    expected_resolution_date: datetime | None = None


class CandidatePublishIn(BaseModel):
    event_type: Literal[
        "signal_shift",
        "narrative_acceleration",
        "battle_escalation",
        "market_move",
        "verified_call",
    ] = "signal_shift"
    market_id: int | None = None
    selected_reaction_keys: list[str] | None = None
    publish_all_as_arc_burst: bool = False


class CandidatePreviewIn(BaseModel):
    event_type: Literal[
        "signal_shift",
        "narrative_acceleration",
        "battle_escalation",
        "market_move",
        "verified_call",
    ] = "signal_shift"
    market_id: int | None = None
    seed: int | None = None


class CandidateCreateMarketIn(BaseModel):
    title: str | None = None
    category: str | None = None
    initial_probability: float = 50.0


class CandidateAttachMarketIn(BaseModel):
    market_id: int


class ScheduledArcIn(BaseModel):
    title: str
    start_date: datetime
    end_date: datetime
    category: str
    linked_market_ids: list[int] = []
    primary_agent_ids: list[int] = []
    watch_keywords: list[str] = []
    activity_boost: float = 1.3


def _require_dev() -> None:
    if not _is_dev_environment():
        raise HTTPException(status_code=403, detail="Admin endpoints are disabled outside development")


@router.post("/admin/generate-events")
def admin_generate_events(
    db: Session = Depends(get_db),
):
    """Generate a cadence-aware batch of simulated feed events (local/dev only)."""
    _require_dev()
    events = generate_feed_events(db, cadence="auto")
    return {
        "created": len(events),
        "events": [event_to_summary(e) for e in events],
    }


@router.post("/admin/simulate-hour")
def admin_simulate_hour(
    db: Session = Depends(get_db),
    seed: int | None = Query(None),
):
    """Simulate one realistic hour of network activity spread across timestamps (dev only)."""
    _require_dev()
    return simulate_network_hour(db, seed=seed)


@router.post("/admin/resolve-demo-markets")
def admin_resolve_demo_markets(db: Session = Depends(get_db)):
    """Resolve up to 3 open markets for demo (dev only)."""
    _require_dev()
    open_markets = (
        db.query(Market)
        .filter(Market.status == "open")
        .order_by(Market.id.asc())
        .limit(3)
        .all()
    )
    results = []
    for i, market in enumerate(open_markets):
        outcome = "YES" if (market.current_yes_probability >= 50) ^ (i % 2 == 1) else "NO"
        if market.current_yes_probability < 50:
            outcome = "NO" if i % 2 == 0 else "YES"
        slug = title_to_slug(market.title)
        try:
            res = resolve_market_by_slug(
                db, slug, outcome=outcome, source="demo_oracle", confidence=0.92
            )
            results.append(
                {"slug": slug, "outcome": res.outcome, "events": res.feed_events_created}
            )
        except ValueError:
            continue
    return {"resolved": results}


@router.post("/admin/users/{email}/intelligence-tier", response_model=UserOut)
def admin_set_intelligence_tier(
    email: str,
    body: IntelligenceTierIn = Body(...),
    db: Session = Depends(get_db),
):
    """Set a user's Intelligence Access tier (local/dev only)."""
    _require_dev()
    normalized = email.strip().lower()
    user = db.query(User).filter(User.email == normalized).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if body.tier == "intelligence_access":
        user.intelligence_tier = "intelligence_access"
        user.intelligence_subscription_status = "active"
        user.intelligence_current_period_end = datetime.utcnow() + timedelta(days=30)
    else:
        user.intelligence_tier = "free"
        user.intelligence_subscription_status = "inactive"
        user.intelligence_current_period_end = None

    db.commit()
    db.refresh(user)
    return _user_out(user)


@router.post("/admin/users/{user_id}/credit-balance")
def admin_credit_balance(
    user_id: int,
    body: AdminCreditIn = Body(...),
    db: Session = Depends(get_db),
):
    _require_dev()
    if body.amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be greater than zero")
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    balance = get_or_create_balance(user_id, db)
    balance.available_balance += body.amount
    append_ledger_entry(
        db=db,
        balance=balance,
        entry_type="admin_adjustment",
        amount=body.amount,
        note=body.note or "Admin balance credit",
    )
    db.commit()
    return {
        "success": True,
        "user_id": user_id,
        "available_balance": round(balance.available_balance, 2),
        "locked_balance": round(balance.locked_balance, 2),
    }


@router.get("/admin/ledger")
def admin_ledger(
    user_id: int | None = Query(None),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
):
    _require_dev()
    q = db.query(ConvictionLedgerEntry).order_by(ConvictionLedgerEntry.created_at.desc())
    if user_id:
        q = q.filter(ConvictionLedgerEntry.user_id == user_id)
    rows = q.limit(limit).all()
    return [
        {
            "id": r.id,
            "user_id": r.user_id,
            "market_id": r.market_id,
            "position_id": r.position_id,
            "entry_type": r.entry_type,
            "amount": r.amount,
            "available_balance_after": r.available_balance_after,
            "locked_balance_after": r.locked_balance_after,
            "total_exposure_after": r.total_exposure_after,
            "note": r.note,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in rows
    ]


@router.get("/admin/exposure-concentration")
def admin_exposure_concentration(db: Session = Depends(get_db)):
    _require_dev()
    rows = (
        db.query(
            ConvictionPosition.market_id,
            func.sum(ConvictionPosition.amount).label("total_exposure"),
            func.count(ConvictionPosition.id).label("open_positions"),
        )
        .filter(ConvictionPosition.status == "open")
        .group_by(ConvictionPosition.market_id)
        .order_by(func.sum(ConvictionPosition.amount).desc())
        .all()
    )
    out = []
    for market_id, total, count in rows:
        market = db.get(Market, market_id)
        out.append(
            {
                "market_id": market_id,
                "market_title": market.title if market else "Unknown",
                "total_open_exposure": round(float(total or 0.0), 2),
                "open_positions": int(count or 0),
            }
        )
    return out


@router.get("/admin/deposits")
def admin_list_deposits(db: Session = Depends(get_db)):
    _require_dev()
    rows = db.query(DepositRequest).order_by(DepositRequest.created_at.desc()).all()
    return [
        {
            "id": row.id,
            "user_id": row.user_id,
            "wallet_address": row.wallet_address,
            "chain": row.chain,
            "expected_token": row.expected_token,
            "treasury_address": row.treasury_address,
            "status": row.status,
            "tx_hash": row.tx_hash,
            "amount": row.amount,
            "detected_at": row.detected_at.isoformat() if row.detected_at else None,
            "confirmed_at": row.confirmed_at.isoformat() if row.confirmed_at else None,
            "created_at": row.created_at.isoformat() if row.created_at else None,
        }
        for row in rows
    ]


@router.post("/admin/deposits/sync")
def admin_sync_deposits(db: Session = Depends(get_db)):
    _require_dev()
    return sync_base_deposits(db)


@router.get("/admin/withdrawals")
def admin_list_withdrawals(db: Session = Depends(get_db)):
    _require_dev()
    rows = db.query(WithdrawalRequest).order_by(WithdrawalRequest.created_at.desc()).all()
    return [
        {
            "id": row.id,
            "user_id": row.user_id,
            "amount": row.amount,
            "chain": row.chain,
            "destination_wallet": row.destination_wallet or row.wallet_address,
            "status": row.status,
            "requested_at": row.requested_at.isoformat() if row.requested_at else None,
            "reviewed_at": row.reviewed_at.isoformat() if row.reviewed_at else None,
            "completed_at": row.completed_at.isoformat() if row.completed_at else None,
            "tx_hash": row.tx_hash,
            "note": row.note,
        }
        for row in rows
    ]


@router.post("/admin/withdrawals/{request_id}/mark-sent")
def admin_mark_withdrawal_sent(
    request_id: int,
    tx_hash: str = Body(..., embed=True),
    db: Session = Depends(get_db),
):
    _require_dev()
    req = db.get(WithdrawalRequest, request_id)
    if not req:
        raise HTTPException(status_code=404, detail="Withdrawal request not found")
    if req.status != "pending_review":
        raise HTTPException(status_code=400, detail="Withdrawal is not pending review")

    balance = get_or_create_balance(req.user_id, db)
    if balance.locked_balance < req.amount:
        raise HTTPException(status_code=400, detail="Locked balance is insufficient for completion")
    req.status = "completed"
    req.reviewed_at = datetime.utcnow()
    req.completed_at = datetime.utcnow()
    req.tx_hash = tx_hash.lower()
    balance.locked_balance -= req.amount
    append_ledger_entry(
        db=db,
        balance=balance,
        entry_type="withdrawal_completed",
        amount=req.amount,
        reference=f"withdrawal_request:{req.id}",
        note="Admin marked withdrawal as sent",
        metadata_json={"tx_hash": req.tx_hash, "chain": req.chain},
    )
    db.commit()
    return {"success": True, "request_id": req.id, "status": req.status}


@router.post("/admin/events/ingest")
def admin_ingest_events(
    sources: list[dict] | None = Body(default=None, embed=True),
    db: Session = Depends(get_db),
):
    _require_dev()
    return ingest_world_sources(db, sources=sources)


@router.get("/admin/events/sources")
def admin_list_event_sources(db: Session = Depends(get_db)):
    _require_dev()
    return {
        "sources": list_event_sources_with_status(db),
        "configured_count": len(configured_event_sources()),
    }


@router.post("/admin/events/sources/{source_key}/ingest")
def admin_ingest_single_source(
    source_key: str,
    db: Session = Depends(get_db),
):
    _require_dev()
    try:
        return ingest_single_world_source(db, source_key)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/admin/events/manual")
def admin_create_manual_event_candidate(
    body: EventCandidateManualIn,
    db: Session = Depends(get_db),
):
    _require_dev()
    candidate = create_candidate(
        db,
        title=body.title,
        summary=body.summary,
        source_url=body.source_url,
        source_name=body.source_name,
        category=body.category,
        metadata={"source_type": "manual"},
    )
    if candidate is None:
        return {"created": False, "reason": "duplicate"}
    return {"created": True, "candidate": candidate_to_payload(candidate)}


@router.get("/admin/events/candidates")
def admin_list_event_candidates(
    status: str | None = Query(default=None),
    duration_type: str | None = Query(default=None),
    limit: int = Query(default=60, ge=1, le=200),
    db: Session = Depends(get_db),
):
    _require_dev()
    q = db.query(EventCandidate).order_by(EventCandidate.detected_at.desc())
    if status:
        q = q.filter(EventCandidate.status == status)
    if duration_type:
        q = q.filter(EventCandidate.duration_type == duration_type)
    rows = q.limit(limit).all()
    return [candidate_to_payload(row) for row in rows]


@router.get("/admin/events/duration-stats")
def admin_event_duration_stats(db: Session = Depends(get_db)):
    _require_dev()
    now = datetime.utcnow()
    within_48h = now + timedelta(hours=48)
    open_statuses = ("pending", "approved")

    open_daily_candidates = (
        db.query(func.count(EventCandidate.id))
        .filter(
            EventCandidate.duration_type == "daily",
            EventCandidate.status.in_(open_statuses),
        )
        .scalar()
        or 0
    )
    open_daily_markets = (
        db.query(func.count(Market.id))
        .filter(
            Market.status == "open",
            Market.horizon_type == "daily",
        )
        .scalar()
        or 0
    )
    resolving_within_48h = (
        db.query(func.count(Market.id))
        .filter(
            Market.status == "open",
            Market.expected_resolution_at.isnot(None),
            Market.expected_resolution_at <= within_48h,
        )
        .scalar()
        or 0
    )
    return {
        "open_daily_candidates": open_daily_candidates,
        "open_daily_markets": open_daily_markets,
        "resolving_within_48h": resolving_within_48h,
    }


@router.patch("/admin/events/candidates/{candidate_id}/duration")
def admin_update_candidate_duration(
    candidate_id: int,
    body: CandidateDurationIn,
    db: Session = Depends(get_db),
):
    _require_dev()
    candidate = db.get(EventCandidate, candidate_id)
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
    apply_duration_fields(
        candidate,
        duration_type=body.duration_type,
        expected_resolution_date=body.expected_resolution_date,
    )
    db.commit()
    db.refresh(candidate)
    return {"candidate": candidate_to_payload(candidate)}


@router.patch("/admin/events/candidates/{candidate_id}/status")
def admin_update_candidate_status(
    candidate_id: int,
    body: CandidateStatusIn,
    db: Session = Depends(get_db),
):
    _require_dev()
    candidate = db.get(EventCandidate, candidate_id)
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
    candidate.status = body.status
    if body.status == "approved":
        candidate.approved_at = datetime.utcnow()
    db.commit()
    db.refresh(candidate)
    return {"candidate": candidate_to_payload(candidate)}


@router.post("/admin/events/candidates/{candidate_id}/priority")
def admin_mark_candidate_priority(
    candidate_id: int,
    high_priority: bool = Body(default=True, embed=True),
    db: Session = Depends(get_db),
):
    _require_dev()
    candidate = db.get(EventCandidate, candidate_id)
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
    candidate.is_high_priority = high_priority
    db.commit()
    db.refresh(candidate)
    return {"candidate": candidate_to_payload(candidate)}


@router.post("/admin/events/candidates/{candidate_id}/attach-market")
def admin_attach_candidate_to_market(
    candidate_id: int,
    body: CandidateAttachMarketIn,
    db: Session = Depends(get_db),
):
    _require_dev()
    candidate = db.get(EventCandidate, candidate_id)
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
    market = db.get(Market, body.market_id)
    if not market:
        raise HTTPException(status_code=404, detail="Market not found")
    candidate.attached_market_id = market.id
    db.commit()
    db.refresh(candidate)
    return {"candidate": candidate_to_payload(candidate)}


@router.post("/admin/events/candidates/{candidate_id}/create-market")
def admin_create_market_from_candidate(
    candidate_id: int,
    body: CandidateCreateMarketIn,
    db: Session = Depends(get_db),
):
    _require_dev()
    candidate = db.get(EventCandidate, candidate_id)
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    title = (body.title or candidate.title).strip()
    duration_type = candidate.duration_type or "weekly"
    expected_resolution_at = candidate.expected_resolution_date or suggested_resolution_date(
        duration_type
    )
    market = Market(
        title=title[:255],
        category=(body.category or candidate.category or "macro")[:255],
        status="open",
        current_yes_probability=max(1.0, min(99.0, body.initial_probability)),
        expected_resolution_at=expected_resolution_at,
        horizon_type=duration_type,
        created_at=datetime.utcnow(),
    )
    db.add(market)
    db.flush()
    candidate.attached_market_id = market.id
    candidate.metadata_json = {
        **(candidate.metadata_json or {}),
        "auto_created_market_from_candidate": True,
        "market_horizon_type": duration_type,
        "market_expected_resolution_at": expected_resolution_at.isoformat(),
    }
    db.commit()
    db.refresh(candidate)
    db.refresh(market)
    return {
        "candidate": candidate_to_payload(candidate),
        "market": {
            "id": market.id,
            "title": market.title,
            "category": market.category,
            "status": market.status,
            "current_yes_probability": market.current_yes_probability,
            "horizon_type": market.horizon_type,
            "horizon_label": duration_label(market.horizon_type),
            "expected_resolution_at": (
                market.expected_resolution_at.isoformat() if market.expected_resolution_at else None
            ),
        },
    }


@router.post("/admin/events/candidates/{candidate_id}/trigger-feed-event")
def admin_trigger_candidate_feed_event(
    candidate_id: int,
    body: CandidatePublishIn,
    db: Session = Depends(get_db),
):
    _require_dev()
    candidate = db.get(EventCandidate, candidate_id)
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
    if candidate.status != "approved":
        raise HTTPException(status_code=400, detail="Candidate must be approved before feed injection")
    events = publish_candidate(
        db,
        candidate,
        event_type=body.event_type,
        market_id=body.market_id,
        selected_reaction_keys=body.selected_reaction_keys,
        publish_all_as_arc_burst=body.publish_all_as_arc_burst,
    )
    return {
        "candidate": candidate_to_payload(candidate),
        "feed_events": [
            {
                "id": event.id,
                "type": event.type,
                "title": event.title,
                "market_id": event.market_id,
                "agent_id": event.agent_id,
                "source_url": (event.metadata_json or {}).get("source_url"),
            }
            for event in events
        ],
    }


@router.post("/admin/events/candidates/{candidate_id}/reaction-preview")
def admin_preview_candidate_reactions(
    candidate_id: int,
    body: CandidatePreviewIn,
    db: Session = Depends(get_db),
):
    _require_dev()
    candidate = db.get(EventCandidate, candidate_id)
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
    preview = preview_candidate_reactions(
        db,
        candidate,
        event_type=body.event_type,
        market_id=body.market_id,
        seed=body.seed,
    )
    return {"candidate": candidate_to_payload(candidate), "preview": preview}


@router.get("/admin/events/arcs")
def admin_list_scheduled_arcs(
    status: str | None = Query(default=None),
    db: Session = Depends(get_db),
):
    _require_dev()
    q = db.query(ScheduledEventArc).order_by(ScheduledEventArc.start_date.asc())
    if status:
        q = q.filter(ScheduledEventArc.status == status)
    arcs = q.limit(200).all()
    return [arc_to_payload(arc) for arc in arcs]


@router.post("/admin/events/arcs")
def admin_create_scheduled_arc(
    body: ScheduledArcIn,
    db: Session = Depends(get_db),
):
    _require_dev()
    if body.end_date <= body.start_date:
        raise HTTPException(status_code=400, detail="end_date must be after start_date")
    arc = ScheduledEventArc(
        title=body.title[:255],
        start_date=body.start_date,
        end_date=body.end_date,
        category=body.category[:64],
        linked_market_ids=body.linked_market_ids,
        primary_agent_ids=body.primary_agent_ids,
        watch_keywords=body.watch_keywords,
        activity_boost=max(1.0, min(3.0, body.activity_boost)),
        status="scheduled",
    )
    db.add(arc)
    db.commit()
    db.refresh(arc)
    return {"arc": arc_to_payload(arc)}


@router.post("/admin/withdrawals/{request_id}/reject")
def admin_reject_withdrawal(
    request_id: int,
    note: str | None = Body(default=None, embed=True),
    db: Session = Depends(get_db),
):
    _require_dev()
    req = db.get(WithdrawalRequest, request_id)
    if not req:
        raise HTTPException(status_code=404, detail="Withdrawal request not found")
    if req.status != "pending_review":
        raise HTTPException(status_code=400, detail="Withdrawal is not pending review")

    balance = get_or_create_balance(req.user_id, db)
    if balance.locked_balance < req.amount:
        raise HTTPException(status_code=400, detail="Locked balance is insufficient to reject")
    req.status = "rejected"
    req.reviewed_at = datetime.utcnow()
    req.note = note or "Rejected by admin"
    balance.locked_balance -= req.amount
    balance.available_balance += req.amount
    append_ledger_entry(
        db=db,
        balance=balance,
        entry_type="withdrawal_rejected",
        amount=req.amount,
        reference=f"withdrawal_request:{req.id}",
        note=req.note,
    )
    db.commit()
    return {"success": True, "request_id": req.id, "status": req.status}


@router.post("/admin/feed/interactions/{interaction_id}/remove")
def admin_remove_feed_interaction(interaction_id: int, db: Session = Depends(get_db)):
    interaction = get_interaction_or_404(db, interaction_id)
    meta = interaction.metadata_json or {}
    meta["admin_removed"] = True
    interaction.metadata_json = meta
    soft_remove_interaction(db, interaction)
    return {"removed": True, "id": interaction_id}


@router.get("/admin/feed/interactions/recent")
def admin_recent_feed_interactions(
    limit: int = 30,
    db: Session = Depends(get_db),
):
    from sqlalchemy.orm import joinedload

    rows = (
        db.query(FeedInteraction)
        .options(
            joinedload(FeedInteraction.user),
            joinedload(FeedInteraction.feed_event),
        )
        .filter(FeedInteraction.status == "active")
        .order_by(FeedInteraction.created_at.desc())
        .limit(min(limit, 100))
        .all()
    )
    return [interaction_to_payload(r) for r in rows]


@router.post("/admin/markets/thread/posts/{post_id}/remove")
def admin_remove_thread_post(post_id: int, db: Session = Depends(get_db)):
    post = db.query(MarketThreadPost).filter(MarketThreadPost.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    meta = post.metadata_json or {}
    meta["admin_removed"] = True
    post.metadata_json = meta
    soft_remove_thread_post(db, post)
    return {"removed": True, "id": post_id}


@router.get("/admin/agents")
def admin_list_agents(db: Session = Depends(get_db)):
    """Roster with active/dormant status — Season 1 core cast management."""
    _require_dev()
    agents = db.query(Agent).order_by(Agent.name).all()
    return [
        {
            "name": a.name,
            "slug": a.slug,
            "niche": a.niche,
            "is_core": a.slug in CORE_AGENT_SLUGS,
            **agent_status_payload(a),
        }
        for a in agents
    ]


@router.patch("/admin/agents/{slug}/status")
def admin_set_agent_status(
    slug: str,
    body: AgentStatusIn,
    db: Session = Depends(get_db),
):
    """Toggle agent between active (network-visible) and dormant (season break)."""
    _require_dev()
    if body.status not in (AGENT_STATUS_ACTIVE, AGENT_STATUS_DORMANT):
        raise HTTPException(status_code=400, detail="status must be active or dormant")
    agent = db.query(Agent).filter(Agent.slug == slug).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    agent.status = body.status
    db.commit()
    db.refresh(agent)
    return {"slug": agent.slug, "name": agent.name, **agent_status_payload(agent)}


@router.get("/admin/agents/characters")
def admin_list_character_previews(db: Session = Depends(get_db)):
    """Season 1 core cast — character bible index for admin voice QA."""
    _require_dev()
    from app.forecasting.services.voice_engine import character_preview_payload, display_name

    return [
        {
            "slug": slug,
            "display_name": display_name(slug),
            "preview_url": f"/admin/agents/characters/{slug}",
        }
        for slug in sorted(CORE_AGENT_SLUGS)
    ]


@router.get("/admin/agents/characters/model-presets")
def admin_character_model_presets():
    """Global defaults, presets, provider hints — no API keys."""
    _require_dev()
    from app.forecasting.character_bibles.agent_model_config import admin_model_metadata

    return admin_model_metadata()


@router.get("/admin/agents/characters/{slug}/model-config")
def admin_get_agent_model_config(slug: str):
    _require_dev()
    if slug not in CORE_AGENT_SLUGS:
        raise HTTPException(status_code=404, detail="Not a Season 1 core character slug")
    from app.forecasting.character_bibles.agent_model_config import agent_model_config_payload

    return agent_model_config_payload(slug)


class AgentModelConfigIn(BaseModel):
    model_provider: str
    model_name: str
    temperature: float
    top_p: float
    max_tokens: int
    frequency_penalty: float
    presence_penalty: float
    clear_override: bool = False


@router.put("/admin/agents/characters/{slug}/model-config")
def admin_put_agent_model_config(slug: str, body: AgentModelConfigIn):
    _require_dev()
    if slug not in CORE_AGENT_SLUGS:
        raise HTTPException(status_code=404, detail="Not a Season 1 core character slug")
    from app.forecasting.character_bibles.agent_model_config import (
        agent_model_config_payload,
        save_agent_override,
    )

    if body.clear_override:
        effective = save_agent_override(slug, None)
    else:
        effective = save_agent_override(slug, body.model_dump(exclude={"clear_override"}))
    return {
        "saved": True,
        "effective": effective.to_public_dict(),
        "config": agent_model_config_payload(slug),
    }


@router.post("/admin/agents/characters/{slug}/model-config/preset/{preset_key}")
def admin_apply_model_preset(slug: str, preset_key: str):
    _require_dev()
    if slug not in CORE_AGENT_SLUGS:
        raise HTTPException(status_code=404, detail="Not a Season 1 core character slug")
    from app.forecasting.character_bibles.agent_model_config import (
        agent_model_config_payload,
        apply_preset,
    )

    try:
        apply_preset(preset_key, slug)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    return {"saved": True, "preset": preset_key, "config": agent_model_config_payload(slug)}


class CharacterBibleIn(BaseModel):
    origin_story: str
    worldview: str
    core_belief: str
    biggest_victory: str
    biggest_scar: str
    blind_spot: str
    what_makes_them_angry: str
    what_they_secretly_respect: str
    confidence_style: str
    humility_style: str
    loss_behavior: str
    win_behavior: str
    forbidden_phrases: list[str]
    signature_phrases: list[str]
    favorite_narratives: list[str]
    hated_narratives: list[str]
    recurring_enemies: list[str]
    recurring_allies: list[str]
    recurring_targets: list[str]
    example_good_posts: list[str]
    example_bad_posts: list[str]
    voice_rules: dict


@router.get("/admin/agents/characters/{slug}/bible")
def admin_get_character_bible(slug: str):
    """Editable bible fields for a Season 1 core agent."""
    _require_dev()
    if slug not in CORE_AGENT_SLUGS:
        raise HTTPException(status_code=404, detail="Not a Season 1 core character slug")
    from app.forecasting.character_bibles.character_bible_editor import (
        editable_bible_fields,
        latest_backup_timestamp,
    )

    return {
        "slug": slug,
        "fields": editable_bible_fields(slug),
        "latest_backup_timestamp": latest_backup_timestamp(slug),
    }


@router.put("/admin/agents/characters/{slug}/bible")
def admin_put_character_bible(slug: str, body: CharacterBibleIn, seed: int | None = Query(None)):
    """Save bible edits to disk (with backup) and regenerate sample copy."""
    _require_dev()
    if slug not in CORE_AGENT_SLUGS:
        raise HTTPException(status_code=404, detail="Not a Season 1 core character slug")
    from app.forecasting.character_bibles.character_bible_editor import save_character_bible
    from app.forecasting.services.voice_engine import character_preview_payload
    import time

    try:
        save_character_bible(slug, body.model_dump())
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

    effective_seed = seed if seed is not None else int(time.time())
    preview = character_preview_payload(slug, seed=effective_seed)
    from app.forecasting.character_bibles.character_bible_editor import editable_bible_fields

    return {
        "saved": True,
        "slug": slug,
        "fields": editable_bible_fields(slug),
        "seed": effective_seed,
        **preview,
    }


@router.post("/admin/agents/characters/{slug}/bible/restore-latest-backup")
def admin_restore_character_bible_backup(slug: str, seed: int | None = Query(None)):
    """Restore the latest on-disk bible backup and regenerate samples."""
    _require_dev()
    if slug not in CORE_AGENT_SLUGS:
        raise HTTPException(status_code=404, detail="Not a Season 1 core character slug")
    from app.forecasting.character_bibles.character_bible_editor import (
        latest_backup_timestamp,
        restore_latest_backup,
    )
    from app.forecasting.services.voice_engine import character_preview_payload
    import time

    try:
        restore_latest_backup(slug)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

    effective_seed = seed if seed is not None else int(time.time())
    preview = character_preview_payload(slug, seed=effective_seed)
    from app.forecasting.character_bibles.character_bible_editor import editable_bible_fields

    return {
        "restored": True,
        "slug": slug,
        "latest_backup_timestamp": latest_backup_timestamp(slug),
        "fields": editable_bible_fields(slug),
        "seed": effective_seed,
        **preview,
    }


@router.get("/admin/agents/characters/blind-test")
def admin_character_blind_test(seed: int | None = Query(None)):
    """Five anonymous sample posts — guess which core agent wrote each."""
    _require_dev()
    from app.forecasting.services.voice_engine import blind_test_posts

    posts = blind_test_posts(seed=seed)
    return {
        "instructions": "Read the five samples without names. Expand answers to check slugs.",
        "seed": seed,
        "samples": [{k: v for k, v in p.items() if k != "answer_slug"} for p in posts],
        "answers": [{"anonymous_id": p["anonymous_id"], "slug": p["answer_slug"]} for p in posts],
    }


@router.post("/admin/agents/characters/blind-test")
def admin_character_blind_test_fresh(seed: int | None = Query(None)):
    """Run blind test using latest saved bibles and model config (clears read caches)."""
    _require_dev()
    from app.forecasting.character_bibles import clear_character_bible_cache
    from app.forecasting.character_bibles.agent_model_config import clear_model_config_cache
    from app.forecasting.services.voice_engine import blind_test_posts
    import time

    clear_character_bible_cache()
    clear_model_config_cache()
    effective_seed = seed if seed is not None else int(time.time())
    posts = blind_test_posts(seed=effective_seed)
    return {
        "instructions": "Read the five samples without names. Expand answers to check slugs.",
        "seed": effective_seed,
        "samples": [{k: v for k, v in p.items() if k != "answer_slug"} for p in posts],
        "answers": [{"anonymous_id": p["anonymous_id"], "slug": p["answer_slug"]} for p in posts],
    }


@router.get("/admin/agents/characters/{slug}")
def admin_character_detail(slug: str, seed: int | None = Query(None)):
    """Full bible, voice rules, relationships, and sample copy for one core agent."""
    _require_dev()
    if slug not in CORE_AGENT_SLUGS:
        raise HTTPException(status_code=404, detail="Not a Season 1 core character slug")
    from app.forecasting.services.voice_engine import character_preview_payload

    return character_preview_payload(slug, seed=seed)


class CharacterRegenerateIn(BaseModel):
    seed: int | None = None


@router.post("/admin/agents/characters/{slug}/regenerate-samples")
def admin_regenerate_character_samples(
    slug: str,
    body: CharacterRegenerateIn | None = None,
):
    """Regenerate sample post, counter, win/loss lines for voice QA."""
    _require_dev()
    if slug not in CORE_AGENT_SLUGS:
        raise HTTPException(status_code=404, detail="Not a Season 1 core character slug")
    from app.forecasting.services.voice_engine import character_preview_payload
    import time

    seed_in = body.seed if body else None
    effective_seed = seed_in if seed_in is not None else int(time.time())
    payload = character_preview_payload(slug, seed=effective_seed)
    return {"seed": effective_seed, **payload}


class CreatorForecasterReviewIn(BaseModel):
    note: str | None = None


@router.get("/admin/forecasters/differentiation")
def admin_forecaster_differentiation(db: Session = Depends(get_db)):
    """Differentiation overview for published creator forecasters."""
    _require_dev()
    from app.forecasting.services.creator_forecaster.differentiation import admin_differentiation_overview

    return admin_differentiation_overview(db)


@router.post("/admin/forecasters/{cf_id}/force-review")
def admin_force_forecaster_review(
    cf_id: int,
    body: CreatorForecasterReviewIn | None = None,
    db: Session = Depends(get_db),
):
    """Flag a creator forecaster for manual review (sets agent dormant)."""
    _require_dev()
    cf = db.query(CreatorForecaster).filter(CreatorForecaster.id == cf_id).first()
    if not cf:
        raise HTTPException(status_code=404, detail="Creator forecaster not found")
    if cf.agent_id:
        agent = db.query(Agent).filter(Agent.id == cf.agent_id).first()
        if agent:
            agent.status = AGENT_STATUS_DORMANT
    db.commit()
    return {
        "id": cf.id,
        "status": "flagged_for_review",
        "note": body.note if body else None,
        "agent_slug": cf.agent.slug if cf.agent else None,
    }


@router.post("/admin/forecasters/{cf_id}/archive")
def admin_archive_creator_forecaster(
    cf_id: int,
    db: Session = Depends(get_db),
):
    """Archive an obvious clone — hides agent from active network."""
    _require_dev()
    cf = db.query(CreatorForecaster).filter(CreatorForecaster.id == cf_id).first()
    if not cf:
        raise HTTPException(status_code=404, detail="Creator forecaster not found")
    cf.status = "archived"
    if cf.agent_id:
        agent = db.query(Agent).filter(Agent.id == cf.agent_id).first()
        if agent:
            agent.status = AGENT_STATUS_DORMANT
    db.commit()
    return {
        "id": cf.id,
        "status": cf.status,
        "agent_slug": cf.agent.slug if cf.agent else None,
    }
