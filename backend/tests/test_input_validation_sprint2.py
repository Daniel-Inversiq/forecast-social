from __future__ import annotations

from datetime import datetime

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.auth.security import create_access_token, hash_password
from app.database import get_db
from app.forecasting.models import Base, ConvictionBalance, Market, User
from app.forecasting.request_schemas import (
    MAX_RESOLUTION_SOURCE_LENGTH,
    MAX_TAKE_BODY_LENGTH,
)
from app.forecasting.routes_markets import router as markets_router
from app.forecasting.routes_resolution import router as resolution_router
import app.forecasting.routes_resolution as routes_resolution_module
from app.forecasting.routes_takes import router as takes_router
import app.security.rate_limit as rate_limit_mod


def _build_client():
    rate_limit_mod._WINDOWS.clear()
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)

    app = FastAPI()
    app.include_router(takes_router)
    app.include_router(markets_router)
    app.include_router(resolution_router)

    def override_get_db():
        db = SessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    return TestClient(app), SessionLocal


def _auth_header(user_id: int) -> dict[str, str]:
    return {"Authorization": f"Bearer {create_access_token(user_id)}"}


def _seed_market_and_user(SessionLocal, *, role: str = "user", balance: float = 0.0):
    with SessionLocal() as db:
        user = User(
            email=f"{role}@example.com",
            username=role,
            hashed_password=hash_password("password123"),
            role=role,
        )
        db.add(user)
        db.flush()
        market = Market(
            title="Test Market",
            category="Macro",
            status="open",
            current_yes_probability=55.0,
            created_at=datetime.utcnow(),
        )
        db.add(market)
        if balance > 0:
            db.add(
                ConvictionBalance(
                    user_id=user.id,
                    currency="USDC",
                    available_balance=balance,
                    locked_balance=0,
                    total_exposure=0,
                    user_exposure_cap=100,
                )
            )
        db.commit()
        return user.id, "test-market"


def _assert_422(response):
    assert response.status_code == 422
    body = response.json()
    assert "detail" in body
    assert isinstance(body["detail"], list)


class TestMarketTakeValidation:
    def test_rejects_empty_body(self):
        client, SessionLocal = _build_client()
        user_id, slug = _seed_market_and_user(SessionLocal)
        res = client.post(
            f"/markets/{slug}/takes",
            headers=_auth_header(user_id),
            json={"side": "YES", "confidence": 70, "body": "   "},
        )
        _assert_422(res)

    def test_rejects_oversized_body(self):
        client, SessionLocal = _build_client()
        user_id, slug = _seed_market_and_user(SessionLocal)
        res = client.post(
            f"/markets/{slug}/takes",
            headers=_auth_header(user_id),
            json={
                "side": "YES",
                "confidence": 70,
                "body": "x" * (MAX_TAKE_BODY_LENGTH + 1),
            },
        )
        _assert_422(res)

    def test_rejects_invalid_confidence(self):
        client, SessionLocal = _build_client()
        user_id, slug = _seed_market_and_user(SessionLocal)
        for confidence in (-1, 101):
            res = client.post(
                f"/markets/{slug}/takes",
                headers=_auth_header(user_id),
                json={"side": "YES", "confidence": confidence, "body": "Valid take body"},
            )
            _assert_422(res)

    def test_accepts_valid_take(self):
        client, SessionLocal = _build_client()
        user_id, slug = _seed_market_and_user(SessionLocal)
        res = client.post(
            f"/markets/{slug}/takes",
            headers=_auth_header(user_id),
            json={"side": "NO", "confidence": 80, "body": "  Conviction on record.  "},
        )
        assert res.status_code == 200
        data = res.json()
        assert data["body"] == "Conviction on record."
        assert data["confidence"] == 80


class TestCreatePositionValidation:
    def test_rejects_zero_amount(self):
        client, SessionLocal = _build_client()
        user_id, slug = _seed_market_and_user(SessionLocal, balance=50)
        res = client.post(
            "/positions",
            headers=_auth_header(user_id),
            json={"market_slug": slug, "side": "YES", "amount": 0},
        )
        _assert_422(res)

    def test_rejects_oversized_amount(self):
        client, SessionLocal = _build_client()
        user_id, slug = _seed_market_and_user(SessionLocal, balance=50)
        res = client.post(
            "/positions",
            headers=_auth_header(user_id),
            json={"market_slug": slug, "side": "YES", "amount": 500},
        )
        _assert_422(res)

    def test_rejects_empty_market_slug(self):
        client, SessionLocal = _build_client()
        user_id, _slug = _seed_market_and_user(SessionLocal, balance=50)
        res = client.post(
            "/positions",
            headers=_auth_header(user_id),
            json={"market_slug": "", "side": "YES", "amount": 5},
        )
        _assert_422(res)

    def test_accepts_valid_position_when_funded(self):
        client, SessionLocal = _build_client()
        user_id, slug = _seed_market_and_user(SessionLocal, balance=50)
        res = client.post(
            "/positions",
            headers=_auth_header(user_id),
            json={"market_slug": slug, "side": "YES", "amount": 5},
        )
        assert res.status_code == 200
        assert res.json()["amount"] == 5


class TestResolveMarketValidation:
    def test_rejects_oversized_source(self):
        client, SessionLocal = _build_client()
        _user_id, slug = _seed_market_and_user(SessionLocal, role="admin")
        with SessionLocal() as db:
            admin = db.query(User).filter(User.role == "admin").first()
            admin_id = admin.id

        res = client.post(
            f"/markets/{slug}/resolve",
            headers=_auth_header(admin_id),
            json={
                "outcome": "YES",
                "source": "s" * (MAX_RESOLUTION_SOURCE_LENGTH + 1),
            },
        )
        _assert_422(res)

    def test_rejects_invalid_resolution_confidence(self):
        client, SessionLocal = _build_client()
        _user_id, slug = _seed_market_and_user(SessionLocal, role="admin")
        with SessionLocal() as db:
            admin = db.query(User).filter(User.role == "admin").first()
            admin_id = admin.id

        res = client.post(
            f"/markets/{slug}/resolve",
            headers=_auth_header(admin_id),
            json={"outcome": "YES", "confidence": 1.5},
        )
        _assert_422(res)

    def test_accepts_minimal_resolve_payload(self, monkeypatch):
        client, SessionLocal = _build_client()
        monkeypatch.setattr(routes_resolution_module, "_market_payload", lambda db, market: {})
        _user_id, slug = _seed_market_and_user(SessionLocal, role="admin")
        with SessionLocal() as db:
            admin = db.query(User).filter(User.role == "admin").first()
            admin_id = admin.id

        res = client.post(
            f"/markets/{slug}/resolve",
            headers=_auth_header(admin_id),
            json={"outcome": "NO"},
        )
        assert res.status_code == 200
        assert res.json()["success"] is True
