from __future__ import annotations

import logging
import os
import threading
import time
from collections import defaultdict, deque
from urllib.parse import urlparse

from fastapi import HTTPException, Request, status
from fastapi.responses import JSONResponse

from app.settings import cors_allowed_origins, is_dev_environment

logger = logging.getLogger(__name__)

_LOCK = threading.Lock()
_WINDOWS: dict[str, deque[float]] = defaultdict(deque)

_LOCALHOST_HOSTS = frozenset({"127.0.0.1", "localhost", "::1"})

_DEV_RELAXED_READ_PATHS = frozenset(
    {
        "/feed",
        "/feed/generated",
        "/feed/intelligence",
        "/agents",
        "/following/agents",
        "/activity/pulse",
    }
)

_STRICT_GLOBAL_SCOPES = frozenset(
    {
        "global-login",
        "global-signup",
        "global-admin",
        "global-reputation-recalculate",
    }
)

_DEV_LOCALHOST_DEFAULT_LIMIT = 2000
_DEV_LOCALHOST_DEFAULT_WINDOW = 60


def is_development() -> bool:
    app_env = os.getenv("APP_ENV", "").strip().lower()
    if app_env == "development":
        return True
    return is_dev_environment()


def _normalize_path(path: str) -> str:
    normalized = (path or "/").rstrip("/") or "/"
    if normalized.startswith("/api/"):
        normalized = normalized[4:] or "/"
    elif normalized.startswith("/api"):
        normalized = normalized[4:] or "/"
    if not normalized.startswith("/"):
        normalized = f"/{normalized}"
    return normalized


def _host_from_client_key(client: str) -> str:
    if client.startswith("["):
        end = client.find("]")
        if end != -1:
            return client[1:end].lower()
    if client.count(":") > 1 and ":" in client:
        return client.rsplit(":", 1)[0].lower()
    if ":" in client:
        host, _port = client.rsplit(":", 1)
        if _port.isdigit():
            return host.lower()
    return client.lower()


def _client_key(request: Request) -> str:
    forwarded_for = request.headers.get("x-forwarded-for", "").split(",")[0].strip()
    if forwarded_for:
        return forwarded_for
    if request.client and request.client.host:
        return request.client.host
    return "unknown-client"


def is_localhost_client(request: Request) -> bool:
    client_host = _host_from_client_key(_client_key(request))
    if client_host in _LOCALHOST_HOSTS:
        return True
    origin = request.headers.get("origin", "").strip()
    if origin:
        parsed = urlparse(origin)
        if parsed.hostname and parsed.hostname.lower() in _LOCALHOST_HOSTS:
            return True
    return False


def is_dev_relaxed_read_path(path: str, method: str) -> bool:
    return method.upper() == "GET" and _normalize_path(path) in _DEV_RELAXED_READ_PATHS


def should_bypass_global_rate_limit(request: Request, path: str, method: str) -> bool:
    if not is_development() or not is_localhost_client(request):
        return False
    return is_dev_relaxed_read_path(path, method)


def dev_localhost_limit(scope: str, limit: int, window_seconds: int) -> tuple[int, int]:
    if not is_development() or scope in _STRICT_GLOBAL_SCOPES:
        return limit, window_seconds
    if scope == "global-default":
        return _DEV_LOCALHOST_DEFAULT_LIMIT, _DEV_LOCALHOST_DEFAULT_WINDOW
    return max(limit, limit * 10), window_seconds


def cors_headers_for_request(request: Request) -> dict[str, str]:
    origin = request.headers.get("origin", "").strip()
    if not origin:
        return {}
    allowed = {entry.rstrip("/") for entry in cors_allowed_origins()}
    if origin.rstrip("/") not in allowed:
        return {}
    return {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Credentials": "true",
        "Vary": "Origin",
    }


def rate_limit_exceeded_response(
    request: Request,
    *,
    detail: str = "Rate limit exceeded",
) -> JSONResponse:
    return JSONResponse(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        content={"detail": detail},
        headers=cors_headers_for_request(request),
    )


def _log_rate_limit_block(request: Request, path: str, method: str, limit: int) -> None:
    client = _client_key(request)
    logger.info(
        "[rate-limit] %s %s blocked after %d requests from %s",
        method,
        path,
        limit,
        client,
    )


def _log_rate_limit_bypass(request: Request, path: str, method: str) -> None:
    client = _client_key(request)
    logger.info("[rate-limit bypass] %s %s from %s", method, path, client)


def limit_requests(limit: int, window_seconds: int, scope: str):
    def dependency(request: Request) -> None:
        path = request.url.path or ""
        method = request.method.upper()
        if should_bypass_global_rate_limit(request, path, method):
            _log_rate_limit_bypass(request, path, method)
            return
        now = time.time()
        key = f"{scope}:{_client_key(request)}"
        cutoff = now - window_seconds
        with _LOCK:
            bucket = _WINDOWS[key]
            while bucket and bucket[0] <= cutoff:
                bucket.popleft()
            if len(bucket) >= limit:
                if is_development():
                    _log_rate_limit_block(request, path, method, limit)
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="Rate limit exceeded",
                )
            bucket.append(now)

    return dependency


def enforce_limit(
    key: str,
    limit: int,
    window_seconds: int,
    *,
    request: Request | None = None,
    path: str = "",
    method: str = "GET",
) -> bool:
    now = time.time()
    cutoff = now - window_seconds
    with _LOCK:
        bucket = _WINDOWS[key]
        while bucket and bucket[0] <= cutoff:
            bucket.popleft()
        if len(bucket) >= limit:
            if is_development() and request is not None:
                _log_rate_limit_block(request, path, method, limit)
            return False
        bucket.append(now)
        return True


def check_global_rate_limit(
    request: Request,
    *,
    path: str,
    method: str,
    limit: int,
    window_seconds: int,
    scope: str,
) -> bool:
    if should_bypass_global_rate_limit(request, path, method):
        _log_rate_limit_bypass(request, path, method)
        return True

    effective_limit, effective_window = limit, window_seconds
    if is_development() and is_localhost_client(request):
        effective_limit, effective_window = dev_localhost_limit(scope, limit, window_seconds)

    client = _client_key(request)
    key = f"{scope}:{method}:{client}"
    return enforce_limit(
        key,
        effective_limit,
        effective_window,
        request=request,
        path=path,
        method=method,
    )
