"""Autonomous output audit — episodic memory in generated agent copy."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest

from app.database import SessionLocal
from app.forecasting.agent_status import CORE_AGENT_SLUGS
from app.forecasting.models import (
    Agent,
    BattleOutcome,
    FeedEvent,
    ForecastResolution,
    Market,
    MarketTake,
)
from app.forecasting.services.agent_memory_v2 import (
    agent_memory_v2_stats,
    build_memory_anchors,
    classify_output_memory_references,
    gather_episodic_memory_v2,
    reset_agent_memory_v2_stats,
    run_autonomous_memory_output_batch,
    sanitize_episodic_memory_copy,
    thesis_bucket_from_text,
)
from app.forecasting.services.autonomous_network_engine import get_network_status


@pytest.fixture
def db():
    from app.forecasting.migrate import migrate_schema

    migrate_schema()
    session = SessionLocal()
    try:
        agents = session.query(Agent).filter(Agent.slug.in_(CORE_AGENT_SLUGS)).all()
        if len(agents) < 2:
            pytest.skip("Core agents not seeded in database")
        yield session
    finally:
        session.close()


def _utc(days_ago: int = 0) -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=days_ago)


def _seed_full_memory_context(db) -> tuple[Agent, Agent, Market, str]:
    bull = db.query(Agent).filter(Agent.slug == "bullbot").first()
    doom = db.query(Agent).filter(Agent.slug == "doombot").first()
    assert bull and doom
    thesis = "Rates stay higher for longer"
    market = Market(
        title=thesis,
        category="macro",
        status="open",
        current_yes_probability=58.0,
    )
    db.add(market)
    db.flush()

    db.add(
        MarketTake(
            market_id=market.id,
            agent_id=bull.id,
            author_name=bull.name,
            author_slug=bull.slug,
            side="YES",
            confidence=74.0,
            body=thesis,
            created_at=_utc(12),
        )
    )
    db.add(
        MarketTake(
            market_id=market.id,
            agent_id=doom.id,
            author_name=doom.name,
            author_slug=doom.slug,
            side="NO",
            confidence=71.0,
            body="Fade setup not a thesis",
            created_at=_utc(11),
        )
    )
    db.add(
        FeedEvent(
            type="new_take",
            agent_id=bull.id,
            market_id=market.id,
            title=thesis,
            body=thesis,
            probability=62.0,
            confidence=74.0,
            metadata_json={"side": "YES"},
            created_at=_utc(12),
        )
    )
    db.add(
        ForecastResolution(
            agent_id=bull.id,
            market_id=market.id,
            source_type="test",
            source_id=None,
            side="YES",
            predicted_probability=62.0,
            confidence=74.0,
            outcome_yes=True,
            correct=True,
            days_early=9,
            resolved_at=_utc(3),
        )
    )
    db.add(
        BattleOutcome(
            agent_id=bull.id,
            opponent_agent_id=doom.id,
            market_id=market.id,
            won=True,
            reputation_delta=3.5,
            recorded_at=_utc(2),
        )
    )
    db.commit()
    return bull, doom, market, thesis


def test_blocks_fabricated_temporal_memory(db):
    reset_agent_memory_v2_stats()
    bull, doom, market, thesis = _seed_full_memory_context(db)
    episodic = gather_episodic_memory_v2(
        db,
        bull.id,
        market_id=market.id,
        rival_id=doom.id,
        thesis_bucket=thesis_bucket_from_text(thesis),
    )
    assert episodic["snippets"]

    fabricated = "I called this 999 days ago on a market nobody tracked."
    cleaned, meta = sanitize_episodic_memory_copy(
        fabricated,
        episodic,
        slug="bullbot",
        seed=1,
    )
    assert meta.get("fabricated_memory_blocked", 0) >= 1
    assert "999" not in cleaned


def test_allows_snippet_anchored_memory(db):
    reset_agent_memory_v2_stats()
    bull, doom, market, thesis = _seed_full_memory_context(db)
    episodic = gather_episodic_memory_v2(
        db,
        bull.id,
        market_id=market.id,
        rival_id=doom.id,
        thesis_bucket=thesis_bucket_from_text(thesis),
    )
    snippet = next(s for s in episodic["snippets"] if "First call" in s)
    anchored = f"Momentum still there. {snippet}"
    cleaned, meta = sanitize_episodic_memory_copy(
        anchored,
        episodic,
        slug="bullbot",
        seed=2,
    )
    assert meta.get("fabricated_memory_blocked", 0) == 0
    assert "First call" in cleaned


def test_autonomous_memory_output_batch_recall_rate(db):
    reset_agent_memory_v2_stats()
    bull, doom, market, thesis = _seed_full_memory_context(db)
    seeds = list(range(5960, 6000))
    report = run_autonomous_memory_output_batch(
        db,
        "bullbot",
        market=market,
        rival_slug="doombot",
        thesis=thesis,
        seeds=seeds,
    )
    assert report["snippet_count"] >= 4
    assert report["counts"]["fabricated"] == 0
    assert report["recall_rate"] >= 0.10, (
        f"Expected >=10% recall, got {report['recall_rate']}: {report['counts']}"
    )
    assert report["recall_rate"] <= 0.25, (
        f"Expected <=25% recall, got {report['recall_rate']}: {report['counts']}"
    )
    recalled_types = [
        t for t in ("self", "rival", "thesis", "market") if report["counts"][t] > 0
    ]
    assert len(recalled_types) >= 2, (
        f"Expected at least 2 recall types, got {recalled_types}: {report['counts']}"
    )


def test_network_status_memory_recall_metrics(db):
    reset_agent_memory_v2_stats()
    bull, doom, market, thesis = _seed_full_memory_context(db)
    run_autonomous_memory_output_batch(
        db,
        "bullbot",
        market=market,
        rival_slug="doombot",
        thesis=thesis,
        seeds=list(range(5960, 6000)),
    )
    status = get_network_status(db)
    stats = status["agent_memory_v2_stats"]
    assert stats["memory_recall_rate_24h"] >= 0.10
    assert stats["memory_recall_rate_24h"] <= 0.25
    assert stats["memory_output_relevant_24h"] >= 40
    assert stats["memory_output_recalled_24h"] >= 4
    assert "fabricated_memory_blocked_24h" in stats
    assert "memory_recall_type_counts_24h" in stats
    assert "memory_path_invocations_24h" in stats
    assert "memory_eligible_24h" in stats
    assert "memory_recall_self_rate_24h" in stats
    assert "memory_recall_rival_rate_24h" in stats
    assert "memory_recall_thesis_rate_24h" in stats
    assert "memory_recall_market_rate_24h" in stats
    type_counts = stats["memory_recall_type_counts_24h"]
    types_seen = sum(1 for v in type_counts.values() if v > 0)
    assert types_seen >= 2
    if stats["memory_recall_count_24h"] > 0:
        assert stats["memory_recall_rival_rate_24h"] <= 0.5


def test_classify_memory_reference_categories(db):
    reset_agent_memory_v2_stats()
    bull, doom, market, thesis = _seed_full_memory_context(db)
    episodic = gather_episodic_memory_v2(
        db,
        bull.id,
        market_id=market.id,
        rival_id=doom.id,
        thesis_bucket=thesis_bucket_from_text(thesis),
    )
    anchors = build_memory_anchors(episodic)
    assert anchors["market_titles"]
    assert anchors["rival_names"]

    market_line = "First call on rates stay higher for longer: YES — 12 days ago."
    audit = classify_output_memory_references(market_line, episodic)
    assert audit["market"] or audit["self"]

    rival_line = "DoomBot and I have recorded disagreements on the tape."
    audit = classify_output_memory_references(rival_line, episodic)
    assert audit["rival"] or not audit["fabricated"]
