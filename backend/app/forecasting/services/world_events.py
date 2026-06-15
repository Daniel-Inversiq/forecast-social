from __future__ import annotations

import re
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime, timedelta
from difflib import SequenceMatcher
from email.utils import parsedate_to_datetime
from typing import Any
from urllib.request import Request, urlopen
from xml.etree import ElementTree
import hashlib

from sqlalchemy.orm import Session

from app import settings
from app.forecasting.models import Agent, EventCandidate, FeedEvent, Market, ScheduledEventArc
from app.forecasting.services.agent_reactions import build_reaction_suggestions
from app.forecasting.services.event_summary_cleaner import prepare_candidate_text
from app.forecasting.services.event_duration import (
    DURATION_LABELS,
    DURATION_WINDOWS,
    DurationType,
    coerce_duration_type,
    duration_label,
    suggested_resolution_date,
)
from app.forecasting.services.feed_timing import iso_utc, source_event_time_from_meta

CATEGORY_KEYWORDS: dict[str, tuple[str, ...]] = {
    "macro": ("inflation", "cpi", "gdp", "fed", "rates", "yield", "central bank", "jobs"),
    "geopolitics": ("war", "sanction", "conflict", "ceasefire", "border", "nato", "diplomatic"),
    "sports": ("world cup", "nba", "nfl", "olympic", "championship", "final", "matchday"),
    "crypto": ("bitcoin", "ethereum", "btc", "eth", "token", "sec", "defi", "onchain"),
    "ai": ("openai", "model", "llm", "inference", "chip", "gpu", "agentic", "alignment"),
    "climate": ("emissions", "hurricane", "climate", "wildfire", "drought", "temperature"),
    "politics": ("election", "parliament", "senate", "debate", "campaign", "vote", "poll"),
}


def _clamp(value: float, lo: float = 0.0, hi: float = 100.0) -> float:
    return max(lo, min(hi, value))


def _source_weights(
    *,
    credibility: float,
    volatility: float,
    outsider: float,
) -> dict[str, float]:
    return {
        "credibility_weight": round(_clamp(credibility, 0.0, 1.0), 2),
        "volatility_weight": round(_clamp(volatility, 0.0, 1.0), 2),
        "outsider_interest_weight": round(_clamp(outsider, 0.0, 1.0), 2),
    }


_CATEGORY_DEFAULT_WEIGHTS: dict[str, dict[str, float]] = {
    "macro": _source_weights(credibility=0.82, volatility=0.55, outsider=0.62),
    "geopolitics": _source_weights(credibility=0.84, volatility=0.62, outsider=0.72),
    "politics": _source_weights(credibility=0.83, volatility=0.72, outsider=0.86),
    "crypto": _source_weights(credibility=0.74, volatility=0.78, outsider=0.68),
    "ai": _source_weights(credibility=0.8, volatility=0.66, outsider=0.7),
    "sports": _source_weights(credibility=0.8, volatility=0.74, outsider=0.9),
    "climate": _source_weights(credibility=0.81, volatility=0.52, outsider=0.64),
}

# Max share of recent candidates any single category may occupy before ingest throttling.
_CATEGORY_QUEUE_SHARE_CAP: dict[str, float] = {
    "crypto": 0.22,
    "sports": 0.24,
    "politics": 0.22,
    "macro": 0.26,
    "geopolitics": 0.24,
    "ai": 0.2,
    "climate": 0.18,
}
_DIVERSITY_WINDOW = 48
_DEFAULT_INGEST_LIMIT = 6

_ANCHOR_KEYWORDS = (
    "world cup",
    "olympics",
    "olympic",
    "presidential election",
    "election cycle",
    "general election",
    "geopolitical arc",
    "decade",
    "multi-year",
    "long arc",
    "regime change",
    "cold war",
    "peace process",
)
_MONTHLY_KEYWORDS = (
    "regime",
    "policy arc",
    "climate target",
    "net zero",
    "emissions target",
    "structural",
    "macro regime",
    "rate cycle",
    "inflation path",
    "housing market",
    "recession risk",
    "fiscal",
)
_WEEKLY_KEYWORDS = (
    "this week",
    "next week",
    "week ahead",
    "matchday",
    "match day",
    "playoff",
    "injury",
    "lineup",
    "earnings week",
    "jobs report",
    "payrolls",
    "debate",
    "primary",
    "cpi print",
    "inflation report",
)
_DAILY_KEYWORDS = (
    "tonight",
    "today",
    "tomorrow",
    "this morning",
    "breaking",
    "game day",
    "kickoff",
    "final whistle",
    "injury report",
    "lineup news",
    "fed day",
    "fomc",
    "earnings today",
    "cpi today",
    "shock",
    "surprise",
)
_SPORTS_DAILY = ("match", "game", "vs ", " v ", "final", "score", "injury", "trade")
_SPORTS_WEEKLY = ("playoff", "series", "tournament", "round of")
_EARNINGS_MACRO = ("earnings", "cpi", "fed", "fomc", "jobs", "payroll", "gdp", "ppi", "rate decision")

DEFAULT_SOURCE_GROUPS: dict[str, tuple[dict[str, Any], ...]] = {
    "macro": (
        {
            "type": "rss",
            "name": "Reuters Business",
            "url": "https://feeds.reuters.com/reuters/businessNews",
            **_source_weights(credibility=0.9, volatility=0.58, outsider=0.66),
        },
        {
            "type": "rss",
            "name": "Bloomberg Markets",
            "url": "https://feeds.bloomberg.com/markets/news.rss",
            **_source_weights(credibility=0.92, volatility=0.64, outsider=0.7),
        },
    ),
    "geopolitics": (
        {
            "type": "rss",
            "name": "Reuters World",
            "url": "https://feeds.reuters.com/Reuters/worldNews",
            **_source_weights(credibility=0.9, volatility=0.65, outsider=0.74),
        },
        {
            "type": "rss",
            "name": "AP World News",
            "url": "https://apnews.com/hub/world-news?format=rss",
            **_source_weights(credibility=0.91, volatility=0.62, outsider=0.76),
        },
        {
            "type": "rss",
            "name": "Financial Times World",
            "url": "https://www.ft.com/world?format=rss",
            **_source_weights(credibility=0.93, volatility=0.6, outsider=0.68),
        },
    ),
    "politics": (
        {
            "type": "rss",
            "name": "Politico",
            "url": "https://www.politico.com/rss/politics08.xml",
            **_source_weights(credibility=0.86, volatility=0.76, outsider=0.88),
        },
        {
            "type": "rss",
            "name": "Axios Politics",
            "url": "https://api.axios.com/feed/politics",
            **_source_weights(credibility=0.85, volatility=0.72, outsider=0.84),
        },
    ),
    "crypto": (
        {
            "type": "rss",
            "name": "CoinDesk",
            "url": "https://www.coindesk.com/arc/outboundfeeds/rss/",
            **_source_weights(credibility=0.8, volatility=0.8, outsider=0.7),
        },
        {
            "type": "rss",
            "name": "The Block",
            "url": "https://www.theblock.co/rss.xml",
            **_source_weights(credibility=0.84, volatility=0.78, outsider=0.72),
        },
        {
            "type": "rss",
            "name": "Decrypt",
            "url": "https://decrypt.co/feed",
            **_source_weights(credibility=0.76, volatility=0.82, outsider=0.74),
        },
    ),
    "ai": (
        {
            "type": "rss",
            "name": "VentureBeat AI",
            "url": "https://venturebeat.com/category/ai/feed/",
            **_source_weights(credibility=0.82, volatility=0.68, outsider=0.72),
        },
    ),
    "sports": (
        {
            "type": "rss",
            "name": "ESPN",
            "url": "https://www.espn.com/espn/rss/news",
            **_source_weights(credibility=0.86, volatility=0.76, outsider=0.92),
        },
        {
            "type": "rss",
            "name": "Sky Sports",
            "url": "https://www.skysports.com/rss/12040",
            **_source_weights(credibility=0.84, volatility=0.74, outsider=0.9),
        },
    ),
    "climate": (
        {
            "type": "rss",
            "name": "Climate Home News",
            "url": "https://www.climatechangenews.com/feed/",
            **_source_weights(credibility=0.83, volatility=0.5, outsider=0.62),
        },
    ),
}

