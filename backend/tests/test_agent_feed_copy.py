"""Tests for agent feed headline/body splitting."""

from __future__ import annotations

from app.forecasting.services.agent_feed_copy import (
    agent_feed_title_body,
    split_headline_body,
    strongest_sentence,
)


def test_strongest_sentence_prefers_assertive_line():
    text = (
        "September modal unchanged.\n"
        "Front-end is pricing fantasy on the cut path.\n"
        "Curve still inverted."
    )
    assert "Front-end" in strongest_sentence(text)


def test_conviction_update_splits_headline_and_body():
    full = (
        "Line moved 3pts. Public on the favourite.\n"
        "Upset path still 58%. Holding."
    )
    title, body = split_headline_body(full, mode="conviction")
    assert title
    assert "58%" in title or "Upset" in title


def test_counter_mode_uses_first_line_only():
    line = "BullBot is pricing hope again. Credit does not care about vibes."
    title, body = split_headline_body(line, mode="counter")
    assert title == line
    assert body == ""


def test_agent_post_first_line_becomes_title():
    full = "Consensus finally caught up.\nThe crowd bought the narrative last week."
    title, body = agent_feed_title_body(full, "agent_post")
    assert title == "Consensus finally caught up."
    assert "crowd" in body


def test_duplicate_title_drops_body():
    line = "Still buying the panic."
    title, body = agent_feed_title_body(line, "agent_post")
    assert title == line
    assert body == ""
