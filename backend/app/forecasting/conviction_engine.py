"""Scry conviction layer — personality-driven feed copy without external LLMs."""

from __future__ import annotations

import random
from dataclasses import dataclass, field

from app.forecasting.models import Agent, AgentReputation, Market
from app.forecasting.services.utils import hash_seed

# ---------------------------------------------------------------------------
# Profiles
# ---------------------------------------------------------------------------

from app.forecasting.seed_data.agents import slug_overrides_for_conviction
from app.forecasting.services.opinion_headlines import resolve_opinion_headline
from app.forecasting.services.voice_engine import apply_voice_to_generated_copy, is_core_character
from app.forecasting.services.creator_forecaster.knowledge import knowledge_flavor_phrase

SLUG_OVERRIDES: dict[str, dict[str, str | float]] = slug_overrides_for_conviction()

CATEGORY_VOCAB: dict[str, list[str]] = {
    "crypto": [
        "ETF inflows",
        "miner distribution",
        "on-chain flows",
        "leverage flush",
        "volatility regime",
        "spot CVD",
        "funding skew",
        "halving hangover",
    ],
    "macro": [
        "soft landing",
        "liquidity impulse",
        "credit impulse",
        "payrolls impulse",
        "term premium",
        "recession window",
        "labor softening",
        "financial conditions",
    ],
    "rates": [
        "dot plot",
        "term premium",
        "real rates",
        "CPI path",
        "policy lag",
        "cut timing",
        "front-end pricing",
        "terminal rate",
    ],
    "equities": [
        "margin trajectory",
        "guide-up risk",
        "inventory overhang",
        "multiple compression",
        "earnings revision",
        "crowded positioning",
        "buyback bid",
    ],
    "sports": [
        "form curve",
        "injury cluster",
        "upset path",
        "rest advantage",
        "tactical mismatch",
        "closing line value",
        "momentum regime",
    ],
    "politics": [
        "polling error",
        "turnout model",
        "debate delta",
        "coalition math",
        "early vote",
        "narrative reset",
    ],
    "tech": [
        "cap-ex cycle",
        "inference demand",
        "regulatory overhang",
        "adoption S-curve",
        "compute bottleneck",
    ],
    "climate": [
        "policy beta",
        "carbon curve",
        "subsidy cliff",
        "transition capex",
    ],
    "commodities": [
        "supply shock",
        "inventory draw",
        "demand destruction",
        "OPEC discipline",
        "freight bottleneck",
        "diesel crack",
    ],
    "credit": [
        "spread widening",
        "default cycle",
        "refinancing wall",
        "covenant breach",
        "IG/HY divergence",
    ],
    "multi": [
        "cross-asset signal",
        "regime shift",
        "correlation break",
        "liquidity pocket",
    ],
}

OPENINGS_ELITE = [
    "{name} reprices {market} after {term_a} — implied YES {prob:.0f}%.",
    "On {market}, {name} sees {term_a} driving {direction} risk; median now {prob:.0f}%.",
    "{name}'s {niche} desk: {term_a} warrants a {direction} nudge to {prob:.0f}% YES.",
]

OPENINGS_STANDARD = [
    "{name} flags {term_a} on {market} and pushes YES to {prob:.0f}%.",
    "Fresh read from {name}: {term_a} matters more than the prior band on {market}.",
    "{name} leans {direction} on {market} — {term_a} is the trigger, not noise.",
]

OPENINGS_AGGRESSIVE = [
    "{name} is pounding the table on {market}: {term_a} means YES belongs at {prob:.0f}%.",
    "No subtlety from {name} — {term_a} on {market} forces a {direction} rip to {prob:.0f}%.",
    "{name} calls the consensus sleepwalking; {term_a} just lit up {market}.",
]

DISAGREEMENT_FRAMES = [
    " while {opp} argues {opp_term} makes the move {opp_stance}.",
    "; {opp} pushes back that {opp_term} — timing still {opp_stance}.",
    ", but {opp} frames {opp_term} as {opp_stance} and refuses the cluster bid.",
    " — {opp} counters with {opp_term}, calling the repricing {opp_stance}.",
]

OPP_STANCES = ["reflexive", "late-cycle", "crowded", "overfit", "premature", "consensus-chasing"]

CONFIDENCE_PHRASES_HIGH = ["locked", "high conviction", "hard YES", "clean read"]
CONFIDENCE_PHRASES_MID = ["lean", "tilt", "working assumption", "base case"]
CONFIDENCE_PHRASES_LOW = ["speculative", "lottery ticket", "tail hedge", "fade setup"]

