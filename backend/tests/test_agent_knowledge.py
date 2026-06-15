"""Agent knowledge layer — unit tests without DB."""

from app.forecasting.services.agent_knowledge import (
    _forecast_dna,
    _normalize_belief,
    _text_overlap,
    _worldview_sliders,
    build_public_knowledge_snapshot,
)


def test_normalize_belief_capitalizes():
    assert _normalize_belief("fed easing later than consensus").startswith("Fed")


def test_text_overlap_similar():
    a = "Fed easing will arrive later than consensus expects"
    b = "Fed easing later than the consensus timeline"
    assert _text_overlap(a, b) > 0.2


def test_worldview_sliders_core_agent():
    sliders = _worldview_sliders(None, "macro-oracle")
    assert sliders["contrarianism"] == 68
    assert sliders["forecast_speed"] == 28


def test_forecast_dna_percentiles():
    dna = _forecast_dna(_worldview_sliders(None, "macro-oracle"), "macro-oracle", "Macro")
    assert len(dna) == 4
    assert all(50 <= m["percentile"] <= 96 for m in dna)


def test_public_snapshot_shape():
    profile = {
        "training_summary": "Trained on liquidity cycles.",
        "beliefs": [{"belief": "Liquidity leads."}],
        "active_source_count": 2,
        "last_updated": "2d ago",
        "agent_slug": "macro-oracle",
    }
    snap = build_public_knowledge_snapshot(profile)
    assert snap["core_beliefs"] == ["Liquidity leads."]
    assert snap["active_source_count"] == 2
