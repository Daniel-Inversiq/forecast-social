from __future__ import annotations

from app.forecasting.models import ConvictionBalance, ConvictionLedgerEntry
from app.settings import max_user_exposure_usdc

ENTRY_TYPES = {
    "deposit_pending",
    "deposit_confirmed",
    "withdrawal_pending",
    "withdrawal_completed",
    "withdrawal_rejected",
    "position_open",
    "position_close",
    "payout",
    "admin_adjustment",
}


def get_or_create_balance(user_id: int, db) -> ConvictionBalance:
    balance = (
        db.query(ConvictionBalance)
        .filter(ConvictionBalance.user_id == user_id, ConvictionBalance.currency == "USDC")
        .first()
    )
    if balance:
        return balance
    balance = ConvictionBalance(
        user_id=user_id,
        currency="USDC",
        user_exposure_cap=max_user_exposure_usdc(),
    )
    db.add(balance)
    db.flush()
    return balance


def append_ledger_entry(
    *,
    db,
    balance: ConvictionBalance,
    entry_type: str,
    amount: float,
    market_id: int | None = None,
    position_id: int | None = None,
    reference: str | None = None,
    note: str | None = None,
    metadata_json: dict | None = None,
) -> ConvictionLedgerEntry:
    if entry_type not in ENTRY_TYPES:
        raise ValueError("Invalid ledger entry type")
    if balance.currency != "USDC":
        raise ValueError("Only USDC balances are supported")
    if balance.available_balance < 0 or balance.locked_balance < 0 or balance.total_exposure < 0:
        raise ValueError("Negative balances are not allowed")

    entry = ConvictionLedgerEntry(
        user_id=balance.user_id,
        balance_id=balance.id,
        market_id=market_id,
        position_id=position_id,
        entry_type=entry_type,
        amount=round(float(amount), 6),
        currency="USDC",
        available_balance_after=round(float(balance.available_balance), 6),
        locked_balance_after=round(float(balance.locked_balance), 6),
        total_exposure_after=round(float(balance.total_exposure), 6),
        reference=reference,
        note=note,
        metadata_json=metadata_json,
    )
    db.add(entry)
    db.flush()
    return entry
