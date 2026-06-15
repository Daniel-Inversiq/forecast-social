from __future__ import annotations

import json
from datetime import datetime
from urllib.request import Request, urlopen

from sqlalchemy.orm import Session

from app.forecasting.models import ConvictionLedgerEntry, DepositRequest, User
from app.forecasting.services.conviction_ledger import append_ledger_entry, get_or_create_balance
from app.settings import (
    base_rpc_url,
    deposit_confirmations_required,
    min_deposit_usdc,
    treasury_wallet_address,
    usdc_base_contract,
)
from app.wallet.verification import normalize_address

TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"


def _rpc_call(rpc_url: str, method: str, params: list) -> dict:
    payload = json.dumps({"jsonrpc": "2.0", "id": 1, "method": method, "params": params}).encode("utf-8")
    req = Request(rpc_url, data=payload, headers={"Content-Type": "application/json"})
    with urlopen(req, timeout=20) as response:
        return json.loads(response.read().decode("utf-8"))


def _to_int(hex_value: str | None) -> int:
    if not hex_value:
        return 0
    return int(hex_value, 16)


def _topic_to_address(topic: str) -> str:
    return f"0x{topic[-40:]}".lower()


def _amount_usdc_from_data(data_hex: str) -> float:
    raw = _to_int(data_hex)
    return raw / 1_000_000


def sync_base_deposits(db: Session) -> dict:
    rpc = base_rpc_url()
    treasury = treasury_wallet_address()
    usdc_token = usdc_base_contract()
    confirmations = deposit_confirmations_required()
    minimum_amount = min_deposit_usdc()

    if not rpc:
        raise ValueError("BASE_RPC_URL is required")
    if not treasury:
        raise ValueError("TREASURY_WALLET_ADDRESS is required")
    if not usdc_token:
        raise ValueError("USDC_BASE_CONTRACT is required")

    latest = _to_int(_rpc_call(rpc, "eth_blockNumber", [])["result"])
    from_block = max(0, latest - 5000)
    params = [
        {
            "fromBlock": hex(from_block),
            "toBlock": hex(latest),
            "address": usdc_token,
            "topics": [TRANSFER_TOPIC, None, f"0x{'0' * 24}{treasury[2:]}"],
        }
    ]
    logs = _rpc_call(rpc, "eth_getLogs", params).get("result", [])

    confirmed = 0
    ignored = 0
    for event in logs:
        tx_hash = (event.get("transactionHash") or "").lower()
        log_index = _to_int(event.get("logIndex"))
        amount = _amount_usdc_from_data(event.get("data") or "0x0")
        block_number = _to_int(event.get("blockNumber"))
        if amount < minimum_amount:
            ignored += 1
            continue
        if latest - block_number + 1 < confirmations:
            ignored += 1
            continue

        sender = _topic_to_address((event.get("topics") or ["", "", ""])[1])
        user = (
            db.query(User)
            .filter(
                User.wallet_verified.is_(True),
                User.wallet_address == sender,
            )
            .first()
        )
        if not user:
            ignored += 1
            continue

        existing_entry = (
            db.query(ConvictionLedgerEntry)
            .filter(ConvictionLedgerEntry.reference == f"deposit_tx:{tx_hash}:{log_index}")
            .first()
        )
        if existing_entry:
            ignored += 1
            continue

        pending_request = (
            db.query(DepositRequest)
            .filter(
                DepositRequest.user_id == user.id,
                DepositRequest.chain == "base",
                DepositRequest.status.in_(["pending", "detected"]),
            )
            .order_by(DepositRequest.created_at.asc())
            .first()
        )
        if not pending_request:
            ignored += 1
            continue

        pending_request.status = "confirmed"
        pending_request.amount = round(amount, 6)
        pending_request.tx_hash = tx_hash
        pending_request.log_index = log_index
        pending_request.detected_at = datetime.utcnow()
        pending_request.confirmed_at = datetime.utcnow()
        pending_request.expected_token = "USDC"
        pending_request.treasury_address = treasury
        pending_request.wallet_address = normalize_address(user.wallet_address or sender)
        pending_request.wallet_verified = True

        balance = get_or_create_balance(user.id, db)
        balance.available_balance += amount
        append_ledger_entry(
            db=db,
            balance=balance,
            entry_type="deposit_confirmed",
            amount=amount,
            reference=f"deposit_tx:{tx_hash}:{log_index}",
            note="USDC treasury transfer confirmed on Base",
            metadata_json={
                "chain": "base",
                "tx_hash": tx_hash,
                "log_index": log_index,
                "confirmations": latest - block_number + 1,
            },
        )
        confirmed += 1

    db.commit()
    return {"chain": "base", "latest_block": latest, "logs_scanned": len(logs), "confirmed": confirmed, "ignored": ignored}
