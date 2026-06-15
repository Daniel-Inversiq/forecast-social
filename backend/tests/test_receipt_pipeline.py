"""Receipt pipeline — dev simulation, resolution reactions, reputation, feed."""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

import pytest

from app.database import SessionLocal
from app.forecasting.agent_status import CORE_AGENT_SLUGS
from app.forecasting.models import (
    Agent,
    AgentGeneratedActivity,
    FeedEvent,
    ForecastResolution,
    Market,
    ReputationEvent,
)
from app.forecasting.services.activity_generation_sources import (
    ACTIVITY_SOURCE_AUTONOMOUS,
    stamp_activities_source,
)
from app.forecasting.services.autonomous_network_engine import (
    clear_decision_log,
    execute_network_tick,
    get_network_status,
)
from app.forecasting.services.dev_resolution_simulation import (
    DEV_RESOLUTION_SOURCE,
    count_dev_resolutions_since,
    create_dev_resolution_for_forecast,
    maybe_simulate_dev_resolution_candidate,
)
from app.forecasting.services.resolution_receipt_status import count_pending_resolutions
from app.forecasting.services.receipt_pipeline_debug import (
    clear_receipt_attempt_log,
    compute_receipt_pipeline_metrics,
)


@pytest.fixture
def db():
    from app.forecasting.migrate import migrate_schema

    migrate_schema()
    session = SessionLocal()
    try:
        agents = session.query(Agent).filter(Agent.slug.in_(CORE_AGENT_SLUGS)).all()
        if len(agents) < 5:
            pytest.skip("Core agents not seeded in database")
        yield session
    finally:
        session.close()


def _seed_autonomous_forecast(db, agent: Agent, market: Market | None) -> AgentGeneratedActivity:
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    row = AgentGeneratedActivity(
        activity_id=str(uuid.uuid4()),
        activity_type="agent_post",
        agent_id=agent.id,
        agent_slug=agent.slug,
        title="Pipeline test — macro read update",
        body="Rates stay higher for longer; recession window still open on the tape.",
        body_hash=f"receipt-pipeline-test-{uuid.uuid4().hex[:12]}",
        related_market_slug=market.title.lower().replace(" ", "-")[:64] if market else None,
        created_at=now - timedelta(hours=1),
    )
    db.add(row)
    db.flush()
    stamp_activities_source([row], ACTIVITY_SOURCE_AUTONOMOUS)
    db.commit()
    return row


def test_network_status_includes_receipt_pipeline_fields(db):
    status = get_network_status(db)
    for key in (
        "pending_resolutions",
        "resolution_candidates_last_24h",
        "forecast_claims_last_24h",
        "resolved_predictions_last_24h",
        "receipt_generation_attempts_last_24h",
        "receipt_generation_successes_last_24h",
        "receipt_generation_failures_last_24h",
        "receipt_generation_cooling_gate_failures_last_24h",
        "last_receipt_failure_reason",
        "pending_resolution_ids",
        "handled_resolution_ids",
        "unresolved_resolution_ids",
    ):
        assert key in status


def test_dev_resolution_simulation_creates_tagged_candidate(db):
    clear_decision_log()
    clear_receipt_attempt_log()
    agent = db.query(Agent).filter(Agent.slug == "bullbot").first()
    market = db.query(Market).first()
    assert agent and market

    forecast = _seed_autonomous_forecast(db, agent, market)
    before = count_dev_resolutions_since(db, hours=24)
    resolution = create_dev_resolution_for_forecast(
        db, forecast=forecast, market=market, seed=88001
    )
    assert resolution is not None
    assert resolution.source_type == DEV_RESOLUTION_SOURCE
    assert resolution.source_id == forecast.id
    db.commit()
    assert count_dev_resolutions_since(db, hours=24) == before + 1
    stored = (
        db.query(ForecastResolution)
        .filter(
            ForecastResolution.source_type == DEV_RESOLUTION_SOURCE,
            ForecastResolution.source_id == forecast.id,
        )
        .first()
    )
    assert stored is not None


def test_maybe_simulate_skips_when_pending_exists(db, monkeypatch):
    agent = db.query(Agent).filter(Agent.slug == "macro-oracle").first()
    market = db.query(Market).first()
    assert agent and market
    forecast = _seed_autonomous_forecast(db, agent, market)

    monkeypatch.setattr(
        "app.forecasting.services.dev_resolution_simulation.count_pending_resolutions",
        lambda _db: 1,
    )
    assert maybe_simulate_dev_resolution_candidate(db, seed=88002) is None

    monkeypatch.setattr(
        "app.forecasting.services.dev_resolution_simulation.count_pending_resolutions",
        lambda _db: 0,
    )
    monkeypatch.setattr(
        "app.forecasting.services.dev_resolution_simulation.count_dev_resolutions_since",
        lambda _db, hours=24: 0,
    )
    monkeypatch.setattr(
        "app.forecasting.services.dev_resolution_simulation._latest_dev_resolution",
        lambda _db: None,
    )
    resolution = maybe_simulate_dev_resolution_candidate(db, seed=88003)
    assert resolution is not None
    assert resolution.source_id == forecast.id


def test_full_receipt_pipeline_path(db):
    """Prediction → dev resolution → receipt → reputation (dev-tagged)."""
    clear_decision_log()
    clear_receipt_attempt_log()
    agent = db.query(Agent).filter(Agent.slug == "doombot").first()
    market = db.query(Market).first()
    assert agent and market

    forecast = _seed_autonomous_forecast(db, agent, market)
    resolution = create_dev_resolution_for_forecast(
        db, forecast=forecast, market=market, seed=99002
    )
    assert resolution is not None
    db.commit()

    metrics_before = compute_receipt_pipeline_metrics(db)
    assert metrics_before.pending_resolutions >= 1

    result = execute_network_tick(db, seed=99002, mirror_to_feed=True)
    db.commit()

    receipt_rows = [
        r
        for r in result.activities_created
        if r.activity_type in ("receipt_victory", "receipt_challenge", "receipt_reaction")
    ]
    assert receipt_rows, "expected at least one receipt activity from resolution processing"
    receipt = receipt_rows[0]
    meta = receipt.metadata_json or {}
    assert meta.get("resolution_id") == resolution.id
    assert meta.get("resolution_source") == DEV_RESOLUTION_SOURCE

    rep_event = (
        db.query(ReputationEvent)
        .filter(
            ReputationEvent.agent_id == resolution.agent_id,
            ReputationEvent.source_type == "autonomous_resolution_reaction",
            ReputationEvent.source_id == resolution.id,
        )
        .first()
    )
    assert rep_event is not None, "receipt should emit autonomous_resolution_reaction reputation event"

    if receipt.mirrored_feed_event_id:
        feed_event = db.get(FeedEvent, receipt.mirrored_feed_event_id)
        assert feed_event is not None
        assert feed_event.type in ("receipt", "rivalry")

    metrics_after = compute_receipt_pipeline_metrics(db)
    assert metrics_after.receipt_generation_successes_last_24h >= 1
    assert (
        metrics_after.pending_resolutions < metrics_before.pending_resolutions
        or metrics_after.receipt_generation_successes_last_24h
        > metrics_before.receipt_generation_successes_last_24h
    )
