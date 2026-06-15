"""Tests for creator forecaster differentiation scoring."""

from __future__ import annotations

from app.forecasting.services.creator_forecaster.differentiation import (
    ForecasterProfile,
    _compare_profiles,
    _level_for_score,
    score_differentiation,
)


def test_level_thresholds():
    assert _level_for_score(20) == "distinct"
    assert _level_for_score(50) == "some_overlap"
    assert _level_for_score(70) == "too_close"
    assert _level_for_score(85) == "clone_risk"


def test_distinct_bear_macro_differs_from_doombot_profile():
    candidate = ForecasterProfile(
        slug="mine",
        name="Mine",
        archetype="the_bear",
        domain_focus="Climate",
        blind_spot="Ignores supply-chain bottlenecks in renewables",
        aggressiveness=40,
        humor=55,
        contrarian_level=30,
        data_vs_intuition=80,
        confidence=45,
        short_bio="Tracks carbon policy shocks, not credit spreads.",
        sample_texts=["EU ETS auction clears weak — heat stress repricing is the trade."],
    )
    doombot = ForecasterProfile(
        slug="doombot",
        name="DoomBot",
        archetype="the_bear",
        domain_focus="Macro",
        blind_spot="Upside reflexivity and coordinated policy puts",
        aggressiveness=82,
        humor=30,
        contrarian_level=55,
        data_vs_intuition=45,
        confidence=75,
        short_bio="Systems are more fragile than consensus prices.",
        sample_texts=["Credit impulse negative. Soft landing is cope."],
    )
    breakdown = _compare_profiles(candidate, doombot)
    assert breakdown.similarity_score < 65


def test_clone_risk_when_cloning_doombot_sliders_and_copy():
    candidate = ForecasterProfile(
        slug="clone",
        name="Clone",
        archetype="the_bear",
        domain_focus="Macro",
        blind_spot="Upside reflexivity and coordinated policy puts",
        aggressiveness=82,
        humor=30,
        contrarian_level=55,
        data_vs_intuition=45,
        confidence=75,
        short_bio="Systems are more fragile than consensus prices.",
        sample_texts=["Credit impulse negative. Soft landing is cope — recession window Q3–Q4."],
    )
    doombot = ForecasterProfile(
        slug="doombot",
        name="DoomBot",
        archetype="the_bear",
        domain_focus="Macro",
        blind_spot="Upside reflexivity and coordinated policy puts",
        aggressiveness=82,
        humor=30,
        contrarian_level=55,
        data_vs_intuition=45,
        confidence=75,
        short_bio="Systems are more fragile than consensus prices.",
        sample_texts=["Credit impulse negative. Soft landing is cope — recession window Q3–Q4."],
    )
    breakdown = _compare_profiles(candidate, doombot)
    assert breakdown.similarity_score >= 80


def test_score_differentiation_empty_db(monkeypatch):
    class FakeQuery:
        def filter(self, *args, **kwargs):
            return self

        def all(self):
            return []

        def first(self):
            return None

    class FakeSession:
        def query(self, model):
            return FakeQuery()

    result = score_differentiation(
        FakeSession(),
        archetype="the_specialist",
        domain_focus="AI",
        blind_spot="Overweights benchmark headlines",
        aggressiveness=50,
        humor=50,
        contrarian_level=50,
        data_vs_intuition=60,
        confidence=50,
    )
    assert "similarity_score" in result
    assert "differentiation_score" in result
    assert result["can_publish"] is True or result["can_publish"] is False
