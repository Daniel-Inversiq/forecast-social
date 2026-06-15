"""Calm threaded replies — conversation structure without Public Clash."""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Literal

from sqlalchemy.orm import Session

from app.forecasting.agent_status import CORE_AGENT_SLUGS
from app.forecasting.models import Agent, AgentGeneratedActivity, Market, NetworkNarrative
from app.forecasting.services.activity_failure import ActivityFailure, record_failure
from app.forecasting.services.conversation_threads import (
    assign_reply_thread,
    ensure_thread_root_mirrored,
    resolve_thread_root,
    thread_extension_failure,
)
from app.forecasting.services.thread_lifecycle import (
    mark_thread_closed,
    thread_dict_from_activity,
)
from app.forecasting.services.copy_sanitize import finalize_persisted_copy, safe_conversational_line
from app.forecasting.services.utils import hash_seed, title_to_slug
from app.forecasting.services.voice_engine import display_name
from app.forecasting.services.voice_engine import generate_reaction_line_with_meta

CalmThreadFormat = Literal["desk_note", "narrative_shift", "market_read"]

CONTINUATION_KIND_BY_FORMAT = {
    "desk_note": "calm_thread_desk",
    "narrative_shift": "calm_thread_narrative",
    "market_read": "calm_thread_market_read",
}


def _utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def pick_calm_responder(
    anchor_slug: str,
    seed: int,
    *,
    exclude: set[str] | None = None,
) -> str | None:
    """Pick a non-rival agent to extend a thread calmly."""
    blocked = {anchor_slug, *(exclude or set())}
    pool = [slug for slug in CORE_AGENT_SLUGS if slug not in blocked]
    if not pool:
        return None
    return pool[hash_seed(anchor_slug, str(seed), "calm_responder") % len(pool)]


def pick_calm_format(slot_seed: int) -> CalmThreadFormat:
    """Sub-format for calm thread slots: mostly desk, some market read."""
    bucket = hash_seed("calm_format", str(slot_seed)) % 100
    if bucket < 65:
        return "desk_note"
    if bucket < 90:
        return "market_read"
    return "narrative_shift"


def _resolve_market(
    source: AgentGeneratedActivity,
    markets: list[Market],
    *,
    seed: int,
    responder_slug: str,
) -> Market | None:
    if source.related_market_slug:
        hint = source.related_market_slug.replace("-", " ")
        for market in markets:
            if hint in market.title.lower() or hint in (market.category or "").lower():
                return market
    if markets:
        return markets[hash_seed(responder_slug, str(seed)) % len(markets)]
    return None


def _generate_calm_copy(
    responder_slug: str,
    source: AgentGeneratedActivity,
    *,
    calm_format: CalmThreadFormat,
    market_title: str | None,
    narrative: NetworkNarrative | None,
    seed: int,
    db: Session,
) -> tuple[str, str, dict[str, Any]]:
    meta: dict[str, Any] = {"thread_tone": "calm", "generation_mode": "calm_thread"}
    if calm_format == "narrative_shift":
        from app.forecasting.services.narrative_progression import (
            compose_narrative_stage_copy,
            narrative_progression_meta,
        )

        label = narrative.label if narrative else "the narrative"
        narrative_id = narrative.narrative_id if narrative else "network-read"
        progression = narrative_progression_meta(
            db,
            responder_slug,
            narrative_id,
            label,
            seed=seed,
        )
        stage = str(progression["narrative_stage"])
        title, body = compose_narrative_stage_copy(
            responder_slug,
            label,
            stage,
            seed=seed,
        )
        meta["event_kind"] = "narrative_reinforce"
        meta.update(progression)
        meta["generation_mode"] = "narrative_stage"
        return title, body, meta

    if calm_format == "market_read":
        market = market_title or "this market"
        line, _, gen_meta = generate_reaction_line_with_meta(
            responder_slug,
            role="aligned",
            headline=source.title,
            market_title=market,
            seed=seed,
            db=db,
        )
        meta.update(gen_meta)
        title = f"Market read: {market[:80]}"
        return title, line, meta

    line = safe_conversational_line(responder_slug, seed=seed)
    title = source.title[:120] if source.title else "Desk follow-up"
    body = f"{line} Building on {display_name(source.agent_slug)}'s point."
    return title, body, meta


