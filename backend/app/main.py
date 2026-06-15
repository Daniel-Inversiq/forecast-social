import app._import_bootstrap  # noqa: F401 — must be first

import asyncio
import logging
import os
import random
import time
from contextlib import asynccontextmanager

print("[import] stdlib", flush=True)

from fastapi import Depends, FastAPI, Request

print("[import] fastapi", flush=True)

from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

print("[import] fastapi.middleware", flush=True)

_startup_log = logging.getLogger("app.startup")
if not logging.getLogger().handlers:
    logging.basicConfig(level=logging.INFO, format="%(message)s")


def _log_import(label: str, started: float) -> None:
    elapsed = time.perf_counter() - started
    print(f"[import] {label} ({elapsed:.2f}s)", flush=True)


_t0 = time.perf_counter()
from app.database import get_db

_log_import("app.database", _t0)

_t0 = time.perf_counter()
from app.forecasting import models  # noqa: F401

_log_import("app.forecasting.models", _t0)

_t0 = time.perf_counter()
from app.forecasting.routes_agents import router as agents_router

_log_import("routes_agents", _t0)

_t0 = time.perf_counter()
from app.forecasting.routes_feed import router as feed_router

_log_import("routes_feed (feed_intelligence, feed_stream)", _t0)

_t0 = time.perf_counter()
from app.forecasting.routes_agent_activity import router as agent_activity_router

_log_import("routes_agent_activity", _t0)

_t0 = time.perf_counter()
from app.forecasting.routes_autonomous_network import router as autonomous_network_router

_log_import("routes_autonomous_network (autonomous_network_engine)", _t0)

_t0 = time.perf_counter()
from app.forecasting.routes_feed_interactions import router as feed_interactions_router

_log_import("routes_feed_interactions", _t0)

_t0 = time.perf_counter()
from app.forecasting.routes_ongoing_stories import router as ongoing_stories_router

_log_import("routes_ongoing_stories", _t0)

_t0 = time.perf_counter()
from app.forecasting.routes_market_thread import router as market_thread_router

_log_import("routes_market_thread", _t0)

_t0 = time.perf_counter()
from app.forecasting.routes_markets import router as markets_router

_log_import("routes_markets", _t0)

_t0 = time.perf_counter()
from app.forecasting.routes_conviction import router as conviction_router

_log_import("routes_conviction", _t0)

_t0 = time.perf_counter()
from app.forecasting.routes_notifications import router as notifications_router

_log_import("routes_notifications", _t0)

_t0 = time.perf_counter()
from app.forecasting.routes_positions import router as positions_router

_log_import("routes_positions", _t0)

_t0 = time.perf_counter()
from app.forecasting.routes_takes import router as takes_router

_log_import("routes_takes", _t0)

_t0 = time.perf_counter()
from app.forecasting.routes_leaderboards import router as leaderboards_router

_log_import("routes_leaderboards", _t0)

_t0 = time.perf_counter()
from app.forecasting.routes_trending import router as trending_router

_log_import("routes_trending", _t0)

_t0 = time.perf_counter()
from app.forecasting.routes_receipts import router as receipts_router

_log_import("routes_receipts", _t0)

_t0 = time.perf_counter()
from app.forecasting.routes_battles import router as battles_router

_log_import("routes_battles", _t0)

_t0 = time.perf_counter()
from app.forecasting.routes_reputation import router as reputation_router

_log_import("routes_reputation", _t0)

_t0 = time.perf_counter()
from app.forecasting.routes_trust import router as trust_router

_log_import("routes_trust", _t0)

_t0 = time.perf_counter()
from app.forecasting.routes_users import router as users_router

_log_import("routes_users", _t0)

_t0 = time.perf_counter()
from app.forecasting.routes_following import router as following_router

_log_import("routes_following", _t0)

_t0 = time.perf_counter()
from app.forecasting.routes_narratives import router as narratives_router

_log_import("routes_narratives", _t0)

_t0 = time.perf_counter()
from app.forecasting.routes_activity import router as activity_router

_log_import("routes_activity", _t0)

_t0 = time.perf_counter()
from app.forecasting.routes_user_activity import router as user_activity_router

_log_import("routes_user_activity", _t0)

_t0 = time.perf_counter()
from app.forecasting.routes_onboarding import router as onboarding_router

_log_import("routes_onboarding", _t0)

_t0 = time.perf_counter()
from app.forecasting.routes_admin import router as admin_router

_log_import("routes_admin", _t0)

_t0 = time.perf_counter()
from app.forecasting.routes_resolution import router as resolution_router

_log_import("routes_resolution", _t0)

_t0 = time.perf_counter()
from app.forecasting.routes_standings import router as standings_router

_log_import("routes_standings", _t0)

_t0 = time.perf_counter()
from app.forecasting.routes_seasons import router as seasons_router

