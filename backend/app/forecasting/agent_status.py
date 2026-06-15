"""Season 1 core cast — active vs dormant agent lifecycle."""

from __future__ import annotations

from sqlalchemy.orm import Query, Session

from app.forecasting.models import Agent

# Season 1 flagship agents (only these generate feed / battles / rankings by default)
CORE_AGENT_SLUGS: frozenset[str] = frozenset(
    {
        "doombot",
        "bullbot",
        "fed-watcher",
        "macro-oracle",
        "sports-chaos",
    }
)

AGENT_STATUS_ACTIVE = "active"
AGENT_STATUS_DORMANT = "dormant"

DORMANT_DISPLAY_LABEL = "Season break"


def default_status_for_slug(slug: str) -> str:
    return AGENT_STATUS_ACTIVE if slug in CORE_AGENT_SLUGS else AGENT_STATUS_DORMANT


def is_active_agent(agent: Agent) -> bool:
    status = getattr(agent, "status", None) or AGENT_STATUS_ACTIVE
    return status == AGENT_STATUS_ACTIVE


def is_dormant_agent(agent: Agent) -> bool:
    return not is_active_agent(agent)


def agent_status_payload(agent: Agent) -> dict[str, str]:
    status = getattr(agent, "status", None) or AGENT_STATUS_ACTIVE
    out: dict[str, str] = {"status": status}
    if status == AGENT_STATUS_DORMANT:
        out["status_label"] = DORMANT_DISPLAY_LABEL
    return out


def active_agents_query(db: Session) -> Query:
    return db.query(Agent).filter(Agent.status == AGENT_STATUS_ACTIVE)


def query_active_agents(db: Session, *, order_by_name: bool = False) -> list[Agent]:
    q = active_agents_query(db)
    if order_by_name:
        q = q.order_by(Agent.name)
    return q.all()


def filter_active(agents: list[Agent]) -> list[Agent]:
    return [a for a in agents if is_active_agent(a)]


def filter_active_ids(agent_ids: set[int] | list[int], db: Session) -> set[int]:
    if not agent_ids:
        return set()
    rows = (
        db.query(Agent.id)
        .filter(Agent.id.in_(list(agent_ids)), Agent.status == AGENT_STATUS_ACTIVE)
        .all()
    )
    return {r[0] for r in rows}
