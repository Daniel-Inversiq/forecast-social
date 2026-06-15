"""Copy sanitization — block prompt/template leakage from feed output."""

from __future__ import annotations

import re

import pytest

from app.database import SessionLocal
from app.forecasting.agent_status import CORE_AGENT_SLUGS
from app.forecasting.models import Agent
from app.forecasting.services.agent_activity_engine import (
    TRIGGER_CATALOG,
    _generate_body,
)
from app.forecasting.services.copy_sanitize import (
    contains_instruction_leak,
    detect_copy_leak,
    detect_copy_quality_issues,
    finalize_persisted_copy,
    has_bracket_placeholder,
    has_repeated_sentence,
    is_headline_pool_candidate,
    safe_signature_phrases,
    strip_bracket_placeholders,
)
from app.forecasting.services.opinion_headlines import _headline_pool
from app.forecasting.services.voice_engine import (
    generate_conviction_update_with_meta,
    generate_counter,
    generate_feed_post_with_meta,
)

CORE_SLUGS = tuple(sorted(CORE_AGENT_SLUGS))

BANNED_OUTPUT_PATTERNS = (
    re.compile(r"\[[^\]]+\]"),
    re.compile(r"(?i)interpret fed data"),
    re.compile(r"(?i)draw the optimistic conclusion"),
    re.compile(r"(?i)^template:"),
    re.compile(r"(?i)my read:\s*\.?\s*updating the model\.?\s*$"),
)

NATURAL_UPDATING_MODEL = re.compile(
    r"(?i)(probability|print|consensus|cut|odds|%).{0,80}updating the model"
)


def _assert_no_leak_in_text(text: str) -> None:
    for pat in BANNED_OUTPUT_PATTERNS:
        assert not pat.search(text), f"leak matched {pat.pattern!r} in {text!r}"
    if "updating the model" in text.lower():
        assert NATURAL_UPDATING_MODEL.search(text), (
            f"placeholder-style 'Updating the model' in {text!r}"
        )


def test_strip_bracket_placeholders() -> None:
    assert strip_bracket_placeholders("My read: [probability]. Updating the model.") == (
        "My read: Updating the model."
    )
    assert not has_bracket_placeholder(strip_bracket_placeholders("Called [X] at [Y]."))


def test_instruction_leak_detects_rivalry_behavior() -> None:
    leaky = "FedWatcher — Interpret Fed data bullishly. Draw the optimistic conclusion from neutral data."
    assert detect_copy_leak("bullbot", leaky) == ["instruction_leak"]


def test_repeated_sentence_detects_exact_duplicate() -> None:
    text = (
        "Curve steepened into the print. "
        "September modal repriced. "
        "Curve steepened into the print."
    )
    assert has_repeated_sentence(text)
    assert detect_copy_quality_issues(text) == ["repeated_sentence"]


def test_repeated_sentence_detects_high_similarity() -> None:
    text = "Curve steepened into the print. The curve steepened into the print."
    assert has_repeated_sentence(text)
    assert "repeated_sentence" in detect_copy_quality_issues(text)


def test_repeated_sentence_allows_distinct_sentences() -> None:
    text = "Curve steepened into the print. September modal repriced."
    assert not has_repeated_sentence(text)
    assert detect_copy_quality_issues(text) == []


def test_finalize_rejects_repeated_sentence_and_falls_back() -> None:
    title, body, meta = finalize_persisted_copy(
        "fed-watcher",
        "Curve steepened into the print.",
        "September modal repriced. Curve steepened into the print.",
        seed=7,
    )
    combined = f"{title}\n{body}".strip()
    assert not has_repeated_sentence(combined)
    assert detect_copy_quality_issues(combined) == []
    assert meta.get("copy_sanitize") in ("rewrite", "safe_fallback", "regenerate")


def test_finalize_rewrites_bracket_phrase() -> None:
    title, body, meta = finalize_persisted_copy(
        "macro-oracle",
        "My read: [probability].",
        "Updating the model.",
        seed=1,
    )
    combined = f"{title}\n{body}".strip()
    assert not has_bracket_placeholder(combined)
    assert not detect_copy_leak("macro-oracle", combined)
    assert meta.get("copy_sanitize") in ("rewrite", "safe_fallback", "regenerate")


def test_finalize_falls_back_on_instruction_echo() -> None:
    title, body, meta = finalize_persisted_copy(
        "bullbot",
        "FedWatcher — Interpret Fed data bullishly. Draw the optimistic conclusion from neutral data.",
        "",
        seed=42,
    )
    combined = f"{title}\n{body}".strip()
    assert "interpret fed data" not in combined.lower()
    assert meta.get("copy_sanitize") in ("rewrite", "safe_fallback", "regenerate")


