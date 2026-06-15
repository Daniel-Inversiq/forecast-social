"""Conversational voice layer v1 — personality-driven rival replies."""

from __future__ import annotations

import re

import pytest

from app.forecasting.agent_status import CORE_AGENT_SLUGS
from app.forecasting.services.conversational_reply_engine import (
    ANALYTICAL_BANNED_PHRASES,
    DISAGREEMENT_STYLES,
    MAX_REPLY_SENTENCES,
    PAIR_DISAGREEMENT_TYPES,
    blind_identification_accuracy,
    classify_speaker,
    generate_conversational_reply,
    is_analytical_summary,
    resolve_disagreement_type,
)
from app.forecasting.services.voice_engine import (
    anchor_rival_reply_to_claim,
    generate_rival_reply,
    is_generic_disagreement,
)

CORE_SLUGS = tuple(sorted(CORE_AGENT_SLUGS))
IDENTIFICATION_TARGET = 0.90


@pytest.mark.parametrize("slug", CORE_SLUGS)
def test_disagreement_style_defined(slug: str) -> None:
    assert slug in DISAGREEMENT_STYLES
    traits = DISAGREEMENT_STYLES[slug]["traits"]
    assert len(traits) >= 2


@pytest.mark.parametrize(
    ("speaker", "target"),
    [
        ("bullbot", "doombot"),
        ("doombot", "bullbot"),
        ("fed-watcher", "macro-oracle"),
        ("macro-oracle", "fed-watcher"),
        ("sports-chaos", "doombot"),
    ],
)
def test_reply_is_conversational_not_analytical(speaker: str, target: str) -> None:
    reply = generate_conversational_reply(speaker, target, seed=42)
    lower = reply.line.lower()
    assert not is_analytical_summary(reply.line), reply.line
    for banned in ANALYTICAL_BANNED_PHRASES:
        assert banned not in lower, f"banned phrase '{banned}' in: {reply.line}"
    assert reply.disagreement_type == resolve_disagreement_type(speaker, target)
    assert reply.sentences[0]


def test_reply_max_three_sentences() -> None:
    for i, speaker in enumerate(CORE_SLUGS):
        for j, target in enumerate(CORE_SLUGS):
            if speaker == target:
                continue
            reply = generate_conversational_reply(speaker, target, seed=i * 17 + j)
            sentences = [s for s in re.split(r"(?<=[.!?])\s+", reply.line) if s.strip()]
            assert len(sentences) <= MAX_REPLY_SENTENCES, (speaker, target, reply.line)
            assert 1 <= len(sentences) <= MAX_REPLY_SENTENCES


def test_generation_steps_order() -> None:
    """Step 1 disagreement always present; evidence and jab optional."""
    reply = generate_conversational_reply("bullbot", "doombot", seed=99)
    steps = reply.generation_meta["steps"]
    assert steps["disagreement"]
    assert reply.sentences[0] == steps["disagreement"]


@pytest.mark.parametrize("phrase", ANALYTICAL_BANNED_PHRASES)
def test_hard_rejection_phrases(phrase: str) -> None:
    assert is_analytical_summary(f"Something {phrase} something else.")


def test_pair_disagreement_types_cover_core_rivalries() -> None:
    assert ("bullbot", "doombot") in PAIR_DISAGREEMENT_TYPES
    assert ("fed-watcher", "macro-oracle") in PAIR_DISAGREEMENT_TYPES
    assert resolve_disagreement_type("bullbot", "doombot") == "momentum_vs_fragility"


def test_blind_identification_100_replies_at_least_90_percent() -> None:
    """Hide names — classifier must identify speaker ≥90% of the time."""
    report = blind_identification_accuracy(count=100, seed=4242)
    assert report["total"] == 100
    assert report["accuracy"] >= IDENTIFICATION_TARGET, (
        f"blind identification {report['accuracy_pct']}% < {IDENTIFICATION_TARGET * 100}% — "
        f"misidentified={report['misidentified'][:5]}"
    )


def test_classify_speaker_on_examples() -> None:
    assert classify_speaker("You're fighting the tape. Still buying.") == "bullbot"
    assert classify_speaker("That's late-cycle thinking. Early, not wrong.") == "doombot"
    assert classify_speaker("The curve disagrees. Front-end moved first.") == "fed-watcher"
    assert classify_speaker("You're focused on the headline. My horizon is longer.") == "macro-oracle"
    assert classify_speaker("The crowd loves that story. Chaos still pays.") == "sports-chaos"


def test_generate_rival_reply_uses_conversational_voice() -> None:
    counter = generate_rival_reply(
        "bullbot",
        "doombot",
        source_context={
            "source_post_title": "Recession window live.",
            "source_post_body": "Credit impulse negative.",
            "source_agent_slug": "doombot",
        },
        seed=9001,
    )
    assert counter.line.strip()
    assert not is_analytical_summary(counter.line)
    assert not is_generic_disagreement(counter.line)
    meta = counter.generation_meta
    assert meta.get("generation_mode") == "conversational" or meta.get("llm_fallback")


def test_anchor_rival_reply_avoids_analytical_templates() -> None:
    line = anchor_rival_reply_to_claim(
        "doombot",
        "bullbot",
        "You're wrong.",
        source_title="The dip is still there.",
        source_body="Pullback — bid still there",
        seed=42,
    )
    assert not is_analytical_summary(line)
    for banned in ANALYTICAL_BANNED_PHRASES:
        assert banned not in line.lower()


def test_replies_sound_distinct_per_personality() -> None:
    """Each core agent should produce recognizably different voice on the same target."""
    target = "macro-oracle"
    lines = {
        slug: generate_conversational_reply(slug, target, seed=77).line
        for slug in CORE_SLUGS
        if slug != target
    }
    assert len(set(lines.values())) == len(lines)
    for slug, line in lines.items():
        assert classify_speaker(line) == slug, (slug, line, classify_speaker(line))
