from __future__ import annotations

from fastapi import HTTPException
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.observability.sentry import before_send


def test_before_send_drops_validation_errors():
    exc = RequestValidationError(
        errors=[{"loc": ("body", "field"), "msg": "required", "type": "missing"}]
    )
    result = before_send({"request": {}}, {"exc_info": (type(exc), exc, exc.__traceback__)})
    assert result is None


def test_before_send_drops_404_http_exception():
    exc = HTTPException(status_code=404, detail="Market not found")
    result = before_send({"request": {}}, {"exc_info": (type(exc), exc, exc.__traceback__)})
    assert result is None


def test_before_send_drops_starlette_422():
    exc = StarletteHTTPException(status_code=422, detail="Invalid")
    result = before_send({"request": {}}, {"exc_info": (type(exc), exc, exc.__traceback__)})
    assert result is None


def test_before_send_passes_unexpected_errors():
    exc = RuntimeError("boom")
    result = before_send({"request": {"url": "http://test/markets"}}, {"exc_info": (type(exc), exc, exc.__traceback__)})
    assert result is not None


def test_before_send_drops_health_checks():
    exc = RuntimeError("db down")
    result = before_send(
        {"request": {"url": "http://test/health"}},
        {"exc_info": (type(exc), exc, exc.__traceback__)},
    )
    assert result is None