VOICE_OPENERS: dict[str, list[str]] = {
    "institutional": [
        "{name} desk note: {term} on {market} — implied YES {prob:.0f}%.",
        "Risk committee read from {name}: {term} supports {direction} repricing on {market}.",
    ],
    "wonkish": [
        "{name} model update — {term} moved the posterior on {market} to {prob:.0f}% YES.",
        "Cross-check from {name}: {term} vs {term_b} on {market}; base case {prob:.0f}%.",
    ],
    "measured": [
        "{name} on {market}: {term} warrants a {direction} nudge — YES {prob:.0f}%.",
        "Slow-burn read from {name}: {term} matters more than the prior band on {market}.",
    ],
    "caps-lock": [
        "{name}: {term} IS THE TRADE ON {market}. YES {prob:.0f}% OR NGMI.",
        "NOT A DRILL — {name} says {term} breaks {market}. {prob:.0f}% YES.",
    ],
    "terse": [
        "{name} → {market}: {term}. {prob:.0f}%.",
        "{term}. {name}. {prob:.0f}% YES on {market}.",
    ],
    "ironic": [
        "{name} (ironically): {term} is totally priced on {market}. Anyway, YES {prob:.0f}%.",
        "Sure, sure — {name} posts {prob:.0f}% YES on {market} because {term}.",
    ],
    "breathless": [
        "{name} CANNOT BELIEVE {market} still ignores {term} — YES {prob:.0f}% NOW.",
        "Wake up: {name} says {term} just lit {market} on fire. {prob:.0f}%.",
    ],
    "clinical": [
        "{name}: {term} cross-section implies {prob:.0f}% YES on {market}.",
        "Clinical update — {name} reprices {market} on {term}; {direction} bias intact.",
    ],
    "probabilistic": [
        "{name} holds {prob:.0f}% YES on {market}; {term} unchanged the thesis, sharpened timing.",
        "Closing-line monk {name}: {term} on {market} — edge persists at {prob:.0f}%.",
    ],
    "emphatic": [
        "{name} is pounding the table: {term} on {market} means YES {prob:.0f}%.",
        "No subtlety from {name} — {term} forces a {direction} rip on {market}.",
    ],
    "dramatic": [
        "{name} declares {term} the bond vigilante's revenge on {market} — YES {prob:.0f}%.",
        "The market begs for mercy; {name} posts {prob:.0f}% YES on {market} via {term}.",
    ],
    "reactive": [
        "{name} (tilted): got stopped again on {market} — still YES {prob:.0f}% on {term}.",
        "Revenge trade alert: {name} doubles {term} thesis on {market} at {prob:.0f}%.",
    ],
    "hot-take": [
        "{name} hot take: {term} makes {market} free money at {prob:.0f}% YES.",
        "Chaos pick from {name} — {term} on {market}, {prob:.0f}%, don't overthink it.",
    ],
}

FOLLOWUP_FRAMES = [
    "Follow-up from {name}: thesis unchanged on {market} — still {side} on {term}.",
    "{name} doubling down: last call on {market} held; {term} confirms the {side} read.",
    "Update, not pivot — {name} keeps {side} on {market}. {prior}",
    "{name} revisits {market}: {prior} Still {side}; {term} is the new evidence.",
]

RIVALRY_FRAMES = [
    "{name} vs {opp} heats up on {market}: {term_a} vs {term_b} — Spread {spread} pts, heat {heat}.",
    "Rivalry escalation — {name} ({side}) clashes with {opp} on {market}. {term_a} against {term_b}. Spread: {spread}.",
    "{opp} thought the fight was over on {market}. {name} disagrees — {term_a} keeps {side} live. Spread {spread}.",
]

STANCE_FLIP_PREFIX = [
    "Rare pivot from {name}: {reason} Now {side} on {market}.",
    "{name} updates stance on {market} — {reason} Revised to {side}.",
]


@dataclass
class AgentConvictionProfile:
    agent: Agent
    personality: str
    tone: str
    conviction_style: str
    specialization: str
    aggressiveness: float
    certainty_style: str
    bias: str
    voice_note: str
    reputation_score: float
    tier: str  # elite | established | emerging

    @property
    def is_elite(self) -> bool:
        return self.tier == "elite"

    @property
    def is_aggressive(self) -> bool:
        return self.aggressiveness >= 0.72


@dataclass
class GeneratedCopy:
    title: str
    body: str
    confidence: float | None = None
    opponent_name: str | None = None
    spread: int | None = None
    reasoning_summary: str | None = None


@dataclass
class ConvictionContext:
    rng: random.Random
    rep_by_agent: dict[int, AgentReputation]
    agents_by_id: dict[int, Agent] = field(default_factory=dict)

    def profile(self, agent: Agent) -> AgentConvictionProfile:
        rep = self.rep_by_agent.get(agent.id)
        score = rep.score if rep else 40.0 + hash_seed(agent.slug) % 20
        overrides = SLUG_OVERRIDES.get(agent.slug, {})
        aggressiveness = float(overrides.get("aggressiveness", _infer_aggressiveness(agent)))
        if score >= 72:
            tier = "elite"
            aggressiveness = min(aggressiveness, 0.65)
        elif score >= 55:
            tier = "established"
        else:
            tier = "emerging"
            aggressiveness = max(aggressiveness, 0.55)

        return AgentConvictionProfile(
            agent=agent,
            personality=agent.personality,
            tone=agent.tone,
            conviction_style=agent.conviction_style,
            specialization=agent.niche,
            aggressiveness=aggressiveness,
            certainty_style=str(overrides.get("certainty_style", _infer_certainty(agent))),
            bias=str(overrides.get("bias", agent.personality)),
            voice_note=str(overrides.get("voice_note", agent.conviction_style)),
            reputation_score=score,
            tier=tier,
        )


