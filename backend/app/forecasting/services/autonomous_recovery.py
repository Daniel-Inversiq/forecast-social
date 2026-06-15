"""Graceful degradation when autonomous activity generation fails."""

from __future__ import annotations

import copy
from typing import Any

from sqlalchemy.orm import Session

from app.forecasting.models import Agent, AgentGeneratedActivity, Market, NetworkNarrative
from app.forecasting.services.activity_failure import (
    RIVAL_QUALITY_FAILURE_CODES,
    THREAD_LIMIT_FAILURE_CODES,
)
from app.forecasting.services.agent_activity_engine import (
    ActivityTrigger,
    _persist_trigger_activity,
)
from app.forecasting.services.rivalry_engine import (
    create_rival_reply_activity,
    pick_rival_responder,
)
from app.forecasting.services.thread_network_events import create_thread_summary_pulse
from app.forecasting.services.thread_lifecycle import mark_thread_closed


def narrative_for_thread(
    db: Session,
    thread: dict[str, Any],
    agent: Agent,
    *,
    seed: int,
    pick_narrative_for_agent,
) -> NetworkNarrative | None:
    latest: AgentGeneratedActivity = thread["latest"]
    meta = latest.metadata_json or {}
    narrative_id = meta.get("narrative_id")
    if narrative_id:
        row = (
            db.query(NetworkNarrative)
            .filter(NetworkNarrative.narrative_id == narrative_id)
            .first()
        )
        if row:
            return row
    return pick_narrative_for_agent(db, agent, seed=seed)


def recover_safe_agent_post(
    db: Session,
    *,
    agent: Agent,
    narrative: NetworkNarrative,
    seed: int,
    agents: dict[str, Agent],
    markets: list[Market],
    recent_hashes: set[str],
    session_by_id: dict[str, AgentGeneratedActivity],
    mirror_to_feed: bool,
    created_len: int,
    global_recent: set[str] | None,
) -> AgentGeneratedActivity | None:
    hint = None
    keywords = narrative.keywords_json or []
    if keywords:
        hint = keywords[0]
    elif narrative.narrative_id:
        hint = narrative.narrative_id.replace("-", " ")
    trigger = ActivityTrigger(
        f"auto_recovery_post_{seed}",
        "agent_post",
        agent.slug,
        f"{narrative.label} — follow-up",
        "narrative_reinforce",
        market_hint=hint,
    )
    row = _persist_trigger_activity(
        db,
        trigger=trigger,
        agents=agents,
        markets=markets,
        recent_hashes=recent_hashes,
        session_by_id=session_by_id,
        base_seed=seed + 4400,
        created_len=created_len,
        mirror_to_feed=mirror_to_feed,
        attempt=0,
        global_recent=global_recent,
        failure_out=None,
    )
    if row:
        meta = dict(row.metadata_json or {})
        meta["narrative_id"] = narrative.narrative_id
        meta["narrative_label"] = narrative.label
        meta["recovery_safe_post"] = True
        row.metadata_json = meta
    return row


def recover_started_new_thread(
    db: Session,
    *,
    agent: Agent,
    narrative: NetworkNarrative,
    seed: int,
    agents: dict[str, Agent],
    markets: list[Market],
    recent_hashes: set[str],
    session_by_id: dict[str, AgentGeneratedActivity],
    mirror_to_feed: bool,
    created_len: int,
    global_recent: set[str] | None,
) -> AgentGeneratedActivity | None:
    hint = None
    keywords = narrative.keywords_json or []
    if keywords:
        hint = keywords[0]
    trigger = ActivityTrigger(
        f"auto_recovery_thread_{seed}",
        "agent_post",
        agent.slug,
        f"{narrative.label} — new angle",
        "agent_signal",
        market_hint=hint,
    )
    row = _persist_trigger_activity(
        db,
        trigger=trigger,
        agents=agents,
        markets=markets,
        recent_hashes=recent_hashes,
        session_by_id=session_by_id,
        base_seed=seed + 5500,
        created_len=created_len,
        mirror_to_feed=mirror_to_feed,
        attempt=0,
        global_recent=global_recent,
        failure_out=None,
    )
    if row:
        meta = dict(row.metadata_json or {})
        meta["narrative_id"] = narrative.narrative_id
        meta["narrative_label"] = narrative.label
        meta["recovery_new_thread"] = True
        meta["threadable"] = True
        row.metadata_json = meta
        rival = pick_rival_responder(row.agent_slug, seed + 5501, exclude={row.agent_slug})
        if rival:
            reply = create_rival_reply_activity(
                db,
                responder_slug=rival,
                target_slug=row.agent_slug,
                source=row,
                order=1,
                seed=seed + 5501,
                mirror_to_feed=mirror_to_feed,
                recent_hashes=recent_hashes,
                agents=agents,
                markets=markets,
                session_by_id=session_by_id,
                failure_out=None,
            )
            if reply:
                return reply
    return row


