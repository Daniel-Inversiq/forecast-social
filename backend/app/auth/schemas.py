from pydantic import BaseModel, EmailStr, Field


class RegisterIn(BaseModel):
    email: EmailStr
    username: str = Field(min_length=3, max_length=32, pattern=r"^[a-zA-Z0-9_-]+$")
    password: str = Field(min_length=8, max_length=128)


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: int
    email: str
    username: str
    bio: str | None
    avatar_color: str | None
    reputation_score: int
    onboarding_completed: bool
    intelligence_tier: str
    intelligence_subscription_status: str | None
    intelligence_current_period_end: str | None
    has_billing_customer: bool = False
    wallet_address: str | None = None
    wallet_address_short: str | None = None
    wallet_chain: str | None = None
    wallet_chain_label: str | None = None
    ens_name: str | None = None
    wallet_verified: bool = False
    wallet_connected_at: str | None = None
    created_at: str

    model_config = {"from_attributes": True}


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut
