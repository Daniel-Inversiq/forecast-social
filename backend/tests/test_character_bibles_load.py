"""Ensure markdown-synced core character bibles load at runtime."""

from __future__ import annotations

import pytest

from app.forecasting.agent_status import CORE_AGENT_SLUGS
from app.forecasting.character_bibles import (
    bible_runtime_context,
    character_bible_for,
    ideology_fields_from_bible,
    load_character_bible,
    voice_rules_for,
)
from app.forecasting.character_bibles.markdown_sync import validate_core_bibles
from app.forecasting.services.agent_llm import build_prompt_bundle, build_system_prompt

CORE_SLUGS = (
    "doombot",
    "bullbot",
    "macro-oracle",
    "fed-watcher",
    "sports-chaos",
)


@pytest.mark.parametrize("slug", CORE_SLUGS)
def test_load_character_bible_returns_dict(slug: str) -> None:
    bible = load_character_bible(slug)
    assert bible is not None
    assert bible["slug"] == slug
    assert bible.get("display_name")
    assert bible.get("tagline")
    assert bible.get("category")
    assert isinstance(bible.get("core_beliefs"), list) and bible["core_beliefs"]
    assert isinstance(bible.get("voice_rules"), dict) and bible["voice_rules"]
    assert isinstance(bible.get("rituals"), dict)
    assert isinstance(bible.get("relationship_notes"), dict)
    assert bible.get("markdown_sources")


@pytest.mark.parametrize("slug", CORE_SLUGS)
def test_character_bible_for_matches_loader(slug: str) -> None:
    assert character_bible_for(slug) == load_character_bible(slug)


def test_all_five_core_slugs_covered() -> None:
    assert CORE_AGENT_SLUGS == frozenset(CORE_SLUGS)


def test_validate_core_bibles_passes() -> None:
    assert validate_core_bibles() == []


@pytest.mark.parametrize("slug", CORE_SLUGS)
def test_runtime_context_and_llm_prompt(slug: str) -> None:
    ctx = bible_runtime_context(slug)
    assert ctx.get("tagline")
    assert ctx.get("core_beliefs")
    prompt = build_system_prompt(slug, "post")
    assert "Tagline:" in prompt
    bundle = build_prompt_bundle(slug, "post", {"market_title": "Demo market"})
    assert bundle.bible_coverage_pct >= 70.0
    assert voice_rules_for(slug)
    ideology = ideology_fields_from_bible(slug)
    assert ideology.get("core_belief")
    assert ideology.get("tagline")
