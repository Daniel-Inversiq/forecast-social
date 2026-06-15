"""Scry agent memory — persistent theses, rivals, stances, and narrative arcs."""

from __future__ import annotations

import random
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Any

from sqlalchemy.orm import Session

from app.forecasting.models import Agent, AgentReputation, AgentState, FeedEvent, Market, MarketTake
from app.forecasting.seed_data.agents import AGENT_VOICE, opponent_slugs_for
from app.forecasting.services.utils import hash_seed

BEARISH_BIAS_MARKERS = ("bear", "contrarian", "fade", "skeptic", "nihilist", "cynical", "ai-bear", "injury-bear")
BULLISH_BIAS_MARKERS = ("bull", "momentum", "optimistic", "dovish", "upset", "product-bull", "supply-bull", "quant-bull")
CONTRARIAN_MARKERS = ("contrarian", "fade", "consensus", "cynical", "skeptic", "nihilist")

FLIP_REASONS = [
    "New {term} print broke the prior band — stance update required.",
    "Timing edge expired after {term}; revising conviction, not abandoning the read.",
    "Cross-agent battle on {term} forced a rare re-underwrite.",
    "{term} data crossed a threshold I said would matter — updating side.",
    "Consensus finally caught up; I'm rotating before the crowd overcorrects on {term}.",
]

ARC_EVENT_SEQUENCE = (
    "new_take",
    "stance_followup",
    "battle_escalation",
    "rivalry",
    "signal_shift",
    "stance_followup",
)


def _utcnow() -> datetime:
    return datetime.utcnow()


def _empty_state() -> dict[str, Any]:
    return {
        "current_theses": [],
        "favorite_markets": [],
        "rivals": {},
        "recent_calls": [],
        "confidence_tendency": 0.62,
        "last_stance": {},
        "active_arcs": [],
        "recent_phrases": [],
    }


