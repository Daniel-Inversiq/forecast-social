from pydantic import BaseModel, Field


class WalletNonceIn(BaseModel):
    address: str = Field(min_length=42, max_length=42)
    chain: str = Field(min_length=2, max_length=32)


class WalletNonceOut(BaseModel):
    message: str
    nonce: str
    expires_in_seconds: int = 300


class WalletVerifyIn(BaseModel):
    address: str = Field(min_length=42, max_length=42)
    chain: str = Field(min_length=2, max_length=32)
    message: str = Field(min_length=10, max_length=512)
    signature: str = Field(min_length=10, max_length=200)
    ens_name: str | None = Field(default=None, max_length=255)


class WalletRegisterIn(WalletVerifyIn):
    username: str = Field(min_length=3, max_length=32, pattern=r"^[a-zA-Z0-9_-]+$")
    email: str | None = Field(default=None, max_length=255)


class WalletIdentityOut(BaseModel):
    wallet_address: str | None = None
    wallet_address_short: str | None = None
    wallet_chain: str | None = None
    wallet_chain_label: str | None = None
    ens_name: str | None = None
    wallet_verified: bool = False
    wallet_connected_at: str | None = None
