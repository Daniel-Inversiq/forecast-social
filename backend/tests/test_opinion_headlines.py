"""Opinion-driven headline validation and regeneration."""

from __future__ import annotations

import pytest

from app.database import SessionLocal
from app.forecasting.agent_status import CORE_AGENT_SLUGS
from app.forecasting.conviction_engine import build_conviction_engine
from app.forecasting.models import Agent, Market
from app.forecasting.services.agent_activity_engine import TRIGGER_CATALOG, _generate_body
from app.forecasting.services.opinion_headlines import (
    ensure_opinion_headline,
    generate_opinion_headline,
    is_event_driven_headline,
    resolve_opinion_headline,
)

BAD_HEADLINES = (
    "US recession by Q4",
    "September modal",
    "Conviction 55% YES",
    "AI breakthrough before December",
    "Signal shift — FedWatcher on Will the Fed cut in September?",
    "Follow-up — DoomBot on US recession by Q4",
    "Flow — NVDA Q2 beat",
    "Receipt verified",
    "FOMC path update",
)

GOOD_HEADLINES = {
    "doombot": "Consensus is late again.",
    "bullbot": "Everyone wants the dip. Nobody buys it.",
    "fed-watcher": "The curve moved first.",
    "macro-oracle": "The narrative changed before the data.",
    "sports-chaos": "Public money is never free money.",
}


@pytest.mark.parametrize("headline", BAD_HEADLINES)
def test_rejects_event_driven_headlines(headline: str) -> None:
    invalid, reason = is_event_driven_headline(
        headline,
        slug="fed-watcher",
        market_title="US recession by Q4",
    )
    assert invalid, f"expected reject for {headline!r}, got ok ({reason})"


@pytest.mark.parametrize("slug", sorted(CORE_AGENT_SLUGS))
def test_accepts_agent_opinion_headlines(slug: str) -> None:
    headline = GOOD_HEADLINES[slug]
    invalid, reason = is_event_driven_headline(headline, slug=slug)
    assert not invalid, f"{slug}: {headline!r} rejected as {reason}"


@pytest.mark.parametrize("slug", sorted(CORE_AGENT_SLUGS))
def test_generate_opinion_headline_is_valid(slug: str) -> None:
    headline = generate_opinion_headline(slug, seed=12345)
    invalid, reason = is_event_driven_headline(headline, slug=slug)
    assert not invalid, f"{slug} generated {headline!r}: {reason}"


def test_ensure_opinion_headline_regenerates_bad_title() -> None:
    body = (
        "On US recession by Q4, DoomBot sees credit impulse driving lower risk; "
        "median now 61% YES. Consensus is usually late."
    )
    final = ensure_opinion_headline(
        "doombot",
        "US recession by Q4",
        body=body,
        market_title="US recession by Q4",
        seed=99,
    )
    invalid, reason = is_event_driven_headline(
        final, slug="doombot", market_title="US recession by Q4", body=body
    )
    assert not invalid, f"regenerated {final!r} still invalid: {reason}"
    assert final != "US recession by Q4"


@pytest.fixture
def db():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


def test_conviction_engine_titles_are_opinion_driven(db) -> None:
    import random

    agents = db.query(Agent).filter(Agent.slug.in_(CORE_AGENT_SLUGS)).all()
    markets = db.query(Market).limit(5).all()
    if len(agents) < 3 or not markets:
        pytest.skip("need seeded agents and markets")

    rng = random.Random(4242)
    engine = build_conviction_engine(rng, {}, agents)
    event_types = (
        "market_move",
        "signal_shift",
        "new_take",
        "stance_followup",
        "battle_escalation",
        "rivalry",
        "narrative_acceleration",
    )
    for agent in agents:
        market = markets[hash(agent.slug) % len(markets)]
        for event_type in event_types:
            copy = engine.generate(event_type, agent, market, side="YES")
            invalid, reason = is_event_driven_headline(
                copy.title,
                slug=agent.slug,
                market_title=market.title,
                body=copy.body,
            )
            assert not invalid, (
                f"{agent.slug}/{event_type}: {copy.title!r} invalid ({reason}); body={copy.body[:80]!r}"
            )


def test_activity_engine_titles_are_opinion_driven(db) -> None:
    markets = db.query(Market).limit(5).all()
    market = markets[0] if markets else None
    for trigger in TRIGGER_CATALOG:
        if trigger.activity_type == "network_briefing_item":
            continue
        title, body, meta = _generate_body(
            trigger,
            market=market,
            seed=88001,
            target_slug=trigger.counter_target,
            db=db,
        )
        invalid, reason = is_event_driven_headline(
            title,
            slug=trigger.agent_slug,
            market_title=market.title if market else None,
            body=body,
        )
        assert not invalid, f"{trigger.trigger_id}: {title!r} ({reason})"
        assert title != trigger.headline_template


def test_resolve_prefers_body_opinion_sentence() -> None:
    body = (
        "Nobody is pricing the downside. "
        "On US recession by Q4, implied YES sits at 61% after credit impulse turned."
    )
    title = resolve_opinion_headline(
        "doombot",
        proposed_title="US recession by Q4",
        body=body,
        market_title="US recession by Q4",
        seed=7,
    )
    assert "recession" not in title.lower()
    assert "61%" not in title
