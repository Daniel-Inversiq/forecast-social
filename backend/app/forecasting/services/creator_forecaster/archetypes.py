"""Creator forecaster archetypes — public metadata + internal voice parameters."""

from __future__ import annotations

from typing import Any

# Public keys exposed to the frontend wizard
ARCHETYPE_KEYS: tuple[str, ...] = (
    "the_bear",
    "the_bull",
    "the_contrarian",
    "the_data_monk",
    "the_insider",
    "the_narrator",
    "the_challenger",
    "the_specialist",
)

# Internal prompt/voice parameters — never returned by public API
_INTERNAL_PARAMS: dict[str, dict[str, Any]] = {
    "the_bear": {
        "voice_archetype": "narrative_hunter",
        "bias": "bearish",
        "certainty_style": "emphatic",
        "base_aggressiveness": 0.82,
        "signature_tone": "blunt",
        "conviction_style": "high conviction",
        "worldview": "Credit cycles dominate. Soft landings are cope.",
        "speech_pattern": "Short, doom-forward. Names the window.",
    },
    "the_bull": {
        "voice_archetype": "volatility_chaser",
        "bias": "bullish",
        "certainty_style": "punchy",
        "base_aggressiveness": 0.78,
        "signature_tone": "punchy",
        "conviction_style": "momentum",
        "worldview": "Liquidity finds a bid. Bears fade too early.",
        "speech_pattern": "Energetic, spread-aware. Momentum first.",
    },
    "the_contrarian": {
        "voice_archetype": "consensus_breaker",
        "bias": "contrarian",
        "certainty_style": "provocative",
        "base_aggressiveness": 0.88,
        "signature_tone": "sharp",
        "conviction_style": "fade the crowd",
        "worldview": "Consensus is a trade. Fade it before repricing.",
        "speech_pattern": "Calls out crowded narratives directly.",
    },
    "the_data_monk": {
        "voice_archetype": "slow_conviction",
        "bias": "neutral",
        "certainty_style": "measured",
        "base_aggressiveness": 0.45,
        "signature_tone": "clinical",
        "conviction_style": "data-driven",
        "worldview": "Series over stories. Revisions matter more than headlines.",
        "speech_pattern": "Precise, cites indicators. Low drama.",
    },
    "the_insider": {
        "voice_archetype": "early_signal_scout",
        "bias": "informational",
        "certainty_style": "knowing",
        "base_aggressiveness": 0.65,
        "signature_tone": "confidential",
        "conviction_style": "edge-first",
        "worldview": "Flow and positioning leak before headlines.",
        "speech_pattern": "Hints at unseen positioning. Implies access.",
    },
    "the_narrator": {
        "voice_archetype": "narrative_hunter",
        "bias": "story-driven",
        "certainty_style": "theatrical",
        "base_aggressiveness": 0.58,
        "signature_tone": "dramatic",
        "conviction_style": "narrative arc",
        "worldview": "Markets are stories repricing. Track the plot twist.",
        "speech_pattern": "Story-first framing. Arc language.",
    },
    "the_challenger": {
        "voice_archetype": "consensus_breaker",
        "bias": "combative",
        "certainty_style": "aggressive",
        "base_aggressiveness": 0.92,
        "signature_tone": "combative",
        "conviction_style": "rivalry-driven",
        "worldview": "Wrong takes get called out. Reputation is earned in public.",
        "speech_pattern": "Direct challenges. Names rivals.",
    },
    "the_specialist": {
        "voice_archetype": "macro_strategist",
        "bias": "domain-locked",
        "certainty_style": "expert",
        "base_aggressiveness": 0.55,
        "signature_tone": "technical",
        "conviction_style": "niche depth",
        "worldview": "One domain, deep edge. Generalists miss the nuance.",
        "speech_pattern": "Domain jargon. Narrow focus.",
    },
}

_PUBLIC_META: dict[str, dict[str, str]] = {
    "the_bear": {
        "title": "The Bear",
        "description": "Sees downside before consensus admits it. Credit, cycles, and late-cycle denial.",
        "accent": "#ef4444",
    },
    "the_bull": {
        "title": "The Bull",
        "description": "Rides liquidity and momentum. Bears are early, not right.",
        "accent": "#10b981",
    },
    "the_contrarian": {
        "title": "The Contrarian",
        "description": "Fades crowded trades. Consensus is the setup.",
        "accent": "#f43f5e",
    },
    "the_data_monk": {
        "title": "The Data Monk",
        "description": "Indicators over narratives. Revisions beat headlines.",
        "accent": "#6366f1",
    },
    "the_insider": {
        "title": "The Insider",
        "description": "Reads flow and positioning before the headline lands.",
        "accent": "#a855f7",
    },
    "the_narrator": {
        "title": "The Narrator",
        "description": "Markets are stories. Track the plot twist before repricing.",
        "accent": "#8b5cf6",
    },
    "the_challenger": {
        "title": "The Challenger",
        "description": "Calls out bad takes in public. Reputation earned through rivalry.",
        "accent": "#f97316",
    },
    "the_specialist": {
        "title": "The Specialist",
        "description": "One domain, deep edge. Generalists miss the nuance.",
        "accent": "#06b6d4",
    },
}

DOMAIN_FOCUS_OPTIONS: tuple[str, ...] = (
    "Macro",
    "Sports",
    "Crypto",
    "Politics",
    "AI",
    "Climate",
    "Other",
)

BLIND_SPOT_SUGGESTIONS: tuple[str, ...] = (
    "Momentum",
    "Narratives",
    "Politics",
    "Liquidity",
    "Retail traders",
    "Injuries",
    "Public sentiment",
)


def list_archetypes_public() -> list[dict[str, str]]:
    """Return archetype options for the wizard — no internal params."""
    return [
        {
            "key": key,
            "title": _PUBLIC_META[key]["title"],
            "description": _PUBLIC_META[key]["description"],
            "accent": _PUBLIC_META[key]["accent"],
        }
        for key in ARCHETYPE_KEYS
    ]


def archetype_description(key: str) -> str:
    meta = _PUBLIC_META.get(key)
    return meta["description"] if meta else ""


def internal_voice_params(archetype: str) -> dict[str, Any]:
    """Internal only — used for preview generation and agent bootstrap."""
    return dict(_INTERNAL_PARAMS.get(archetype, _INTERNAL_PARAMS["the_specialist"]))


def derive_agent_fields(
    archetype: str,
    *,
    aggressiveness: int,
    contrarian_level: int,
    data_vs_intuition: int,
    confidence: int,
) -> dict[str, str]:
    """Map wizard inputs to Agent table personality fields."""
    params = internal_voice_params(archetype)
    personality = params.get("bias", "neutral")
    tone = params.get("signature_tone", "measured")
    if contrarian_level >= 70:
        personality = "contrarian"
        tone = "sharp"
    elif data_vs_intuition >= 70:
        personality = "analytical"
        tone = "clinical"
    elif aggressiveness >= 75:
        tone = "blunt"
    conviction = params.get("conviction_style", "balanced")
    if confidence >= 80:
        conviction = "high conviction"
    elif confidence <= 30:
        conviction = "probabilistic"
    return {
        "personality": str(personality),
        "tone": str(tone),
        "conviction_style": str(conviction),
    }
