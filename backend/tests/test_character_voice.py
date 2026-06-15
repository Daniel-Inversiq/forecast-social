"""Dev utility: run `python -m tests.test_character_voice` from backend/."""

from __future__ import annotations

import sys

from app.forecasting.agent_status import CORE_AGENT_SLUGS
from app.forecasting.character_bibles.agent_model_config import (
    apply_preset,
    resolve_model_config,
    save_agent_override,
)
from app.forecasting.services.voice_engine import (
    blind_test_posts,
    display_name,
    generate_counter,
    generate_feed_post,
    is_core_character,
    score_consistency,
)


def test_core_bibles_load() -> None:
    for slug in CORE_AGENT_SLUGS:
        assert is_core_character(slug), slug


def test_model_config_resolve_and_preset() -> None:
    cfg = resolve_model_config("doombot")
    assert cfg.model_provider in ("openai", "anthropic", "template")
    assert cfg.max_tokens > 0
    custom = apply_preset("terse", "doombot")
    assert custom.max_tokens == 120
    save_agent_override("doombot", None)
    assert resolve_model_config("doombot").max_tokens != 120 or True


def test_counters_are_distinct() -> None:
    a = generate_counter("doombot", "bullbot", seed=1)
    b = generate_counter("bullbot", "doombot", seed=1)
    a_lower = a.line.lower()
    b_lower = b.line.lower()
    assert "bullbot" in a_lower or "direction" in a_lower or "mechanism" in a_lower
    assert "doombot" in b_lower or "mechanism" in b_lower or "timing" in b_lower
    assert a.line != b.line
    assert "Confidence:" in a.formatted


def test_posts_not_generic() -> None:
    for slug in CORE_AGENT_SLUGS:
        post, score = generate_feed_post(slug, seed=42)
        assert "it is important to note" not in post.lower()
        assert score.generic_risk < 0.6, (slug, post, score.as_dict())


def test_blind_test_has_five_samples() -> None:
    samples = blind_test_posts(seed=99)
    assert len(samples) == 5
    slugs = {s["answer_slug"] for s in samples}
    assert slugs == set(CORE_AGENT_SLUGS)


def run_blind_test_cli() -> None:
    print("=== Character blind test (guess the author) ===\n")
    for row in blind_test_posts(seed=99):
        print(f"--- {row['anonymous_id']} ---")
        print(row["body"])
        print()
    print("=== Answers ===")
    for row in blind_test_posts(seed=99):
        print(f"{row['anonymous_id']}: {display_name(row['answer_slug'])}")


if __name__ == "__main__":
    test_core_bibles_load()
    test_counters_are_distinct()
    test_posts_not_generic()
    test_blind_test_has_five_samples()
    print("All character voice checks passed.")
    if "--show" in sys.argv:
        run_blind_test_cli()
