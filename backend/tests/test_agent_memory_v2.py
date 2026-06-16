"""Tests for structured episodic agent memory v2."""

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
    compute_memory_type_weights,
    format_market_memory_snippets,
    format_self_memory_snippets,
    gather_episodic_memory_v2,
    get_market_memory,
    get_recent_self_memory,
    get_rival_memory,
    get_thesis_memory,
    reset_agent_memory_v2_stats,
    select_weighted_memory_snippet,
    thesis_bucket_from_text,
)
from app.forecasting.services.agent_llm import build_prompt_bundle
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


def _seed_market(db, title: str = "Memory V2 test market") -> Market:
    market = Market(
        title=title,
        category="macro",
        status="open",
        current_yes_probability=55.0,
    )
    db.add(market)
    db.flush()
    return market


def _seed_resolution(
    db,
    *,
    agent: Agent,
    market: Market,
    correct: bool,
    days_ago: int,
    side: str = "YES",
    confidence: float = 80.0,
    days_early: int = 5,
) -> ForecastResolution:
    row = ForecastResolution(
        agent_id=agent.id,
        market_id=market.id,
        source_type="test",
        source_id=None,
        side=side,
        predicted_probability=60.0,
        confidence=confidence,
        outcome_yes=True,
        correct=correct,
        days_early=days_early if correct else 0,
        resolved_at=_utc(days_ago),
    )
    db.add(row)
    db.flush()
    return row


def test_thesis_bucket_normalization():
    assert thesis_bucket_from_text("The Long Side Wins.") == "the long side wins"


def test_compute_streaks_isolated():
    from app.forecasting.services.agent_memory_v2 import _compute_streaks

    class Row:
        def __init__(self, correct: bool, day: int):
            self.correct = correct
            self.resolved_at = _utc(day)

    rows = [
        Row(True, 12),
        Row(True, 8),
        Row(False, 4),
        Row(True, 1),
    ]
    current, previous = _compute_streaks(rows)  # type: ignore[arg-type]
    assert current == 1
    assert previous == 2


def test_self_memory_streaks_and_receipts(db):
    reset_agent_memory_v2_stats()
    bull = db.query(Agent).filter(Agent.slug == "bullbot").first()
    doom = db.query(Agent).filter(Agent.slug == "doombot").first()
    assert bull and doom
    market = _seed_market(db, "Streak memory market")

    _seed_resolution(db, agent=bull, market=market, correct=True, days_ago=12, days_early=14)
    _seed_resolution(db, agent=bull, market=market, correct=True, days_ago=8, days_early=10)
    fail = _seed_resolution(db, agent=bull, market=market, correct=False, days_ago=0, confidence=92.0)
    win = _seed_resolution(db, agent=bull, market=market, correct=True, days_ago=1, days_early=3)
    db.commit()

    memory = get_recent_self_memory(db, bull.id)
    assert memory["last_successful_receipt"]["resolution_id"] == win.id
    assert memory["last_successful_receipt"]["market_title"] == "Streak memory market"
    assert memory["last_failed_receipt"]["resolution_id"] == fail.id
    assert memory["last_failed_receipt"]["market_title"] == "Streak memory market"
    assert memory["worst_miss"]["resolution_id"] == fail.id
    assert memory["best_call"]["days_early"] >= 14

    snippets = format_self_memory_snippets(memory)
    assert any("resolution #" in s for s in snippets)
    assert not any("999 days ago" in s for s in snippets)


def test_rival_memory_tracks_disagreements_and_battles(db):
    reset_agent_memory_v2_stats()
    bull = db.query(Agent).filter(Agent.slug == "bullbot").first()
    doom = db.query(Agent).filter(Agent.slug == "doombot").first()
    assert bull and doom
    market = _seed_market(db, "Rival memory market")

    db.add(
        MarketTake(
            market_id=market.id,
            agent_id=bull.id,
            author_name=bull.name,
            author_slug=bull.slug,
            side="YES",
            confidence=72.0,
            body="Bull case holds on macro tape.",
            created_at=_utc(6),
        )
    )
    db.add(
        MarketTake(
            market_id=market.id,
            agent_id=doom.id,
            author_name=doom.name,
            author_slug=doom.slug,
            side="NO",
            confidence=68.0,
            body="Fade setup not a thesis.",
            created_at=_utc(5),
        )
    )
    db.add(
        BattleOutcome(
            agent_id=bull.id,
            opponent_agent_id=doom.id,
            market_id=market.id,
            won=True,
            reputation_delta=4.0,
            recorded_at=_utc(2),
        )
    )
    db.commit()

    memory = get_rival_memory(db, bull.id, doom.id)
    assert memory["disagreements"] >= 1
    assert memory["wins"] >= 1
    assert memory["last_disagreement_date"]
    assert memory["last_winner_slug"] == "bullbot"


def test_thesis_memory_links_receipts(db):
    reset_agent_memory_v2_stats()
    bull = db.query(Agent).filter(Agent.slug == "bullbot").first()
    assert bull
    thesis = "Rates stay higher for longer"
    bucket = thesis_bucket_from_text(thesis)
    market = _seed_market(db, thesis)

    db.add(
        MarketTake(
            market_id=market.id,
            agent_id=bull.id,
            author_name=bull.name,
            author_slug=bull.slug,
            side="YES",
            confidence=70.0,
            body=thesis,
            created_at=_utc(10),
        )
    )
    resolution = _seed_resolution(db, agent=bull, market=market, correct=True, days_ago=3)
    db.commit()

    memory = get_thesis_memory(db, bull.id, bucket)
    assert memory["thesis_bucket"] == bucket
    assert memory["first_appearance"]
    assert memory["latest_appearance"]
    assert any(r["resolution_id"] == resolution.id for r in memory["supporting_receipts"])
    assert memory["confidence_trend"]