@dataclass
class AgentMemory:
    """In-memory view of an agent's Scry state."""

    agent_id: int
    agent_slug: str
    data: dict[str, Any] = field(default_factory=_empty_state)

    @property
    def confidence_tendency(self) -> float:
        return float(self.data.get("confidence_tendency", 0.62))

    @property
    def last_stance(self) -> dict[str, dict[str, Any]]:
        return self.data.setdefault("last_stance", {})

    @property
    def rivals(self) -> dict[str, dict[str, Any]]:
        return self.data.setdefault("rivals", {})

    @property
    def active_arcs(self) -> list[dict[str, Any]]:
        return self.data.setdefault("active_arcs", [])

    @property
    def recent_phrases(self) -> list[str]:
        return self.data.setdefault("recent_phrases", [])

    def stance_for_market(self, market_id: int) -> dict[str, Any] | None:
        return self.last_stance.get(str(market_id))

    def side_for_market(self, market_id: int) -> str | None:
        stance = self.stance_for_market(market_id)
        return stance.get("side") if stance else None

    def favorite_market_ids(self, limit: int = 5) -> list[int]:
        favs = sorted(
            self.data.get("favorite_markets", []),
            key=lambda x: x.get("weight", 0),
            reverse=True,
        )
        return [int(f["market_id"]) for f in favs[:limit] if f.get("market_id") is not None]

    def rival_heat(self, rival_slug: str) -> int:
        return int(self.rivals.get(rival_slug, {}).get("heat", 0))

    def bump_favorite(self, market_id: int, delta: float = 0.15) -> None:
        favs: list[dict[str, Any]] = self.data.setdefault("favorite_markets", [])
        for fav in favs:
            if fav.get("market_id") == market_id:
                fav["weight"] = min(1.0, float(fav.get("weight", 0.5)) + delta)
                fav["last_active_at"] = _utcnow().isoformat()
                return
        favs.append({"market_id": market_id, "weight": 0.55 + delta, "last_active_at": _utcnow().isoformat()})
        favs.sort(key=lambda x: x.get("weight", 0), reverse=True)
        self.data["favorite_markets"] = favs[:8]

    def record_thesis(self, market_id: int, side: str, thesis: str, confidence: float) -> None:
        theses: list[dict[str, Any]] = self.data.setdefault("current_theses", [])
        now = _utcnow().isoformat()
        for t in theses:
            if t.get("market_id") == market_id:
                t.update({"side": side, "thesis": thesis, "confidence": confidence, "updated_at": now})
                break
        else:
            theses.insert(0, {"market_id": market_id, "side": side, "thesis": thesis, "confidence": confidence, "updated_at": now})
        self.data["current_theses"] = theses[:6]

    def set_stance(
        self,
        market_id: int,
        side: str,
        confidence: float,
        *,
        reason: str | None = None,
        thesis: str | None = None,
    ) -> None:
        now = _utcnow().isoformat()
        prev = self.stance_for_market(market_id)
        entry: dict[str, Any] = {
            "side": side,
            "confidence": confidence,
            "since": prev.get("since", now) if prev and prev.get("side") == side else now,
            "updated_at": now,
        }
        if reason:
            entry["flip_reason"] = reason
        if thesis:
            entry["thesis"] = thesis
        self.last_stance[str(market_id)] = entry

    def record_call(
        self,
        *,
        event_type: str,
        market_id: int | None,
        side: str | None,
        summary: str,
        opponent_slug: str | None = None,
    ) -> None:
        calls: list[dict[str, Any]] = self.data.setdefault("recent_calls", [])
        calls.insert(
            0,
            {
                "event_type": event_type,
                "market_id": market_id,
                "side": side,
                "summary": summary[:200],
                "opponent_slug": opponent_slug,
                "created_at": _utcnow().isoformat(),
            },
        )
        self.data["recent_calls"] = calls[:12]

    def bump_rival(self, rival_slug: str, *, market_id: int | None, event_type: str) -> int:
        rivals = self.rivals
        entry = rivals.setdefault(rival_slug, {"heat": 0, "encounters": 0})
        entry["heat"] = min(10, int(entry.get("heat", 0)) + 1)
        entry["encounters"] = int(entry.get("encounters", 0)) + 1
        entry["last_market_id"] = market_id
        entry["last_event_type"] = event_type
        entry["last_at"] = _utcnow().isoformat()
        return int(entry["heat"])

    def add_phrase(self, phrase: str, *, limit: int = 24) -> None:
        key = phrase.strip().lower()
        if not key or len(key) < 4:
            return
        phrases = self.recent_phrases
        if key in phrases:
            phrases.remove(key)
        phrases.insert(0, key)
        self.data["recent_phrases"] = phrases[:limit]

    def start_arc(
        self,
        *,
        market_id: int,
        rival_slug: str | None,
        thesis: str,
        side: str,
    ) -> str:
        arc_id = f"{self.agent_slug}-{market_id}-{hash_seed(self.agent_slug, market_id, _utcnow().minute)}"
        self.active_arcs.insert(
            0,
            {
                "arc_id": arc_id,
                "market_id": market_id,
                "rival_slug": rival_slug,
                "thesis": thesis[:160],
                "side": side,
                "stage": 0,
                "started_at": _utcnow().isoformat(),
            },
        )
        self.data["active_arcs"] = self.active_arcs[:5]
        return arc_id

    def advance_arc(self, arc_id: str) -> dict[str, Any] | None:
        for arc in self.active_arcs:
            if arc.get("arc_id") == arc_id:
                arc["stage"] = int(arc.get("stage", 0)) + 1
                arc["last_at"] = _utcnow().isoformat()
                return arc
        return None

    def arc_ready_for_stage(self, arc: dict[str, Any]) -> str | None:
        stage = int(arc.get("stage", 0))
        if stage >= len(ARC_EVENT_SEQUENCE):
            return None
        return ARC_EVENT_SEQUENCE[stage]

    def prune_stale_arcs(self, *, hours: int = 48) -> None:
        cutoff = _utcnow() - timedelta(hours=hours)
        kept: list[dict[str, Any]] = []
        for arc in self.active_arcs:
            last = arc.get("last_at") or arc.get("started_at")
            if last:
                try:
                    if datetime.fromisoformat(last) < cutoff and int(arc.get("stage", 0)) >= 3:
                        continue
                except ValueError:
                    pass
            if int(arc.get("stage", 0)) < len(ARC_EVENT_SEQUENCE):
                kept.append(arc)
        self.data["active_arcs"] = kept[:5]

    def to_public_dict(self, markets_by_id: dict[int, Market] | None = None) -> dict[str, Any]:
        markets_by_id = markets_by_id or {}

        def market_label(mid: int | None) -> str | None:
            if mid is None:
                return None
            m = markets_by_id.get(mid)
            return m.title if m else None

        theses = []
        for t in self.data.get("current_theses", [])[:4]:
            theses.append(
                {
                    "market_id": t.get("market_id"),
                    "market_title": market_label(t.get("market_id")),
                    "side": t.get("side"),
                    "thesis": t.get("thesis"),
                    "confidence": t.get("confidence"),
                }
            )

        favorites = []
        for f in self.data.get("favorite_markets", [])[:5]:
            mid = f.get("market_id")
            favorites.append({"market_id": mid, "market_title": market_label(mid), "weight": f.get("weight")})

        rivals = []
        for slug, meta in sorted(self.rivals.items(), key=lambda x: -x[1].get("heat", 0))[:4]:
            rivals.append({"slug": slug, "heat": meta.get("heat", 0), "encounters": meta.get("encounters", 0)})

        return {
            "current_theses": theses,
            "favorite_markets": favorites,
            "rivals": rivals,
            "recent_calls": self.data.get("recent_calls", [])[:6],
            "confidence_tendency": round(self.confidence_tendency, 2),
            "active_arcs": len(self.active_arcs),
            "arcs": [
                {
                    "arc_id": a.get("arc_id"),
                    "market_id": a.get("market_id"),
                    "market_title": market_label(a.get("market_id")),
                    "stage": int(a.get("stage", 0)),
                    "side": a.get("side"),
                    "thesis": (a.get("thesis") or "")[:120],
                    "rival_slug": a.get("rival_slug"),
                }
                for a in self.active_arcs[:4]
            ],
        }