_INGEST_STATUS_BY_SOURCE_KEY: dict[str, dict[str, Any]] = {}


def _weights_for_category(category: str) -> dict[str, float]:
    return dict(_CATEGORY_DEFAULT_WEIGHTS.get((category or "macro").lower(), _CATEGORY_DEFAULT_WEIGHTS["macro"]))


def _weights_from_source_config(src: dict[str, Any], category: str) -> dict[str, float]:
    base = _weights_for_category(category)
    return {
        "credibility_weight": float(src.get("credibility_weight", base["credibility_weight"])),
        "volatility_weight": float(src.get("volatility_weight", base["volatility_weight"])),
        "outsider_interest_weight": float(src.get("outsider_interest_weight", base["outsider_interest_weight"])),
    }


def _editorial_signal_from_source_weights(weights: dict[str, float] | None) -> dict[str, float]:
    """Credibility-gated boosts: volatile but low-credibility sources cannot dominate alone."""
    if not weights:
        return {"signal_quality": 0.0, "outsider_boost": 0.0, "timing_boost": 0.0, "rivalry_boost": 0.0}
    cred = float(weights.get("credibility_weight", 0.65))
    vol = float(weights.get("volatility_weight", 0.5))
    outsider_w = float(weights.get("outsider_interest_weight", 0.5))
    signal_quality = cred * (0.45 + 0.55 * vol)
    return {
        "signal_quality": signal_quality,
        "outsider_boost": min(10.0, outsider_w * signal_quality * 14.0),
        "timing_boost": min(7.0, vol * signal_quality * 11.0),
        "rivalry_boost": min(6.0, vol * signal_quality * 9.0),
    }


def _recent_category_share(db: Session, category: str) -> float:
    recent = (
        db.query(EventCandidate)
        .order_by(EventCandidate.detected_at.desc())
        .limit(_DIVERSITY_WINDOW)
        .all()
    )
    if not recent:
        return 0.0
    normalized = (category or "macro").lower()
    count = sum(1 for row in recent if (row.category or "").lower().strip() == normalized)
    return count / len(recent)


def _category_within_diversity_quota(db: Session, category: str) -> bool:
    share = _recent_category_share(db, category)
    cap = _CATEGORY_QUEUE_SHARE_CAP.get((category or "macro").lower(), 0.25)
    return share < cap


