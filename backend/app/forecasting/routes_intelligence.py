from datetime import datetime, timedelta

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.auth.dependencies import get_current_user_optional
from app.forecasting.models import User

router = APIRouter(prefix="/intelligence", tags=["intelligence"])


class IntelligenceBillingPreview(BaseModel):
    provider: str
    mode: str
    monthly: str
    yearly: str
    yearly_savings_note: str


class IntelligenceAccessResponse(BaseModel):
    tier: str
    has_access: bool
    entitlement_key: str
    renewal_state: str
    current_period_end: str | None
    billing_preview: IntelligenceBillingPreview
    future_surfaces: list[str]


@router.get("/access", response_model=IntelligenceAccessResponse)
def get_intelligence_access(user: User | None = Depends(get_current_user_optional)):
    tier = (user.intelligence_tier if user else None) or "free"
    has_access = tier == "intelligence_access"
    renewal_state = (user.intelligence_subscription_status if user else None) or "inactive"
    period_end = (
        user.intelligence_current_period_end.isoformat()
        if user and user.intelligence_current_period_end
        else None
    )
    if has_access and period_end is None:
        period_end = (datetime.utcnow() + timedelta(days=30)).isoformat()

    return IntelligenceAccessResponse(
        tier=tier,
        has_access=has_access,
        entitlement_key="intelligence_access.v1",
        renewal_state=renewal_state,
        current_period_end=period_end,
        billing_preview=IntelligenceBillingPreview(
            provider="stripe",
            mode="foundation_ready",
            monthly="pending",
            yearly="pending",
            yearly_savings_note="Annual intelligence billing surface prepared.",
        ),
        future_surfaces=[
            "private_desks",
            "private_forecasting_groups",
            "custom_alerts",
            "advanced_notifications",
            "ai_forecasting_assistants",
            "portfolio_intelligence",
            "live_data_ingestion",
            "api_access",
        ],
    )
