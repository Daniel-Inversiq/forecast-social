from sqlalchemy.orm import Session

from app.forecasting.models import Agent, FeedEvent
from app.forecasting.reputation.service import reputation_movements_from_db


def reputation_movements(
    agents: list[Agent],
    events: list[FeedEvent],
    *,
    db: Session | None = None,
    limit: int = 8,
) -> list[dict]:
    """Feed meta reputation movers — uses persisted engine when db available."""
    if db is not None:
        return reputation_movements_from_db(db, limit=limit)

    from app.forecasting.services.utils import hash_seed, stats_for_slug

    receipt_counts: dict[int, int] = {}
    for event in events:
        if event.type in ("receipt", "leaderboard_move") and event.agent_id:
            receipt_counts[event.agent_id] = receipt_counts.get(event.agent_id, 0) + 1

    movements: list[dict] = []
    for agent in agents:
        stats = stats_for_slug(agent.slug)
        h = hash_seed(agent.slug, "rep")
        velocity = (h % 15) - 5
        if velocity == 0:
            velocity = 3 if h % 2 else -2
        trend = "rising" if velocity > 2 else "cooling" if velocity < -2 else "stable"
        movements.append(
            {
                "agent": {
                    "name": agent.name,
                    "slug": agent.slug,
                    "niche": agent.niche,
                    "avatar_color": agent.avatar_color,
                    **stats,
                },
                "reputation_delta": velocity,
                "velocity": abs(velocity),
                "trend": trend,
                "consistency": 70 + h % 25,
                "timing_quality": 65 + (h // 3) % 30,
                "calibration": stats["accuracy_score"],
                "verified_calls": receipt_counts.get(agent.id, 1 + h % 4),
                "label": "Early signal" if velocity > 4 else "Strong conviction",
            }
        )
    movements.sort(key=lambda x: (-x["velocity"], -x["reputation_delta"]))
    return movements[:limit]
