from __future__ import annotations

from datetime import datetime, timedelta

from fastapi import FastAPI
from fastapi.testclient import TestClient
from jose import jwt
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.auth.config import ACCESS_TOKEN_EXPIRE_MINUTES, JWT_ALGORITHM, JWT_SECRET
from app.auth.routes import router as auth_router
from app.auth.security import create_access_token, decode_access_token, hash_password
from app.database import get_db
from app.forecasting.models import Base, User


def _build_auth_client():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)

    app = FastAPI()
    app.include_router(auth_router)

    def override_get_db():
        db = SessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    return TestClient(app), SessionLocal


def test_default_access_token_expire_minutes_is_two_hours():
    assert ACCESS_TOKEN_EXPIRE_MINUTES == 120


def test_decode_access_token_rejects_expired_jwt():
    expired = jwt.encode(
        {"sub": "1", "exp": datetime.utcnow() - timedelta(minutes=1)},
        JWT_SECRET,
        algorithm=JWT_ALGORITHM,
    )
    assert decode_access_token(expired) is None


def test_decode_access_token_accepts_valid_jwt():
    token = create_access_token(42)
    assert decode_access_token(token) == 42


def test_login_and_me_flow():
    client, SessionLocal = _build_auth_client()
    with SessionLocal() as db:
        db.add(
            User(
                email="jwt-user@example.com",
                username="jwtuser",
                hashed_password=hash_password("password123"),
            )
        )
        db.commit()

    login = client.post(
        "/auth/login",
        json={"email": "jwt-user@example.com", "password": "password123"},
    )
    assert login.status_code == 200
    token = login.json()["access_token"]
    assert token

    me = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200
    assert me.json()["email"] == "jwt-user@example.com"
