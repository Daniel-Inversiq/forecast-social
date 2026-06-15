from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user
from app.auth.schemas import AuthResponse, LoginIn, RegisterIn, UserOut
from app.auth.security import create_access_token, hash_password, verify_password
from app.database import get_db
from app.forecasting.models import User, UserProfile
from app.security.rate_limit import limit_requests
from app.wallet.service import wallet_identity

router = APIRouter(prefix="/auth", tags=["auth"])


def _user_out(user: User) -> UserOut:
    wallet = wallet_identity(user)
    return UserOut(
        id=user.id,
        email=user.email,
        username=user.username,
        bio=user.bio,
        avatar_color=user.avatar_color,
        reputation_score=user.reputation_score,
        onboarding_completed=user.onboarding_completed,
        intelligence_tier=user.intelligence_tier or "free",
        intelligence_subscription_status=user.intelligence_subscription_status,
        intelligence_current_period_end=user.intelligence_current_period_end.isoformat()
        if user.intelligence_current_period_end
        else None,
        has_billing_customer=bool(user.intelligence_customer_ref),
        wallet_address=wallet.wallet_address,
        wallet_address_short=wallet.wallet_address_short,
        wallet_chain=wallet.wallet_chain,
        wallet_chain_label=wallet.wallet_chain_label,
        ens_name=wallet.ens_name,
        wallet_verified=wallet.wallet_verified,
        wallet_connected_at=wallet.wallet_connected_at,
        created_at=user.created_at.isoformat() if user.created_at else datetime.utcnow().isoformat(),
    )


def _auth_response(user: User) -> AuthResponse:
    return AuthResponse(
        access_token=create_access_token(user.id),
        user=_user_out(user),
    )


@router.post("/register", response_model=AuthResponse)
def register(
    body: RegisterIn,
    _: None = Depends(limit_requests(limit=5, window_seconds=60, scope="signup")),
    db: Session = Depends(get_db),
):
    email = body.email.strip().lower()
    username = body.username.strip().lower()

    if db.query(User).filter(User.email == email).first():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")
    if db.query(User).filter(User.username == username).first():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Username already taken")

    user = User(
        email=email,
        username=username,
        hashed_password=hash_password(body.password),
        avatar_color="#7c3aed",
    )
    db.add(user)
    db.flush()

    profile = UserProfile(user_id=user.id, selected_interests=[])
    db.add(profile)
    db.commit()
    db.refresh(user)

    return _auth_response(user)


@router.post("/login", response_model=AuthResponse)
def login(
    body: LoginIn,
    _: None = Depends(limit_requests(limit=5, window_seconds=60, scope="login")),
    db: Session = Depends(get_db),
):
    email = body.email.strip().lower()
    user = db.query(User).filter(User.email == email).first()
    if not user or not verify_password(body.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
    return _auth_response(user)


@router.get("/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_user)):
    return _user_out(current_user)
