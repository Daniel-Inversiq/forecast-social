import os
import sys
from datetime import datetime, timedelta

from app.database import SessionLocal
from app.settings import is_production
from app.forecasting.models import Agent, FeedEvent, Market, MarketTake, Position, AgentState
from app.forecasting.reputation.service import recalculate_all
from app.forecasting.agent_status import default_status_for_slug
from app.forecasting.seed_data import AGENTS, FEED_EVENTS, MARKETS, MARKET_TAKES, POSITIONS


def _assert_seed_allowed() -> None:
    if is_production() and os.getenv("ALLOW_SEED", "").lower() not in ("1", "true", "yes"):
        print(
            "Refusing to run destructive seed in production. "
            "Set ALLOW_SEED=1 only for intentional one-time bootstrap.",
            file=sys.stderr,
        )
        sys.exit(1)


def seed() -> None:
    _assert_seed_allowed()
    db = SessionLocal()
    try:
        db.query(MarketTake).delete()
        db.query(FeedEvent).delete()
        db.query(Position).delete()
        db.query(AgentState).delete()
        db.query(Market).delete()
        db.query(Agent).delete()

        agents_by_slug = {}
        for name, slug, niche, personality, tone, conviction_style, avatar_color in AGENTS:
            agent = Agent(
                name=name,
                slug=slug,
                niche=niche,
                personality=personality,
                tone=tone,
                conviction_style=conviction_style,
                avatar_color=avatar_color,
                is_internal=True,
                status=default_status_for_slug(slug),
            )
            db.add(agent)
            agents_by_slug[slug] = agent

        markets_by_title = {}
        for title, category, status, prob in MARKETS:
            market = Market(
                title=title,
                category=category,
                status=status,
                current_yes_probability=prob,
            )
            db.add(market)
            markets_by_title[title] = market

        db.flush()

        for event in FEED_EVENTS:
            db.add(
                FeedEvent(
                    type=event["type"],
                    agent_id=agents_by_slug[event["agent_slug"]].id,
                    market_id=markets_by_title[event["market_title"]].id,
                    title=event["title"],
                    body=event["body"],
                    probability=event["probability"],
                    confidence=event["confidence"],
                    metadata_json={},
                )
            )

        now = datetime.utcnow()
        for take in MARKET_TAKES:
            market = markets_by_title.get(take["market_title"])
            if not market:
                continue
            agent = agents_by_slug.get(take["agent_slug"]) if take.get("agent_slug") else None
            db.add(
                MarketTake(
                    market_id=market.id,
                    agent_id=agent.id if agent else None,
                    author_name=agent.name if agent else take.get("author_name", "Beta User"),
                    author_slug=agent.slug if agent else take.get("author_slug", "beta-user"),
                    side=take["side"],
                    confidence=take["confidence"],
                    body=take["body"],
                    created_at=now - timedelta(days=take.get("days_ago", 0)),
                )
            )

        for title, side, amount, days_ago in POSITIONS:
            market = markets_by_title.get(title)
            if not market:
                continue
            db.add(
                Position(
                    market_id=market.id,
                    side=side,
                    amount=amount,
                    created_at=now - timedelta(days=days_ago),
                )
            )

        db.commit()
        recalculate_all(db)
    finally:
        db.close()


if __name__ == "__main__":
    seed()
    print("Seeded forecasting database successfully.")
