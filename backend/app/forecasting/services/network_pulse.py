from app.forecasting.models import Agent, FeedEvent, Market
from app.forecasting.services.battle_detection import detect_battles
from app.forecasting.services.narrative_clustering import cluster_narratives
from app.forecasting.services.utils import hash_seed


def _headline_from_narrative(narrative: dict) -> str:
    label = narrative["label"]
    momentum = narrative["momentum"]
    if momentum == "accelerating":
        return f"Consensus building on {label}"
    if momentum == "fragmenting":
        return f"{label} narrative fragmenting"
    if momentum == "cooling":
        return f"{label} momentum cooling"
    return f"{label} cluster trending"


def generate_network_pulse(
    events: list[FeedEvent],
    agents: list[Agent],
    markets: list[Market],
    takes: list,
    *,
    narratives: list[dict] | None = None,
    battles: list[dict] | None = None,
) -> dict:
    narratives = narratives or cluster_narratives(markets, events, takes, agents)
    battles = battles or detect_battles(agents, events, takes, markets, limit=6)

    headlines: list[dict] = []
    for narrative in narratives[:4]:
        headlines.append(
            {
                "type": "narrative",
                "text": _headline_from_narrative(narrative),
                "intensity": min(5, max(1, int(narrative["strength"] / 20))),
                "narrative_id": narrative["id"],
                "momentum": narrative["momentum"],
            }
        )

    niche_groups: dict[str, list[Agent]] = {}
    for agent in agents:
        niche_groups.setdefault(agent.niche, []).append(agent)

    for niche, group in niche_groups.items():
        if len(group) < 2:
            continue
        h = hash_seed(niche)
        if h % 3 != 0:
            continue
        action = "repricing recession odds" if "macro" in niche.lower() else "split sharply"
        headlines.append(
            {
                "type": "cluster",
                "text": f"{niche} agents {action}",
                "intensity": 3 + h % 3,
                "niche": niche,
            }
        )

    for battle in battles[:3]:
        if battle.get("widening"):
            headlines.append(
                {
                    "type": "battle",
                    "text": (
                        f"Battle intensity rising: {battle['agent_a']['name']} vs "
                        f"{battle['agent_b']['name']}"
                    ),
                    "intensity": 4,
                    "battle_id": battle["id"],
                }
            )

    heated = [e for e in events if e.type in ("rivalry", "consensus_shift")]
    for event in heated[:2]:
        agent_name = event.agent.name if event.agent else "Agents"
        headlines.append(
            {
                "type": "event",
                "text": f"{agent_name}: {event.title}",
                "intensity": 3,
                "event_type": event.type,
            }
        )

    headlines.sort(key=lambda x: -x["intensity"])
    headlines = headlines[:8]

    from app.forecasting.beta_network_scale import beta_live_count_seed, clamp_beta_live_count

    activity = (
        len(events) * 2
        + len(battles)
        + len([n for n in narratives if n["momentum"] == "accelerating"]) * 2
    )
    live_count = clamp_beta_live_count(
        beta_live_count_seed("pulse", str(activity), str(len(narratives))),
    )

    return {
        "live_count": live_count,
        "headlines": headlines,
        "narrative_labels": [n["label"] for n in narratives[:5]],
        "hottest_battle": battles[0] if battles else None,
        "rising_narrative": next((n for n in narratives if n["momentum"] == "accelerating"), None),
    }