def recover_conviction_update(
    db: Session,
    *,
    agent: Agent,
    narrative: NetworkNarrative | None,
    seed: int,
    agents: dict[str, Agent],
    markets: list[Market],
    recent_hashes: set[str],
    session_by_id: dict[str, AgentGeneratedActivity],
    mirror_to_feed: bool,
    created_len: int,
    global_recent: set[str] | None,
    narrative_market_hint,
) -> AgentGeneratedActivity | None:
    label = narrative.label if narrative else "network read"
    hint = narrative_market_hint(narrative) if narrative else None
    trigger = ActivityTrigger(
        f"auto_recovery_conviction_{seed}",
        "conviction_update",
        agent.slug,
        f"{label} — conviction shift",
        "conviction_shift",
        market_hint=hint,
    )
    row = _persist_trigger_activity(
        db,
        trigger=trigger,
        agents=agents,
        markets=markets,
        recent_hashes=recent_hashes,
        session_by_id=session_by_id,
        base_seed=seed + 6600,
        created_len=created_len,
        mirror_to_feed=mirror_to_feed,
        attempt=0,
        global_recent=global_recent,
        failure_out=None,
    )
    if row and narrative:
        meta = dict(row.metadata_json or {})
        meta["narrative_id"] = narrative.narrative_id
        meta["narrative_label"] = narrative.label
        meta["recovery_conviction_fallback"] = True
        row.metadata_json = meta
    return row


def recover_continue_thread_failure(
    db: Session,
    *,
    thread: dict[str, Any],
    agent: Agent,
    failure_reason: dict[str, Any],
    agents: dict[str, Agent],
    markets: list[Market],
    recent_hashes: set[str],
    session_by_id: dict[str, AgentGeneratedActivity],
    seed: int,
    mirror_to_feed: bool,
    created_len: int,
    global_recent: set[str] | None,
    pick_narrative_for_agent,
    narrative_market_hint,
) -> tuple[AgentGeneratedActivity | None, str | None]:
    code = failure_reason.get("code", "")
    narrative = narrative_for_thread(
        db, thread, agent, seed=seed, pick_narrative_for_agent=pick_narrative_for_agent
    )

    if code in THREAD_LIMIT_FAILURE_CODES:
        mark_thread_closed(db, thread, code)
        if len(thread.get("rows") or []) >= 2:
            row = create_thread_summary_pulse(
                db,
                thread,
                agents=agents,
                markets=markets,
                session_by_id=session_by_id,
                seed=seed + 7700,
                mirror_to_feed=mirror_to_feed,
                recent_hashes=recent_hashes,
            )
            if row:
                return row, "created_network_pulse"
        if narrative:
            row = recover_started_new_thread(
                db,
                agent=agent,
                narrative=narrative,
                seed=seed,
                agents=agents,
                markets=markets,
                recent_hashes=recent_hashes,
                session_by_id=session_by_id,
                mirror_to_feed=mirror_to_feed,
                created_len=created_len,
                global_recent=global_recent,
            )
            if row:
                return row, "started_new_thread"

    if code in RIVAL_QUALITY_FAILURE_CODES:
        latest: AgentGeneratedActivity = thread["latest"]
        responder = pick_rival_responder(
            latest.agent_slug,
            seed + 8800,
            exclude={latest.agent_slug},
        )
        if responder:
            row = create_rival_reply_activity(
                db,
                responder_slug=responder,
                target_slug=latest.agent_slug,
                source=latest,
                order=1,
                seed=seed + 8800,
                mirror_to_feed=mirror_to_feed,
                recent_hashes=recent_hashes,
                agents=agents,
                markets=markets,
                session_by_id=session_by_id,
                failure_out=None,
                recovery_attempt=True,
            )
            if row:
                return row, "rival_reply_retry"
        if narrative:
            row = recover_safe_agent_post(
                db,
                agent=agent,
                narrative=narrative,
                seed=seed,
                agents=agents,
                markets=markets,
                recent_hashes=recent_hashes,
                session_by_id=session_by_id,
                mirror_to_feed=mirror_to_feed,
                created_len=created_len,
                global_recent=global_recent,
            )
            if row:
                return row, "safe_agent_post"

    return None, None


def recover_weighted_action_failure(
    db: Session,
    *,
    action: str,
    agent: Agent,
    narrative: NetworkNarrative | None,
    failure_reason: dict[str, Any],
    agents: dict[str, Agent],
    markets: list[Market],
    recent_hashes: set[str],
    session_by_id: dict[str, AgentGeneratedActivity],
    seed: int,
    mirror_to_feed: bool,
    created_len: int,
    global_recent: set[str] | None,
    narrative_market_hint,
) -> tuple[AgentGeneratedActivity | None, str | None]:
    if action == "start_battle":
        row = recover_conviction_update(
            db,
            agent=agent,
            narrative=narrative,
            seed=seed,
            agents=agents,
            markets=markets,
            recent_hashes=recent_hashes,
            session_by_id=session_by_id,
            mirror_to_feed=mirror_to_feed,
            created_len=created_len,
            global_recent=global_recent,
            narrative_market_hint=narrative_market_hint,
        )
        if row:
            return row, "conviction_update"
    return None, None


def apply_recovery_to_decision(
    decision: dict[str, Any],
    *,
    row: AgentGeneratedActivity,
    recovery_action: str,
    original_failure: dict[str, Any],
) -> None:
    decision["outcome"] = "recovered"
    decision["original_failure_reason"] = copy.deepcopy(original_failure)
    decision["recovery_action"] = recovery_action
    decision["activity_id"] = row.activity_id
    decision["activity_type"] = row.activity_type
    decision.pop("failure_reason", None)


def tick_has_visible_activity(result) -> bool:
    if result.activities_created:
        return True
    for decision in result.decisions:
        if decision.get("outcome") in ("executed", "recovered"):
            if decision.get("action") not in (None, "resolution_receipt"):
                return True
            if decision.get("action") == "resolution_receipt":
                return True
    return False