class AgentStateStore:
    """Load, bootstrap, and persist agent memory across event generation."""

    def __init__(self, db: Session, *, rng: random.Random | None = None):
        self.db = db
        self.rng = rng or random.Random()
        self._by_agent: dict[int, AgentMemory] = {}
        self._rows: dict[int, AgentState] = {}

    def load(self, agents: list[Agent]) -> dict[int, AgentMemory]:
        rows = self.db.query(AgentState).filter(AgentState.agent_id.in_([a.id for a in agents])).all()
        self._rows = {r.agent_id: r for r in rows}
        for agent in agents:
            row = self._rows.get(agent.id)
            if row and row.state_json:
                self._by_agent[agent.id] = AgentMemory(agent.id, agent.slug, dict(row.state_json))
            else:
                self._by_agent[agent.id] = AgentMemory(agent.id, agent.slug, _empty_state())
        return self._by_agent

    def get(self, agent_id: int) -> AgentMemory | None:
        return self._by_agent.get(agent_id)

    def bootstrap_agent(
        self,
        agent: Agent,
        *,
        takes: list[MarketTake],
        markets: list[Market],
        rep: AgentReputation | None,
    ) -> AgentMemory:
        mem = self._by_agent.get(agent.id) or AgentMemory(agent.id, agent.slug, _empty_state())
        voice = AGENT_VOICE.get(agent.slug, {})
        aggressiveness = float(voice.get("aggressiveness", 0.55))
        rep_score = rep.score if rep else 42.0 + hash_seed(agent.slug) % 18
        mem.data["confidence_tendency"] = round(
            min(0.92, max(0.38, aggressiveness * 0.55 + rep_score / 200)),
            2,
        )

        agent_takes = [t for t in takes if t.agent_id == agent.id]
        for take in agent_takes[:4]:
            mem.set_stance(take.market_id, take.side, take.confidence, thesis=take.body[:140])
            mem.record_thesis(take.market_id, take.side, take.body[:140], take.confidence)
            mem.bump_favorite(take.market_id, delta=0.2)

        niche_markets = [m for m in markets if m.category.lower() == agent.niche.lower() and m.status == "open"]
        for m in niche_markets[:2]:
            if m.id not in mem.favorite_market_ids():
                mem.bump_favorite(m.id, delta=0.1)

        sample = voice.get("sample_take")
        if sample and niche_markets:
            m = niche_markets[hash_seed(agent.slug) % len(niche_markets)]
            side = resolve_side_from_bias(agent.slug, m.current_yes_probability, self.rng)
            if not mem.side_for_market(m.id):
                conf = 58 + hash_seed(agent.slug, m.id) % 22
                mem.set_stance(m.id, side, conf, thesis=str(sample)[:140])
                mem.record_thesis(m.id, side, str(sample)[:140], conf)

        for rival_slug in opponent_slugs_for(agent.slug)[:3]:
            mem.rivals.setdefault(rival_slug, {"heat": 1, "encounters": 0})

        self._by_agent[agent.id] = mem
        return mem

    def ensure_all(
        self,
        agents: list[Agent],
        *,
        takes: list[MarketTake],
        markets: list[Market],
        rep_by_agent: dict[int, AgentReputation],
    ) -> dict[int, AgentMemory]:
        self.load(agents)
        changed = False
        for agent in agents:
            mem = self._by_agent.get(agent.id)
            if mem and (mem.last_stance or mem.data.get("current_theses")):
                continue
            self.bootstrap_agent(agent, takes=takes, markets=markets, rep=rep_by_agent.get(agent.id))
            changed = True
        if changed:
            self.persist()
        return self._by_agent

    def persist(self) -> None:
        for agent_id, mem in self._by_agent.items():
            row = self._rows.get(agent_id)
            if row is None:
                row = self.db.query(AgentState).filter(AgentState.agent_id == agent_id).first()
            if row is None:
                row = AgentState(agent_id=agent_id, state_json=mem.data)
                self.db.add(row)
            else:
                row.state_json = mem.data
                row.updated_at = _utcnow()
            self._rows[agent_id] = row
        self.db.flush()


