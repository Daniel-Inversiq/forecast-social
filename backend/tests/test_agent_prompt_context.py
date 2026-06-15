"""Tests for enriched agent LLM prompt context and bible coverage."""

from __future__ import annotations

import pytest

from app.database import SessionLocal
from app.forecasting.agent_status import CORE_AGENT_SLUGS
from app.forecasting.models import Agent
from app.forecasting.services.agent_llm import build_prompt_bundle
from app.forecasting.services.agent_prompt_context import (
    build_reply_relationship_context,
    gather_few_shot_examples,
    gather_relationship_context,
    gather_rituals,
)

CORE_SLUGS = tuple(sorted(CORE_AGENT_SLUGS))


@pytest.mark.parametrize("slug", CORE_SLUGS)
def test_few_shot_examples_present(slug: str) -> None:
    examples = gather_few_shot_examples(slug)
    assert len(examples) >= 3
    assert all(len(ex.strip()) > 20 for ex in examples)


@pytest.mark.parametrize("slug", CORE_SLUGS)
def test_relationship_context_includes_rivals(slug: str) -> None:
    rels = gather_relationship_context(slug)
    assert rels
    first = rels[0]
    assert first.get("rival_slug")
    assert first.get("response_style") or first.get("typical_response") or first.get("rivalry_behavior")


@pytest.mark.parametrize("slug", CORE_SLUGS)
def test_rituals_include_schedule_and_triggers(slug: str) -> None:
    rituals = gather_rituals(slug, event_kind="fomc", trigger_id="fomc_day")
    assert rituals.get("posting_schedule")
    assert rituals.get("trigger_events")
    assert rituals.get("never_posts_about")


@pytest.mark.parametrize("slug", CORE_SLUGS)
def test_prompt_bundle_bible_coverage_at_least_70_percent(slug: str) -> None:
    bundle = build_prompt_bundle(
        slug,
        "post",
        {"market_title": "Will the Fed cut in September?", "event_type": "cpi"},
    )
    assert bundle.bible_coverage_pct >= 70.0, (
        f"{slug} coverage {bundle.bible_coverage_pct}% — system={len(bundle.system_prompt)} "
        f"user={len(bundle.user_prompt)}"
    )
    assert "Voice examples" in bundle.user_prompt
    assert bundle.retrieved.get("few_shot_examples")


@pytest.mark.parametrize("slug", CORE_SLUGS)
def test_prompt_bundle_includes_relationship_in_user_prompt(slug: str) -> None:
    rivals = gather_relationship_context(slug)
    if not rivals:
        pytest.skip("no rivals")
    opponent = rivals[0]["rival_slug"]
    bundle = build_prompt_bundle(
        slug,
        "counter",
        {"market_title": "Demo market", "opponent_slug": opponent},
    )
    assert "Relationship context" in bundle.user_prompt
    assert opponent.replace("-", " ") in bundle.user_prompt.lower() or opponent in bundle.user_prompt


def test_prompt_bundle_with_db_continuity_and_rivals() -> None:
    session = SessionLocal()
    try:
        agent = session.query(Agent).filter(Agent.slug == "doombot").first()
        if not agent:
            pytest.skip("doombot not seeded")
        bundle = build_prompt_bundle(
            "doombot",
            "post",
            {"market_title": "Recession before 2027?", "event_type": "macro_release"},
            db=session,
        )
        debug = bundle.debug_payload()
        assert "retrieved_memories" in debug
        assert "retrieved_receipts" in debug
        assert "retrieved_rival_context" in debug
        assert bundle.bible_coverage_pct >= 70.0
    finally:
        session.close()


def test_build_reply_relationship_context_loads_bible_fields() -> None:
    ctx = build_reply_relationship_context("bullbot", "doombot")
    assert ctx["core_beliefs"]
    assert ctx.get("rivalry_behavior")
    assert ctx.get("typical_response")
    assert ctx.get("relationship_dynamic")
    assert "mechanism" in ctx["typical_response"].lower()


def test_counter_prompt_includes_relationship_worldview() -> None:
    bundle = build_prompt_bundle(
        "doombot",
        "counter",
        {
            **build_reply_relationship_context("doombot", "bullbot"),
            "market_title": "AI capex cycle",
            "source_post_title": "The dip is still there.",
            "source_post_body": "Still buying.",
            "source_agent_slug": "bullbot",
        },
    )
    assert "core beliefs" in bundle.user_prompt.lower()
    assert "rivalry behavior" in bundle.user_prompt.lower()
    assert "typical counter" in bundle.user_prompt.lower()
    assert "relationship dynamic" in bundle.user_prompt.lower()
    assert "BullBot" in bundle.user_prompt


def test_conviction_update_task_in_system_prompt() -> None:
    bundle = build_prompt_bundle(
        "fed-watcher",
        "conviction_update",
        {
            "market_title": "Will the Fed cut in September?",
            "event_kind": "fomc",
            "trigger_id": "fomc_day",
            "prob": 62,
        },
    )
    assert "conviction_update" in bundle.system_prompt.lower()
    assert "Target conviction" in bundle.user_prompt or "prob: 62" in bundle.user_prompt