_log_import("routes_seasons", _t0)

_t0 = time.perf_counter()
from app.forecasting.routes_daily_brief import router as daily_brief_router

_log_import("routes_daily_brief", _t0)

_t0 = time.perf_counter()
from app.forecasting.routes_creator_forecasters import router as creator_forecasters_router

_log_import("routes_creator_forecasters", _t0)

_t0 = time.perf_counter()
from app.forecasting.routes_studio import router as studio_router

_log_import("routes_studio", _t0)

_t0 = time.perf_counter()
from app.forecasting.routes_forecaster_knowledge import router as forecaster_knowledge_router

_log_import("routes_forecaster_knowledge", _t0)

_t0 = time.perf_counter()
from app.forecasting.routes_agent_knowledge import router as agent_knowledge_router

_log_import("routes_agent_knowledge", _t0)

_t0 = time.perf_counter()
from app.forecasting.routes_search import router as search_router

_log_import("routes_search", _t0)

_t0 = time.perf_counter()
from app.forecasting.routes_intelligence import router as intelligence_router

_log_import("routes_intelligence", _t0)

_t0 = time.perf_counter()
from app.auth.routes import router as auth_router

_log_import("auth.routes", _t0)

_t0 = time.perf_counter()
from app.billing.routes import router as billing_router

_log_import("billing.routes", _t0)

_t0 = time.perf_counter()
from app.wallet.routes import auth_wallet_router, router as wallet_router

_log_import("wallet.routes", _t0)

_t0 = time.perf_counter()
from app.observability.sentry import (
    capture_background_exception,
    init_sentry,
    send_test_event,
    sentry_debug_routes_enabled,
    sentry_request_middleware,
)

_log_import("observability.sentry", _t0)

_t0 = time.perf_counter()
from app.settings import cors_allowed_origins, is_dev_environment, validate_settings_on_startup

_log_import("app.settings", _t0)

_t0 = time.perf_counter()
from app.security.rate_limit import check_global_rate_limit, rate_limit_exceeded_response

_log_import("security.rate_limit", _t0)

_t0 = time.perf_counter()
init_sentry()
_log_import("init_sentry", _t0)

print("[import] app.main module complete", flush=True)


def _scheduler_enabled() -> bool:
    return os.getenv("ENABLE_EVENT_SCHEDULER", "").lower() in ("1", "true", "yes")


def _autonomous_network_enabled() -> bool:
    return os.getenv("ENABLE_AUTONOMOUS_NETWORK", "").lower() in ("1", "true", "yes")


def _run_startup_step(label: str, fn, *args, **kwargs) -> None:
    started = time.perf_counter()
    _startup_log.info("[startup] %s begin", label)
    fn(*args, **kwargs)
    _startup_log.info("[startup] %s done (%.2fs)", label, time.perf_counter() - started)


def _run_data_initialization() -> None:
    """Heavy DB seed/backfill — runs off the event loop so uvicorn can bind quickly."""
    from app.database import SessionLocal
    from app.forecasting.reputation.service import ensure_reputation_initialized
    from app.forecasting.services.agent_state import ensure_agent_states
    from app.forecasting.services.autonomous_network_engine import ensure_narratives_initialized
    from app.forecasting.services.daily_brief import ensure_daily_briefs
    from app.forecasting.services.narrative_seasons import ensure_seasons_initialized

    db = SessionLocal()
    try:
        _run_startup_step("ensure_reputation_initialized", ensure_reputation_initialized, db)
        _run_startup_step("ensure_seasons_initialized", ensure_seasons_initialized, db)
        _run_startup_step("ensure_agent_states", ensure_agent_states, db)
        _run_startup_step("ensure_daily_briefs", ensure_daily_briefs, db)
        _run_startup_step("ensure_narratives_initialized", ensure_narratives_initialized, db)
    finally:
        db.close()


async def _deferred_data_initialization() -> None:
    try:
        await asyncio.to_thread(_run_data_initialization)
        _startup_log.info("[startup] deferred data initialization complete")
    except asyncio.CancelledError:
        raise
    except Exception as exc:
        capture_background_exception(exc, job="startup_data_init")


