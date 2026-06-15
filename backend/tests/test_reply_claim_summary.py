"""Reply claim cleaning, summarization, and grammar guards."""

from __future__ import annotations

import pytest

from app.forecasting.services.reply_claim_summary import (
    claim_summary,
    clean_source_claim,
    is_broken_reply_grammar,
)
from app.forecasting.services.voice_engine import anchor_rival_reply_to_claim


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("Soft landing is cope.", "soft landing"),
        ("The bid is still there.", "the bid"),
        ("Watching the statement language, not the decision.", "statement language"),
        ("Nobody is pricing the downside.", "downside risk"),
        ("DoomBot's read: The bid is still there.", "the bid"),
        ("Re: Watching the statement language, not the decision.", "statement language"),
        ("The data on The bid is still there.", "the bid"),
    ],
)
def test_claim_summary_examples(raw: str, expected: str):
    assert claim_summary(raw, None) == expected


def test_clean_source_claim_strips_agent_reads():
    assert clean_source_claim("FedWatcher's read: curve still inverted") == "curve still inverted"
    assert clean_source_claim("DoomBot's read on the mechanism is consistent") == ""


@pytest.mark.parametrize(
    "broken",
    [
        "The data on Watching the statement language, not the decision may be right, but BullBot is assuming the market has not repriced it.",
        "The data on The bid is still there may be right, but DoomBot is assuming the market has not repriced it.",
        "The data on DoomBot's read on the mechanism is consistent may be right, but FedWatcher is assuming the market has not repriced it.",
        "Taking the underdog side. The data on The bid is still there may be right, but SportsChaos is assuming the market has not repriced it.",
        "The data may be right, but may be right, but you are early.",
        "DoomBot's read on the mechanism is consistent with the front-end.",
    ],
)
def test_is_broken_reply_grammar_rejects_known_bad_outputs(broken: str):
    assert is_broken_reply_grammar(
        broken,
        source_title="Watching the statement language, not the decision.",
        source_body="",
    )


def test_anchor_rival_reply_avoids_nested_headline_injection():
    line = anchor_rival_reply_to_claim(
        "macro-oracle",
        "bullbot",
        "You're wrong.",
        source_title="Watching the statement language, not the decision.",
        source_body="",
        seed=42,
    )
    lower = line.lower()
    assert "the data on watching" not in lower
    assert "the data on the" not in lower
    assert "may be right, but" in lower
    assert not is_broken_reply_grammar(
        line,
        source_title="Watching the statement language, not the decision.",
        source_body="",
    )


def test_anchor_rival_reply_uses_short_claim_for_bid():
    line = anchor_rival_reply_to_claim(
        "doombot",
        "bullbot",
        "I disagree.",
        source_title="The bid is still there.",
        source_body="Pullback — dip still there",
        seed=7,
    )
    lower = line.lower()
    assert "the data on the bid" in lower or "on the bid" in lower
    assert "the data on the bid is still there" not in lower
    assert not is_broken_reply_grammar(
        line,
        source_title="The bid is still there.",
        source_body="Pullback — dip still there",
    )


def test_anchor_rival_reply_omits_claim_when_summary_unusable():
    line = anchor_rival_reply_to_claim(
        "fed-watcher",
        "doombot",
        "You're wrong.",
        source_title="DoomBot's read on the mechanism is consistent with the front-end.",
        source_body="",
        seed=99,
    )
    assert not is_broken_reply_grammar(
        line,
        source_title="DoomBot's read on the mechanism is consistent with the front-end.",
        source_body="",
    )
    assert "the data on doombot" not in line.lower()
