"""Sentry initialization and helpers for the FastAPI API."""

from __future__ import annotations

import logging
import os
from typing import Any

import sentry_sdk
from fastapi import Request
from fastapi.exceptions import RequestValidationError
from pydantic import ValidationError
from sentry_sdk.integrations.asyncio import AsyncioIntegration
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.starlette import StarletteIntegration
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.auth.security import decode_access_token
from app.settings import app_env, is_dev_environment, sentry_dsn, sentry_enabled, sentry_traces_sample_rate

logger = logging.getLogger(__name__)
_initialized = False


def _user_id_from_request(request: Request) -> int | None:
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        return None
    return decode_access_token(auth.removeprefix("Bearer ").strip())


def _apply_request_scope(request: Request) -> None:
    scope = sentry_sdk.get_current_scope()
    scope.set_tag("route", request.url.path)
    scope.set_tag("environment", app_env())
    scope.set_tag("http.method", request.method)
    user_id = _user_id_from_request(request)
    if user_id is not None:
        scope.set_user({"id": str(user_id)})


def before_send(event: dict[str, Any], hint: dict[str, Any]) -> dict[str, Any] | None:
    """Drop expected client/API noise (404, validation)."""
    exc_info = hint.get("exc_info")
    if exc_info:
        exc_type, exc_value, _tb = exc_info
        if exc_type and issubclass(exc_type, (RequestValidationError, ValidationError)):
            return None
        status_code = getattr(exc_value, "status_code", None)
        if status_code in (404, 422):
            return None
        if isinstance(exc_value, StarletteHTTPException) and exc_value.status_code in (404, 422):
            return None

    request_data = event.get("request") or {}
    if request_data.get("url", "").endswith("/health"):
        return None

    return event


def init_sentry() -> bool:
    """Initialize Sentry once per process. Returns True when active."""
    global _initialized
    if _initialized:
        return sentry_enabled()
    _initialized = True

    if not sentry_enabled():
        logger.info("Sentry disabled (no DSN or local development default).")
        return False

    dsn = sentry_dsn()
    sentry_sdk.init(
        dsn=dsn,
        environment=app_env(),
        integrations=[
            FastApiIntegration(),
            StarletteIntegration(),
            AsyncioIntegration(),
        ],
        traces_sample_rate=sentry_traces_sample_rate(),
        send_default_pii=False,
        before_send=before_send,
        ignore_errors=[RequestValidationError, ValidationError],
    )
    logger.info("Sentry initialized for environment=%s", app_env())
    return True


async def sentry_request_middleware(request: Request, call_next):
    if not sentry_enabled():
        return await call_next(request)

    _apply_request_scope(request)
    try:
        return await call_next(request)
    except Exception:
        sentry_sdk.capture_exception()
        raise


def capture_background_exception(exc: BaseException, *, job: str) -> None:
    if not sentry_enabled():
        return
    with sentry_sdk.push_scope() as scope:
        scope.set_tag("job", job)
        scope.set_tag("environment", app_env())
        scope.set_tag("background", "true")
        sentry_sdk.capture_exception(exc)


def send_test_event() -> str:
    """Send a test event when Sentry is enabled (for smoke verification)."""
    if not sentry_enabled():
        return "disabled"
    if not _initialized:
        init_sentry()
    event_id = sentry_sdk.capture_message("SCRY Sentry backend test event", level="info")
    return event_id or "sent"


def sentry_debug_routes_enabled() -> bool:
    if is_dev_environment():
        return os.getenv("SENTRY_DEBUG_ROUTES", "").lower() in ("1", "true", "yes")
    return sentry_enabled() and os.getenv("SENTRY_DEBUG_ROUTES", "").lower() in ("1", "true", "yes")
