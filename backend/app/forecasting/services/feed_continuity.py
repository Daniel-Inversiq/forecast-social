"""Feed continuity — visible narrative memory, arcs, rivalry, and market states."""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Any

from sqlalchemy.orm import Session

from app.forecasting.models import Agent, AgentState, FeedEvent, Market, MarketTake
from app.forecasting.services.agent_state import AgentMemory
from app.forecasting.services.narrative_clustering import NARRATIVE_TEMPLATES, _text_blob
from app.forecasting.services.utils import hash_seed, parse_spread, title_to_slug

# User-facing continuity labels (requirement set)
CONTINUITY_LABELS = frozenset(
    {
        "escalation",
        "consensus fracture",
        "counterattack",
        "isolation",
        "timing split",
        "narrative acceleration",
        "flips stance",
    }
)

ARC_PROGRESSION_STAGES = (
    "opening thesis",
    "first counter",
    "consensus split",
    "escalation",
    "coalition forming",
    "isolation",
    "outcome pressure",
    "receipt pending",
)

MARKET_NARRATIVE_STATES = frozenset(
    {
        "fragmenting",
        "consensus building",
        "panic repricing",
        "stabilization",
        "crowded",
        "contrarian breakout",
    }
)

_META_STAGE_TO_PROGRESSION = {
    "new_thesis": "opening thesis",
    "follow_up": "first counter",
    "disagreement": "consensus split",
    "escalation": "escalation",
}

_EVENT_TYPE_PROGRESSION = {
    "new_take": "opening thesis",
    "stance_followup": "outcome pressure",
    "rivalry": "first counter",
    "battle_escalation": "escalation",
    "narrative_acceleration": "coalition forming",
    "market_move": "consensus split",
    "signal_shift": "coalition forming",
    "verified_call": "receipt pending",
    "reputation_move": "outcome pressure",
    "quiet_pulse": "isolation",
}


@dataclass
class ContinuityContext:
    """Precomputed memory for feed enrichment."""

    memories: dict[int, AgentMemory] = field(default_factory=dict)
    agents_by_slug: dict[str, Agent] = field(default_factory=dict)
    markets_by_id: dict[int, Market] = field(default_factory=dict)
    arc_events: dict[str, list[FeedEvent]] = field(default_factory=dict)
    market_events: dict[int, list[FeedEvent]] = field(default_factory=dict)
    rivalry_history: dict[tuple[str, str], list[dict[str, Any]]] = field(default_factory=dict)
    market_narrative: dict[int, dict[str, Any]] = field(default_factory=dict)
    narrative_for_market: dict[int, dict[str, Any]] = field(default_factory=dict)


def load_agent_memories(db: Session, agents: list[Agent]) -> dict[int, AgentMemory]:
    if not agents:
        return {}
    rows = db.query(AgentState).filter(AgentState.agent_id.in_([a.id for a in agents])).all()
    out: dict[int, AgentMemory] = {}
    for agent in agents:
        row = next((r for r in rows if r.agent_id == agent.id), None)
        data = dict(row.state_json) if row and row.state_json else {}
        out[agent.id] = AgentMemory(agent.id, agent.slug, data)
    return out


def _dominant_narrative_for_market(market: Market, events: list[FeedEvent]) -> dict[str, Any] | None:
    scores: dict[str, float] = defaultdict(float)
    for template in NARRATIVE_TEMPLATES:
        nid = template["id"]
        blob = _text_blob(market.title, market.category)
        if any(kw in blob for kw in template["keywords"]):
            scores[nid] += 2.0
        if market.category.lower() in template["categories"]:
            scores[nid] += 1.0
        for event in events:
            eblob = _text_blob(event.title, event.body)
            if any(kw in eblob for kw in template["keywords"]):
                scores[nid] += 1.5

    if not scores:
        return None
    best_id = max(scores, key=scores.get)
    template = next(t for t in NARRATIVE_TEMPLATES if t["id"] == best_id)
    return {"id": best_id, "label": template["label"], "strength": round(scores[best_id] * 4.5, 1)}