def create_calm_thread_reply(
    db: Session,
    *,
    responder_slug: str,
    source: AgentGeneratedActivity,
    calm_format: CalmThreadFormat,
    seed: int,
    mirror_to_feed: bool,
    recent_hashes: set[str],
    agents: dict[str, Agent],
    markets: list[Market],
    session_by_id: dict[str, AgentGeneratedActivity] | None = None,
    narrative: NetworkNarrative | None = None,
    failure_out: dict[str, Any] | None = None,
) -> AgentGeneratedActivity | None:
    """Persist a calm threaded reply (not rival_reply)."""
    from app.forecasting.services import agent_activity_engine as engine

    responder = agents.get(responder_slug)
    if not responder:
        record_failure(
            failure_out,
            ActivityFailure(
                code="unknown_responder",
                source="calm_thread_engine.create_calm_thread_reply",
                missing_prerequisite="core_agent",
                recoverable=False,
            ),
        )
        return None

    block = thread_extension_failure(db, source, responder_slug, by_id=session_by_id)
    if block:
        thread = thread_dict_from_activity(
            db,
            source,
            by_id=session_by_id,
        )
        mark_thread_closed(db, thread, block)
        record_failure(
            failure_out,
            ActivityFailure(
                code=block,
                source="calm_thread_engine.create_calm_thread_reply",
                missing_prerequisite=(
                    "thread_depth_headroom"
                    if block == "thread_depth_limit"
                    else "thread_agent_slot"
                ),
                recoverable=True,
            ),
        )
        return None

    market = _resolve_market(source, markets, seed=seed, responder_slug=responder_slug)
    market_title = market.title if market else None
    title, body, meta = _generate_calm_copy(
        responder_slug,
        source,
        calm_format=calm_format,
        market_title=market_title,
        narrative=narrative,
        seed=seed,
        db=db,
    )
    title, body, san_meta = finalize_persisted_copy(
        responder_slug, title, body, seed=seed, db=db
    )
    if san_meta:
        meta.update(san_meta)
    if not body.strip():
        body = title

    h = engine.body_hash(body)
    if h in recent_hashes:
        record_failure(
            failure_out,
            ActivityFailure(
                code="duplicate_body_hash",
                source="calm_thread_engine.create_calm_thread_reply",
                missing_prerequisite="unique_body_hash",
                recoverable=True,
            ),
        )
        return None

    activity_type = "conviction_update" if calm_format == "narrative_shift" else "agent_post"
    meta.update(
        {
            "continuation_kind": CONTINUATION_KIND_BY_FORMAT[calm_format],
            "thread_tone": "calm",
            "in_reply_to_activity_id": source.activity_id,
            "in_reply_to_agent_slug": source.agent_slug,
            "source_post_title": source.title,
            "activity_type": activity_type,
            "system_event_label": (
                f"{display_name(responder_slug)} calm thread reply to "
                f"{display_name(source.agent_slug)}"
            ),
            "generation_seed": seed,
        }
    )
    if narrative and calm_format == "narrative_shift" and meta.get("narrative_stage"):
        from app.forecasting.services.narrative_progression import commit_narrative_stage

        commit_narrative_stage(
            db,
            responder_slug,
            narrative.narrative_id,
            str(meta["narrative_stage"]),
        )

    meta["credibility_delta"] = (hash_seed(responder_slug, str(seed)) % 15) - 3
    activity_id = str(uuid.uuid4())
    row = AgentGeneratedActivity(
        activity_id=activity_id,
        activity_type=activity_type,
        agent_id=responder.id,
        agent_slug=responder.slug,
        title=title[:255],
        body=body,
        body_hash=h,
        related_market_slug=(
            title_to_slug(market.title) if market else source.related_market_slug
        ),
        related_battle_slug=source.related_battle_slug,
        trigger_id=f"calm_thread_{calm_format}",
        metadata_json=meta,
        created_at=_utcnow(),
    )
    assign_reply_thread(row, source)
    meta["thread_id"] = row.thread_id
    meta["parent_activity_id"] = row.parent_activity_id
    meta["generated_activity_id"] = activity_id
    row.metadata_json = meta

    ensure_thread_root_mirrored(
        db,
        resolve_thread_root(source, by_id=session_by_id, db=db),
        agents=agents,
        markets=markets,
        mirror_to_feed=mirror_to_feed,
    )
    if mirror_to_feed:
        feed_ev = engine._mirror_feed_event(
            db,
            agent=responder,
            market=market,
            activity_type=activity_type,
            title=title,
            body=body,
            meta=meta,
            related_battle_slug=source.related_battle_slug,
        )
        if feed_ev:
            row.mirrored_feed_event_id = feed_ev.id

    db.add(row)
    recent_hashes.add(h)
    if session_by_id is not None:
        session_by_id[row.activity_id] = row
    return row
