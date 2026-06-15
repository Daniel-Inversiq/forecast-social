"""Dev-only synthetic resolution candidates for autonomous receipt pipeline testing.

Creates ForecastResolution rows tagged source_type=dev_resolution_simulation.
Does not alter production market truth or emit fake settlement FeedEvents.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.forecasting.agent_status import CORE_AGENT_SLUGS, query_active_agents
from app.forecasting.models import AgentGeneratedActivity, ForecastResolution, Market
from app.forecasting.services.activity_generation_sources import ACTIVITY_SOURCE_AUTONOMOUS
from app.forecasting.services.resolution_receipt_status import count_pending_resolutions
from app.forecasting.services.utils import hash_seed, title_to_slug
from app.settings import is_dev_environment

DEV_RESOLUTION_SOURCE = "dev_resolution_simulation"
MIN_DEV_RESOLUTIONS_PER_24H = 2
MAX_DEV_RESOLUTIONS_PER_24H = 5
MIN_HOURS_BETWEEN_SIMULATIONS = 4


def _utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _activity_source_expr(source: str):
    return AgentGeneratedActivity.metadata_json["source"].as_string() == source


def count_dev_resolutions_since(db: Session, *, hours: int = 24) -> int:
    cutoff = _utcnow() - timedelta(hours=hours)
    return (
        db.query(ForecastResolution)
        .filter(
            ForecastResolution.source_type == DEV_RESOLUTION_SOURCE,
            ForecastResolution.resolved_at >= cutoff,
        )
        .count()
    )


def _latest_dev_resolution(db: Session) -> ForecastResolution | None:
    return (
        db.query(ForecastResolution)
        .filter(ForecastResolution.source_type == DEV_RESOLUTION_SOURCE)
        .order_by(ForecastResolution.resolved_at.desc())
        .first()
    )


def _pick_recent_autonomous_forecast(db: Session, seed: int) -> AgentGeneratedActivity | None:
    cutoff = _utcnow() - timedelta(hours=48)
    rows = (
        db.query(AgentGeneratedActivity)
        .filter(
            AgentGeneratedActivity.created_at >= cutoff,
            AgentGeneratedActivity.activity_type.in_(("agent_post", "conviction_update")),
            AgentGeneratedActivity.agent_slug.in_(CORE_AGENT_SLUGS),
            _activity_source_expr(ACTIVITY_SOURCE_AUTONOMOUS),
        )
        .order_by(AgentGeneratedActivity.created_at.desc())
        .limit(40)
        .all()
    )
    eligible = [row for row in rows if not _already_simulated_for_activity(db, row.id)]
    if not eligible:
        return None
    # Prefer the newest autonomous forecast not yet simulated.
    return eligible[0]


def _pick_market(db: Session, activity: AgentGeneratedActivity, seed: int) -> Market | None:
    if activity.related_market_slug:
        slug = activity.related_market_slug
        for market in db.query(Market).all():
            if title_to_slug(market.title) == slug:
                return market
    markets = db.query(Market).filter(Market.status == "open").all()
    if not markets:
        markets = db.query(Market).all()
    if not markets:
        return None
    return markets[hash_seed(activity.activity_id, str(seed), "market") % len(markets)]


def _already_simulated_for_activity(db: Session, activity_pk: int) -> bool:
    return (
        db.query(ForecastResolution)
        .filter(
            ForecastResolution.source_type == DEV_RESOLUTION_SOURCE,
            ForecastResolution.source_id == activity_pk,
        )
        .first()
        is not None
    )


def create_dev_resolution_for_forecast(
    db: Session,
    *,
    forecast: AgentGeneratedActivity,
    market: Market | None,
    seed: int,
) -> ForecastResolution | None:
    """Create a dev-tagged resolution for a specific forecast (idempotent)."""
    if not is_dev_environment():
        return None
    existing = (
        db.query(ForecastResolution)
        .filter(
            ForecastResolution.source_type == DEV_RESOLUTION_SOURCE,
            ForecastResolution.source_id == forecast.id,
        )
        .first()
    )
    if existing:
        return existing

    agents = {a.slug: a for a in query_active_agents(db) if a.slug in CORE_AGENT_SLUGS}
    agent = agents.get(forecast.agent_slug)
    if not agent:
        return None

    market = market or _pick_market(db, forecast, seed)
    prob = float(market.current_yes_probability) if market else 50.0
    side_roll = hash_seed(forecast.activity_id, str(seed), "side") % 100
    side = "YES" if side_roll >= int(prob) else "NO"
    correct = hash_seed(forecast.activity_id, str(seed), "correct") % 5 != 0
    outcome_yes = (side == "YES") if correct else (side != "YES")
    days_early = 3 + (hash_seed(str(seed), forecast.activity_id) % 12)

    resolution = ForecastResolution(
        agent_id=agent.id,
        market_id=market.id if market else None,
        source_type=DEV_RESOLUTION_SOURCE,
        source_id=forecast.id,
        side=side,
        predicted_probability=prob if side == "YES" else 100.0 - prob,
        confidence=65.0 + (hash_seed(str(seed), "conf") % 20),
        outcome_yes=outcome_yes,
        correct=correct,
        days_early=days_early,
        resolved_at=_utcnow(),
    )
    db.add(resolution)
    db.flush()
    return resolution


def maybe_simulate_dev_resolution_candidate(
    db: Session,
    *,
    seed: int,
) -> ForecastResolution | None:
    """Create at most one dev-tagged ForecastResolution when the pipeline needs candidates."""
    if not is_dev_environment():
        return None

    dev_count_24h = count_dev_resolutions_since(db, hours=24)
    if dev_count_24h >= MAX_DEV_RESOLUTIONS_PER_24H:
        return None

    if count_pending_resolutions(db) > 0:
        return None

    latest = _latest_dev_resolution(db)
    if latest and dev_count_24h >= MIN_DEV_RESOLUTIONS_PER_24H:
        elapsed = _utcnow() - latest.resolved_at
        if elapsed < timedelta(hours=MIN_HOURS_BETWEEN_SIMULATIONS):
            return None

    activity = _pick_recent_autonomous_forecast(db, seed)
    if not activity:
        return None

    market = _pick_market(db, activity, seed)
    return create_dev_resolution_for_forecast(
        db, forecast=activity, market=market, seed=seed
    )