def ensure_agent_states(db: Session) -> None:
    agents = db.query(Agent).all()
    if not agents:
        return
    takes = db.query(MarketTake).order_by(MarketTake.created_at.desc()).limit(200).all()
    markets = db.query(Market).all()
    reps = {r.agent_id: r for r in db.query(AgentReputation).all()}
    store = AgentStateStore(db)
    store.ensure_all(agents, takes=takes, markets=markets, rep_by_agent=reps)


def resolve_side_from_bias(slug: str, consensus_yes: float, rng: random.Random) -> str:
    """Map agent bias to a side relative to market consensus."""
    bias = str(AGENT_VOICE.get(slug, {}).get("bias", "")).lower()
    if any(m in bias for m in CONTRARIAN_MARKERS):
        if consensus_yes >= 58:
            return "NO"
        if consensus_yes <= 42:
            return "YES"
        return "NO" if rng.random() > 0.42 else "YES"
    if any(m in bias for m in BEARISH_BIAS_MARKERS):
        return "NO" if consensus_yes >= 48 else "YES"
    if any(m in bias for m in BULLISH_BIAS_MARKERS):
        return "YES" if consensus_yes <= 52 else "NO"
    return "YES" if consensus_yes >= 50 else "NO"


def resolve_agent_side(
    agent: Agent,
    market: Market,
    mem: AgentMemory,
    *,
    rng: random.Random,
    take: MarketTake | None = None,
) -> tuple[str, float, str | None]:
    """Return side, confidence, optional flip reason."""
    existing = mem.stance_for_market(market.id)
    if take:
        side = take.side
        conf = take.confidence
    elif existing:
        side = existing["side"]
        conf = float(existing.get("confidence", mem.confidence_tendency * 100))
    else:
        side = resolve_side_from_bias(agent.slug, market.current_yes_probability, rng)
        conf = mem.confidence_tendency * 100 + rng.randint(-6, 10)

    flip_reason: str | None = None
    if existing and existing.get("side") != side:
        allowed, flip_reason = evaluate_stance_flip(agent, existing, side, rng)
        if not allowed:
            side = existing["side"]
            conf = float(existing.get("confidence", conf))
            flip_reason = None

    return side, max(52.0, min(96.0, conf)), flip_reason