def _infer_aggressiveness(agent: Agent) -> float:
    style = agent.conviction_style.lower()
    tone = agent.tone.lower()
    if "high" in style or "volatile" in style or "blunt" in tone or "punchy" in tone:
        return 0.85
    if "patient" in style or "measured" in style or "calm" in agent.personality:
        return 0.35
    if "contrarian" in style or "skeptical" in tone:
        return 0.68
    return 0.55


def _infer_certainty(agent: Agent) -> str:
    if "data" in agent.conviction_style:
        return "wonkish"
    if "policy" in agent.conviction_style:
        return "institutional"
    if "patient" in agent.conviction_style:
        return "probabilistic"
    return "measured"


class ConvictionEngine:
    """Compose event copy from agent personality + market vocabulary."""

    def __init__(self, ctx: ConvictionContext):
        self.ctx = ctx

    def generate(
        self,
        event_type: str,
        agent: Agent,
        market: Market | None,
        *,
        opponent: Agent | None = None,
        delta: float | None = None,
        new_prob: float | None = None,
        spread: int | None = None,
        side: str | None = None,
        rep_delta: float | None = None,
        verified_calls: int | None = None,
        position_amount: float | None = None,
        position_side: str | None = None,
        take_snippet: str | None = None,
        prior_thesis: str | None = None,
        prior_call_summary: str | None = None,
        flip_reason: str | None = None,
        recent_phrases: list[str] | None = None,
        confidence_tendency: float | None = None,
        arc_stage: int | None = None,
        rival_heat: int | None = None,
        knowledge_context: dict | None = None,
    ) -> GeneratedCopy:
        memory_kwargs = {
            "prior_thesis": prior_thesis,
            "prior_call_summary": prior_call_summary,
            "flip_reason": flip_reason,
            "recent_phrases": recent_phrases or [],
            "confidence_tendency": confidence_tendency,
            "arc_stage": arc_stage,
            "rival_heat": rival_heat or 0,
            "knowledge_context": knowledge_context,
        }
        try:
            handler = getattr(self, f"_gen_{event_type}", None)
            if handler is None:
                raise ValueError(f"unknown event type: {event_type}")
            copy = handler(
                agent,
                market,
                opponent=opponent,
                delta=delta,
                new_prob=new_prob,
                spread=spread,
                side=side,
                rep_delta=rep_delta,
                verified_calls=verified_calls,
                position_amount=position_amount,
                position_side=position_side,
                take_snippet=take_snippet,
                **memory_kwargs,
            )
            return self._apply_character_voice(
                agent,
                copy,
                market=market,
                opponent=opponent,
                event_type=event_type,
                knowledge_context=knowledge_context,
            )
        except Exception:
            copy = self._fallback(
                event_type,
                agent,
                market,
                opponent=opponent,
                delta=delta,
                new_prob=new_prob,
                spread=spread,
                side=side,
                rep_delta=rep_delta,
                verified_calls=verified_calls,
                position_amount=position_amount,
                position_side=position_side,
                take_snippet=take_snippet,
                **memory_kwargs,
            )
            return self._apply_character_voice(
                agent,
                copy,
                market=market,
                opponent=opponent,
                event_type=event_type,
                knowledge_context=knowledge_context,
            )

    def _resolve_headline(self, agent: Agent, copy: GeneratedCopy, market: Market | None, event_type: str) -> None:
        copy.title = resolve_opinion_headline(
            agent.slug,
            proposed_title=copy.title,
            body=copy.body,
            market_title=market.title if market else None,
            event_type=event_type,
            seed=hash_seed(agent.slug, copy.body, event_type),
            rng=self.ctx.rng,
        )

    def _apply_character_voice(
        self,
        agent: Agent,
        copy: GeneratedCopy,
        *,
        market: Market | None,
        opponent: Agent | None,
        event_type: str,
        knowledge_context: dict | None = None,
    ) -> GeneratedCopy:
        if getattr(agent, "is_creator", False) and knowledge_context and copy.body:
            flavor = knowledge_flavor_phrase(knowledge_context, self.ctx.rng)
            if flavor and flavor.lower() not in copy.body.lower():
                copy.body = f"{copy.body.rstrip()} Grounded in my research on {flavor.lower().rstrip('.')}."
            self._resolve_headline(agent, copy, market, event_type)
            return copy
        if not is_core_character(agent.slug):
            self._resolve_headline(agent, copy, market, event_type)
            return copy
        if event_type in ("battle_escalation", "rivalry") and "Confidence:" in copy.body:
            from app.forecasting.services.voice_engine import polish_copy

            copy.body = polish_copy(agent.slug, copy.body)
            self._resolve_headline(agent, copy, market, event_type)
            return copy
        opp_slug = opponent.slug if opponent else None
        if event_type == "verified_call":
            from app.forecasting.services.voice_engine import generate_win_reaction

            copy.body = generate_win_reaction(
                agent.slug,
                market_title=market.title if market else copy.title,
                seed=hash_seed(agent.slug, copy.body),
            )
            self._resolve_headline(agent, copy, market, event_type)
            return copy
        title, body, meta = apply_voice_to_generated_copy(
            agent.slug,
            copy.title,
            copy.body,
            opponent_slug=opp_slug,
            event_type=event_type,
        )
        copy.title = title
        copy.body = body
        if meta.get("character_consistency"):
            copy.reasoning_summary = (
                (copy.reasoning_summary or "") + f" [voice:{meta['character_consistency'].get('passes')}]"
            ).strip()
        self._resolve_headline(agent, copy, market, event_type)
        return copy

    def _prof(self, agent: Agent) -> AgentConvictionProfile:
        return self.ctx.profile(agent)

    def _vocab(self, market: Market | None, n: int = 2) -> list[str]:
        cat = (market.category if market else "multi").lower()
        pool = CATEGORY_VOCAB.get(cat, CATEGORY_VOCAB["multi"])
        return self.ctx.rng.sample(pool, min(n, len(pool)))

    def _opening_pool(self, profile: AgentConvictionProfile) -> list[str]:
        style = profile.certainty_style.lower()
        if style in VOICE_OPENERS:
            return VOICE_OPENERS[style]
        if profile.is_elite:
            return OPENINGS_ELITE
        if profile.is_aggressive:
            return OPENINGS_AGGRESSIVE
        return OPENINGS_STANDARD

    def _pick_phrase(self, pool: list[str], recent: list[str]) -> str:
        blocked = {p.lower() for p in recent}
        fresh = [p for p in pool if p.lower() not in blocked]
        return self.ctx.rng.choice(fresh or pool)

    def _voice_opening(
        self,
        profile: AgentConvictionProfile,
        *,
        market: Market | None,
        terms: list[str],
        prob: float,
        direction: str,
        recent_phrases: list[str],
    ) -> str:
        pool = self._opening_pool(profile)
        template = self._pick_phrase(pool, recent_phrases)
        term_b = terms[1] if len(terms) > 1 else terms[0]
        return template.format(
            name=profile.agent.name,
            market=market.title if market else "the market",
            term=terms[0],
            term_b=term_b,
            direction=direction,
            prob=prob,
            niche=profile.specialization,
        )

    def _disagreement(
        self,
        profile: AgentConvictionProfile,
        opponent: Agent | None,
        market: Market | None,
    ) -> str:
        if opponent is None or opponent.id == profile.agent.id:
            return ""
        opp_prof = self._prof(opponent)
        opp_terms = self._vocab(market, 1)
        opp_term = opp_terms[0] if opp_terms else "the setup"
        stance = self.ctx.rng.choice(OPP_STANCES)
        frame = self.ctx.rng.choice(DISAGREEMENT_FRAMES)
        return frame.format(opp=opponent.name, opp_term=opp_term, opp_stance=stance)

    def _confidence_value(
        self,
        profile: AgentConvictionProfile,
        base: float = 70,
        *,
        tendency: float | None = None,
    ) -> float:
        jitter = self.ctx.rng.randint(-8, 14)
        if profile.is_elite:
            jitter -= 4
        if profile.is_aggressive:
            jitter += 6
        if tendency is not None:
            base = base * 0.5 + tendency * 100 * 0.5
        return float(max(52, min(96, base + jitter)))

    def _direction_word(self, delta: float | None) -> str:
        if delta is None:
            return "mixed"
        return "higher" if delta > 0 else "lower"

    # --- Event generators ---------------------------------------------------

    def _gen_market_move(
        self,
        agent: Agent,
        market: Market | None,
        *,
        opponent: Agent | None = None,
        delta: float | None = None,
        new_prob: float | None = None,
        side: str | None = None,
        flip_reason: str | None = None,
        recent_phrases: list[str] | None = None,
        confidence_tendency: float | None = None,
        **_,
    ) -> GeneratedCopy:
        p = self._prof(agent)
        terms = self._vocab(market, 2)
        prob = new_prob or (market.current_yes_probability if market else 50.0)
        direction = self._direction_word(delta)
        recent = recent_phrases or []

        if market and market.category.lower() == "crypto" and opponent and opponent.id != agent.id:
            bull_bias = ("momentum", "bullish", "reflexivity", "microstructure")
            bull = agent if p.bias in bull_bias or "goblin" in agent.slug else opponent
            if opponent and getattr(self._prof(opponent), "bias", "") in bull_bias:
                bull = opponent
            bear = opponent if bull.id == agent.id else agent
            if bull.id != bear.id:
                body = (
                    f"{bull.name} argues {terms[0]} overpower {terms[1]} for tourists, "
                    f"while {bear.name} calls the move exit liquidity and late-cycle — YES {prob:.0f}%."
                )
                title = self._title_market(p, market, "repriced")
                return GeneratedCopy(
                    title=title,
                    body=body,
                    confidence=self._confidence_value(p, 70, tendency=confidence_tendency),
                    opponent_name=opponent.name,
                    reasoning_summary=body,
                )

        if flip_reason and side:
            prefix = self.ctx.rng.choice(STANCE_FLIP_PREFIX).format(
                name=agent.name,
                reason=flip_reason,
                side=side,
                market=market.title if market else "the market",
            )
            body = prefix + " " + self._voice_opening(
                p, market=market, terms=terms, prob=prob, direction=direction, recent_phrases=recent
            )
        else:
            body = self._voice_opening(
                p, market=market, terms=terms, prob=prob, direction=direction, recent_phrases=recent
            )
        if opponent and opponent.id != agent.id:
            body += self._disagreement(p, opponent, market)
            if len(terms) > 1:
                body += f" {opponent.name} still anchors the prior median on {terms[1]}."
        title = self._title_market(p, market, "repriced")
        return GeneratedCopy(
            title=title,
            body=body,
            confidence=self._confidence_value(p, 68, tendency=confidence_tendency),
            opponent_name=opponent.name if opponent else None,
            reasoning_summary=body.split(".")[0] + ".",
        )

    def _gen_signal_shift(
        self,
        agent: Agent,
        market: Market | None,
        *,
        opponent: Agent | None = None,
        delta: float | None = None,
        new_prob: float | None = None,
        **_,
    ) -> GeneratedCopy:
        p = self._prof(agent)
        terms = self._vocab(market, 2)
        prob = new_prob or market.current_yes_probability
        frames = [
            (
                f"{agent.name} tightens the band on {market.title}: {terms[0]} and {terms[1]} "
                f"force YES to {prob:.0f}% ({delta:+.1f} pts)."
            ),
            (
                f"Signal shift — {agent.name} says {terms[0]} broke the stale prior on "
                f"{market.title}; implied {prob:.0f}% with {terms[1]} still in play."
            ),
            (
                f"Conviction cluster wobbles: {agent.name} reprices {market.title} on {terms[0]}, "
                f"while holdouts cite {terms[1]} for timing risk."
            ),
        ]
        body = self.ctx.rng.choice(frames)
        if opponent and opponent.id != agent.id:
            body += self._disagreement(p, opponent, market)
        title = f"Signal shift — {agent.name} on {market.title}"
        return GeneratedCopy(
            title=title[:255],
            body=body,
            confidence=self._confidence_value(p, 74),
            opponent_name=opponent.name if opponent else None,
        )

    def _gen_battle_escalation(
        self,
        agent: Agent,
        market: Market | None,
        *,
        opponent: Agent | None = None,
        spread: int | None = None,
        side: str | None = None,
        rival_heat: int | None = None,
        prior_thesis: str | None = None,
        confidence_tendency: float | None = None,
        **_,
    ) -> GeneratedCopy:
        p = self._prof(agent)
        opp = opponent or self._synthetic_opponent(agent)
        spread_val = spread or (22 + hash_seed(market.id if market else 0, agent.slug) % 28)
        if is_core_character(agent.slug) and is_core_character(opp.slug):
            from app.forecasting.services.voice_engine import generate_battle_body

            body = generate_battle_body(
                agent.slug,
                opp.slug,
                market_title=market.title if market else "the market",
                spread=spread_val,
                side=side or "YES",
                seed=hash_seed(agent.slug, opp.slug, market.id if market else 0),
            )
            if prior_thesis:
                body += f" Callback: {prior_thesis[:90]}."
            title = f"{agent.name} vs {opp.name} — {market.title if market else 'network'}"
            return GeneratedCopy(
                title=title[:255],
                body=body,
                confidence=self._confidence_value(p, 72, tendency=confidence_tendency),
                opponent_name=opp.name,
                spread=spread_val,
            )
        opp_p = self._prof(opp)
        heat = rival_heat or 0
        terms_a = self._vocab(market, 1)
        terms_b = self._vocab(market, 1)
        thesis_hook = f" Same thesis: {prior_thesis[:80]}." if prior_thesis else ""
        if p.is_elite and opp_p.is_elite:
            body = (
                f"{agent.name} and {opp.name} widen the split on {market.title}: "
                f"{agent.name} cites {terms_a[0]} at high conviction ({side or 'YES'}); {opp.name} counters "
                f"that {terms_b[0]} caps the move — Spread: {spread_val} pts (heat {heat}).{thesis_hook}"
            )
        elif p.is_aggressive:
            body = (
                f"{agent.name} doubles down — {terms_a[0]} is the whole trade on {market.title}; "
                f"{opp.name} calls it {self.ctx.rng.choice(OPP_STANCES)} and fades the chase. "
                f"Spread: {spread_val} pts, rivalry heat {heat}."
            )
        else:
            body = (
                f"Battle escalates on {market.title}: {agent.name} leans {terms_a[0]} ({side or 'YES'}) while "
                f"{opp.name} argues {terms_b[0]} — consensus vs contrarian timing. "
                f"Spread: {spread_val} pts.{thesis_hook}"
            )
        title = f"{agent.name} vs {opp.name} — {market.title}"
        return GeneratedCopy(
            title=title[:255],
            body=body,
            confidence=self._confidence_value(p, 72, tendency=confidence_tendency),
            opponent_name=opp.name,
            spread=spread_val,
        )

    def _gen_rivalry(
        self,
        agent: Agent,
        market: Market | None,
        *,
        opponent: Agent | None = None,
        spread: int | None = None,
        side: str | None = None,
        rival_heat: int | None = None,
        prior_thesis: str | None = None,
        confidence_tendency: float | None = None,
        **_,
    ) -> GeneratedCopy:
        p = self._prof(agent)
        opp = opponent or self._synthetic_opponent(agent)
        spread_val = spread or 30
        heat = rival_heat or 1
        terms_a = self._vocab(market, 1)
        terms_b = self._vocab(market, 1)
        frame = self.ctx.rng.choice(RIVALRY_FRAMES)
        body = frame.format(
            name=agent.name,
            opp=opp.name,
            market=market.title if market else "the market",
            term_a=terms_a[0],
            term_b=terms_b[0],
            spread=spread_val,
            heat=heat,
            side=side or "YES",
        )
        if prior_thesis:
            body += f" Callback: {prior_thesis[:90]}."
        title = f"Rivalry — {agent.name} vs {opp.name}"
        return GeneratedCopy(
            title=title[:255],
            body=body,
            confidence=self._confidence_value(p, 75, tendency=confidence_tendency),
            opponent_name=opp.name,
            spread=spread_val,
        )

    def _gen_stance_followup(
        self,
        agent: Agent,
        market: Market | None,
        *,
        opponent: Agent | None = None,
        side: str | None = None,
        prior_thesis: str | None = None,
        prior_call_summary: str | None = None,
        arc_stage: int | None = None,
        confidence_tendency: float | None = None,
        **_,
    ) -> GeneratedCopy:
        p = self._prof(agent)
        s = side or "YES"
        terms = self._vocab(market, 1)
        prior = prior_thesis or prior_call_summary or "thesis unchanged"
        frame = self.ctx.rng.choice(FOLLOWUP_FRAMES)
        body = frame.format(
            name=agent.name,
            market=market.title if market else "the market",
            side=s,
            term=terms[0],
            prior=prior[:100],
        )
        if arc_stage is not None and arc_stage >= 2:
            body += f" Arc stage {arc_stage + 1} — narrative continuing, not resetting."
        if opponent and opponent.id != agent.id:
            body += f" {opponent.name} still holds the fade."
        title = f"Follow-up — {agent.name} on {market.title if market else 'network'}"
        return GeneratedCopy(
            title=title[:255],
            body=body,
            confidence=self._confidence_value(p, 76, tendency=confidence_tendency),
            opponent_name=opponent.name if opponent else None,
            reasoning_summary=body.split(".")[0] + ".",
        )

    def _gen_narrative_acceleration(
        self,
        agent: Agent,
        market: Market | None,
        *,
        opponent: Agent | None = None,
        **_,
    ) -> GeneratedCopy:
        p = self._prof(agent)
        terms = self._vocab(market, 2)
        cluster = 3 + hash_seed(market.title if market else "m") % 4
        prob = market.current_yes_probability if market else 50.0
        if p.is_elite:
            body = (
                f"{cluster} {p.specialization.lower()} agents repriced {market.title} in one window — "
                f"{agent.name} led on {terms[0]}; median YES {prob:.0f}%. Holdouts still weight {terms[1]}."
            )
        else:
            body = (
                f"Narrative acceleration on {market.title}: {terms[0]} pulled {cluster} agents "
                f"into the same band ({prob:.0f}% YES). {agent.name} was early; late movers chase {terms[1]}."
            )
        if opponent and opponent.id != agent.id:
            body += self._disagreement(p, opponent, market)
        title = f"Narrative surge — {market.title}"
        return GeneratedCopy(title=title, body=body, confidence=None)

    def _gen_verified_call(
        self,
        agent: Agent,
        market: Market | None,
        *,
        opponent: Agent | None = None,
        verified_calls: int | None = None,
        **_,
    ) -> GeneratedCopy:
        p = self._prof(agent)
        terms = self._vocab(market, 1)
        lag = 8 + hash_seed(agent.slug) % 12
        vc = verified_calls or 1
        if p.is_elite:
            body = (
                f"{agent.name} archived a pre-consensus {market.title if market else 'call'} — "
                f"{terms[0]} was visible {lag}d before the median moved ({vc} verified on record)."
            )
        else:
            body = (
                f"Verified call resurfaced: {agent.name} had {market.title if market else 'the market'} "
                f"pegged via {terms[0]} while consensus lagged ~{lag}d."
            )
        if opponent:
            body += (
                f" {opponent.name} had the fade live but couldn't match the timing edge."
            )
        title = f"Verified — {agent.name} on {market.title if market else 'network'}"
        return GeneratedCopy(
            title=title[:255],
            body=body,
            confidence=self._confidence_value(p, 90),
            opponent_name=opponent.name if opponent else None,
        )

    def _gen_reputation_move(
        self,
        agent: Agent,
        market: Market | None,
        *,
        opponent: Agent | None = None,
        rep_delta: float | None = None,
        **_,
    ) -> GeneratedCopy:
        p = self._prof(agent)
        rep = self.ctx.rep_by_agent.get(agent.id)
        score = rep.score if rep else p.reputation_score
        delta = rep_delta or round(1.5 + self.ctx.rng.uniform(0.5, 3.5), 1)
        new_score = min(99, score + delta)
        terms = self._vocab(market, 1) if market else ["calibration streak"]
        if p.is_elite:
            body = (
                f"{agent.name} climbs on sustained {p.specialization.lower()} calibration — "
                f"{score:.0f} → {new_score:.0f} (+{delta:.1f}). {terms[0].capitalize()} calls drove the move."
            )
        else:
            body = (
                f"Reputation rip: {agent.name} jumps {delta:.1f} pts in {p.specialization} "
                f"after a hot run on {terms[0]} — network now prices {new_score:.0f}."
            )
        if opponent:
            body += f" {opponent.name} still leads the niche but the gap narrowed."
        title = f"{agent.name} — reputation breakout"
        return GeneratedCopy(
            title=title,
            body=body,
            confidence=self._confidence_value(p, 84),
            opponent_name=opponent.name if opponent else None,
        )

    def _gen_new_take(
        self,
        agent: Agent,
        market: Market | None,
        *,
        side: str | None = None,
        take_snippet: str | None = None,
        opponent: Agent | None = None,
        flip_reason: str | None = None,
        prior_thesis: str | None = None,
        recent_phrases: list[str] | None = None,
        confidence_tendency: float | None = None,
        **_,
    ) -> GeneratedCopy:
        p = self._prof(agent)
        s = side or "YES"
        conf = self._confidence_value(p, 70, tendency=confidence_tendency)
        terms = self._vocab(market, 1)
        conf_phrase = self._pick_confidence_phrase(p, recent_phrases or [])
        if flip_reason:
            voice = f"{flip_reason} Now {conf_phrase} {s}."
        elif take_snippet and len(take_snippet) > 20:
            voice = take_snippet[:140].rstrip("…")
        elif prior_thesis and p.certainty_style in ("measured", "institutional", "probabilistic"):
            voice = f"{conf_phrase} {s} — still anchored on {prior_thesis[:80]}."
        elif p.is_aggressive:
            voice = f"{conf_phrase} {s} — {terms[0]} is the whole thesis, consensus be damned."
        elif p.is_elite:
            voice = f"{conf_phrase} {s} on {terms[0]}; edge is timing, not narrative."
        else:
            voice = f"Posting {s} ({conf_phrase}) — {terms[0]} vs the crowd on {market.title}."
        body = f"{agent.name}: {voice}"
        if opponent and opponent.id != agent.id:
            body += f" {opponent.name} still holds the other side."
        title = f"{agent.name} take — {market.title}"
        return GeneratedCopy(title=title, body=body, confidence=conf)

    def _gen_position_update(
        self,
        agent: Agent,
        market: Market | None,
        *,
        position_side: str | None = None,
        position_amount: float | None = None,
        opponent: Agent | None = None,
        **_,
    ) -> GeneratedCopy:
        p = self._prof(agent)
        side = position_side or "YES"
        amt = position_amount or 1000.0
        terms = self._vocab(market, 1)
        if p.is_elite:
            body = (
                f"Desk prints {side} ${amt:,.0f} on {market.title} — {agent.name} reads it as "
                f"{terms[0]} confirmation, not noise, at {market.current_yes_probability:.0f}% implied."
            )
        else:
            body = (
                f"Size hit {market.title}: {side} ${amt:,.0f}. {agent.name} says {terms[0]} "
                f"{'supports' if side == 'YES' else 'pressures'} the tape; crowd still split."
            )
        if opponent and opponent.id != agent.id:
            body += self._disagreement(p, opponent, market)
        title = f"Flow — {market.title}"
        return GeneratedCopy(title=title, body=body, confidence=self._confidence_value(p, 62))

    def _pick_confidence_phrase(self, profile: AgentConvictionProfile, recent: list[str] | None = None) -> str:
        if profile.is_aggressive:
            pool = CONFIDENCE_PHRASES_HIGH
        elif profile.is_elite:
            pool = CONFIDENCE_PHRASES_MID
        else:
            pool = CONFIDENCE_PHRASES_MID + CONFIDENCE_PHRASES_LOW
        return self._pick_phrase(pool, recent or [])

    def _title_market(self, profile: AgentConvictionProfile, market: Market | None, verb: str) -> str:
        short = _short_market_title(market.title if market else "Market")
        if profile.is_aggressive:
            return f"{profile.agent.name} — {short} {verb}"
        return f"{short} {verb}"

    def _synthetic_opponent(self, agent: Agent) -> Agent:
        others = [a for a in self.ctx.agents_by_id.values() if a.id != agent.id]
        if not others:
            return agent
        niche_others = [a for a in others if a.niche != agent.niche]
        pool = niche_others or others
        return self.ctx.rng.choice(pool)

    # --- Fallback (legacy templates) ----------------------------------------

    def _fallback(
        self,
        event_type: str,
        agent: Agent,
        market: Market | None,
        **kwargs,
    ) -> GeneratedCopy:
        opponent = kwargs.get("opponent")
        opp_name = opponent.name if opponent else "network contrarians"
        delta = kwargs.get("delta") or 0.0
        new_prob = kwargs.get("new_prob") or (market.current_yes_probability if market else 50.0)
        spread = kwargs.get("spread") or 30
        mtitle = market.title if market else "market"

        templates: dict[str, tuple[str, str]] = {
            "market_move": (
                f"{mtitle} repriced",
                (
                    f"{agent.name} flagged fresh inputs — YES now {new_prob:.0f}% "
                    f"({delta:+.1f} pts) after cross-checking recent takes."
                ),
            ),
            "signal_shift": (
                f"Signal shift on {mtitle}",
                (
                    f"Conviction band tightened: {agent.name} revised implied YES to "
                    f"{new_prob:.0f}% (Δ {delta:+.1f})."
                ),
            ),
            "battle_escalation": (
                f"Battle heating up on {mtitle}",
                (
                    f"{agent.name} doubled down while {opp_name} holds the fade. "
                    f"Spread: {spread} pts."
                ),
            ),
            "narrative_acceleration": (
                f"Narrative accelerating — {mtitle}",
                f"Cluster repriced {mtitle}; {agent.name} led. Median YES {new_prob:.0f}%.",
            ),
            "verified_call": (
                f"Verified call — {mtitle}",
                f"{agent.name} archived a pre-consensus read on {mtitle}.",
            ),
            "reputation_move": (
                f"{agent.name} reputation ticked up",
                f"Sustained calibration in {agent.niche} — score climbing on recent calls.",
            ),
            "new_take": (
                f"New take — {agent.name} on {mtitle}",
                kwargs.get("take_snippet") or f"{agent.name} posted fresh conviction on {mtitle}.",
            ),
            "position_update": (
                f"Position flow on {mtitle}",
                f"Desk flow on {mtitle} — {agent.name} frames size as directional signal.",
            ),
            "stance_followup": (
                f"Follow-up — {agent.name} on {mtitle}",
                f"{agent.name} revisits {mtitle} — thesis held, narrative continuing.",
            ),
            "rivalry": (
                f"Rivalry — {agent.name} on {mtitle}",
                f"{agent.name} escalates a curated rivalry on {mtitle}. Spread: {spread} pts.",
            ),
            "quiet_pulse": (
                f"{mtitle} — quiet pulse",
                f"{agent.name} watching {mtitle}. Tape steady; no thesis change.",
            ),
        }
        title, body = templates.get(event_type, (f"{agent.name} signal", f"{agent.name}: activity on {mtitle}."))
        if isinstance(body, str) and opponent and event_type not in ("battle_escalation",):
            body += f" {opp_name} disagrees on timing."
        return GeneratedCopy(
            title=title[:255],
            body=body if isinstance(body, str) else str(body),
            confidence=kwargs.get("confidence"),
            spread=spread if event_type == "battle_escalation" else None,
        )


def _short_market_title(title: str, max_len: int = 42) -> str:
    if len(title) <= max_len:
        return title
    return title[: max_len - 1].rstrip() + "…"


def build_conviction_engine(
    rng: random.Random,
    rep_by_agent: dict[int, AgentReputation],
    agents: list[Agent] | None = None,
) -> ConvictionEngine:
    ctx = ConvictionContext(
        rng=rng,
        rep_by_agent=rep_by_agent,
        agents_by_id={a.id: a for a in (agents or [])},
    )
    return ConvictionEngine(ctx)
