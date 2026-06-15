from app.forecasting.models import Agent, FeedEvent, Market
from app.forecasting.services.context import IntelligenceContext
from app.forecasting.services.utils import parse_spread


def _niche_agents_label(niche: str) -> str:
    labels = {
        "macro": "Fed-sensitive macro agents",
        "rates": "Rates-focused forecasters",
        "crypto": "Crypto forecasters",
        "equities": "Equity momentum agents",
        "politics": "Election modelers",
        "sports": "Sports upset specialists",
        "tech": "AI-timeline forecasters",
        "climate": "Climate policy agents",
        "commodities": "Commodity strategists",
    }
    return labels.get(niche.lower(), f"{niche} agents")


def _first_sentence(text: str) -> str:
    for sep in (". ", "; ", " — "):
        if sep in text:
            return text.split(sep, 1)[0].strip() + ("." if sep == ". " else "")
    return text.strip()


def _why_now_for_generated(event_type: str) -> str:
    return {
        "market_move": "Cross-agent repricing hit the live band.",
        "signal_shift": "Conviction cluster tightened on new inputs.",
        "battle_escalation": "Opposing agents widened the disagreement spread.",
        "narrative_acceleration": "Multiple agents moved in the same window.",
        "verified_call": "Archived call resurfaced with timing edge.",
        "reputation_move": "Calibration streak triggered a reputation tick.",
        "new_take": "Fresh agent take entered the live disagreement set.",
        "position_update": "Desk flow crossed a visibility threshold.",
        "stance_followup": "Agent doubled down on a prior thesis — arc continuing.",
        "rivalry": "Curated rivalry pair escalated on contested market.",
    }.get(event_type, "Network intelligence updated.")


def generate_reasoning(
    event: FeedEvent,
    *,
    ctx: IntelligenceContext | None = None,
    opposing_agent: Agent | None = None,
) -> dict:
    agent = event.agent
    market = event.market
    meta = event.metadata_json or {}
    if meta.get("generated") and event.body:
        summary = meta.get("reasoning_summary") or _first_sentence(event.body)
        opponent = opposing_agent.name if opposing_agent else None
        if not opponent and meta.get("opponent_slug"):
            opponent = meta["opponent_slug"].replace("-", " ").title()
        return {
            "summary": summary,
            "why_now": _why_now_for_generated(event.type),
            "who_moved_first": agent.name if agent else "Network",
            "who_disagrees": opponent or "Holdouts on prior median",
            "narrative_driver": _first_sentence(event.body),
        }

    agent_name = agent.name if agent else "Unknown agent"
    niche = (agent.niche if agent else "Multi").lower()
    market_title = market.title if market else None
    spread = parse_spread(event.body) if event.type in ("rivalry", "battle_escalation") else None

    if event.type in ("rivalry", "battle_escalation"):
        opponent = opposing_agent.name if opposing_agent else "contrarians on the other side"
        summary = (
            f"{_niche_agents_label(niche)} widened disagreement on {market_title or 'this market'}"
            f" — spread now {spread or 'wide'} points while {opponent} holds the fade."
        )
        return {
            "summary": summary,
            "why_now": "Conviction spread widened as agents repriced on new information.",
            "who_moved_first": f"{agent_name} escalated the split",
            "who_disagrees": opponent if opposing_agent else "Multiple agents on opposite sides",
            "narrative_driver": event.body.split(".")[0] if event.body else event.title,
        }

    if event.type in ("receipt", "verified_call"):
        summary = (
            f"{agent_name} locked a verified call on {market_title or 'this market'}"
            " before consensus repriced — timing edge is the signal."
        )
        return {
            "summary": summary,
            "why_now": "Public forecast archived before the median moved.",
            "who_moved_first": f"{agent_name} posted early conviction",
            "who_disagrees": "Consensus lagged the call",
            "narrative_driver": "Receipt culture — proof over narrative",
        }

    if event.type in ("consensus_shift", "narrative_acceleration"):
        summary = (
            f"{_niche_agents_label(niche)} repriced {market_title or 'cluster odds'}"
            " — holdouts still anchored to the prior median."
        )
        return {
            "summary": summary,
            "why_now": "A cluster of agents moved in the same window.",
            "who_moved_first": f"{agent_name} led the timing shift",
            "who_disagrees": "Holdouts still on prior median",
            "narrative_driver": market_title or "Consensus repricing",
        }

    if event.type in ("leaderboard_move", "reputation_move"):
        summary = (
            f"{agent_name} gained leaderboard ground on sustained calibration"
            f" in {niche} — reputation velocity is accelerating."
        )
        return {
            "summary": summary,
            "why_now": "Sustained calibration streak hit leaderboard thresholds.",
            "who_moved_first": f"{agent_name} earned rank through verified calls",
            "who_disagrees": None,
            "narrative_driver": event.body.split(".")[0] if event.body else "Reputation jump",
        }

    if event.type == "new_take":
        summary = (
            f"{agent_name} published a fresh take on {market_title or 'this market'} — "
            "network is repricing around the new conviction line."
        )
        return {
            "summary": summary,
            "why_now": "New agent take entered the live disagreement set.",
            "who_moved_first": agent_name,
            "who_disagrees": "Agents still on prior side",
            "narrative_driver": event.body.split(":")[-1].strip() if ":" in event.body else event.title,
        }

    if event.type == "position_update":
        summary = (
            f"Position flow shifted on {market_title or 'this market'} — "
            f"{agent_name} interprets size as a directional signal."
        )
        return {
            "summary": summary,
            "why_now": "Desk flow crossed a visibility threshold.",
            "who_moved_first": "Position flow",
            "who_disagrees": f"{agent_name} vs. passive holders",
            "narrative_driver": event.title,
        }

    if event.type in ("confidence_shift", "market_move", "signal_shift"):
        delta_hint = ""
        if event.probability is not None and market:
            delta_hint = f" to {event.probability:.0f}%"
        summary = (
            f"{_niche_agents_label(niche)} repriced {market_title or event.title}{delta_hint}"
            " after new data forced a conviction update."
        )
        if ctx and ctx.conviction_style:
            style = ctx.conviction_style.lower()
            if "contrarian" in style or "fade" in style:
                summary += " Contrarian readers may view this as a fade setup."
            elif "high" in style or "conviction" in style:
                summary += " High-conviction cluster likely to follow through."
        return {
            "summary": summary,
            "why_now": "New data or narrative forced a conviction update.",
            "who_moved_first": f"{agent_name} moved first on this read",
            "who_disagrees": "Agents still anchored to prior band",
            "narrative_driver": market_title or event.title,
        }

    summary = f"{agent_name}: {event.title}"
    return {
        "summary": summary,
        "why_now": "Network activity on this conviction line.",
        "who_moved_first": agent_name,
        "who_disagrees": None,
        "narrative_driver": market_title or event.title,
    }
