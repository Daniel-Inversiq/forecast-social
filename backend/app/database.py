"""Database engine and session — lazy init (no connect at import time)."""

from __future__ import annotations

import os
from typing import Any

SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./forecast_social.db")

_engine: Any = None
_sessionmaker: Any = None
_Base: Any = None


def _connect_args() -> dict:
    args: dict = {}
    if SQLALCHEMY_DATABASE_URL.startswith("sqlite"):
        args["check_same_thread"] = False
        args["timeout"] = float(os.getenv("SQLITE_BUSY_TIMEOUT", "30"))
    return args


def get_engine():
    global _engine
    if _engine is None:
        from sqlalchemy import create_engine

        _engine = create_engine(
            SQLALCHEMY_DATABASE_URL,
            connect_args=_connect_args(),
            pool_pre_ping=True,
        )
    return _engine


def _get_sessionmaker():
    global _sessionmaker
    if _sessionmaker is None:
        from sqlalchemy.orm import sessionmaker

        _sessionmaker = sessionmaker(autocommit=False, autoflush=False, bind=get_engine())
    return _sessionmaker


def SessionLocal():
    return _get_sessionmaker()()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def __getattr__(name: str) -> Any:
    if name == "engine":
        return get_engine()
    if name == "Base":
        global _Base
        if _Base is None:
            from sqlalchemy.orm import declarative_base

            _Base = declarative_base()
        return _Base
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
