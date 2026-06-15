from __future__ import annotations

import re
from datetime import datetime

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.auth.routes import router as auth_router
from app.auth.security import create_access_token, hash_password
from app.database import get_db
from app.forecasting.models import Base, Market, Position, User
from app.forecasting.routes_admin import router as admin_router
from app.forecasting.routes_notifications import router as notifications_router
from app.forecasting.routes_reputation import router as reputation_router
from app.forecasting.routes_resolution import router as resolution_router
import app.forecasting.routes_resolution as routes_resolution_module
import app.security.rate_limit as rate_limit_mod


def _build_app_and_session():
    rate_limit_mod._WINDOWS.clear()
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)

    app = FastAPI()
    app.include_router(auth_router)
    app.include_router(admin_router)
    app.include_router(resolution_router)
    app.include_router(reputation_router)
    app.include_router(notifications_router)

    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    return app, TestingSessionLocal


def _create_user(db, email: str, role: str = "user", is_active: bool = True) -> User:
    user = User(
        email=email,
        username=email.split("@")[0],
        hashed_password=hash_password("password123"),
        role=role,
        is_active=is_active,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _auth_header(user_id: int) -> dict[str, str]:
    return {"Authorization": f"Bearer {create_access_token(user_id)}"}


def _materialize_path(path: str) -> str:
    replacements = {
        "slug": "test-market",
        "request_id": "1",
        "user_id": "1",
        "email": "user@example.com",
        "candidate_id": "1",
        "source_key": "source",
        "post_id": "1",
        "interaction_id": "1",
        "cf_id": "1",
        "preset_key": "default",
    }

    def repl(match: re.Match[str]) -> str:
        raw = match.group(1)
        key = raw.split(":")[0]
        return replacements.get(key, "1")

    return re.sub(r"\{([^}]+)\}", repl, path)


def test_market_resolution_admin_can_resolve_non_admin_and_anonymous_cannot(monkeypatch):
    app, SessionLocal = _build_app_and_session()
    client = TestClient(app)
    monkeypatch.setattr(routes_resolution_module, "_market_payload", lambda db, market: {})

    with SessionLocal() as db:
        admin = _create_user(db, "admin@example.com", role="admin")
        user = _create_user(db, "user@example.com", role="user")
        db.add(
            Market(
                title="Test Market",
                category="Macro",
                status="open",
                current_yes_probability=55.0,
                created_at=datetime.utcnow(),
            )
        )
        db.commit()
        admin_id = admin.id
        user_id = user.id

    admin_response = client.post(
        "/markets/test-market/resolve",
        json={"outcome": "YES", "source": "oracle", "confidence": 0.95},
        headers=_auth_header(admin_id),
    )
    assert admin_response.status_code == 200

    user_response = client.post(
        "/markets/test-market/resolve",
        json={"outcome": "YES", "source": "oracle", "confidence": 0.95},
        headers=_auth_header(user_id),
    )
    assert user_response.status_code == 403

    anonymous_response = client.post(
        "/markets/test-market/resolve",
        json={"outcome": "YES", "source": "oracle", "confidence": 0.95},
    )
    assert anonymous_response.status_code == 401


def test_every_admin_route_requires_admin_role():
    app, SessionLocal = _build_app_and_session()
    client = TestClient(app)
    with SessionLocal() as db:
        admin = _create_user(db, "admin2@example.com", role="admin")
        user = _create_user(db, "user2@example.com", role="user")
        admin_id = admin.id
        user_id = user.id

    routes = [r for r in app.routes if getattr(r, "path", "").startswith("/admin/")]
    assert routes, "Expected admin routes to be mounted for security coverage."

    for route in routes:
        for method in sorted(m for m in route.methods if m in {"GET", "POST", "PUT", "PATCH", "DELETE"}):
            path = _materialize_path(route.path)
            kwargs = {}
            if method in {"POST", "PUT", "PATCH"}:
                kwargs["json"] = {}

            unauth = client.request(method, path, **kwargs)
            assert unauth.status_code == 401, f"{method} {path} should require auth"

            non_admin = client.request(method, path, headers=_auth_header(user_id), **kwargs)
            assert non_admin.status_code == 403, f"{method} {path} should require admin role"

            admin_res = client.request(method, path, headers=_auth_header(admin_id), **kwargs)
            assert admin_res.status_code != 401, f"{method} {path} should authenticate admin"
            assert admin_res.status_code != 403, f"{method} {path} should authorize admin"


def test_reputation_recalculate_requires_admin_and_is_rate_limited():
    app, SessionLocal = _build_app_and_session()
    client = TestClient(app)
    with SessionLocal() as db:
        admin = _create_user(db, "admin3@example.com", role="admin")
        user = _create_user(db, "user3@example.com", role="user")
        admin_id = admin.id
        user_id = user.id

    anon = client.post("/reputation/recalculate")
    assert anon.status_code == 401

    forbidden = client.post("/reputation/recalculate", headers=_auth_header(user_id))
    assert forbidden.status_code == 403

    allowed = client.post("/reputation/recalculate", headers=_auth_header(admin_id))
    assert allowed.status_code == 200

    responses = [
        client.post("/reputation/recalculate", headers=_auth_header(admin_id)).status_code
        for _ in range(12)
    ]
    assert 429 in responses


def test_auth_login_rate_limited():
    app, SessionLocal = _build_app_and_session()
    client = TestClient(app)
    with SessionLocal() as db:
        _create_user(db, "login@example.com", role="user")

    statuses = []
    for _ in range(6):
        res = client.post(
            "/auth/login",
            json={"email": "login@example.com", "password": "wrong-password"},
        )
        statuses.append(res.status_code)
    assert 429 in statuses


def test_notifications_are_isolated_between_public_and_personal():
    app, SessionLocal = _build_app_and_session()
    client = TestClient(app)
    with SessionLocal() as db:
        user_a = _create_user(db, "usera@example.com")
        user_b = _create_user(db, "userb@example.com")
        user_a_id = user_a.id
        market_a = Market(
            title="User A Market",
            category="Macro",
            status="open",
            current_yes_probability=51.0,
            created_at=datetime.utcnow(),
        )
        market_b = Market(
            title="User B Market",
            category="Macro",
            status="open",
            current_yes_probability=49.0,
            created_at=datetime.utcnow(),
        )
        db.add(market_a)
        db.add(market_b)
        db.flush()
        db.add(Position(user_id=user_a.id, market_id=market_a.id, side="YES", amount=10))
        db.add(Position(user_id=user_b.id, market_id=market_b.id, side="NO", amount=20))
        db.commit()

    personal_unauth = client.get("/notifications/personal")
    assert personal_unauth.status_code == 401

    personal = client.get("/notifications/personal", headers=_auth_header(user_a_id))
    assert personal.status_code == 200
    payload = personal.json()
    titles = [n.get("title", "") for n in payload if n.get("type") == "position_update"]
    assert any("User A Market" in t for t in titles)
    assert all("User B Market" not in t for t in titles)

    public_res = client.get("/notifications")
    assert public_res.status_code == 200
    public_types = {n.get("type") for n in public_res.json()}
    assert "position_update" not in public_types
