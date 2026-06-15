"""Feed ordering / dedupe debug snapshot — exposes pipeline stages for auditing."""

from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session, joinedload

from app.forecasting.models import FeedEvent, Market, MarketTake, User
from app.forecasting.services.context import build_intelligence_context
from app.forecasting.services.feed_continuity import (
    build_continuity_context,
    reorder_for_arc_coherence,
)
from app.forecasting.services.feed_intelligence import (
    _apply_liveness_pass,
    _chip_filter,
    _dedupe_feed_payloads,
    _event_payload,
    _filter_for_you_trust,
    _filter_rising_trust,
    _inject_milestone_events,
    _inject_season_events,
    _is_latest_chip,
    _normalize_chip,
    _resolve_feed_mode,
    _sort_payloads_by_publish_time,
)
from app.forecasting.services.feed_ranking import rank_feed_events
from app.forecasting.services.feed_timing import feed_published_at_for_event, iso_utc
from app.forecasting.services.feed_variety import apply_feed_variety_mix, resolve_card_kind
from app.forecasting.services.narrative_clustering import cluster_narratives
from app.forecasting.services.feed_enrichment import load_reputation_by_agent
from app.forecasting.reputation.featured_marks import load_milestone_map_by_agent
from app.forecasting.market_credibility import _rep_by_slug


RANKING_FORMULA = {
    "mode": "personalized_score_with_recency_tiebreak_then_variety_mix",
    "primary_rank_key": "created_at DESC, feed_score DESC (before variety mix)",
    "display_timestamp": "feed_published_at ?? created_at (not used for final slot order)",
    "not_used_in_feed_order": [
        "activity_time",
        "heat",
        "thread_rank",
        "relevance",
        "network_heat_score",
    ],
    "score_components": {
        "type_base": "8–17 pts by event type (receipt/verified highest)",
        "follow_boost": "+14 if following agent",
        "anchor_boost": "+10 if anchor agent",
        "interest_match": "up to +12 from keyword overlap",
        "position_boost": "+8 if user positioned in market",
        "viewed_boost": "+4 if user viewed market",
        "battle_boost": "up to +10 from disagreement spread",
        "conviction_boost": "+5 if confidence >= 80",
        "verified_boost": "+8 for receipt/verified_call",
        "reputation_boost": "up to +7 elite / +4 high-rep / +8 rising",
        "recency": "max +10.8 for items <24h old (0.45 * hours_remaining)",
        "stale_penalty": "-8 if older than 72h",
        "trust_multiplier": "final score *= trust tier distribution_weight",
    },
    "post_rank_reorders": [
        "reorder_for_arc_coherence (cluster arc/market threads)",
        "apply_feed_variety_mix (40% posts / 40% battles slot cycle)",
        "_apply_liveness_pass (anti-adjacent-same-type swap)",
        "inject milestone / season / status moments (every 7–11 cards)",
    ],
    "frontend_reorders": [
        "mergeGeneratedIntoFeed (chronological merge, thread grouping)",
        "orderFeedForDisplay: stream priority 3min, variety mix again, adjacency separation",
    ],
}

SORT_PIPELINE = [
    "1. DB fetch: FeedEvent.created_at DESC (limit 120)",
    "2. rank_feed_events: sort by (-created_at, -feed_score); compute feed_score via score_feed_event",
    "3. Chip filter + For You trust filter (trusted/ranked/elite unless <8 matches)",
    "4. Build payloads with feed_score + rank_reasons",
    "5. reorder_for_arc_coherence",
    "6. apply_feed_variety_mix (slot cycle — breaks strict chronology)",
    "7. _apply_liveness_pass",
    "8. inject milestone / season / public status moments",
    "9. Frontend mergeGeneratedIntoFeed: sort created_at DESC + thread adjacency",
    "10. Frontend orderFeedForDisplay: stream pin 3m, variety mix, adjacency swap",
]

