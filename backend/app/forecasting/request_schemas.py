"""Validated request bodies for forecasting write endpoints."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, field_validator

from app.settings import max_user_exposure_usdc

# Beta caps aligned with frontend conviction UI and exposure settings.
MAX_TAKE_BODY_LENGTH = 280
MAX_MARKET_SLUG_LENGTH = 200
MAX_RESOLUTION_SOURCE_LENGTH = 500
MAX_POSITION_AMOUNT_USDC = max_user_exposure_usdc()


class MarketTakeIn(BaseModel):
    side: Literal["YES", "NO"]
    confidence: float = Field(ge=0, le=100)
    body: str = Field(max_length=MAX_TAKE_BODY_LENGTH)

    @field_validator("body")
    @classmethod
    def normalize_body(cls, value: str) -> str:
        trimmed = value.strip()
        if not trimmed:
            raise ValueError("Body is required")
        return trimmed


class CreatePositionIn(BaseModel):
    market_slug: str = Field(min_length=1, max_length=MAX_MARKET_SLUG_LENGTH)
    side: Literal["YES", "NO"]
    amount: float = Field(ge=1, le=MAX_POSITION_AMOUNT_USDC)


class CreateBattlePositionIn(BaseModel):
    battle_id: str = Field(min_length=3, max_length=120)
    backed_agent_slug: str = Field(min_length=1, max_length=80)
    amount: float = Field(ge=1, le=MAX_POSITION_AMOUNT_USDC)


class ResolveMarketIn(BaseModel):
    outcome: Literal["YES", "NO"]
    source: str = Field(default="oracle", max_length=MAX_RESOLUTION_SOURCE_LENGTH)
    confidence: float = Field(default=0.95, ge=0.0, le=1.0)