def _ingest_limit_for_source(db: Session, source: dict[str, Any]) -> int:
    category = str(source.get("category") or "macro")
    base = int(source.get("limit") or _DEFAULT_INGEST_LIMIT)
    share = _recent_category_share(db, category)
    cap = _CATEGORY_QUEUE_SHARE_CAP.get(category.lower(), 0.25)
    if share >= cap:
        return max(2, base // 3)
    if share >= cap * 0.85:
        return max(3, base // 2)
    return base


@dataclass
class CandidateSuggestion:
    market_ids: list[int]
    agent_ids: list[int]
    arc_type: str


def _keyword_hits(text: str, keywords: tuple[str, ...]) -> int:
    return sum(1 for keyword in keywords if keyword in text)


def _sample_reason(topics: list[str]) -> str:
    if not topics:
        return "general network relevance"
    return ", ".join(topics[:3])


def _category_profile(category: str) -> dict[str, Any]:
    base_profile = {
        "weights": {
            "disagreement_potential": 0.12,
            "macro_relevance": 0.12,
            "market_repricing_likelihood": 0.12,
            "coalition_overlap": 0.08,
            "emotional_volatility": 0.08,
            "timing_uncertainty": 0.08,
            "narrative_divisiveness": 0.1,
            "historical_parallels": 0.08,
            "agent_specialization_overlap": 0.07,
            "possible_reputation_migration": 0.08,
            "season_impact_potential": 0.07,
        },
        "fatigue_multiplier": 1.0,
        "low_conflict_suppression": 0.0,
    }
    profiles: dict[str, dict[str, Any]] = {
        "macro": {
            "weights": {
                "market_repricing_likelihood": 0.17,
                "timing_uncertainty": 0.15,
                "macro_relevance": 0.14,
                "disagreement_potential": 0.11,
                "season_impact_potential": 0.11,
            },
            "fatigue_multiplier": 1.0,
            "low_conflict_suppression": 0.0,
        },
        "geopolitics": {
            "weights": {
                "emotional_volatility": 0.14,
                "market_repricing_likelihood": 0.13,
                "timing_uncertainty": 0.12,
                "outsider_interest_score": 0.11,
                "escalation_risk": 0.11,
            },
            "fatigue_multiplier": 0.95,
            "low_conflict_suppression": 0.0,
        },
        "crypto": {
            "weights": {
                "market_repricing_likelihood": 0.16,
                "timing_uncertainty": 0.11,
                "disagreement_potential": 0.12,
                "emotional_volatility": 0.12,
                "narrative_divisiveness": 0.11,
                "attention_velocity": 0.12,
            },
            "fatigue_multiplier": 1.1,
            "low_conflict_suppression": 3.0,
        },
        "ai": {
            "weights": {
                "market_repricing_likelihood": 0.15,
                "macro_relevance": 0.11,
                "disagreement_potential": 0.11,
                "timing_uncertainty": 0.11,
                "narrative_divisiveness": 0.11,
                "capability_shock": 0.13,
            },
            "fatigue_multiplier": 1.08,
            "low_conflict_suppression": 5.0,
        },
        "sports": {
            "weights": {
                "timing_uncertainty": 0.15,
                "emotional_volatility": 0.14,
                "outsider_interest_score": 0.12,
                "disagreement_potential": 0.1,
                "narrative_divisiveness": 0.09,
                "injury_shock": 0.12,
            },
            "fatigue_multiplier": 0.95,
            "low_conflict_suppression": 4.0,
        },
        "climate": {
            "weights": {
                "market_repricing_likelihood": 0.14,
                "macro_relevance": 0.12,
                "disagreement_potential": 0.11,
                "timing_uncertainty": 0.11,
                "season_impact_potential": 0.1,
                "narrative_divisiveness": 0.11,
            },
            "fatigue_multiplier": 1.15,
            "low_conflict_suppression": 9.0,
        },
        "politics": {
            "weights": {
                "timing_uncertainty": 0.14,
                "disagreement_potential": 0.13,
                "outsider_interest_score": 0.12,
                "narrative_divisiveness": 0.12,
                "emotional_volatility": 0.1,
                "season_impact_potential": 0.1,
            },
            "fatigue_multiplier": 1.0,
            "low_conflict_suppression": 2.0,
        },
    }
    profile = dict(base_profile)
    selected = profiles.get(category, {})
    profile["weights"] = {**base_profile["weights"], **selected.get("weights", {})}
    profile["fatigue_multiplier"] = selected.get("fatigue_multiplier", base_profile["fatigue_multiplier"])
    profile["low_conflict_suppression"] = selected.get(
        "low_conflict_suppression",
        base_profile["low_conflict_suppression"],
    )
    return profile


def _top_reason_lines(category: str, scored: dict[str, float]) -> list[str]:
    reason_templates: dict[str, dict[str, str]] = {
        "macro": {
            "market_repricing_likelihood": "High repricing potential from rates/inflation/liquidity signals.",
            "timing_uncertainty": "Timing uncertainty raises split forecasts and path dependence.",
            "macro_relevance": "Direct macro-policy relevance with broad market transmission.",
            "disagreement_potential": "Agent disagreement is likely on policy path and landing.",
            "season_impact_potential": "Material chance to reshape the current macro season narrative.",
        },
        "geopolitics": {
            "emotional_volatility": "Escalation language implies elevated emotional volatility.",
            "market_repricing_likelihood": "Energy/security spillover can force cross-market repricing.",
            "timing_uncertainty": "Uncertain escalation path increases market uncertainty.",
            "outsider_interest_score": "Public stakes are legible to outsiders, boosting attention.",
            "escalation_risk": "Escalation risk is non-trivial based on conflict cues.",
        },
        "crypto": {
            "market_repricing_likelihood": "Reflexive crypto positioning can reprice quickly.",
            "timing_uncertainty": "Liquidity/timing uncertainty can trigger rapid reversals.",
            "disagreement_potential": "Strong bull-vs-bear split suggests agent conflict.",
            "emotional_volatility": "Attention and sentiment volatility are elevated.",
            "attention_velocity": "Meme/news velocity suggests crowding risk in feed reactions.",
        },
        "ai": {
            "capability_shock": "Potential capability shock raises valuation and thesis pressure.",
            "market_repricing_likelihood": "Compute/regulation implications can drive repricing.",
            "disagreement_potential": "Acceleration-vs-skeptic camps are likely to diverge.",
            "timing_uncertainty": "Uncertain commercialization/regulatory timing increases instability.",
            "narrative_divisiveness": "Narrative split is clear enough to sustain debate arcs.",
        },
        "sports": {
            "injury_shock": "Injury/news shock materially changes expected outcomes.",
            "timing_uncertainty": "Near-term event timing creates high reaction pressure.",
            "emotional_volatility": "Fan attention and emotion profile are elevated.",
            "outsider_interest_score": "Outcome stakes are easy to follow for broader audiences.",
            "disagreement_potential": "Rival forecast camps can activate agent rivalry.",
        },
        "climate": {
            "market_repricing_likelihood": "Policy/transition risk can reprice energy and insurance narratives.",
            "macro_relevance": "Climate-event spillovers connect to broader macro and energy regimes.",
            "disagreement_potential": "Transition conflict suggests durable ideological disagreement.",
            "timing_uncertainty": "Policy and implementation timing remains contested.",
            "season_impact_potential": "Potential to alter the broader transition-season storyline.",
        },
        "politics": {
            "timing_uncertainty": "Election timing and event sequencing remain uncertain.",
            "disagreement_potential": "Ideological conflict is likely to fracture consensus.",
            "outsider_interest_score": "High public attention and social stakes increase relevance.",
            "narrative_divisiveness": "Clear camps create sustained narrative contest.",
            "emotional_volatility": "Debate/media cycle can increase emotional intensity.",
        },
    }
    templates = reason_templates.get(category, reason_templates["macro"])
    ranked = sorted(scored.items(), key=lambda item: item[1], reverse=True)
    reasons: list[str] = []
    for key, _ in ranked:
        if key in templates:
            reasons.append(templates[key])
        if len(reasons) >= 4:
            break
    return reasons[:4]


def _build_editorial_intelligence(
    db: Session,
    *,
    title: str,
    summary: str,
    category: str,
    detected_at: datetime,
    suggested_agent_ids: list[int],
    suggested_market_ids: list[int],
    source_weights: dict[str, float] | None = None,
) -> dict[str, Any]:
    text = _normalize_text(f"{title} {summary}")
    category = (category or "macro").lower()
    profile = _category_profile(category)
    age_hours = max(0.0, (datetime.utcnow() - detected_at).total_seconds() / 3600.0)

    shock_hits = _keyword_hits(
        text,
        (
            "surprise",
            "unexpected",
            "shock",
            "ban",
            "halt",
            "war",
            "lawsuit",
            "crisis",
            "breakdown",
            "liquidation",
            "default",
        ),
    )
    uncertainty_hits = _keyword_hits(
        text,
        ("could", "may", "uncertain", "uncertainty", "debate", "split", "contested", "timing", "if"),
    )
    macro_hits = _keyword_hits(
        text,
        ("fed", "rates", "inflation", "election", "gdp", "jobs", "war", "oil", "treasury", "sec"),
    )
    emotion_hits = _keyword_hits(
        text,
        ("fear", "panic", "anger", "rage", "protest", "collapse", "surge", "crash", "bloodbath", "hype"),
    )
    divisive_hits = _keyword_hits(
        text,
        ("left", "right", "hawk", "dove", "bull", "bear", "winners", "losers", "blame", "boycott"),
    )
    reprice_hits = _keyword_hits(
        text,
        ("repricing", "reprice", "reset", "pivot", "u-turn", "guidance cut", "downgrade", "upgrade", "miss"),
    )
    callback_hits = _keyword_hits(
        text,
        ("again", "returns", "repeat", "echo", "as in", "similar to", "last season", "rematch", "revisit"),
    )
    outsider_hits = _keyword_hits(
        text,
        ("consumer", "jobs", "election", "war", "inflation", "mortgage", "energy", "wages", "tax"),
    )
    rates_liquidity_hits = _keyword_hits(
        text,
        ("rates", "inflation", "liquidity", "yield", "treasury", "cpi", "fomc", "central bank"),
    )
    escalation_hits = _keyword_hits(
        text,
        ("missile", "strike", "troops", "retaliation", "mobilization", "nuclear", "sanction", "blockade"),
    )
    crypto_reflexivity_hits = _keyword_hits(
        text,
        ("liquidation", "funding", "open interest", "etf", "sec", "onchain", "whale", "short squeeze", "meme"),
    )
    ai_shock_hits = _keyword_hits(
        text,
        ("breakthrough", "agi", "frontier", "chip export", "inference", "compute", "datacenter", "open source"),
    )
    sports_shock_hits = _keyword_hits(
        text,
        ("injury", "lineup", "suspension", "odds", "matchday", "playoff", "final", "knockout", "upset"),
    )
    climate_policy_hits = _keyword_hits(
        text,
        ("carbon", "emissions", "transition", "grid", "insurance", "wildfire", "drought", "adaptation", "ev"),
    )
    election_poll_hits = _keyword_hits(
        text,
        ("poll", "swing state", "debate", "turnout", "approval", "election", "campaign", "ballot"),
    )

    recent_candidates = (
        db.query(EventCandidate)
        .filter(EventCandidate.detected_at >= datetime.utcnow() - timedelta(days=30))
        .order_by(EventCandidate.detected_at.desc())
        .limit(250)
        .all()
    )
    category_recent = [row for row in recent_candidates if _normalize_text(row.category) == category]
    similar_recent = [
        row
        for row in recent_candidates
        if SequenceMatcher(None, _normalize_text(row.title), _normalize_text(title)).ratio() >= 0.83
    ]

    from app.forecasting.agent_status import query_active_agents

    suggested_agents = query_active_agents(db)
    suggested_agent_set = {int(agent_id) for agent_id in suggested_agent_ids if isinstance(agent_id, int)}
    should_react_ids = [a.id for a in suggested_agents if a.id in suggested_agent_set][:4]
    remain_silent_ids = [a.id for a in suggested_agents if a.id not in suggested_agent_set][:8]
    rivalry_pairs: list[dict[str, Any]] = []
    if len(should_react_ids) >= 2:
        rivalry_pairs.append({"a": should_react_ids[0], "b": should_react_ids[1], "reason": "ideology overlap"})
    if len(should_react_ids) >= 3 and (shock_hits + divisive_hits) >= 2:
        rivalry_pairs.append(
            {"a": should_react_ids[0], "b": should_react_ids[2], "reason": "high tension narrative"}
        )

    category_fatigue = _clamp(
        (len(category_recent) * 5.5 + len(similar_recent) * 18.0) * float(profile["fatigue_multiplier"]),
        0.0,
        100.0,
    )
    duplicate_suppression = _clamp(len(similar_recent) * 23.0, 0.0, 100.0)
    already_priced = _clamp((len(similar_recent) * 15.0) + (max(0.0, 24.0 - age_hours) * 0.5), 0.0, 100.0)

    disagreement_potential = _clamp(24 + divisive_hits * 12 + uncertainty_hits * 6 + shock_hits * 7)
    macro_relevance = _clamp(20 + macro_hits * 11 + (16 if category in ("macro", "geopolitics", "politics") else 0))
    market_repricing_likelihood = _clamp(16 + reprice_hits * 14 + shock_hits * 8 + uncertainty_hits * 5)
    coalition_overlap = _clamp(15 + len(should_react_ids) * 8 + divisive_hits * 6)
    emotional_volatility = _clamp(18 + emotion_hits * 13 + shock_hits * 8)
    timing_uncertainty = _clamp(14 + uncertainty_hits * 12 + (10 if "timing" in text else 0))
    narrative_divisiveness = _clamp(18 + divisive_hits * 14 + disagreement_potential * 0.2)
    historical_parallels = _clamp(10 + callback_hits * 18 + len(similar_recent) * 9)
    agent_specialization_overlap = _clamp(12 + len(should_react_ids) * 10 + len(suggested_market_ids) * 6)
    reputation_migration = _clamp(10 + market_repricing_likelihood * 0.35 + disagreement_potential * 0.2)
    season_impact = _clamp(
        10 + macro_relevance * 0.35 + narrative_divisiveness * 0.25 + historical_parallels * 0.2
    )
    escalation_risk = _clamp(12 + escalation_hits * 16 + shock_hits * 8 + uncertainty_hits * 6)
    attention_velocity = _clamp(10 + emotion_hits * 8 + crypto_reflexivity_hits * 14 + shock_hits * 6)
    capability_shock = _clamp(10 + ai_shock_hits * 16 + reprice_hits * 8)
    injury_shock = _clamp(10 + sports_shock_hits * 15 + shock_hits * 8)

    # Domain-specific signal boosts
    if category == "macro":
        macro_relevance = _clamp(macro_relevance + rates_liquidity_hits * 5)
        market_repricing_likelihood = _clamp(market_repricing_likelihood + rates_liquidity_hits * 4)
        timing_uncertainty = _clamp(timing_uncertainty + rates_liquidity_hits * 2)
    elif category == "geopolitics":
        emotional_volatility = _clamp(emotional_volatility + escalation_hits * 4)
        market_repricing_likelihood = _clamp(market_repricing_likelihood + escalation_hits * 3)
    elif category == "crypto":
        market_repricing_likelihood = _clamp(market_repricing_likelihood + crypto_reflexivity_hits * 4)
        emotional_volatility = _clamp(emotional_volatility + crypto_reflexivity_hits * 3)
        disagreement_potential = _clamp(disagreement_potential + crypto_reflexivity_hits * 2)
    elif category == "ai":
        market_repricing_likelihood = _clamp(market_repricing_likelihood + ai_shock_hits * 3)
        timing_uncertainty = _clamp(timing_uncertainty + ai_shock_hits * 2)
        disagreement_potential = _clamp(disagreement_potential + ai_shock_hits * 2)
    elif category == "sports":
        timing_uncertainty = _clamp(timing_uncertainty + sports_shock_hits * 4)
        emotional_volatility = _clamp(emotional_volatility + sports_shock_hits * 4)
    elif category == "climate":
        market_repricing_likelihood = _clamp(market_repricing_likelihood + climate_policy_hits * 3)
        macro_relevance = _clamp(macro_relevance + climate_policy_hits * 2)
    elif category == "politics":
        timing_uncertainty = _clamp(timing_uncertainty + election_poll_hits * 3)
        disagreement_potential = _clamp(disagreement_potential + election_poll_hits * 3)
        outsider_hits += election_poll_hits

    factor_scores = {
        "disagreement_potential": disagreement_potential,
        "macro_relevance": macro_relevance,
        "market_repricing_likelihood": market_repricing_likelihood,
        "coalition_overlap": coalition_overlap,
        "emotional_volatility": emotional_volatility,
        "timing_uncertainty": timing_uncertainty,
        "narrative_divisiveness": narrative_divisiveness,
        "historical_parallels": historical_parallels,
        "agent_specialization_overlap": agent_specialization_overlap,
        "possible_reputation_migration": reputation_migration,
        "season_impact_potential": season_impact,
        "outsider_interest_score": _clamp(24 + outsider_hits * 8 + emotional_volatility * 0.2),
        "escalation_risk": escalation_risk,
        "attention_velocity": attention_velocity,
        "capability_shock": capability_shock,
        "injury_shock": injury_shock,
    }
    weights: dict[str, float] = profile["weights"]
    raw_narrative = sum(factor_scores.get(key, 0.0) * weight for key, weight in weights.items())
    raw_weight = sum(float(weight) for weight in weights.values()) or 1.0
    raw_narrative = raw_narrative / raw_weight
    fatigue_penalty = category_fatigue * 0.2 + duplicate_suppression * 0.25 + already_priced * 0.15
    if conflict_score := _clamp(
        disagreement_potential * 0.34
        + narrative_divisiveness * 0.24
        + timing_uncertainty * 0.2
        + coalition_overlap * 0.12
        + emotional_volatility * 0.1
    ):
        pass
    low_conflict_penalty = 0.0
    if conflict_score < 38 and (shock_hits + reprice_hits + escalation_hits + ai_shock_hits + sports_shock_hits) <= 1:
        low_conflict_penalty = 12.0 + float(profile["low_conflict_suppression"])
    fatigue_penalty += low_conflict_penalty
    narrative_potential_score = round(_clamp(raw_narrative - fatigue_penalty), 1)

    conflict_score = round(conflict_score, 1)
    conflict_topics = []
    if disagreement_potential >= 70:
        conflict_topics.append("high disagreement potential")
    if timing_uncertainty >= 60:
        conflict_topics.append("timing split pressure")
    if coalition_overlap >= 60:
        conflict_topics.append("coalition instability risk")
    if not conflict_topics:
        conflict_topics.append("limited disagreement catalysts")
    conflict_reasoning = f"Conflict profile: {_sample_reason(conflict_topics)}."

    persistence = _clamp(22 + (18 if len(similar_recent) >= 2 else 0) + callback_hits * 8)
    recurrence = _clamp(16 + len(similar_recent) * 12 + callback_hits * 10)
    broad_market_impact = _clamp(18 + macro_relevance * 0.6 + market_repricing_likelihood * 0.3)
    emotional_engagement = _clamp(20 + emotional_volatility * 0.65 + outsider_hits * 6)
    identity_alignment = _clamp(14 + narrative_divisiveness * 0.5 + coalition_overlap * 0.4)
    source_signal = _editorial_signal_from_source_weights(source_weights)
    rivalry_activation = _clamp(
        10 + conflict_score * 0.55 + len(rivalry_pairs) * 10 + source_signal["rivalry_boost"]
    )
    arc_scalar = (
        persistence * 0.18
        + recurrence * 0.13
        + broad_market_impact * 0.22
        + emotional_engagement * 0.16
        + identity_alignment * 0.14
        + rivalry_activation * 0.17
    )
    if arc_scalar < 28:
        arc_worthiness = "ambient noise"
    elif arc_scalar < 46:
        arc_worthiness = "signal"
    elif arc_scalar < 63:
        arc_worthiness = "major signal"
    elif arc_scalar < 80:
        arc_worthiness = "narrative arc"
    else:
        arc_worthiness = "season-defining event"

    repricing_probability = round(_clamp(market_repricing_likelihood * 0.72 + conflict_score * 0.28), 1)
    outsider_interest_score = round(
        _clamp(
            emotional_volatility * 0.3
            + disagreement_potential * 0.24
            + timing_uncertainty * 0.16
            + narrative_divisiveness * 0.15
            + outsider_hits * 7
            - duplicate_suppression * 0.12
        ),
        1,
    )
    outsider_interest_score = round(
        _clamp(outsider_interest_score + source_signal["outsider_boost"]),
        1,
    )
    timing_instability = round(
        _clamp(
            timing_uncertainty * 0.72 + conflict_score * 0.2 + uncertainty_hits * 3 + source_signal["timing_boost"]
        ),
        1,
    )
    callback_value_score = round(
        _clamp(historical_parallels * 0.42 + len(similar_recent) * 9 + rivalry_activation * 0.22 + callback_hits * 7),
        1,
    )

    amplification_score = round(
        _clamp(
            narrative_potential_score * 0.36
            + conflict_score * 0.22
            + outsider_interest_score * 0.2
            + repricing_probability * 0.22
            - category_fatigue * 0.2
            - duplicate_suppression * 0.2
            - already_priced * 0.12
            - low_conflict_penalty * 0.8
        ),
        1,
    )

    if amplification_score >= 78:
        suggested_feed_density = "burst"
    elif amplification_score >= 58:
        suggested_feed_density = "elevated"
    elif amplification_score >= 38:
        suggested_feed_density = "normal"
    else:
        suggested_feed_density = "ambient"

    suggested_market_creation = bool(
        narrative_potential_score >= 62 and repricing_probability >= 55 and len(suggested_market_ids) == 0
    )
    rivalry_threshold = max(48.0, 58.0 - source_signal["rivalry_boost"] * 1.6)
    suggested_rivalry_activation = bool(conflict_score >= rivalry_threshold and len(rivalry_pairs) > 0)
    callback_opportunities = []
    if callback_value_score >= 60:
        callback_opportunities.append("surface prior receipts and old season parallels")
    if len(similar_recent) >= 2:
        callback_opportunities.append("link to prior candidate thread to track conviction migration")

    editorial_suggestions = []
    if conflict_score >= 65:
        editorial_suggestions.append("Potential consensus fracture")
    if suggested_rivalry_activation:
        editorial_suggestions.append("High rivalry activation probability")
    if callback_value_score >= 62:
        editorial_suggestions.append("Likely season callback")
    if narrative_potential_score < 36:
        editorial_suggestions.append("Low narrative value — informational only")
    if low_conflict_penalty > 0:
        editorial_suggestions.append("Suppressed: high relevance but low conflict consequence")

    why_scry_scored_this = _top_reason_lines(
        category,
        {
            key: factor_scores.get(key, 0.0) * weights.get(key, 0.0)
            for key in set(weights.keys()).union(
                {
                    "outsider_interest_score",
                    "escalation_risk",
                    "attention_velocity",
                    "capability_shock",
                    "injury_shock",
                }
            )
        },
    )
    if low_conflict_penalty > 0 and len(why_scry_scored_this) < 4:
        why_scry_scored_this.append("Suppressed because conflict/tension catalysts are weak despite baseline relevance.")

    return {
        "narrative_potential_score": narrative_potential_score,
        "category_profile": category,
        "why_scry_scored_this": why_scry_scored_this[:4],
        "narrative_factor_scores": {
            "disagreement_potential": round(disagreement_potential, 1),
            "macro_relevance": round(macro_relevance, 1),
            "market_repricing_likelihood": round(market_repricing_likelihood, 1),
            "coalition_overlap": round(coalition_overlap, 1),
            "emotional_volatility": round(emotional_volatility, 1),
            "timing_uncertainty": round(timing_uncertainty, 1),
            "narrative_divisiveness": round(narrative_divisiveness, 1),
            "historical_parallels": round(historical_parallels, 1),
            "agent_specialization_overlap": round(agent_specialization_overlap, 1),
            "possible_reputation_migration": round(reputation_migration, 1),
            "season_impact_potential": round(season_impact, 1),
            "escalation_risk": round(escalation_risk, 1),
            "attention_velocity": round(attention_velocity, 1),
            "capability_shock": round(capability_shock, 1),
            "injury_shock": round(injury_shock, 1),
        },
        "conflict_score": conflict_score,
        "conflict_reasoning": conflict_reasoning,
        "conflict_profile": {
            "disagreement": round(disagreement_potential, 1),
            "rivalry_escalation": round(rivalry_activation, 1),
            "consensus_fracture": round((conflict_score + narrative_divisiveness) / 2.0, 1),
            "timing_split": round(timing_uncertainty, 1),
            "coalition_instability": round(coalition_overlap, 1),
        },
        "arc_worthiness": arc_worthiness,
        "agent_activation": {
            "should_react_agent_ids": should_react_ids,
            "should_activate_rivalries": rivalry_pairs,
            "should_remain_silent_agent_ids": remain_silent_ids,
        },
        "fatigue_control": {
            "category_fatigue_score": round(category_fatigue, 1),
            "duplicate_narrative_suppression": round(duplicate_suppression, 1),
            "already_priced_into_feed_score": round(already_priced, 1),
            "similar_recent_count": len(similar_recent),
            "low_conflict_suppression_penalty": round(low_conflict_penalty, 1),
        },
        "repricing_probability": repricing_probability,
        "timing_instability": timing_instability,
        "outsider_interest_score": outsider_interest_score,
        "callback_value_score": callback_value_score,
        "suggested_market_creation": suggested_market_creation,
        "suggested_rivalry_activation": suggested_rivalry_activation,
        "suggested_callback_opportunities": callback_opportunities,
        "editorial_suggestions": editorial_suggestions,
        "amplification_score": amplification_score,
        "suggested_feed_density": suggested_feed_density,
        "source_signal_quality": round(source_signal["signal_quality"], 3),
    }


def _source_key(name: str, category: str, url: str) -> str:
    digest = hashlib.sha1(f"{name}|{category}|{url}".encode("utf-8")).hexdigest()[:10]
    return f"{category}:{digest}"


def _source_payload(
    *,
    name: str,
    category: str,
    url: str,
    source_type: str = "rss",
    weights: dict[str, float] | None = None,
) -> dict[str, Any]:
    category = (category or "macro").lower()
    resolved_weights = weights or _weights_for_category(category)
    return {
        "key": _source_key(name, category, url),
        "type": source_type,
        "name": name,
        "category": category,
        "url": url,
        **resolved_weights,
    }


def configured_event_sources() -> list[dict[str, Any]]:
    """Resolve default groups + env overrides/custom sources."""
    resolved: list[dict[str, Any]] = []
    for category, defaults in DEFAULT_SOURCE_GROUPS.items():
        env_urls = settings.event_sources_by_category_env().get(category, [])
        if env_urls:
            for idx, url in enumerate(env_urls, start=1):
                name = f"{category.title()} Source {idx}"
                resolved.append(_source_payload(name=name, category=category, url=url))
        else:
            for src in defaults:
                name = str(src.get("name") or src.get("url") or "source")
                url = str(src.get("url") or "")
                resolved.append(
                    _source_payload(
                        name=name,
                        category=category,
                        url=url,
                        source_type=str(src.get("type") or "rss"),
                        weights=_weights_from_source_config(src, category),
                    )
                )

    raw_custom = settings.event_sources_custom_csv()
    if raw_custom:
        for part in [p.strip() for p in raw_custom.split(",") if p.strip()]:
            pieces = [p.strip() for p in part.split("|")]
            if len(pieces) != 3:
                continue
            name, category, url = pieces
            category = (category or "macro").lower()
            resolved.append(_source_payload(name=name, category=category, url=url))

    deduped: dict[str, dict[str, Any]] = {}
    for src in resolved:
        deduped[src["key"]] = src
    return list(deduped.values())


def log_event_source_configuration() -> None:
    sources = configured_event_sources()
    categories = sorted({str(source.get("category") or "unknown") for source in sources})
    print(f"Loaded {len(sources)} event sources")
    print(f"Event source categories: {', '.join(categories) if categories else 'none'}")


def _normalize_text(value: str) -> str:
    return re.sub(r"\s+", " ", (value or "").strip().lower())


def _text_has_any(haystack: str, keywords: tuple[str, ...]) -> bool:
    return any(kw in haystack for kw in keywords)


def infer_duration_type(title: str, summary: str, category: str) -> DurationType:
    """Infer expected resolution horizon from category/title language."""
    haystack = _normalize_text(f"{title} {summary}")
    cat = (category or "macro").lower()

    if _text_has_any(haystack, _ANCHOR_KEYWORDS):
        return "anchor"
    if cat in ("politics", "geopolitics") and _text_has_any(
        haystack, ("election", "world cup", "campaign season", "ceasefire talks", "summit season")
    ):
        return "anchor"
    if cat == "sports" and _text_has_any(haystack, ("world cup", "olympic", "season-long", "title race")):
        return "anchor"

    if _text_has_any(haystack, _MONTHLY_KEYWORDS) or (
        cat in ("climate", "macro") and _text_has_any(haystack, ("regime", "arc", "structural", "path"))
    ):
        return "monthly"

    if _text_has_any(haystack, _DAILY_KEYWORDS):
        return "daily"
    if cat == "sports" and _text_has_any(haystack, _SPORTS_DAILY):
        return "daily"
    if _text_has_any(haystack, _SPORTS_WEEKLY) and cat == "sports":
        return "weekly"

    if _text_has_any(haystack, _WEEKLY_KEYWORDS):
        return "weekly"
    if _text_has_any(haystack, _EARNINGS_MACRO):
        if _text_has_any(haystack, ("today", "tomorrow", "this week", "print", "decision", "meeting")):
            return "daily"
        if _text_has_any(haystack, ("quarter", "guidance", "outlook", "path", "cycle")):
            return "monthly"
        return "weekly"
    if cat in ("politics", "macro") and _text_has_any(haystack, ("debate", "vote", "ballot", "primary")):
        return "weekly"

    if cat == "sports":
        return "weekly"
    if cat in ("climate", "geopolitics"):
        return "monthly"
    if cat == "crypto":
        return "weekly"
    return "weekly"


def apply_duration_fields(
    candidate: EventCandidate,
    *,
    duration_type: str | None = None,
    expected_resolution_date: datetime | None = None,
) -> None:
    resolved_type = coerce_duration_type(duration_type or candidate.duration_type or "weekly")
    candidate.duration_type = resolved_type
    candidate.expected_resolution_window = DURATION_WINDOWS[resolved_type]
    if expected_resolution_date is not None:
        candidate.expected_resolution_date = expected_resolution_date
    else:
        candidate.expected_resolution_date = suggested_resolution_date(resolved_type)


def classify_category(title: str, summary: str) -> str:
    haystack = _normalize_text(f"{title} {summary}")
    best = ("macro", 0)
    for category, keywords in CATEGORY_KEYWORDS.items():
        score = sum(1 for kw in keywords if kw in haystack)
        if score > best[1]:
            best = (category, score)
    return best[0]


def score_relevance(title: str, summary: str) -> float:
    text = _normalize_text(f"{title} {summary}")
    base = min(100.0, 35.0 + len(text) * 0.08)
    bump = 0.0
    if any(k in text for k in ("breaking", "urgent", "surge", "crash", "announced", "approved")):
        bump += 18.0
    if any(k in text for k in ("federal reserve", "election", "world cup", "earnings", "sec")):
        bump += 12.0
    return round(min(100.0, base + bump), 1)


def score_urgency(title: str, summary: str, detected_at: datetime) -> float:
    text = _normalize_text(f"{title} {summary}")
    age_minutes = max(1.0, (datetime.utcnow() - detected_at).total_seconds() / 60.0)
    recency = max(0.0, 36.0 - min(36.0, age_minutes / 10.0))
    hot = 0.0
    if any(k in text for k in ("breaking", "explosion", "ban", "hack", "outage", "rate decision", "liquidation")):
        hot += 40.0
    return round(min(100.0, 20.0 + recency + hot), 1)


def map_suggestions(db: Session, *, title: str, summary: str, category: str) -> CandidateSuggestion:
    text = _normalize_text(f"{title} {summary}")
    markets = db.query(Market).filter(Market.status == "open").all()
    scored_markets: list[tuple[float, Market]] = []
    for market in markets:
        title_score = SequenceMatcher(None, _normalize_text(market.title), _normalize_text(title)).ratio()
        category_bonus = 0.15 if _normalize_text(market.category) == category else 0.0
        keyword_hits = sum(1 for token in re.findall(r"[a-z0-9]+", market.title.lower()) if token in text)
        score = title_score + category_bonus + keyword_hits * 0.03
        if score > 0.35:
            scored_markets.append((score, market))
    scored_markets.sort(key=lambda pair: pair[0], reverse=True)

    from app.forecasting.agent_status import query_active_agents

    agents = query_active_agents(db)
    scored_agents: list[tuple[float, Agent]] = []
    for agent in agents:
        niche_match = 0.45 if category in _normalize_text(agent.niche) else 0.0
        keyword_hits = sum(1 for token in re.findall(r"[a-z0-9]+", f"{agent.name} {agent.niche}".lower()) if token in text)
        score = niche_match + keyword_hits * 0.07
        if score > 0.2:
            scored_agents.append((score, agent))
    scored_agents.sort(key=lambda pair: pair[0], reverse=True)

    arc_type = "scheduled_watch"
    if category in ("macro", "politics", "geopolitics"):
        arc_type = "policy_cycle"
    elif category == "sports":
        arc_type = "tournament_cycle"
    elif category == "crypto":
        arc_type = "volatility_spike"
    elif category == "ai":
        arc_type = "innovation_race"

    return CandidateSuggestion(
        market_ids=[m.id for _, m in scored_markets[:3]],
        agent_ids=[a.id for _, a in scored_agents[:4]],
        arc_type=arc_type,
    )


def _is_duplicate(db: Session, *, title: str, source_url: str) -> bool:
    norm_title = _normalize_text(title)
    existing = (
        db.query(EventCandidate)
        .filter(EventCandidate.detected_at >= datetime.utcnow() - timedelta(days=14))
        .order_by(EventCandidate.detected_at.desc())
        .limit(200)
        .all()
    )
    for row in existing:
        if source_url and row.source_url == source_url:
            return True
        ratio = SequenceMatcher(None, _normalize_text(row.title), norm_title).ratio()
        if ratio >= 0.9:
            return True
    return False


def _source_event_time_for_candidate(candidate: EventCandidate) -> datetime | None:
    return source_event_time_from_meta(candidate.metadata_json)


def create_candidate(
    db: Session,
    *,
    title: str,
    summary: str,
    source_url: str,
    source_name: str,
    category: str | None = None,
    detected_at: datetime | None = None,
    source_event_time: datetime | None = None,
    metadata: dict | None = None,
) -> EventCandidate | None:
    clean_title, clean_summary, summary_cleaned = prepare_candidate_text(
        title=title,
        summary=summary,
        source_name=source_name,
        category=category,
    )
    if _is_duplicate(db, title=clean_title, source_url=source_url):
        return None
    detected = detected_at or datetime.utcnow()
    resolved_category = category or classify_category(clean_title, clean_summary)
    if not _category_within_diversity_quota(db, resolved_category):
        return None
    suggestion = map_suggestions(db, title=clean_title, summary=clean_summary, category=resolved_category)
    meta = dict(metadata or {})
    if source_event_time:
        meta["source_event_time"] = iso_utc(source_event_time)
    if summary_cleaned:
        meta["summary_cleaned"] = True
    source_weights = meta.get("source_weights")
    if not isinstance(source_weights, dict):
        source_weights = _weights_for_category(resolved_category)
    meta["source_weights"] = source_weights
    meta["editorial_intelligence"] = _build_editorial_intelligence(
        db,
        title=clean_title,
        summary=clean_summary,
        category=resolved_category,
        detected_at=detected,
        suggested_agent_ids=suggestion.agent_ids,
        suggested_market_ids=suggestion.market_ids,
        source_weights=source_weights,
    )
    inferred_duration = infer_duration_type(clean_title, clean_summary, resolved_category)
    resolution_date = suggested_resolution_date(inferred_duration)
    candidate = EventCandidate(
        title=clean_title[:255],
        summary=clean_summary[:5000],
        source_url=(source_url or "")[:1024],
        source_name=source_name[:128],
        category=resolved_category,
        detected_at=detected,
        relevance_score=score_relevance(clean_title, clean_summary),
        urgency_score=score_urgency(clean_title, clean_summary, detected),
        suggested_markets=suggestion.market_ids,
        suggested_agents=suggestion.agent_ids,
        suggested_arc_type=suggestion.arc_type,
        status="pending",
        duration_type=inferred_duration,
        expected_resolution_window=DURATION_WINDOWS[inferred_duration],
        expected_resolution_date=resolution_date,
        metadata_json=meta,
    )
    db.add(candidate)
    db.commit()
    db.refresh(candidate)
    return candidate


def _rss_item_text(item) -> tuple[str, str, str]:
    """Extract title, body, and link from RSS/Atom-like item nodes."""
    title = ""
    body = ""
    link = ""
    for child in item:
        local = child.tag.rsplit("}", 1)[-1].lower()
        text = (child.text or "").strip()
        if not text:
            continue
        if local == "title" and not title:
            title = text
        elif local == "link" and not link:
            link = text
        elif local in ("description", "summary", "encoded", "content") and len(text) > len(body):
            body = text
    if not title:
        title = (item.findtext("title") or "").strip()
    if not body:
        body = (item.findtext("description") or item.findtext("summary") or "").strip()
    if not link:
        link = (item.findtext("link") or item.findtext("guid") or "").strip()
    return title, body, link


def _rss_item_published_at(item) -> datetime | None:
    for child in item:
        local = child.tag.rsplit("}", 1)[-1].lower()
        if local not in ("pubdate", "published", "updated"):
            continue
        text = (child.text or "").strip()
        if not text:
            continue
        try:
            return parsedate_to_datetime(text)
        except (TypeError, ValueError, OverflowError):
            continue
    return None


def ingest_rss_source(
    db: Session,
    *,
    name: str,
    url: str,
    limit: int = 10,
    category: str | None = None,
    source_key: str | None = None,
    source_weights: dict[str, float] | None = None,
) -> int:
    req = Request(url, headers={"User-Agent": "ScryEventIngest/1.0"})
    with urlopen(req, timeout=8) as response:
        payload = response.read()
    root = ElementTree.fromstring(payload)
    items = root.findall(".//item")
    created = 0
    for item in items[:limit]:
        title, summary, link = _rss_item_text(item)
        if not title:
            continue
        source_event_time = _rss_item_published_at(item)
        candidate = create_candidate(
            db,
            title=title,
            summary=summary or title,
            source_url=link,
            source_name=name,
            category=category,
            source_event_time=source_event_time,
            metadata={
                "source_type": "rss",
                "source_key": source_key,
                "source_category": category,
                "source_weights": source_weights or _weights_for_category(category or "macro"),
            },
        )
        if candidate:
            created += 1
    return created


def ingest_world_sources(db: Session, sources: list[dict[str, Any]] | None = None) -> dict[str, Any]:
    used_sources = sources or configured_event_sources()
    result = {"created": 0, "errors": [], "sources": []}
    for source in used_sources:
        source_type = str(source.get("type") or "rss")
        name = str(source.get("name") or source.get("url") or "source")
        category = str(source.get("category") or "macro")
        url = str(source.get("url") or "")
        source_key = str(source.get("key") or _source_key(name, category, url))
        started = datetime.utcnow()
        try:
            created = 0
            if source_type == "rss":
                created = ingest_rss_source(
                    db,
                    name=name,
                    url=url,
                    limit=_ingest_limit_for_source(db, source),
                    category=category,
                    source_key=source_key,
                    source_weights={
                        "credibility_weight": float(source.get("credibility_weight", 0.65)),
                        "volatility_weight": float(source.get("volatility_weight", 0.5)),
                        "outsider_interest_weight": float(source.get("outsider_interest_weight", 0.55)),
                    },
                )
            else:
                created = 0
            result["created"] += created
            source_payload = {
                "key": source_key,
                "name": name,
                "type": source_type,
                "category": category,
                "url": url,
                "created": created,
                "last_ingest_at": datetime.utcnow().isoformat(),
                "last_error": None,
            }
            result["sources"].append(source_payload)
            _INGEST_STATUS_BY_SOURCE_KEY[source_key] = {
                "last_ingest_at": source_payload["last_ingest_at"],
                "created_last_ingest": created,
                "last_error": None,
                "duration_ms": int((datetime.utcnow() - started).total_seconds() * 1000),
            }
        except Exception as exc:
            result["errors"].append({"key": source_key, "name": name, "error": str(exc)})
            _INGEST_STATUS_BY_SOURCE_KEY[source_key] = {
                "last_ingest_at": datetime.utcnow().isoformat(),
                "created_last_ingest": 0,
                "last_error": str(exc),
                "duration_ms": int((datetime.utcnow() - started).total_seconds() * 1000),
            }
    return result


def list_event_sources_with_status(db: Session) -> list[dict[str, Any]]:
    configured = configured_event_sources()
    candidates = (
        db.query(EventCandidate)
        .filter(EventCandidate.detected_at >= datetime.utcnow() - timedelta(days=30))
        .all()
    )
    by_source_name: dict[str, list[EventCandidate]] = defaultdict(list)
    for c in candidates:
        by_source_name[c.source_name].append(c)
    output: list[dict[str, Any]] = []
    for source in configured:
        src_rows = by_source_name.get(source["name"], [])
        last_candidate = max((row.detected_at for row in src_rows if row.detected_at), default=None)
        status = _INGEST_STATUS_BY_SOURCE_KEY.get(str(source["key"]), {})
        output.append(
            {
                **source,
                "candidates_last_30d": len(src_rows),
                "last_candidate_at": last_candidate.isoformat() if last_candidate else None,
                "last_ingest_at": status.get("last_ingest_at"),
                "created_last_ingest": status.get("created_last_ingest", 0),
                "last_error": status.get("last_error"),
            }
        )
    output.sort(key=lambda row: (row.get("category", ""), row.get("name", "")))
    return output


def ingest_single_world_source(db: Session, source_key: str) -> dict[str, Any]:
    source = next((s for s in configured_event_sources() if str(s.get("key")) == source_key), None)
    if source is None:
        raise ValueError("Unknown source key")
    result = ingest_world_sources(db, sources=[source])
    source_result = result.get("sources", [{}])[0] if result.get("sources") else {}
    return {"created": result.get("created", 0), "source": source_result, "errors": result.get("errors", [])}


def candidate_to_payload(candidate: EventCandidate) -> dict[str, Any]:
    meta = candidate.metadata_json or {}
    intelligence = meta.get("editorial_intelligence") if isinstance(meta.get("editorial_intelligence"), dict) else {}
    return {
        "id": candidate.id,
        "title": candidate.title,
        "summary": candidate.summary,
        "source_url": candidate.source_url,
        "source_name": candidate.source_name,
        "category": candidate.category,
        "detected_at": candidate.detected_at.isoformat() if candidate.detected_at else None,
        "candidate_detected_at": iso_utc(candidate.detected_at),
        "source_event_time": iso_utc(_source_event_time_for_candidate(candidate)),
        "relevance_score": candidate.relevance_score,
        "urgency_score": candidate.urgency_score,
        "suggested_markets": candidate.suggested_markets or [],
        "suggested_agents": candidate.suggested_agents or [],
        "suggested_arc_type": candidate.suggested_arc_type,
        "duration_type": candidate.duration_type,
        "duration_label": duration_label(candidate.duration_type),
        "expected_resolution_window": candidate.expected_resolution_window,
        "expected_resolution_date": iso_utc(candidate.expected_resolution_date),
        "status": candidate.status,
        "is_high_priority": candidate.is_high_priority,
        "attached_market_id": candidate.attached_market_id,
        "approved_at": candidate.approved_at.isoformat() if candidate.approved_at else None,
        "published_at": candidate.published_at.isoformat() if candidate.published_at else None,
        "published_feed_event_id": candidate.published_feed_event_id,
        "metadata_json": meta,
        "narrative_potential_score": intelligence.get("narrative_potential_score"),
        "conflict_score": intelligence.get("conflict_score"),
        "conflict_reasoning": intelligence.get("conflict_reasoning"),
        "arc_worthiness": intelligence.get("arc_worthiness"),
        "outsider_interest_score": intelligence.get("outsider_interest_score"),
        "repricing_probability": intelligence.get("repricing_probability"),
        "timing_instability": intelligence.get("timing_instability"),
        "callback_value_score": intelligence.get("callback_value_score"),
        "amplification_score": intelligence.get("amplification_score"),
        "category_profile": intelligence.get("category_profile"),
        "why_scry_scored_this": intelligence.get("why_scry_scored_this") or [],
        "suggested_market_creation": intelligence.get("suggested_market_creation"),
        "suggested_rivalry_activation": intelligence.get("suggested_rivalry_activation"),
        "suggested_callback_opportunities": intelligence.get("suggested_callback_opportunities") or [],
        "editorial_suggestions": intelligence.get("editorial_suggestions") or [],
    }


def publish_candidate(
    db: Session,
    candidate: EventCandidate,
    *,
    event_type: str = "signal_shift",
    market_id: int | None = None,
    selected_reaction_keys: list[str] | None = None,
    publish_all_as_arc_burst: bool = False,
) -> list[FeedEvent]:
    if candidate.status not in ("approved", "published"):
        raise ValueError("Candidate must be approved before publication.")
    reaction_bundle = build_reaction_suggestions(
        db,
        candidate,
        event_type=event_type,
        market_id=market_id,
    )

    market = None
    if market_id:
        market = db.get(Market, market_id)
    if not market and candidate.attached_market_id:
        market = db.get(Market, candidate.attached_market_id)
    if not market and candidate.suggested_markets:
        market = db.get(Market, int(candidate.suggested_markets[0]))

    source_event_time = _source_event_time_for_candidate(candidate)
    meta_base = {
        "generated": True,
        "source_event_candidate_id": candidate.id,
        "source_url": candidate.source_url,
        "source_name": candidate.source_name,
        "world_event_category": candidate.category,
        "world_event_relevance": candidate.relevance_score,
        "world_event_urgency": candidate.urgency_score,
        "world_event_duration_type": candidate.duration_type,
        "world_event_duration_label": duration_label(candidate.duration_type),
        "world_event_expected_resolution_window": candidate.expected_resolution_window,
        "world_event_expected_resolution_date": iso_utc(candidate.expected_resolution_date),
        "editorial_approved": True,
        "reaction_bundle": reaction_bundle,
        "candidate_detected_at": iso_utc(candidate.detected_at),
        "source_event_time": iso_utc(source_event_time),
    }
    intelligence = {}
    meta_json = candidate.metadata_json or {}
    if isinstance(meta_json.get("editorial_intelligence"), dict):
        intelligence = meta_json["editorial_intelligence"]

    feed_published_at = datetime.utcnow()
    drafts = reaction_bundle.get("suggestions", [])
    if selected_reaction_keys:
        selected = set(selected_reaction_keys)
        drafts = [d for d in drafts if str(d.get("key")) in selected]
    if not drafts:
        drafts = reaction_bundle.get("suggestions", [])[:1]
    if not selected_reaction_keys:
        amplification_score = float(intelligence.get("amplification_score") or 0.0)
        if amplification_score < 35:
            drafts = drafts[:1]
        elif amplification_score < 65:
            drafts = drafts[:2]
    created_events: list[FeedEvent] = []
    for idx, draft in enumerate(drafts):
        published_at = feed_published_at + timedelta(seconds=45 * idx)
        event = FeedEvent(
            type=str(draft.get("event_type") or event_type),
            agent_id=int(draft.get("agent_id")),
            market_id=market.id if market else None,
            title=str(draft.get("title") or candidate.title)[:255],
            body=str(draft.get("body") or candidate.summary)[:5000],
            probability=market.current_yes_probability if market else None,
            confidence=float(
                draft.get("confidence")
                or max(45.0, min(96.0, (candidate.relevance_score + candidate.urgency_score) / 2.0))
            ),
            metadata_json={
                **meta_base,
                **(draft.get("metadata_json") or {}),
                "reaction_key": draft.get("key"),
                "arc_burst": bool(publish_all_as_arc_burst),
                "feed_published_at": iso_utc(published_at),
            },
            created_at=published_at,
            feed_published_at=published_at,
            source_event_time=source_event_time,
        )
        db.add(event)
        db.flush()
        created_events.append(event)

    candidate.status = "published"
    candidate.published_at = feed_published_at
    candidate.published_feed_event_id = created_events[0].id if created_events else None
    candidate.metadata_json = {
        **(candidate.metadata_json or {}),
        "published_event_ids": [e.id for e in created_events],
        "published_event_type": event_type,
        "published_reaction_keys": [d.get("key") for d in drafts],
        "reaction_bundle": reaction_bundle,
        "arc_burst": bool(publish_all_as_arc_burst),
    }
    db.commit()
    for event in created_events:
        db.refresh(event)
    db.refresh(candidate)
    return created_events


def preview_candidate_reactions(
    db: Session,
    candidate: EventCandidate,
    *,
    event_type: str = "signal_shift",
    market_id: int | None = None,
    seed: int | None = None,
) -> dict[str, Any]:
    return build_reaction_suggestions(
        db,
        candidate,
        event_type=event_type,
        market_id=market_id,
        seed=seed,
    )


def scheduled_arc_activity_multiplier(db: Session, *, now: datetime | None = None) -> float:
    current = now or datetime.utcnow()
    upcoming = (
        db.query(ScheduledEventArc)
        .filter(ScheduledEventArc.status.in_(("scheduled", "active")))
        .all()
    )
    if not upcoming:
        return 1.0
    multiplier = 1.0
    for arc in upcoming:
        hours_to_start = (arc.start_date - current).total_seconds() / 3600.0
        if arc.start_date <= current <= arc.end_date:
            multiplier = max(multiplier, max(1.2, arc.activity_boost or 1.25))
            arc.status = "active"
        elif 0 <= hours_to_start <= 72:
            boost = 1.0 + (72.0 - hours_to_start) / 180.0
            multiplier = max(multiplier, min(arc.activity_boost or 1.25, boost))
    if multiplier > 1.0:
        db.commit()
    return round(multiplier, 3)


def arc_to_payload(arc: ScheduledEventArc) -> dict[str, Any]:
    return {
        "id": arc.id,
        "title": arc.title,
        "start_date": arc.start_date.isoformat() if arc.start_date else None,
        "end_date": arc.end_date.isoformat() if arc.end_date else None,
        "category": arc.category,
        "linked_market_ids": arc.linked_market_ids or [],
        "primary_agent_ids": arc.primary_agent_ids or [],
        "watch_keywords": arc.watch_keywords or [],
        "activity_boost": arc.activity_boost,
        "status": arc.status,
    }