def test_market_memory_first_call_and_stance_history(db):
    reset_agent_memory_v2_stats()
    fed = db.query(Agent).filter(Agent.slug == "fed-watcher").first()
    assert fed
    market = _seed_market(db, "Fed cut timing market")

    db.add(
        FeedEvent(
            type="new_take",
            agent_id=fed.id,
            market_id=market.id,
            title="Fed cut timing",
            body="Front-end still mispriced for cuts.",
            probability=42.0,
            confidence=65.0,
            metadata_json={"side": "NO"},
            created_at=_utc(12),
        )
    )
    _seed_resolution(db, agent=fed, market=market, correct=True, days_ago=2, side="NO")
    db.commit()

    memory = get_market_memory(db, fed.id, market.id)
    assert memory["first_call"]["side"] == "NO"
    assert memory["receipts_earned"] == 1
    assert len(memory["stance_history"]) >= 2

    snippets = format_market_memory_snippets(memory)
    assert any("12 days ago" in s for s in snippets)
    assert any("First call" in s for s in snippets)


def test_no_fabricated_recall_without_data(db):
    reset_agent_memory_v2_stats()
    bull = db.query(Agent).filter(Agent.slug == "bullbot").first()
    assert bull
    empty_market = _seed_market(db, "No calls yet market")
    db.commit()

    memory = get_market_memory(db, bull.id, empty_market.id)
    snippets = format_market_memory_snippets(memory)
    assert snippets == []

    episodic = gather_episodic_memory_v2(
        db,
        bull.id,
        market_id=empty_market.id,
        thesis_bucket="nonexistent thesis bucket xyz",
    )
    assert episodic["market_memory"]["receipts_earned"] == 0
    assert episodic["thesis_memory"]["supporting_receipts"] == []
    assert not any("999" in s for s in episodic["snippets"])


def test_network_status_exposes_agent_memory_v2_stats(db):
    reset_agent_memory_v2_stats()
    bull = db.query(Agent).filter(Agent.slug == "bullbot").first()
    assert bull
    market = _seed_market(db, "Stats probe market")
    _seed_resolution(db, agent=bull, market=market, correct=True, days_ago=5)
    db.commit()
    episodic = gather_episodic_memory_v2(db, bull.id, market_id=market.id)
    from app.forecasting.services.agent_memory_v2 import record_memory_output_audit

    snippet = next(s for s in episodic["snippets"] if "receipt" in s.lower())
    record_memory_output_audit(snippet, episodic)
    status = get_network_status(db)
    stats = status["agent_memory_v2_stats"]
    assert "memory_recall_count_24h" in stats
    assert stats["self_memory_hits"] >= 1
    assert "rival_memory_hits" in stats
    assert "thesis_memory_hits" in stats
    assert "market_memory_hits" in stats
    assert "memory_recall_rate_24h" in stats
    assert "memory_recall_type_counts_24h" in stats
    assert "memory_recall_self_rate_24h" in stats
    assert "fabricated_memory_blocked_24h" in stats


def test_weighted_memory_recall_prefers_self_and_market(db):
    reset_agent_memory_v2_stats()
    bull = db.query(Agent).filter(Agent.slug == "bullbot").first()
    doom = db.query(Agent).filter(Agent.slug == "doombot").first()
    assert bull and doom
    thesis = "Rates stay higher for longer"
    market = _seed_market(db, thesis)
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
    _seed_resolution(db, agent=bull, market=market, correct=True, days_ago=3)
    db.add(
        MarketTake(
            market_id=market.id,
            agent_id=doom.id,
            author_name=doom.name,
            author_slug=doom.slug,
            side="NO",
            confidence=71.0,
            body="Fade setup",
            created_at=_utc(11),
        )
    )
    db.commit()

    episodic = gather_episodic_memory_v2(
        db,
        bull.id,
        market_id=market.id,
        rival_id=doom.id,
        thesis_bucket=thesis_bucket_from_text(thesis),
    )
    weights = compute_memory_type_weights(episodic)
    assert weights["self"] >= weights["rival"]
    assert weights["market"] >= weights["thesis"]

    seen_types: set[str] = set()
    for seed in range(200):
        _snippet, category, _idx = select_weighted_memory_snippet(episodic, seed=seed)
        if category:
            seen_types.add(category)
    assert len(seen_types) >= 2


def test_prompt_bundle_includes_episodic_memory(db):
    reset_agent_memory_v2_stats()
    bull = db.query(Agent).filter(Agent.slug == "bullbot").first()
    doom = db.query(Agent).filter(Agent.slug == "doombot").first()
    assert bull and doom
    market = _seed_market(db, "Prompt episodic memory market")
    _seed_resolution(db, agent=bull, market=market, correct=True, days_ago=12)
    db.commit()

    bundle = build_prompt_bundle(
        "bullbot",
        "post",
        {
            "market_title": market.title,
            "opponent_slug": "doombot",
            "thesis_bucket": market.title,
        },
        db=db,
    )
    assert "Episodic memory" in bundle.user_prompt
    assert bundle.retrieved.get("episodic_memory", {}).get("snippets")
