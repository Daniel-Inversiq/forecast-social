from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user
from app.auth.routes import _auth_response, _user_out
from app.auth.schemas import AuthResponse, UserOut
from app.database import get_db
from app.forecasting.models import User
from app.wallet.chains import SUPPORTED_CHAINS, is_supported_chain
from app.wallet.schemas import (
    WalletIdentityOut,
    WalletNonceIn,
    WalletNonceOut,
    WalletRegisterIn,
    WalletVerifyIn,
)
from app.wallet.service import (
    find_user_by_wallet,
    link_wallet_to_user,
    register_user_with_wallet,
    unlink_wallet_from_user,
    wallet_identity,
)
from app.wallet.verification import create_nonce, verify_wallet_signature

router = APIRouter(prefix="/wallet", tags=["wallet"])


@router.get("/chains")
def list_chains():
    """Supported chains for wallet identity (future-ready for USDC)."""
    return {
        "chains": [
            {
                "key": c.key,
                "name": c.name,
                "chain_id": c.chain_id,
                "native_symbol": c.native_symbol,
                "usdc_enabled": False,
            }
            for c in SUPPORTED_CHAINS.values()
        ]
    }


@router.post("/nonce", response_model=WalletNonceOut)
def request_nonce(body: WalletNonceIn, db: Session = Depends(get_db)):
    if not is_supported_chain(body.chain):
        raise HTTPException(status_code=400, detail="Unsupported chain")
    try:
        message, _nonce = create_nonce(db, body.address, body.chain)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return WalletNonceOut(message=message, nonce=_nonce)


@router.post("/link", response_model=UserOut)
def link_wallet(
    body: WalletVerifyIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        link_wallet_to_user(
            db,
            current_user,
            address=body.address,
            chain=body.chain,
            message=body.message,
            signature=body.signature,
            ens_name=body.ens_name,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return _user_out(current_user)


@router.post("/unlink", response_model=UserOut)
def unlink_wallet(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not current_user.wallet_address:
        raise HTTPException(status_code=400, detail="No wallet linked")
    unlink_wallet_from_user(db, current_user)
    return _user_out(current_user)


@router.get("/balance")
def wallet_balance_placeholder(current_user: User = Depends(get_current_user)):
    """Placeholder balance layer — future USDC conviction staking."""
    if not current_user.wallet_verified or not current_user.wallet_chain:
        return {
            "status": "unlinked",
            "usdc_balance": None,
            "staked_conviction": None,
            "available_for_staking": None,
        }
    return {
        "status": "placeholder",
        "chain": current_user.wallet_chain,
        "usdc_balance": None,
        "staked_conviction": None,
        "available_for_staking": None,
    }


@router.get("/me", response_model=WalletIdentityOut)
def my_wallet(current_user: User = Depends(get_current_user)):
    return wallet_identity(current_user)


auth_wallet_router = APIRouter(prefix="/auth", tags=["auth"])


@auth_wallet_router.post("/wallet-login", response_model=AuthResponse)
def wallet_login(body: WalletVerifyIn, db: Session = Depends(get_db)):
    try:
        verify_wallet_signature(
            db,
            address=body.address,
            chain=body.chain,
            message=body.message,
            signature=body.signature,
        )
    except ValueError as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc

    user = find_user_by_wallet(db, body.address)
    if not user:
        raise HTTPException(status_code=404, detail="Wallet not linked to an account")

    if body.ens_name and body.ens_name != user.ens_name:
        user.ens_name = body.ens_name.strip()
        db.commit()
        db.refresh(user)

    return _auth_response(user)


@auth_wallet_router.post("/wallet-register", response_model=AuthResponse)
def wallet_register(body: WalletRegisterIn, db: Session = Depends(get_db)):
    try:
        user = register_user_with_wallet(
            db,
            address=body.address,
            chain=body.chain,
            message=body.message,
            signature=body.signature,
            username=body.username,
            email=body.email,
            ens_name=body.ens_name,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return _auth_response(user)