DEDUPE_PIPELINE = [
    "Backend variety mix: _dedupe_key = id or slug+created_at+title",
    "Backend agent_activity_engine: duplicate_body_hash rejection on generation",
    "Frontend mergeGeneratedIntoFeed: skip if id in mainIds; skip if generated_activity_id seen",
    "Frontend mergeGeneratedIntoFeed: enrich mirrored rows (same id) instead of duplicating",
    "Frontend mergeFetchedWithStreamState: dedupe by eventDedupeKey on REST refresh",
    "Frontend insertStreamedEvent: re-promote existing id to top instead of duplicating",
    "Frontend orderFeedForDisplay: dedupe by id before split stream/rest",
    "NOT deduped: thread root + replies (intentional multi-card threads)",
    "NOT deduped: injected milestone/season/status cards (synthetic ids)",
]


def _item_row(payload: dict[str, Any], *, display_order: int, stage: str) -> dict[str, Any]:
    return {
        "feed_item_id": payload.get("id"),
        "created_at": payload.get("created_at"),
        "feed_published_at": payload.get("feed_published_at"),
        "ranking_score": payload.get("feed_score"),
        "ranking_reason": payload.get("rank_reasons") or [],
        "display_order": display_order,
        "pipeline_stage": stage,
        "card_kind": payload.get("card_kind"),
        "type": payload.get("type"),
        "title": payload.get("title"),
        "agent_slug": (payload.get("agent") or {}).get("slug"),
        "is_generated_activity": payload.get("is_generated_activity", False),
        "generated_activity_id": payload.get("generated_activity_id"),
        "thread_id": payload.get("thread_id"),
        "parent_activity_id": payload.get("parent_activity_id"),
    }


def _positions(items: list[dict[str, Any]]) -> dict[int | str, int]:
    out: dict[int | str, int] = {}
    for i, p in enumerate(items):
        eid = p.get("id")
        key: int | str = eid if eid is not None else f"anon:{i}"
        out[key] = i
    return out