async def _event_generation_loop() -> None:
    from app.database import SessionLocal
    from app.forecasting.event_engine import generate_feed_events

    while True:
        await asyncio.sleep(random.randint(120, 300))
        db = SessionLocal()
        try:
            generate_feed_events(db, cadence="auto")
        except Exception as exc:
            capture_background_exception(exc, job="event_generation_loop")
        finally:
            db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    _run_startup_step("validate_settings_on_startup", validate_settings_on_startup)

    from app.forecasting.services.world_events import log_event_source_configuration

    _run_startup_step("log_event_source_configuration", log_event_source_configuration)

    from app.forecasting.services.creator_forecaster.knowledge import log_pdf_processing_status

    _run_startup_step("log_pdf_processing_status", log_pdf_processing_status)

    from app.forecasting.migrate import migrate_schema

    _run_startup_step("migrate_schema", migrate_schema)

    data_init_task = asyncio.create_task(_deferred_data_initialization())

    scheduler_task: asyncio.Task | None = None
    autonomous_task: asyncio.Task | None = None

    if _scheduler_enabled() and is_dev_environment():
        _startup_log.info("[startup] event scheduler enabled (dev)")
        scheduler_task = asyncio.create_task(_event_generation_loop())
    if _autonomous_network_enabled() and is_dev_environment():
        from app.forecasting.services.autonomous_network_engine import autonomous_network_loop

        _startup_log.info("[startup] autonomous network loop enabled (dev)")
        autonomous_task = asyncio.create_task(autonomous_network_loop())

    _startup_log.info("[startup] ready — accepting connections (data init continues in background)")
    yield

    data_init_task.cancel()
    try:
        await data_init_task
    except asyncio.CancelledError:
        pass

    if scheduler_task is not None:
        scheduler_task.cancel()
        try:
            await scheduler_task
        except asyncio.CancelledError:
            pass
    if autonomous_task is not None:
        autonomous_task.cancel()
        try:
            await autonomous_task
        except asyncio.CancelledError:
            pass


app = FastAPI(title="Forecast Social API", lifespan=lifespan)


app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_allowed_origins(),
    allow_methods=["GET", "POST", "PATCH", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)


@app.middleware("http")
async def sentry_context_middleware(request: Request, call_next):
    return await sentry_request_middleware(request, call_next)


@app.middleware("http")
async def global_rate_limit(request: Request, call_next):
    path = request.url.path or ""
    method = request.method.upper()
    if path == "/health":
        return await call_next(request)

    if path.startswith("/auth/login"):
        limit, window, scope = 5, 60, "global-login"
    elif path.startswith("/auth/register"):
        limit, window, scope = 5, 60, "global-signup"
    elif path.startswith("/reputation/recalculate"):
        limit, window, scope = 10, 60, "global-reputation-recalculate"
    elif path.startswith("/admin/"):
        limit, window, scope = 5, 60, "global-admin"
    elif path.startswith("/markets") or path.startswith("/positions"):
        limit, window, scope = 10, 60, "global-markets-positions"
    elif "/subscriptions" in path or path.startswith("/billing/"):
        limit, window, scope = 10, 60, "global-subscriptions"
    else:
        limit, window, scope = 120, 60, "global-default"

    if not check_global_rate_limit(
        request,
        path=path,
        method=method,
        limit=limit,
        window_seconds=window,
        scope=scope,
    ):
        return rate_limit_exceeded_response(request)

    return await call_next(request)


app.include_router(auth_router)

app.include_router(auth_wallet_router)

app.include_router(wallet_router)

app.include_router(feed_router)
app.include_router(agent_activity_router)
app.include_router(autonomous_network_router)
app.include_router(feed_interactions_router)
app.include_router(ongoing_stories_router)
app.include_router(market_thread_router)

app.include_router(agents_router)
app.include_router(studio_router)
app.include_router(creator_forecasters_router)
app.include_router(forecaster_knowledge_router)
app.include_router(agent_knowledge_router)

app.include_router(markets_router)
app.include_router(conviction_router)

app.include_router(positions_router)

app.include_router(notifications_router)

app.include_router(trending_router)

app.include_router(leaderboards_router)

app.include_router(takes_router)

app.include_router(receipts_router)

app.include_router(battles_router)

app.include_router(reputation_router)

app.include_router(trust_router)

app.include_router(users_router)

app.include_router(following_router)

app.include_router(narratives_router)

app.include_router(activity_router)
app.include_router(user_activity_router)

app.include_router(onboarding_router)

if is_dev_environment():
    app.include_router(admin_router)

app.include_router(resolution_router)

app.include_router(standings_router)

app.include_router(seasons_router)

app.include_router(daily_brief_router)

app.include_router(search_router)

app.include_router(intelligence_router)

app.include_router(billing_router)


@app.get("/health")
def health(db=Depends(get_db)):
    from sqlalchemy import text

    db.execute(text("SELECT 1"))
    return {"status": "ok"}


@app.post("/debug/sentry-test", include_in_schema=False)
def sentry_test_event():
    if not sentry_debug_routes_enabled():
        return JSONResponse(status_code=404, content={"detail": "Not found"})
    event_id = send_test_event()
    return {"ok": True, "event_id": event_id}


@app.get("/debug/sentry-throw", include_in_schema=False)
def sentry_test_throw():
    if not sentry_debug_routes_enabled():
        return JSONResponse(status_code=404, content={"detail": "Not found"})
    raise RuntimeError("SCRY Sentry backend test exception")