def _compute_market_narrative_state(market: Market, events: list[FeedEvent]) -> str | None:
    if not events:
        return None

    recent = sorted(events, key=lambda e: e.created_at or datetime.min, reverse=True)[:12]
    types = [e.type for e in recent]
    deltas: list[float] = []
    spreads: list[int] = []
    sides: list[str] = []

    for event in recent:
        meta = event.metadata_json or {}
        if meta.get("delta") is not None:
            deltas.append(abs(float(meta["delta"])))
        if meta.get("side"):
            sides.append(str(meta["side"]))
        sp = meta.get("spread")
        if sp is not None:
            spreads.append(int(sp))
        elif event.type in ("rivalry", "battle_escalation"):
            parsed = parse_spread(event.body)
            if parsed:
                spreads.append(parsed)

    if types.count("quiet_pulse") >= max(2, len(types) // 3):
        return "stabilization"

    if deltas and max(deltas) >= 2.8 and len([d for d in deltas if d >= 2.0]) >= 2:
        return "panic repricing"

    if spreads and max(spreads) >= 32:
        return "fragmenting"

    if sides and len(set(sides)) == 1 and len(sides) >= 3:
        return "crowded"

    move_types = sum(1 for t in types if t in ("market_move", "signal_shift", "narrative_acceleration"))
    if move_types >= 3:
        prob = market.current_yes_probability
        if prob >= 62 or prob <= 38:
            return "consensus building"

    if types.count("verified_call") or any(t in ("market_move", "signal_shift") for t in types[:3]):
        meta0 = recent[0].metadata_json or {}
        if meta0.get("side") and market.current_yes_probability >= 55 and meta0.get("side") == "NO":
            return "contrarian breakout"
        if meta0.get("side") and market.current_yes_probability <= 45 and meta0.get("side") == "YES":
            return "contrarian breakout"

    if len(set(types)) >= 4:
        return "fragmenting"

    return "consensus building" if move_types >= 2 else None


def build_continuity_context(
    db: Session,
    *,
    agents: list[Agent],
    markets: list[Market],
    events: list[FeedEvent],
    takes: list[MarketTake] | None = None,
) -> ContinuityContext:
    ctx = ContinuityContext(
        memories=load_agent_memories(db, agents),
        agents_by_slug={a.slug: a for a in agents},
        markets_by_id={m.id: m for m in markets},
    )

    sorted_events = sorted(
        events,
        key=lambda e: e.created_at or datetime.min,
        reverse=True,
    )

    for event in sorted_events:
        meta = event.metadata_json or {}
        arc_id = meta.get("arc_id")
        if arc_id:
            ctx.arc_events.setdefault(str(arc_id), []).append(event)
        if event.market_id:
            ctx.market_events.setdefault(event.market_id, []).append(event)

        agent_slug = event.agent.slug if event.agent else None
        opp_slug = meta.get("opponent_slug")
        if agent_slug and opp_slug:
            pair = tuple(sorted((agent_slug, str(opp_slug))))
            spread = meta.get("spread")
            if spread is None and event.type in ("rivalry", "battle_escalation"):
                spread = parse_spread(event.body)
            ctx.rivalry_history.setdefault(pair, []).append(
                {
                    "event_id": event.id,
                    "type": event.type,
                    "spread": spread,
                    "created_at": event.created_at.isoformat() if event.created_at else None,
                    "market_id": event.market_id,
                }
            )

    for pair, hist in ctx.rivalry_history.items():
        hist.sort(key=lambda x: x.get("created_at") or "", reverse=True)

    for market in markets:
        if market.status != "open":
            continue
        mevents = ctx.market_events.get(market.id, [])
        state = _compute_market_narrative_state(market, mevents)
        if state:
            narrative = _dominant_narrative_for_market(market, mevents)
            ctx.market_narrative[market.id] = {
                "state": state,
                "narrative_id": narrative["id"] if narrative else None,
                "narrative_label": narrative["label"] if narrative else None,
            }
            if narrative:
                ctx.narrative_for_market[market.id] = narrative

    return ctx


def arc_progression_label(
    event: FeedEvent,
    *,
    meta: dict[str, Any],
    mem: AgentMemory | None,
    arc_events: list[FeedEvent] | None,
) -> str | None:
    arc_id = meta.get("arc_id")
    if not arc_id and not mem:
        return None

    meta_stage = meta.get("arc_stage")
    if meta_stage and meta_stage in _META_STAGE_TO_PROGRESSION:
        label = _META_STAGE_TO_PROGRESSION[meta_stage]
    else:
        label = _EVENT_TYPE_PROGRESSION.get(event.type)

    if arc_id and mem:
        for arc in mem.active_arcs:
            if arc.get("arc_id") == arc_id:
                stage = int(arc.get("stage", 0))
                if stage <= 0:
                    return "opening thesis"
                if stage == 1:
                    return "first counter"
                if stage == 2:
                    return "consensus split"
                if stage == 3:
                    return "escalation"
                if stage >= 4:
                    return "outcome pressure"
                break

    if arc_events and len(arc_events) >= 4 and event.type == "stance_followup":
        return "receipt pending"

    return label


def continuity_label(
    event: FeedEvent,
    *,
    meta: dict[str, Any],
    mem: AgentMemory | None,
    ctx: ContinuityContext,
) -> str | None:
    if meta.get("stance_flip_reason"):
        return "flips stance"

    if event.type == "verified_call":
        return "timing split"

    if event.type in ("rivalry", "battle_escalation"):
        agent_slug = event.agent.slug if event.agent else None
        opp_slug = meta.get("opponent_slug")
        if agent_slug and opp_slug:
            pair = tuple(sorted((agent_slug, str(opp_slug))))
            hist = ctx.rivalry_history.get(pair, [])
            if len(hist) >= 2:
                spreads = [h["spread"] for h in hist if h.get("spread") is not None]
                if len(spreads) >= 2 and spreads[0] and spreads[1] and spreads[0] > spreads[1]:
                    return "escalation"
                return "counterattack"
        heat = int(meta.get("rival_heat", 0))
        if heat >= 3:
            return "escalation"
        return None

    if event.type == "stance_followup":
        arc_id = meta.get("arc_id")
        if arc_id:
            prior = ctx.arc_events.get(str(arc_id), [])
            if len(prior) >= 2:
                return "counterattack"
        return "timing split"

    if event.type == "quiet_pulse":
        return "isolation"

    if event.type == "new_take" and meta.get("arc_id"):
        return "narrative acceleration"

    if event.type in ("market_move", "signal_shift"):
        side = meta.get("side")
        market = event.market
        if side and market:
            prob = market.current_yes_probability
            if (side == "NO" and prob >= 58) or (side == "YES" and prob <= 42):
                return "consensus fracture"
        if mem and event.market_id:
            stance = mem.stance_for_market(event.market_id)
            if stance and stance.get("flip_reason"):
                return "flips stance"
        return "narrative acceleration"

    if event.type == "narrative_acceleration":
        return "narrative acceleration"

    return None


def rivalry_memory_line(
    event: FeedEvent,
    *,
    meta: dict[str, Any],
    ctx: ContinuityContext,
) -> str | None:
    if event.type not in ("rivalry", "battle_escalation"):
        return None
    agent_slug = event.agent.slug if event.agent else None
    opp_slug = meta.get("opponent_slug")
    if not agent_slug or not opp_slug:
        return None

    pair = tuple(sorted((agent_slug, str(opp_slug))))
    hist = ctx.rivalry_history.get(pair, [])
    mem = ctx.memories.get(event.agent_id) if event.agent_id else None
    encounters = 0
    if mem:
        rival = mem.rivals.get(str(opp_slug), {})
        encounters = int(rival.get("encounters", 0))

    current_spread = meta.get("spread")
    if current_spread is None:
        current_spread = parse_spread(event.body)

    prior_spreads = [h["spread"] for h in hist[1:] if h.get("spread") is not None]
    opp_name = str(opp_slug).replace("-", " ").title()

    if prior_spreads and current_spread:
        prev = prior_spreads[0]
        if current_spread > prev:
            return (
                f"Rematch #{max(1, encounters)} with {opp_name} — spread widened "
                f"{prev}→{current_spread} pts."
            )
        return f"Rematch #{max(1, encounters)} with {opp_name} — spread holding near {current_spread} pts."

    if encounters >= 2:
        return f"Ongoing rivalry with {opp_name} ({encounters} recent encounters on tape)."

    return f"Rivalry thread opening with {opp_name}."


def prior_call_reference(mem: AgentMemory | None, market_id: int | None) -> str | None:
    if not mem or not market_id:
        return None
    stance = mem.stance_for_market(market_id)
    if stance and stance.get("thesis"):
        return str(stance["thesis"])[:140]
    for call in mem.data.get("recent_calls", []):
        if call.get("market_id") == market_id and call.get("summary"):
            return str(call["summary"])[:140]
    for thesis in mem.data.get("current_theses", []):
        if thesis.get("market_id") == market_id and thesis.get("thesis"):
            return str(thesis["thesis"])[:140]
    return None


def enrich_event_continuity(
    event: FeedEvent,
    ctx: ContinuityContext,
) -> dict[str, Any]:
    meta = event.metadata_json or {}
    mem = ctx.memories.get(event.agent_id) if event.agent_id else None
    arc_id = meta.get("arc_id")
    arc_events = ctx.arc_events.get(str(arc_id), []) if arc_id else []

    label = continuity_label(event, meta=meta, mem=mem, ctx=ctx)
    progression = arc_progression_label(
        event, meta=meta, mem=mem, arc_events=arc_events
    )

    market_state = None
    market_narrative = None
    if event.market_id and event.market_id in ctx.market_narrative:
        mn = ctx.market_narrative[event.market_id]
        market_state = mn.get("state")
        market_narrative = mn.get("narrative_label")

    opponent_slug = meta.get("opponent_slug")
    opponent_name = None
    if opponent_slug:
        opp = ctx.agents_by_slug.get(str(opponent_slug))
        opponent_name = opp.name if opp else str(opponent_slug).replace("-", " ").title()

    prior_thesis = prior_call_reference(mem, event.market_id)
    rivalry_line = rivalry_memory_line(event, meta=meta, ctx=ctx)

    arc_summary = None
    if arc_id and mem:
        for arc in mem.active_arcs:
            if arc.get("arc_id") == arc_id:
                arc_summary = {
                    "arc_id": arc_id,
                    "stage_index": int(arc.get("stage", 0)),
                    "thesis": arc.get("thesis"),
                    "side": arc.get("side"),
                    "rival_slug": arc.get("rival_slug"),
                    "events_in_arc": len(arc_events),
                }
                break

    return {
        "continuity_label": label,
        "arc_progression": progression,
        "arc_id": arc_id,
        "arc_summary": arc_summary,
        "prior_thesis": prior_thesis,
        "stance_side": meta.get("side"),
        "opponent_slug": opponent_slug,
        "opponent_name": opponent_name,
        "rivalry_memory": rivalry_line,
        "market_narrative_state": market_state,
        "market_narrative_label": market_narrative,
        "returns_to_arc": bool(arc_id and event.type in ("stance_followup", "signal_shift", "market_move")),
    }


def apply_continuity_to_reasoning(reasoning: dict, continuity: dict[str, Any]) -> dict:
    out = dict(reasoning)
    label = continuity.get("continuity_label")
    rivalry = continuity.get("rivalry_memory")
    prior = continuity.get("prior_thesis")

    if label == "counterattack" and prior:
        out["why_now"] = f"Counterattack off prior read: {prior[:100]}…"
    elif label == "timing split" and prior:
        out["why_now"] = f"Timing split versus prior thesis anchor: {prior[:90]}…"
    elif label == "flips stance":
        flip = (reasoning.get("summary") or "")[:80]
        out["why_now"] = f"Public stance flip — {flip or 're-underwrite after new inputs'}."
    elif label == "escalation" and rivalry:
        out["why_now"] = rivalry
    elif label == "narrative acceleration":
        prog = continuity.get("arc_progression") or "narrative"
        out["why_now"] = f"Returns to an active {prog} thread on this market."
    elif label == "consensus fracture":
        out["why_now"] = "Consensus cracked and opposing confidence is now explicit."
    elif label == "timing split":
        out["why_now"] = "Earlier thesis timing is now visible to the network."
    elif label == "isolation":
        out["why_now"] = "Position is isolated versus the dominant cluster."
    elif label == "counterattack":
        out["why_now"] = "Narrative counterattack landed and forced the thread forward."

    if prior and not out.get("narrative_driver"):
        out["narrative_driver"] = prior[:160]

    if continuity.get("opponent_name") and not out.get("who_disagrees"):
        out["who_disagrees"] = continuity["opponent_name"]

    return out


def reorder_for_arc_coherence(payloads: list[dict]) -> list[dict]:
    """Group related arc/market events while preserving broad recency."""
    if len(payloads) < 3:
        return payloads

    used: set[int | str] = set()
    result: list[dict] = []
    by_arc: dict[str, list[dict]] = defaultdict(list)
    by_market: dict[str, list[dict]] = defaultdict(list)

    for p in payloads:
        aid = p.get("id")
        arc = p.get("arc_id")
        mslug = p.get("market_slug")
        if arc:
            by_arc[str(arc)].append(p)
        elif mslug and p.get("returns_to_arc"):
            by_market[mslug].append(p)

    def pid(p: dict) -> int | str:
        return p.get("id") or id(p)

    for p in payloads:
        if pid(p) in used:
            continue
        arc = p.get("arc_id")
        cluster: list[dict] = []
        if arc and str(arc) in by_arc and len(by_arc[str(arc)]) > 1:
            cluster = sorted(
                by_arc[str(arc)],
                key=lambda x: x.get("created_at") or "",
                reverse=True,
            )
        elif p.get("market_slug") and p.get("market_slug") in by_market:
            mslug = p["market_slug"]
            if len(by_market[mslug]) > 1:
                cluster = sorted(
                    by_market[mslug],
                    key=lambda x: x.get("created_at") or "",
                    reverse=True,
                )

        if cluster and len(cluster) > 1:
            for item in cluster:
                k = pid(item)
                if k not in used:
                    result.append(item)
                    used.add(k)
        else:
            k = pid(p)
            if k not in used:
                result.append(p)
                used.add(k)

    for p in payloads:
        if pid(p) not in used:
            result.append(p)

    return result


def market_states_for_meta(ctx: ContinuityContext) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for market_id, info in ctx.market_narrative.items():
        market = ctx.markets_by_id.get(market_id)
        if not market:
            continue
        out.append(
            {
                "market_id": market_id,
                "market_slug": title_to_slug(market.title),
                "market_title": market.title,
                "state": info.get("state"),
                "narrative_id": info.get("narrative_id"),
                "narrative_label": info.get("narrative_label"),
            }
        )
    out.sort(key=lambda x: (x.get("state") or "", x.get("market_title") or ""))
    return out[:12]
