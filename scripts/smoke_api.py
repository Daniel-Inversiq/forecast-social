#!/usr/bin/env python3
"""Lightweight API smoke checks for private-alpha deploy verification."""

from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request

API_BASE = os.getenv("API_BASE", "http://127.0.0.1:8000").rstrip("/")
FAILURES: list[str] = []


def _request_status(
    method: str,
    path: str,
    *,
    body: dict | None = None,
    headers: dict | None = None,
) -> int:
    url = f"{API_BASE}{path}"
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("Accept", "application/json")
    if body is not None:
        req.add_header("Content-Type", "application/json")
    for k, v in (headers or {}).items():
        req.add_header(k, v)
    try:
        with urllib.request.urlopen(req, timeout=15) as res:
            return res.status
    except urllib.error.HTTPError as exc:
        return exc.code
    except urllib.error.URLError:
        return 0


def check(name: str, method: str, path: str, *, expect: int = 200, body: dict | None = None, headers: dict | None = None) -> dict | None:
    url = f"{API_BASE}{path}"
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("Accept", "application/json")
    if body is not None:
        req.add_header("Content-Type", "application/json")
    for k, v in (headers or {}).items():
        req.add_header(k, v)
    try:
        with urllib.request.urlopen(req, timeout=15) as res:
            status = res.status
            raw = res.read().decode()
    except urllib.error.HTTPError as exc:
        status = exc.code
        raw = exc.read().decode()
    except urllib.error.URLError as exc:
        FAILURES.append(f"{name}: unreachable ({exc.reason})")
        return None

    if status != expect:
        FAILURES.append(f"{name}: expected HTTP {expect}, got {status} — {raw[:200]}")
        return None

    if not raw:
        return {}
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return {}


def main() -> int:
    print(f"Smoke testing {API_BASE}")

    health = check("health", "GET", "/health")
    if health and health.get("status") != "ok":
        FAILURES.append("health: status not ok")

    check("feed", "GET", "/feed?limit=5")
    check("feed_intelligence", "GET", "/feed/intelligence")
    check("agents", "GET", "/agents")
    check("markets", "GET", "/markets")

    email = f"smoke-{os.getpid()}@example.com"
    username = f"smoke{os.getpid()}"
    password = "smoke-test-pass-12"

    reg = check(
        "auth_register",
        "POST",
        "/auth/register",
        body={"email": email, "username": username, "password": password},
    )
    token = reg.get("access_token") if reg else None
    if not token:
        FAILURES.append("auth_register: no access_token")
    else:
        auth_headers = {"Authorization": f"Bearer {token}"}
        me = check("auth_me", "GET", "/auth/me", headers=auth_headers)
        if me and me.get("email") != email:
            FAILURES.append("auth_me: email mismatch")

        billing_status = _request_status(
            "POST",
            "/billing/create-checkout-session",
            headers=auth_headers,
        )
        if billing_status not in (200, 503):
            FAILURES.append(
                f"billing_checkout: expected HTTP 200 or 503, got {billing_status}"
            )

    check("billing_webhook_unsigned", "POST", "/billing/webhook", expect=400)

    if FAILURES:
        print("FAILED:")
        for item in FAILURES:
            print(f"  - {item}")
        return 1

    print("All smoke checks passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