def _duplicate_risks(payloads: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Flag near-duplicate rows in the final feed."""
    risks: list[dict[str, Any]] = []
    seen_ids: dict[int, int] = {}
    seen_titles: dict[str, list[int]] = {}
    seen_gen: dict[str, int] = {}

    for i, p in enumerate(payloads):
        eid = p.get("id")
        if eid is not None:
            if eid in seen_ids:
                risks.append(
                    {
                        "kind": "duplicate_id",
                        "feed_item_id": eid,
                        "positions": [seen_ids[eid], i],
                        "title": p.get("title"),
                    }
                )
            seen_ids[eid] = i

        gid = p.get("generated_activity_id")
        if gid:
            if gid in seen_gen:
                risks.append(
                    {
                        "kind": "duplicate_generated_activity_id",
                        "generated_activity_id": gid,
                        "positions": [seen_gen[gid], i],
                        "feed_item_id": eid,
                    }
                )
            seen_gen[gid] = i

        title_key = f"{(p.get('agent') or {}).get('slug')}::{p.get('title')}"
        seen_titles.setdefault(title_key, []).append(i)

    for title_key, positions in seen_titles.items():
        if len(positions) > 1:
            risks.append(
                {
                    "kind": "duplicate_title_agent",
                    "title_key": title_key,
                    "positions": positions,
                }
            )

    return risks


def build_feed_debug_report(
    db: Session,
    user: User | None,
    *,
    chip: str | None = None,
    limit: int = 50,
) -> dict[str, Any]:
    """Run the feed pipeline with stage markers for ordering / dedupe audits."""
    from app.forecasting.agent_status import query_active_agents

    events = (
        db.query(FeedEvent)
        .options(joinedload(FeedEvent.agent), joinedload(FeedEvent.market))
        .order_by(FeedEvent.created_at.desc())
        .limit(120)
        .all()
    )
    agents = query_active_agents(db)
    markets = db.query(Market).all()
    takes = (
        db.query(MarketTake)
        .options(joinedload(MarketTake.market), joinedload(MarketTake.agent))
        .order_by(MarketTake.created_at.desc())
        .limit(100)
        .all()
    )

    ctx = build_intelligence_context(
        user, db, agents=agents, markets=markets, events=events, takes=takes
    )
    narratives = cluster_narratives(markets, events, takes, agents)
    ctx.narrative_labels = {n["id"]: n["strength"] for n in narratives}
    continuity_ctx = build_continuity_context(
        db, agents=agents, markets=markets, events=events, takes=takes
    )

    rep_by_agent = load_reputation_by_agent(db)
    milestone_map = load_milestone_map_by_agent(db)
    rep_by_slug = _rep_by_slug(db)

    ranked = rank_feed_events(
        events, ctx, rep_by_agent=rep_by_agent, continuity_ctx=continuity_ctx
    )
    chip_norm = _normalize_chip(chip)
    feed_mode = _resolve_feed_mode(chip_norm)
    is_latest = _is_latest_chip(chip_norm)
    chip_types = _chip_filter(chip)
    if chip_types:
        ranked = [(e, s, r) for e, s, r in ranked if e.type in chip_types]
    if chip_norm in ("for_you", ""):
        ranked = _filter_for_you_trust(ranked, rep_by_agent)
    elif chip_norm == "rising":
        ranked = _filter_rising_trust(ranked, rep_by_agent)

    score_by_event_id = {event.id: (score, reasons) for event, score, reasons in ranked}

    after_rank = [
        {
            "feed_item_id": e.id,
            "created_at": iso_utc(e.created_at),
            "feed_published_at": iso_utc(feed_published_at_for_event(e)),
            "ranking_score": s,
            "ranking_reason": r,
            "rank_position": i,
            "type": e.type,
        }
        for i, (e, s, r) in enumerate(ranked[:limit])
    ]

    def _build_payload(event: FeedEvent, score: float, reasons: list[str]) -> dict:
        opposing = None
        if event.type in ("rivalry", "battle_escalation"):
            meta = event.metadata_json or {}
            opp_slug = meta.get("opponent_slug")
            if opp_slug:
                opposing = next((a for a in agents if a.slug == opp_slug), None)
            if opposing is None:
                opposing = next((a for a in agents if a.id != event.agent_id), None)
        return _event_payload(
            event,
            feed_score=score,
            rank_reasons=reasons,
            ctx_followed=ctx.followed_agent_ids,
            ctx_anchor_id=ctx.anchor_agent_id,
            opposing_agent=opposing,
            rep_by_agent=rep_by_agent,
            db=db,
            rep_by_slug=rep_by_slug,
            milestone_map=milestone_map,
            continuity_ctx=continuity_ctx,
        )

    payloads: list[dict] = []
    pos_after_payload: dict[int | str, int] = {}
    pos_after_arc: dict[int | str, int] = {}
    pos_after_variety: dict[int | str, int] = {}
    pos_after_liveness: dict[int | str, int] = {}

    if is_latest:
        ordered_events = sorted(
            [event for event, _, _ in ranked],
            key=feed_published_at_for_event,
            reverse=True,
        )
        for event in ordered_events[:limit]:
            score, reasons = score_by_event_id.get(event.id, (0.0, ["Chronological feed"]))
            payload = _build_payload(event, score, reasons)
            payload["feed_mode"] = "latest"
            payload["card_kind"] = resolve_card_kind(payload)
            payloads.append(payload)
        payloads = _dedupe_feed_payloads(_sort_payloads_by_publish_time(payloads))
        pos_after_payload = _positions(payloads)
        pos_final = pos_after_payload
    else:
        for event, score, reasons in ranked[:limit]:
            payload = _build_payload(event, score, reasons)
            payload["feed_mode"] = "for_you"
            payloads.append(payload)

        pos_after_payload = _positions(payloads)
        payloads = reorder_for_arc_coherence(payloads)
        pos_after_arc = _positions(payloads)

        if chip_norm in ("for_you", "", "all"):
            payloads = apply_feed_variety_mix(payloads)
        pos_after_variety = _positions(payloads)

        payloads = _apply_liveness_pass(payloads)
        pos_after_liveness = _positions(payloads)

        payloads = _inject_milestone_events(payloads, db)
        payloads = _inject_season_events(payloads, db)
        from app.forecasting.services.public_status_moments import inject_status_moments

        payloads = inject_status_moments(payloads, db, user)
        pos_final = _positions(payloads)

    items = [
        {**_item_row(p, display_order=i, stage="final"), "feed_mode": feed_mode}
        for i, p in enumerate(payloads[:limit])
    ]

    # Recent autonomous activity placement check (last hour)
    from datetime import datetime, timedelta

    one_hour_ago = datetime.utcnow() - timedelta(hours=1)
    recent_autonomous = []
    for i, p in enumerate(payloads[:limit]):
        meta_source = p.get("activity_type") or p.get("is_generated_activity")
        published = p.get("feed_published_at") or p.get("created_at")
        if not meta_source or not published:
            continue
        try:
            ts = datetime.fromisoformat(str(published).replace("Z", "+00:00").replace("+00:00", ""))
        except ValueError:
            continue
        if ts >= one_hour_ago:
            recent_autonomous.append(
                {
                    "feed_item_id": p.get("id"),
                    "display_order": i,
                    "created_at": p.get("created_at"),
                    "feed_published_at": p.get("feed_published_at"),
                    "ranking_score": p.get("feed_score"),
                    "title": p.get("title"),
                }
            )

    def _publish_ts(payload: dict) -> str:
        return str(payload.get("feed_published_at") or payload.get("created_at") or "")

    chronology_violations = []
    for i in range(1, min(len(payloads), limit)):
        prev = _publish_ts(payloads[i - 1])
        curr = _publish_ts(payloads[i])
        if prev and curr and curr > prev:
            chronology_violations.append(
                {
                    "newer_below_older": True,
                    "above": {
                        "order": i - 1,
                        "feed_published_at": payloads[i - 1].get("feed_published_at"),
                        "created_at": payloads[i - 1].get("created_at"),
                        "id": payloads[i - 1].get("id"),
                    },
                    "below": {
                        "order": i,
                        "feed_published_at": payloads[i].get("feed_published_at"),
                        "created_at": payloads[i].get("created_at"),
                        "id": payloads[i].get("id"),
                    },
                }
            )

    from app.forecasting.services.feed_thread_display_stats import (
        compute_feed_thread_display_stats,
        group_conversation_display_payloads,
        sort_feed_by_thread_block_time_desc,
    )

    thread_stats_payloads = (
        sort_feed_by_thread_block_time_desc(payloads[:limit])
        if is_latest
        else payloads[:limit]
    )
    stream_items = [
        {"type": "event", "event": payload, "index": index}
        for index, payload in enumerate(thread_stats_payloads)
    ]
    thread_ui_stats = compute_feed_thread_display_stats(
        group_conversation_display_payloads(stream_items)
    )

    return {
        "feed_mode": feed_mode,
        "ranking_mode": "personalized" if user else "network",
        "chip": chip or "for_you",
        **thread_ui_stats,
        "for_you_intentionally_ranked": not is_latest,
        "chronological_order_expected": is_latest,
        "sort_pipeline": SORT_PIPELINE if not is_latest else [
            "1. DB fetch: FeedEvent.created_at DESC (limit 120)",
            "2. rank_feed_events (scores only — not used for slot order)",
            "3. Sort by feed_published_at ?? created_at DESC",
            "4. Dedupe by feed event id + generated_activity_id",
            "5. Skip arc coherence, variety mix, liveness pass, synthetic injections",
        ],
        "dedupe_pipeline": DEDUPE_PIPELINE,
        "ranking_formula": RANKING_FORMULA if not is_latest else {
            "mode": "chronological",
            "primary_rank_key": "feed_published_at DESC, else created_at DESC",
        },
        "stage_position_deltas": {
            str(eid): {
                "after_payload": pos_after_payload.get(eid),
                "after_arc_coherence": pos_after_arc.get(eid),
                "after_variety_mix": pos_after_variety.get(eid),
                "after_liveness": pos_after_liveness.get(eid),
                "final": pos_final.get(eid),
            }
            for eid in pos_after_payload
            if isinstance(eid, int)
        },
        "after_rank": after_rank,
        "items": items,
        "duplicate_risks": _duplicate_risks(payloads[:limit]),
        "chronology_violations_sample": chronology_violations[:15],
        "chronology_violation_count": len(chronology_violations),
        "recent_autonomous_last_hour": recent_autonomous,
        "score_breakdown_sample": [
            {
                "feed_item_id": e.id,
                "ranking_score": score,
                "ranking_reason": reasons,
            }
            for e, score, reasons in ranked[:5]
        ],
    }
