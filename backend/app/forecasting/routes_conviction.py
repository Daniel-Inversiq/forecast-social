from datetime import datetime

from fastapi import APIRouter, Body, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user
from app.database import get_db
from app.forecasting.models import (
    ConvictionLedgerEntry,
    ConvictionPosition,
    DepositRequest,
    Market,
    User,
    WithdrawalRequest,
)
from app.forecasting.services.conviction_ledger import append_ledger_entry, get_or_create_balance
from app.forecasting.services.conviction_limits import open_user_exposure
from app.settings import treasury_wallet_address
from app.wallet.chains import normalize_chain
from app.wallet.verification import normalize_address

router = APIRouter(tags=["conviction"])


@router.get("/me/conviction-balance")
def get_my_conviction_balance(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    balance = get_or_create_balance(current_user.id, db)
    db.flush()
    balance.total_exposure = open_user_exposure(db, current_user.id)
    remaining_exposure = max(0.0, balance.user_exposure_cap - balance.total_exposure)
    db.commit()
    return {
        "available_balance": round(balance.available_balance, 2),
        "locked_balance": round(balance.locked_balance, 2),
        "total_exposure": round(balance.total_exposure, 2),
        "global_exposure_cap": round(balance.user_exposure_cap, 2),
        "remaining_exposure": round(remaining_exposure, 2),
        "currency": balance.currency,
        "wallet_address": current_user.wallet_address,
        "has_verified_wallet": bool(current_user.wallet_verified and current_user.wallet_address),
    }


@router.get("/me/conviction-ledger")
def get_my_conviction_ledger(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    entries = (
        db.query(ConvictionLedgerEntry)
        .filter(ConvictionLedgerEntry.user_id == current_user.id)
        .order_by(ConvictionLedgerEntry.created_at.desc(), ConvictionLedgerEntry.id.desc())
        .all()
    )
    market_ids = list({e.market_id for e in entries if e.market_id})
    markets = {m.id: m.title for m in db.query(Market).filter(Market.id.in_(market_ids)).all()} if market_ids else {}
    return [
        {
            "type": e.entry_type,
            "amount": e.amount,
            "currency": e.currency,
            "market": markets.get(e.market_id) if e.market_id else None,
            "created_at": e.created_at.isoformat() if e.created_at else None,
            "available_balance_after": e.available_balance_after,
            "locked_balance_after": e.locked_balance_after,
            "total_exposure_after": e.total_exposure_after,
            "metadata": e.metadata_json,
        }
        for e in entries
    ]


@router.get("/me/conviction-positions")
def get_my_conviction_positions(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(ConvictionPosition, Market)
        .join(Market, Market.id == ConvictionPosition.market_id)
        .filter(ConvictionPosition.user_id == current_user.id)
        .order_by(ConvictionPosition.opened_at.desc())
        .all()
    )
    data: list[dict] = []
    for position, market in rows:
        reputation_impact = None
        if position.status == "won":
            reputation_impact = round(2 + position.amount * 0.08, 1)
        elif position.status == "lost":
            reputation_impact = round(-(1 + position.amount * 0.05), 1)
        data.append(
            {
                "market": market.title,
                "side": position.side,
                "amount": position.amount,
                "status": position.status,
                "opened_at": position.opened_at.isoformat() if position.opened_at else None,
                "resolved_at": position.resolved_at.isoformat() if position.resolved_at else None,
                "payout_amount": position.payout_amount,
                "outcome": market.resolved_outcome,
                "reputation_impact": reputation_impact,
            }
        )
    open_positions = [p for p in data if p["status"] == "open"]
    resolved_positions = [p for p in data if p["status"] != "open"]
    return {"open_positions": open_positions, "resolved_positions": resolved_positions}


@router.post("/me/deposits/create")
def create_my_deposit(
    chain: str = Body(default="base", embed=True),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not current_user.wallet_verified or not current_user.wallet_address:
        raise HTTPException(status_code=400, detail="Verified wallet required")
    try:
        chain_key = normalize_chain(chain)
        wallet = normalize_address(current_user.wallet_address)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    treasury = treasury_wallet_address()
    if not treasury:
        raise HTTPException(status_code=500, detail="Treasury wallet is not configured")

    request = DepositRequest(
        user_id=current_user.id,
        amount=0.0,
        wallet_address=wallet,
        chain=chain_key,
        expected_token="USDC",
        treasury_address=treasury,
        wallet_verified=True,
        status="pending",
        note="Awaiting on-chain USDC transfer detection",
    )
    db.add(request)
    db.commit()
    return {
        "success": True,
        "request_id": request.id,
        "status": request.status,
        "chain": chain_key,
        "expected_token": "USDC",
        "treasury_address": treasury,
        "message": "Deposit watch created. Send USDC from your verified wallet to the treasury address.",
    }


@router.get("/me/deposits")
def get_my_deposits(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(DepositRequest)
        .filter(DepositRequest.user_id == current_user.id)
        .order_by(DepositRequest.created_at.desc(), DepositRequest.id.desc())
        .all()
    )
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


@router.post("/me/withdrawals/request")
def request_my_withdrawal(
    amount: float = Body(..., embed=True),
    destination_wallet: str = Body(..., embed=True),
    chain: str = Body(default="base", embed=True),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not current_user.wallet_verified or not current_user.wallet_address:
        raise HTTPException(status_code=400, detail="Verified wallet required")
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be greater than zero")
    try:
        chain_key = normalize_chain(chain)
        destination = normalize_address(destination_wallet)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    balance = get_or_create_balance(current_user.id, db)
    if balance.available_balance < amount:
        raise HTTPException(status_code=400, detail="Withdrawal request exceeds available USDC balance")
    request = WithdrawalRequest(
        user_id=current_user.id,
        amount=amount,
        wallet_address=normalize_address(current_user.wallet_address),
        destination_wallet=destination,
        chain=chain_key,
        wallet_verified=True,
        status="pending_review",
        requested_at=datetime.utcnow(),
        note="Awaiting manual admin review",
    )
    db.add(request)
    db.flush()
    balance.available_balance -= amount
    balance.locked_balance += amount
    append_ledger_entry(
        db=db,
        balance=balance,
        entry_type="withdrawal_pending",
        amount=amount,
        reference=f"withdrawal_request:{request.id}",
        note="Withdrawal requested and amount locked pending manual review",
    )
    db.commit()
    return {
        "success": True,
        "request_id": request.id,
        "status": request.status,
        "message": "Withdrawal request submitted for manual admin review.",
    }


@router.get("/me/withdrawals")
def get_my_withdrawals(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(WithdrawalRequest)
        .filter(WithdrawalRequest.user_id == current_user.id)
        .order_by(WithdrawalRequest.created_at.desc(), WithdrawalRequest.id.desc())
        .all()
    )
    return [
        {
            "id": row.id,
            "amount": row.amount,
            "chain": row.chain,
            "destination_wallet": row.destination_wallet or row.wallet_address,
            "status": row.status,
            "requested_at": (row.requested_at or row.created_at).isoformat()
            if (row.requested_at or row.created_at)
            else None,
            "reviewed_at": row.reviewed_at.isoformat() if row.reviewed_at else None,
            "completed_at": row.completed_at.isoformat() if row.completed_at else None,
            "tx_hash": row.tx_hash,
            "note": row.note,
        }
        for row in rows
    ]