def evaluate_stance_flip(
    agent: Agent,
    existing: dict[str, Any],
    new_side: str,
    rng: random.Random,
) -> tuple[bool, str | None]:
    """High-conviction agents flip rarely; flips always carry a reason."""
    conf = float(existing.get("confidence", 70))
    voice = AGENT_VOICE.get(agent.slug, {})
    aggressiveness = float(voice.get("aggressiveness", 0.55))
    persist_threshold = 82 if aggressiveness < 0.5 else 74 if aggressiveness > 0.8 else 78

    if conf >= persist_threshold:
        flip_odds = 0.12 if conf >= 88 else 0.22
    else:
        flip_odds = 0.38

    if rng.random() > flip_odds:
        return False, None

    term = voice.get("voice_note", agent.niche.lower())
    reason = rng.choice(FLIP_REASONS).format(term=term)
    return True, reason


def pick_agent_for_market(
    agents: list[Agent],
    market: Market,
    states: dict[int, AgentMemory],
    rep_by_agent: dict[int, AgentReputation],
    rng: random.Random,
    *,
    prefer_arc: dict[str, Any] | None = None,
) -> Agent:
    if prefer_arc and prefer_arc.get("agent_id"):
        agent = next((a for a in agents if a.id == prefer_arc["agent_id"]), None)
        if agent:
            return agent

    scored: list[tuple[float, Agent]] = []
    for agent in agents:
        mem = states.get(agent.id)
        score = 0.0
        if agent.niche.lower() == market.category.lower():
            score += 2.5
        if mem:
            if market.id in mem.favorite_market_ids():
                score += 2.0 + mem.confidence_tendency
            stance = mem.stance_for_market(market.id)
            if stance:
                score += 1.2
        rep = rep_by_agent.get(agent.id)
        if rep:
            score += rep.score / 40 + rep.velocity * 0.3
        score += rng.random() * 0.8
        scored.append((score, agent))
    scored.sort(key=lambda x: -x[0])
    pool = [a for _, a in scored[:8]]
    return rng.choice(pool[: min(5, len(pool))])


def market_delta_for_side(side: str, rng: random.Random) -> float:
    """Nudge market probability in direction consistent with agent stance."""
    direction = 1 if side == "YES" else -1
    magnitude = rng.uniform(0.8, 3.6)
    return direction * magnitude


def pick_arc_continuation(
    states: dict[int, AgentMemory],
    markets_by_id: dict[int, Market],
    rng: random.Random,
) -> tuple[AgentMemory, dict[str, Any], Market] | None:
    candidates: list[tuple[AgentMemory, dict[str, Any], Market]] = []
    for mem in states.values():
        mem.prune_stale_arcs()
        for arc in mem.active_arcs:
            market = markets_by_id.get(int(arc.get("market_id", 0)))
            if not market or market.status != "open":
                continue
            if mem.arc_ready_for_stage(arc):
                candidates.append((mem, arc, market))
    if not candidates:
        return None
    return rng.choice(candidates)
