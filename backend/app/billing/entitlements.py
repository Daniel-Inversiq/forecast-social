from datetime import datetime
from typing import Any

from app.forecasting.models import User

ACCESS_STATUSES = frozenset({"active", "trialing"})


def _period_end_from_subscription(subscription: dict[str, Any]) -> datetime | None:
    period_end = subscription.get("current_period_end")
    if period_end is None:
        return None
    return datetime.utcfromtimestamp(int(period_end))


def _customer_id(subscription: dict[str, Any]) -> str | None:
    customer = subscription.get("customer")
    if customer is None:
        return None
    if isinstance(customer, str):
        return customer
    return customer.get("id")


def apply_subscription_entitlements(user: User, subscription: dict[str, Any]) -> None:
    status = subscription.get("status") or "inactive"
    customer_id = _customer_id(subscription)
    sub_id = subscription.get("id")

    if customer_id:
        user.intelligence_customer_ref = customer_id
    if sub_id:
        user.intelligence_subscription_ref = sub_id

    user.intelligence_current_period_end = _period_end_from_subscription(subscription)

    if status in ACCESS_STATUSES:
        user.intelligence_tier = "intelligence_access"
        user.intelligence_subscription_status = status
        return

    user.intelligence_tier = "free"
    if status == "canceled":
        user.intelligence_subscription_status = "canceled"
    elif status in ("unpaid", "past_due"):
        user.intelligence_subscription_status = "unpaid"
    else:
        user.intelligence_subscription_status = "inactive"


def apply_payment_failed(user: User) -> None:
    user.intelligence_tier = "free"
    user.intelligence_subscription_status = "unpaid"
    user.intelligence_current_period_end = None
