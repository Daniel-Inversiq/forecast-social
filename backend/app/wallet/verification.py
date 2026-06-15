import secrets
from datetime import datetime, timedelta

from eth_account import Account
from eth_account.messages import encode_defunct
from sqlalchemy.orm import Session

from app.wallet.chains import chain_label, normalize_chain
from app.forecasting.models import WalletNonce

NONCE_TTL_MINUTES = 5


def normalize_address(address: str) -> str:
    raw = address.strip()
    if not raw.startswith("0x") or len(raw) != 42:
        raise ValueError("Invalid wallet address")
    return raw.lower()


def build_sign_message(address: str, chain: str, nonce: str) -> str:
    chain_key = normalize_chain(chain)
    label = chain_label(chain_key)
    return (
        "Scry wants you to verify wallet ownership.\n\n"
        f"Address: {address}\n"
        f"Chain: {label}\n"
        f"Nonce: {nonce}\n\n"
        f"This request expires in {NONCE_TTL_MINUTES} minutes."
    )


def create_nonce(db: Session, address: str, chain: str) -> tuple[str, str]:
    normalized = normalize_address(address)
    chain_key = normalize_chain(chain)
    nonce = secrets.token_hex(16)
    message = build_sign_message(normalized, chain_key, nonce)
    expires_at = datetime.utcnow() + timedelta(minutes=NONCE_TTL_MINUTES)

    row = WalletNonce(
        wallet_address=normalized,
        chain=chain_key,
        nonce=nonce,
        message=message,
        expires_at=expires_at,
    )
    db.add(row)
    db.commit()
    return message, nonce


def verify_wallet_signature(
    db: Session,
    *,
    address: str,
    chain: str,
    message: str,
    signature: str,
) -> None:
    normalized = normalize_address(address)
    chain_key = normalize_chain(chain)

    row = (
        db.query(WalletNonce)
        .filter(
            WalletNonce.wallet_address == normalized,
            WalletNonce.chain == chain_key,
            WalletNonce.message == message,
            WalletNonce.used_at.is_(None),
        )
        .order_by(WalletNonce.created_at.desc())
        .first()
    )
    if not row:
        raise ValueError("Invalid or expired verification request")
    if row.expires_at < datetime.utcnow():
        raise ValueError("Verification request expired")
    if row.message != message:
        raise ValueError("Message mismatch")

    try:
        recovered = Account.recover_message(
            encode_defunct(text=message),
            signature=signature,
        )
    except Exception as exc:
        raise ValueError("Invalid signature") from exc

    if recovered.lower() != normalized:
        raise ValueError("Signature does not match wallet address")

    row.used_at = datetime.utcnow()
    db.commit()
