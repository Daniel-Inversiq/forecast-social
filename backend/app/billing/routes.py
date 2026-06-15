import logging

import stripe
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user
from app.billing import config as billing_config
from app.billing.entitlements import apply_payment_failed, apply_subscription_entitlements
from app.database import get_db
from app.forecasting.models import ProcessedStripeEvent, User
from app.security.rate_limit import limit_requests

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/billing", tags=["billing"])


class CheckoutSessionOut(BaseModel):
    checkout_url: str


class PortalSessionOut(BaseModel):
    portal_url: str


def _configure_stripe() -> None:
    stripe.api_key = billing_config.STRIPE_SECRET_KEY


def _user_by_id(db: Session, user_id: str | int | None) -> User | None:
    if user_id is None:
        return None
    try:
        uid = int(user_id)
    except (TypeError, ValueError):
        return None
    return db.query(User).filter(User.id == uid).first()


def _user_from_subscription(db: Session, subscription: dict) -> User | None:
    sub_id = subscription.get("id")
    if sub_id:
        user = db.query(User).filter(User.intelligence_subscription_ref == sub_id).first()
        if user:
            return user

    customer_id = subscription.get("customer")
    if isinstance(customer_id, str):
        user = db.query(User).filter(User.intelligence_customer_ref == customer_id).first()
        if user:
            return user

    metadata = subscription.get("metadata") or {}
    return _user_by_id(db, metadata.get("user_id"))


def _user_from_checkout_session(db: Session, session: dict) -> User | None:
    metadata = session.get("metadata") or {}
    user = _user_by_id(db, metadata.get("user_id"))
    if user:
        return user
    return _user_by_id(db, session.get("client_reference_id"))


def _retrieve_subscription(subscription_id: str) -> dict:
    _configure_stripe()
    return stripe.Subscription.retrieve(subscription_id)


@router.post("/create-checkout-session", response_model=CheckoutSessionOut)
def create_checkout_session(
    _: None = Depends(limit_requests(limit=10, window_seconds=60, scope="subscriptions-checkout")),
    current_user: User = Depends(get_current_user),
):
    if not billing_config.stripe_checkout_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Stripe billing is not configured",
        )

    _configure_stripe()
    success_url = f"{billing_config.FRONTEND_URL}/intelligence-access?checkout=success"
    cancel_url = f"{billing_config.FRONTEND_URL}/intelligence-access"

    params: dict = {
        "mode": "subscription",
        "line_items": [{"price": billing_config.STRIPE_INTELLIGENCE_PRICE_ID, "quantity": 1}],
        "success_url": success_url,
        "cancel_url": cancel_url,
        "client_reference_id": str(current_user.id),
        "metadata": {"user_id": str(current_user.id)},
        "subscription_data": {"metadata": {"user_id": str(current_user.id)}},
    }

    if current_user.intelligence_customer_ref:
        params["customer"] = current_user.intelligence_customer_ref
    else:
        params["customer_email"] = current_user.email

    try:
        session = stripe.checkout.Session.create(**params)
    except stripe.StripeError as exc:
        logger.exception("Stripe checkout session failed")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Could not create checkout session",
        ) from exc

    if not session.url:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Checkout session missing URL",
        )

    return CheckoutSessionOut(checkout_url=session.url)


@router.post("/create-portal-session", response_model=PortalSessionOut)
def create_portal_session(
    _: None = Depends(limit_requests(limit=10, window_seconds=60, scope="subscriptions-portal")),
    current_user: User = Depends(get_current_user),
):
    if not billing_config.stripe_checkout_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Stripe billing is not configured",
        )

    if not current_user.intelligence_customer_ref:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No billing customer on file. Subscribe to Intelligence Access first.",
        )

    _configure_stripe()
    return_url = f"{billing_config.FRONTEND_URL}/intelligence-access"

    try:
        session = stripe.billing_portal.Session.create(
            customer=current_user.intelligence_customer_ref,
            return_url=return_url,
        )
    except stripe.StripeError as exc:
        logger.exception("Stripe portal session failed")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Could not create billing portal session",
        ) from exc

    if not session.url:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Portal session missing URL",
        )

    return PortalSessionOut(portal_url=session.url)


@router.post("/webhook")
async def stripe_webhook(request: Request, db: Session = Depends(get_db)):
    if not billing_config.stripe_webhook_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Stripe webhook is not configured",
        )

    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")
    if not sig_header:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing Stripe signature")

    _configure_stripe()
    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, billing_config.STRIPE_WEBHOOK_SECRET
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid payload") from exc
    except stripe.SignatureVerificationError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid signature") from exc

    event_id = event["id"]
    event_type = event["type"]
    data_object = event["data"]["object"]

    if db.get(ProcessedStripeEvent, event_id) is not None:
        return {"received": True, "duplicate": True}

    try:
        if event_type == "checkout.session.completed":
            _handle_checkout_completed(db, data_object)
        elif event_type == "customer.subscription.created":
            _handle_subscription_event(db, data_object)
        elif event_type == "customer.subscription.updated":
            _handle_subscription_event(db, data_object)
        elif event_type == "customer.subscription.deleted":
            _handle_subscription_deleted(db, data_object)
        elif event_type == "invoice.payment_failed":
            _handle_payment_failed(db, data_object)
    except Exception:
        logger.exception("Stripe webhook handler failed for %s", event_type)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Webhook handler failed",
        ) from None

    db.add(ProcessedStripeEvent(event_id=event_id, event_type=event_type))
    db.commit()
    return {"received": True}


def _handle_checkout_completed(db: Session, session: dict) -> None:
    user = _user_from_checkout_session(db, session)
    if user is None:
        logger.warning("checkout.session.completed: no user for session %s", session.get("id"))
        return

    customer_id = session.get("customer")
    if isinstance(customer_id, str):
        user.intelligence_customer_ref = customer_id

    subscription_id = session.get("subscription")
    if subscription_id:
        subscription = _retrieve_subscription(subscription_id)
        apply_subscription_entitlements(user, subscription)
    db.add(user)


def _handle_subscription_event(db: Session, subscription: dict) -> None:
    user = _user_from_subscription(db, subscription)
    if user is None:
        logger.warning(
            "subscription event: no user for subscription %s", subscription.get("id")
        )
        return
    apply_subscription_entitlements(user, subscription)
    db.add(user)


def _handle_subscription_deleted(db: Session, subscription: dict) -> None:
    user = _user_from_subscription(db, subscription)
    if user is None:
        logger.warning(
            "subscription deleted: no user for subscription %s", subscription.get("id")
        )
        return
    user.intelligence_tier = "free"
    user.intelligence_subscription_status = "canceled"
    user.intelligence_current_period_end = None
    db.add(user)


def _handle_payment_failed(db: Session, invoice: dict) -> None:
    subscription_id = invoice.get("subscription")
    user: User | None = None
    if subscription_id:
        user = db.query(User).filter(User.intelligence_subscription_ref == subscription_id).first()
        if user is None:
            try:
                subscription = _retrieve_subscription(subscription_id)
                user = _user_from_subscription(db, subscription)
            except stripe.StripeError:
                pass

    customer_id = invoice.get("customer")
    if user is None and isinstance(customer_id, str):
        user = db.query(User).filter(User.intelligence_customer_ref == customer_id).first()

    if user is None:
        logger.warning("invoice.payment_failed: no user for invoice %s", invoice.get("id"))
        return

    apply_payment_failed(user)
    db.add(user)
