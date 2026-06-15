import os

STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY", "")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET", "")
STRIPE_INTELLIGENCE_PRICE_ID = os.getenv("STRIPE_INTELLIGENCE_PRICE_ID", "")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000").rstrip("/")


def stripe_checkout_configured() -> bool:
    return bool(STRIPE_SECRET_KEY and STRIPE_INTELLIGENCE_PRICE_ID)


def stripe_webhook_configured() -> bool:
    return bool(STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET)
