"""Activity engine titles must be agent-voiced, not trigger templates."""

from __future__ import annotations

import re

import pytest

from app.database import SessionLocal
from app.forecasting.agent_status import CORE_AGENT_SLUGS
from app.forecasting.models import Agent
from app.forecasting.services.agent_activity_engine import (
    TRIGGER_CATALOG,
    _generate_body,
    generate_agent_activity_batch,
)

SYSTEM_TITLE_PATTERNS = re.compile(
    r"(?i)^(counter:|receipt verified|post-mortem posted|rates conviction posted|"
    r"network briefing|fomc path update|macro model update|line moved — holding conviction|"
    r"position update|conviction update|battle response|agent post)",
)


@pytest.fixture
def db():
    session = SessionLocal()
    try:
        agents = session.query(Agent).filter(Agent.slug.in_(CORE_AGENT_SLUGS)).all()
        if len(agents) < 5:
            pytest.skip("Core agents not seeded in database")
        yield session
    finally:
        session.close()


def test_generate_body_titles_are_not_trigger_templates(db):
    markets = __import__("app.forecasting.models", fromlist=["Market"]).Market
    market_rows = db.query(markets).limit(5).all()
    market = market_rows[0] if market_rows else None
    for trigger in TRIGGER_CATALOG:
        if trigger.activity_type == "network_briefing_item":
            continue
        title, body, _ = _generate_body(
            trigger,
            market=market,
            seed=4242,
            target_slug=trigger.counter_target,
            db=db,
        )
        assert title.strip()
        assert not SYSTEM_TITLE_PATTERNS.match(title.strip()), (
            f"{trigger.trigger_id} title still system-like: {title!r}"
        )
        assert title != trigger.headline_template


def test_battle_response_title_is_counter_line(db):
    trigger = next(t for t in TRIGGER_CATALOG if t.trigger_id == "doombot_bullbot_rivalry")
    title, body, meta = _generate_body(
        trigger,
        market=None,
        seed=9001,
        target_slug="bullbot",
        db=db,
    )
    assert title
    assert "Counter:" not in title
    assert meta.get("counter_target") == "bullbot"
    assert not body or body != title


def test_batch_excludes_network_briefing_items(db):
    created = generate_agent_activity_batch(db, count=8, seed=88001)
    assert all(r.activity_type != "network_briefing_item" for r in created)