def test_headline_pool_excludes_brackets_and_instructions() -> None:
    for slug in CORE_SLUGS:
        for phrase in _headline_pool(slug):
            assert is_headline_pool_candidate(phrase)
            assert not has_bracket_placeholder(phrase)
            assert "interpret" not in phrase.lower()


def test_macro_oracle_signature_phrases_have_no_brackets() -> None:
    phrases = safe_signature_phrases("macro-oracle")
    assert phrases
    assert all(not has_bracket_placeholder(p) for p in phrases)
    assert not any("[probability]" in p for p in phrases)


def test_conviction_template_no_bracket_leak_across_seeds() -> None:
    for seed in range(100):
        text, _, _ = generate_conviction_update_with_meta(
            "macro-oracle",
            market_title="Will the US enter recession by Q4?",
            prob=50.0,
            seed=seed,
        )
        assert not has_bracket_placeholder(text), f"seed {seed}: {text!r}"
        assert "My read: My read:" not in text


def test_500_synthetic_generation_paths_have_no_prompt_leaks() -> None:
    """Exercise 500 generation paths (no DB) and assert no prompt/template leakage."""
    db_free_triggers = [
        t
        for t in TRIGGER_CATALOG
        if t.activity_type
        not in ("receipt_challenge", "receipt_victory")
    ]
    assert db_free_triggers
    bad: list[tuple] = []
    for i in range(500):
        trigger = db_free_triggers[i % len(db_free_triggers)]
        title, body, _meta = _generate_body(
            trigger,
            market=None,
            seed=20260605 + i,
            target_slug=trigger.counter_target,
            db=None,
        )
        if title or body:
            combined = f"{title}\n{body}".strip()
            try:
                _assert_no_leak_in_text(combined)
                assert not detect_copy_leak(trigger.agent_slug, combined)
            except AssertionError:
                bad.append((i, trigger.trigger_id, combined[:120]))
        if i % 7 == 0:
            for slug, tgt in (("bullbot", "fed-watcher"), ("macro-oracle", "doombot")):
                line = generate_counter(slug, tgt, market_title="Demo market", seed=i).line
                _assert_no_leak_in_text(line)
                assert not detect_copy_leak(slug, line)
        if i % 5 == 0:
            for slug in CORE_SLUGS:
                text, _, _ = generate_feed_post_with_meta(
                    slug, market_title="Demo market", prob=50.0, seed=i
                )
                _assert_no_leak_in_text(text)
                assert not detect_copy_leak(slug, text)
            text, _, _ = generate_conviction_update_with_meta(
                "macro-oracle", market_title="Demo market", prob=50.0, seed=i
            )
            _assert_no_leak_in_text(text)
            assert not detect_copy_leak("macro-oracle", text)
    assert not bad, f"leaks in synthetic batch: {bad[:5]}"


@pytest.fixture
def db():
    import sqlalchemy.exc

    session = SessionLocal()
    try:
        agents = session.query(Agent).filter(Agent.slug.in_(CORE_SLUGS)).all()
        if len(agents) < 5:
            pytest.skip("Core agents not seeded in database")
        yield session
    except sqlalchemy.exc.OperationalError as exc:
        if "locked" in str(exc).lower():
            pytest.skip("database locked")
        raise
    finally:
        session.close()


def test_batch_500_activities_have_no_prompt_leaks(db) -> None:
    """Generate 500 persisted activities when the database is available."""
    import sqlalchemy.exc
    from app.forecasting.services.agent_activity_engine import generate_agent_activity_batch

    try:
        created = generate_agent_activity_batch(db, count=500, seed=20260605, mirror_to_feed=True)
    except sqlalchemy.exc.OperationalError as exc:
        if "locked" in str(exc).lower():
            pytest.skip("database locked — run integration test when DB is free")
        raise
    assert len(created) >= 100
    for row in created:
        combined = f"{row.title}\n{row.body}".strip()
        _assert_no_leak_in_text(combined)
        assert not detect_copy_leak(row.agent_slug, combined)


def test_contains_instruction_leak_rejects_prompt_lines() -> None:
    assert contains_instruction_leak("Rivalry behavior toward FedWatcher: Interpret Fed data bullishly.")
    assert not contains_instruction_leak(
        "Probability of September cut: 48%. Down from 62% this morning. Updating the model."
    )
