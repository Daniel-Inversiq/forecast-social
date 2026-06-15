"""Wallet service abstraction — identity today, balances and staking later."""

from datetime import datetime

from sqlalchemy.orm import Session

from app.forecasting.models import User, UserProfile
from app.wallet.chains import chain_label, normalize_chain
from app.wallet.schemas import WalletIdentityOut
from app.wallet.verification import normalize_address, verify_wallet_signature


def shorten_address(address: str) -> str:
    if len(address) < 10:
        return address
    return f"{address[:6]}…{address[-4:]}"


def wallet_identity(user: User) -> WalletIdentityOut:
    address = user.wallet_address
    chain = user.wallet_chain
    return WalletIdentityOut(
        wallet_address=address,
        wallet_address_short=shorten_address(address) if address else None,
        wallet_chain=chain,
        wallet_chain_label=chain_label(chain) if chain else None,
        ens_name=user.ens_name,
        wallet_verified=bool(user.wallet_verified),
        wallet_connected_at=user.wallet_connected_at.isoformat() if user.wallet_connected_at else None,
    )


def wallet_identity_dict(user: User) -> dict:
    return wallet_identity(user).model_dump()


def link_wallet_to_user(
    db: Session,
    user: User,
    *,
    address: str,
    chain: str,
    message: str,
    signature: str,
    ens_name: str | None = None,
) -> User:
    normalized = normalize_address(address)
    chain_key = normalize_chain(chain)

    verify_wallet_signature(
        db,
        address=normalized,
        chain=chain_key,
        message=message,
        signature=signature,
    )

    existing = db.query(User).filter(User.wallet_address == normalized).first()
    if existing and existing.id != user.id:
        raise ValueError("Wallet already linked to another account")

    if user.wallet_address and user.wallet_address != normalized:
        raise ValueError("Account already has a linked wallet")

    user.wallet_address = normalized
    user.wallet_chain = chain_key
    user.ens_name = ens_name.strip() if ens_name else None
    user.wallet_verified = True
    user.wallet_connected_at = datetime.utcnow()
    db.commit()
    db.refresh(user)
    return user


def unlink_wallet_from_user(db: Session, user: User) -> User:
    user.wallet_address = None
    user.wallet_chain = None
    user.ens_name = None
    user.wallet_verified = False
    user.wallet_connected_at = None
    db.commit()
    db.refresh(user)
    return user


def find_user_by_wallet(db: Session, address: str) -> User | None:
    normalized = normalize_address(address)
    return db.query(User).filter(User.wallet_address == normalized, User.wallet_verified.is_(True)).first()


def register_user_with_wallet(
    db: Session,
    *,
    address: str,
    chain: str,
    message: str,
    signature: str,
    username: str,
    email: str | None = None,
    ens_name: str | None = None,
) -> User:
    from app.auth.security import hash_password

    normalized = normalize_address(address)
    chain_key = normalize_chain(chain)
    username_norm = username.strip().lower()

    verify_wallet_signature(
        db,
        address=normalized,
        chain=chain_key,
        message=message,
        signature=signature,
    )

    if db.query(User).filter(User.wallet_address == normalized).first():
        raise ValueError("Wallet already registered")
    if db.query(User).filter(User.username == username_norm).first():
        raise ValueError("Username already taken")

    resolved_email = (email or f"{normalized[2:10]}@wallet.scry").strip().lower()
    if db.query(User).filter(User.email == resolved_email).first():
        raise ValueError("Email already registered")

    user = User(
        email=resolved_email,
        username=username_norm,
        hashed_password=hash_password(secrets_placeholder_password(normalized)),
        avatar_color="#7c3aed",
        wallet_address=normalized,
        wallet_chain=chain_key,
        ens_name=ens_name.strip() if ens_name else None,
        wallet_verified=True,
        wallet_connected_at=datetime.utcnow(),
    )
    db.add(user)
    db.flush()
    db.add(UserProfile(user_id=user.id, selected_interests=[]))
    db.commit()
    db.refresh(user)
    return user


def secrets_placeholder_password(address: str) -> str:
    import secrets

    return secrets.token_urlsafe(32) + address[:8]
