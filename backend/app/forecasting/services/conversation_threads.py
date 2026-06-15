"""Conversation threading for agent-generated activity."""

from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from app.forecasting.models import Agent, AgentGeneratedActivity, FeedEvent, Market

MAX_THREAD_AGENTS = 3
MAX_THREAD_DEPTH = 5


def assign_root_thread(activity: AgentGeneratedActivity) -> None:
    """Original post: thread_id = activity_id, no parent."""
    activity.thread_id = activity.activity_id
    activity.parent_activity_id = None


def assign_reply_thread(
    activity: AgentGeneratedActivity,
    parent: AgentGeneratedActivity,
) -> None:
    """Reply inherits root thread_id and points at the post being answered."""
    activity.thread_id = parent.thread_id or parent.activity_id
    activity.parent_activity_id = parent.activity_id


def thread_root_id(activity: AgentGeneratedActivity) -> str:
    return activity.thread_id or activity.activity_id


def activity_depth(
    activity: AgentGeneratedActivity,
    by_id: dict[str, AgentGeneratedActivity] | None = None,
) -> int:
    """Depth 1 = root post; replies increment."""
    if not activity.parent_activity_id:
        return 1
    if by_id and activity.parent_activity_id in by_id:
        return activity_depth(by_id[activity.parent_activity_id], by_id) + 1
    return 2


def _depth_from_db(db: Session, activity_id: str) -> int:
    depth = 0
    current_id: str | None = activity_id
    seen: set[str] = set()
    while current_id and current_id not in seen:
        seen.add(current_id)
        row = (
            db.query(AgentGeneratedActivity)
            .filter(AgentGeneratedActivity.activity_id == current_id)
            .first()
        )
        if not row:
            break
        depth += 1
        current_id = row.parent_activity_id
    return max(depth, 1)


def thread_agent_slugs(
    db: Session,
    thread_id: str,
    *,
    by_id: dict[str, AgentGeneratedActivity] | None = None,
    extra_slug: str | None = None,
) -> set[str]:
    slugs: set[str] = set()
    if by_id:
        for row in by_id.values():
            if thread_root_id(row) == thread_id:
                slugs.add(row.agent_slug)
    else:
        rows = (
            db.query(AgentGeneratedActivity.agent_slug)
            .filter(AgentGeneratedActivity.thread_id == thread_id)
            .all()
        )
        slugs = {r[0] for r in rows}
    if extra_slug:
        slugs.add(extra_slug)
    return slugs


def _parent_depth(
    db: Session,
    parent: AgentGeneratedActivity,
    *,
    by_id: dict[str, AgentGeneratedActivity] | None = None,
) -> int:
    if by_id:
        return activity_depth(parent, by_id)
    if parent.parent_activity_id is None:
        return 1
    return _depth_from_db(db, parent.activity_id)


def thread_extension_failure(
    db: Session,
    parent: AgentGeneratedActivity,
    responder_slug: str,
    *,
    by_id: dict[str, AgentGeneratedActivity] | None = None,
) -> str | None:
    """Return block reason when a thread cannot accept another reply."""
    parent_depth = _parent_depth(db, parent, by_id=by_id)
    if parent_depth + 1 > MAX_THREAD_DEPTH:
        return "thread_depth_limit"
    participants = thread_agent_slugs(
        db,
        thread_root_id(parent),
        by_id=by_id,
        extra_slug=responder_slug,
    )
    if len(participants) > MAX_THREAD_AGENTS:
        return "thread_agent_limit"
    return None


def can_extend_thread(
    db: Session,
    parent: AgentGeneratedActivity,
    responder_slug: str,
    *,
    by_id: dict[str, AgentGeneratedActivity] | None = None,
) -> bool:
    """Enforce max depth and max distinct agents per thread."""
    return thread_extension_failure(
        db, parent, responder_slug, by_id=by_id
    ) is None


def resolve_thread_root(
    activity: AgentGeneratedActivity,
    *,
    by_id: dict[str, AgentGeneratedActivity] | None = None,
    db: Session | None = None,
) -> AgentGeneratedActivity:
    """Walk parent_activity_id chain to the thread root post."""
    current = activity
    seen: set[str] = set()
    while current.parent_activity_id and current.parent_activity_id not in seen:
        seen.add(current.parent_activity_id)
        parent: AgentGeneratedActivity | None = None
        if by_id:
            parent = by_id.get(current.parent_activity_id)
        if parent is None and db is not None:
            parent = (
                db.query(AgentGeneratedActivity)
                .filter(AgentGeneratedActivity.activity_id == current.parent_activity_id)
                .first()
            )
        if parent is None:
            break
        current = parent
    return current


def ensure_thread_root_mirrored(
    db: Session,
    root: AgentGeneratedActivity,
    *,
    agents: dict[str, Agent] | None = None,
    markets: list[Market] | None = None,
    mirror_to_feed: bool = True,
) -> AgentGeneratedActivity:
    """Mirror thread roots so replies in /feed can render as conversation blocks."""
    if not mirror_to_feed or root.mirrored_feed_event_id or root.parent_activity_id:
        return root

    from app.forecasting.services import agent_activity_engine as engine
    from app.forecasting.services.utils import title_to_slug

    if agents is None:
        from app.forecasting.agent_status import query_active_agents

        agents = {a.slug: a for a in query_active_agents(db)}
    agent = agents.get(root.agent_slug)
    if not agent:
        return root

    market = None
    if markets and root.related_market_slug:
        market = next(
            (m for m in markets if title_to_slug(m.title) == root.related_market_slug),
            None,
        )

    meta: dict[str, Any] = dict(root.metadata_json or {})
    meta["generated_activity_id"] = root.activity_id
    meta.setdefault("thread_id", root.thread_id or root.activity_id)
    meta.setdefault("parent_activity_id", root.parent_activity_id)

    feed_ev = engine._mirror_feed_event(
        db,
        agent=agent,
        market=market,
        activity_type=root.activity_type,
        title=root.title,
        body=root.body,
        meta=meta,
        related_battle_slug=root.related_battle_slug,
    )
    if feed_ev:
        root.mirrored_feed_event_id = feed_ev.id
        root.metadata_json = meta
        db.flush()
    return root
