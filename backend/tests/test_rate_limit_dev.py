from __future__ import annotations

import os

import pytest
from fastapi import Request
from starlette.datastructures import Headers

import app.security.rate_limit as rate_limit_mod
from app.security.rate_limit import (
    check_global_rate_limit,
    cors_headers_for_request,
    is_dev_relaxed_read_path,
    rate_limit_exceeded_response,
    should_bypass_global_rate_limit,
)


def _request(
    path: str = "/feed",
    method: str = "GET",
    client_host: str = "127.0.0.1",
    origin: str | None = None,
) -> Request:
    headers = []
    if origin:
        headers.append((b"origin", origin.encode()))
    scope = {
        "type": "http",
        "http_version": "1.1",
        "method": method,
        "path": path,
        "headers": headers,
        "client": (client_host, 12345),
    }
    return Request(scope)


@pytest.fixture(autouse=True)
def _clear_windows():
    rate_limit_mod._WINDOWS.clear()
    yield
    rate_limit_mod._WINDOWS.clear()


def test_dev_relaxed_read_paths():
    assert is_dev_relaxed_read_path("/feed", "GET")
    assert is_dev_relaxed_read_path("/api/feed/generated", "GET")
    assert not is_dev_relaxed_read_path("/auth/login", "POST")


def test_localhost_feed_bypass_in_development(monkeypatch):
    monkeypatch.setenv("APP_ENV", "development")
    monkeypatch.setenv("ENV", "development")
    req = _request("/feed", origin="http://localhost:3000")
    assert should_bypass_global_rate_limit(req, "/feed", "GET")


def test_production_feed_not_bypassed(monkeypatch):
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("ENV", "production")
    req = _request("/feed")
    assert not should_bypass_global_rate_limit(req, "/feed", "GET")


def test_global_limit_still_applies_in_production(monkeypatch):
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("ENV", "production")
    req = _request("/feed")
    for _ in range(120):
        assert check_global_rate_limit(
            req,
            path="/feed",
            method="GET",
            limit=120,
            window_seconds=60,
            scope="global-default",
        )
    assert not check_global_rate_limit(
        req,
        path="/feed",
        method="GET",
        limit=120,
        window_seconds=60,
        scope="global-default",
    )


def test_rate_limit_response_includes_cors_for_allowed_origin(monkeypatch):
    monkeypatch.setenv("FRONTEND_URL", "http://localhost:3000")
    req = _request(origin="http://localhost:3000")
    response = rate_limit_exceeded_response(req)
    assert response.status_code == 429
    assert response.headers.get("access-control-allow-origin") == "http://localhost:3000"


def test_localhost_relaxed_default_limit_in_development(monkeypatch):
    monkeypatch.setenv("APP_ENV", "development")
    monkeypatch.setenv("ENV", "development")
    req = _request("/markets", client_host="127.0.0.1")
    for _ in range(2000):
        assert check_global_rate_limit(
            req,
            path="/markets",
            method="GET",
            limit=120,
            window_seconds=60,
            scope="global-default",
        )
    assert not check_global_rate_limit(
        req,
        path="/markets",
        method="GET",
        limit=120,
        window_seconds=60,
        scope="global-default",
    )
