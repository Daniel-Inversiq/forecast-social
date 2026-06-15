"""Template-based preview generation for creator forecasters — no LLM required."""

from __future__ import annotations

import random
from typing import Any

from app.forecasting.services.creator_forecaster.archetypes import internal_voice_params
from app.forecasting.services.creator_forecaster.knowledge import knowledge_flavor_phrase

SAMPLE_MARKETS: tuple[str, ...] = (
    "Fed cuts by September 2026?",
    "BTC above $150k by year end?",
    "US recession before Q4?",
    "Chiefs cover -3.5 this weekend?",
    "NVDA beats Q2 estimates?",
)

RIVAL_NAMES: tuple[str, ...] = (
    "the consensus",
    "Macro Oracle",
    "BullBot",
    "DoomBot",
    "retail flow",
)


def _rng(seed: int | None) -> random.Random:
    return random.Random(seed)


def _tone_opener(params: dict[str, Any], confidence: int) -> str:
    bias = params.get("bias", "neutral")
    if confidence >= 75:
        cert = "Lock it in."
    elif confidence <= 35:
        cert = "Could go either way, but"
    else:
        cert = "Conviction building."
    if bias == "bearish":
        return f"{cert} The downside is underpriced."
    if bias == "bullish":
        return f"{cert} Liquidity still has a bid."
    if bias == "contrarian":
        return f"{cert} The crowd is wrong here."
    return f"{cert} The setup is clearer than consensus thinks."


def _forecast_line(
    rng: random.Random,
    params: dict[str, Any],
    *,
    display_name: str,
    domain_focus: str,
    blind_spot: str,
    market: str,
    confidence: int,
    data_vs_intuition: int,
    knowledge_context: dict[str, Any] | None = None,
) -> str:
    opener = _tone_opener(params, confidence)
    domain = domain_focus or "markets"
    if data_vs_intuition >= 65:
        evidence = rng.choice(
            [
                "The series flipped last week.",
                "Revisions tell the story the headline missed.",
                "Positioning data disagrees with the narrative.",
            ]
        )
    else:
        evidence = rng.choice(
            [
                "The vibe shifted before the data confirmed.",
                "You can feel the repricing starting.",
                "This has the smell of a crowded trade.",
            ]
        )
    knowledge_bit = ""
    if knowledge_context and rng.random() > 0.35:
        flavor = knowledge_flavor_phrase(knowledge_context, rng)
        if flavor:
            knowledge_bit = f" My research frames this around {flavor.lower().rstrip('.')}."
    blind = ""
    if blind_spot and rng.random() > 0.5:
        blind = f" (I'm probably underweighting {blind_spot.lower()} again.)"
    return f"{display_name}: {market} — {opener} {evidence}{knowledge_bit} Watching {domain}.{blind}"


def _rivalry_line(
    rng: random.Random,
    params: dict[str, Any],
    *,
    display_name: str,
    aggressiveness: int,
    rival: str,
    knowledge_context: dict[str, Any] | None = None,
) -> str:
    knowledge_suffix = ""
    if knowledge_context and rng.random() > 0.5:
        flavor = knowledge_flavor_phrase(knowledge_context, rng)
        if flavor:
            knowledge_suffix = f" My read on {flavor.lower().rstrip('.')} still holds."
    if aggressiveness >= 70:
        templates = [
            f"{display_name}: {rival} is pricing hope, not probability.{knowledge_suffix}",
            f"{display_name}: If {rival} is right, I'll eat the receipt. They won't be.{knowledge_suffix}",
            f"{display_name}: {rival} keeps fading the same signal. Bold strategy.{knowledge_suffix}",
        ]
    else:
        templates = [
            f"{display_name}: Respectfully disagree with {rival} on timing here.{knowledge_suffix}",
            f"{display_name}: {rival}'s read isn't crazy — just early.{knowledge_suffix}",
            f"{display_name}: Different path than {rival}, same market.{knowledge_suffix}",
        ]
    return rng.choice(templates)


def _win_line(rng: random.Random, *, display_name: str, confidence: int) -> str:
    if confidence >= 70:
        return rng.choice(
            [
                f"{display_name}: Called it. Receipt posted. Next.",
                f"{display_name}: Timing was the edge. Crowd was late.",
                f"{display_name}: Verified. The thesis held.",
            ]
        )
    return rng.choice(
        [
            f"{display_name}: Got this one right — barely.",
            f"{display_name}: Win logged. Still calibrating.",
            f"{display_name}: Correct call. Confidence unchanged.",
        ]
    )


def _loss_line(rng: random.Random, *, display_name: str, blind_spot: str) -> str:
    blind = blind_spot.lower() if blind_spot else "second-order effects"
    return rng.choice(
        [
            f"{display_name}: Missed it. Underestimated {blind} — again.",
            f"{display_name}: Wrong. {blind.capitalize()} got me. Adjusting.",
            f"{display_name}: Loss taken. Blind spot on {blind} is real.",
        ]
    )


def generate_preview(
    *,
    display_name: str,
    archetype: str,
    domain_focus: str,
    blind_spot: str,
    aggressiveness: int,
    humor: int,
    contrarian_level: int,
    data_vs_intuition: int,
    confidence: int,
    seed: int | None = None,
    knowledge_context: dict[str, Any] | None = None,
    knowledge_sources: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    rng = _rng(seed)
    params = internal_voice_params(archetype)
    name = display_name or "Your Forecaster"
    markets = rng.sample(list(SAMPLE_MARKETS), k=min(3, len(SAMPLE_MARKETS)))
    rivals = rng.sample(list(RIVAL_NAMES), k=2)

    forecasts = [
        _forecast_line(
            rng,
            params,
            display_name=name,
            domain_focus=domain_focus,
            blind_spot=blind_spot,
            market=m,
            confidence=confidence,
            data_vs_intuition=data_vs_intuition,
            knowledge_context=knowledge_context,
        )
        for m in markets
    ]
    rivalry_reactions = [
        _rivalry_line(
            rng,
            params,
            display_name=name,
            aggressiveness=aggressiveness,
            rival=r,
            knowledge_context=knowledge_context,
        )
        for r in rivals
    ]
    return {
        "forecasts": forecasts,
        "rivalry_reactions": rivalry_reactions,
        "winning_reaction": _win_line(rng, display_name=name, confidence=confidence),
        "losing_reaction": _loss_line(rng, display_name=name, blind_spot=blind_spot),
        "seed": seed,
        "knowledge_used": bool(knowledge_context),
        "knowledge_sources": knowledge_sources or [],
    }
