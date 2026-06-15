from collections import deque
from sqlalchemy.orm import Session, joinedload

from typing import Any

from app.forecasting.models import Agent, FeedEvent, Market, MarketTake, User
from app.forecasting.services.feed_interactions import interaction_summary_for_feed_card
from app.forecasting.services.battle_detection import detect_battles
from app.forecasting.services.context import build_intelligence_context
from app.forecasting.reputation.featured_marks import load_milestone_map_by_agent
from app.forecasting.services.feed_enrichment import (
    agent_reputation_fields,
    build_intelligence_modules,
    load_reputation_by_agent,
    market_credibility_for_event,
    why_it_matters_for_event,
)
from app.forecasting.services.feed_action_state import (
    action_state_label,
    resolve_feed_action_state,
)
from app.forecasting.services.feed_continuity import (
    ContinuityContext,
    apply_continuity_to_reasoning,
    build_continuity_context,
    enrich_event_continuity,
    market_states_for_meta,
    reorder_for_arc_coherence,
)
from app.forecasting.services.feed_ranking import rank_feed_events
from app.forecasting.services.feed_variety import apply_feed_variety_mix, resolve_card_kind
from app.forecasting.services.narrative_clustering import cluster_narratives
from app.forecasting.services.network_pulse import generate_network_pulse
from app.forecasting.services.reasoning import generate_reasoning
from app.forecasting.services.memory_callbacks import memory_for_feed_event
from app.forecasting.reputation.service import (
    recent_milestone_unlock_feed,
    reputation_movements_from_db,
)
from app.forecasting.services.reputation_engine import reputation_movements
from app.forecasting.services.feed_timing import (
    feed_published_at_for_event,
    iso_utc,
    timing_fields_for_event,
)
from app.forecasting.services.utils import (
    active_takes_count,
    hash_seed,
    movement_delta,
    parse_spread,
    stats_for_slug,
    title_to_slug,
)
from app.forecasting.trust.config import DISTRIBUTION_TAGLINE
from app.forecasting.trust.distribution import trust_from_agent_rep


def _reputation_delta(event: FeedEvent) -> int | None:
    if event.type != "leaderboard_move":
        return None
    h = hash_seed(event.agent.slug)
    return 3 + h % 8


def _event_payload(
    event: FeedEvent,
    *,
    feed_score: float,
    rank_reasons: list[str],
    ctx_followed: set[int],
    ctx_anchor_id: int | None = None,
    opposing_agent: Agent | None = None,
    rep_by_agent: dict | None = None,
    db: Session | None = None,
    rep_by_slug: dict | None = None,
    milestone_map: dict | None = None,
    continuity_ctx: Any | None = None,
) -> dict:
    stats = stats_for_slug(event.agent.slug)
    market = event.market
    spread = parse_spread(event.body) if event.type in ("rivalry", "battle_escalation") else None
    reasoning = generate_reasoning(event, opposing_agent=opposing_agent)
    following = event.agent_id in ctx_followed
    is_anchor = ctx_anchor_id is not None and event.agent_id == ctx_anchor_id
    live = (event.id % 3) != 0 or (hash_seed(event.id) % 4 == 0)

    personalization = rank_reasons[0] if rank_reasons else None
    if is_anchor and not personalization:
        personalization = f"Your anchor agent — {event.agent.name}"
    elif following and not personalization:
        personalization = f"Because you follow {event.agent.name}"

    rep = rep_by_agent.get(event.agent_id) if rep_by_agent and event.agent_id else None
    rep_fields = agent_reputation_fields(event.agent, rep, milestone_map=milestone_map)
    market_fields = None
    if db and market:
        market_fields = market_credibility_for_event(db, event, rep_by_slug=rep_by_slug)

    reputation_delta = rep_fields.pop("reputation_delta", None)
    if reputation_delta is None and event.type in ("leaderboard_move", "reputation_move"):
        reputation_delta = _reputation_delta(event)
    elif reputation_delta is None and rep and rep.trend == "rising":
        reputation_delta = max(1, round(rep.velocity))

    why_it_matters = why_it_matters_for_event(
        event,
        rep=rep,
        market_fields=market_fields,
        reasoning_summary=reasoning.get("summary"),
    )

    movement_type = market_fields["movement_type"] if market_fields else _movement_type_from_event(event, spread)
    credibility_label = market_fields["credibility_label"] if market_fields else None
    first_mover = market_fields["first_mover"] if market_fields else None
    credibility_split = market_fields["credibility_split"] if market_fields else None
    reputation_yes_share = market_fields.get("reputation_yes_share") if market_fields else None

    tags = _intelligence_tags(event, spread, live, movement_type, rep_fields.get("verified_calls_count"))

    continuity_fields: dict = {}
    if continuity_ctx is not None:
        continuity_fields = enrich_event_continuity(event, continuity_ctx)
        reasoning = apply_continuity_to_reasoning(reasoning, continuity_fields)
        if continuity_fields.get("continuity_label"):
            tags = [continuity_fields["continuity_label"], *tags[:3]]
        if continuity_fields.get("arc_progression"):
            tags.append(continuity_fields["arc_progression"])

    memory_fields = memory_for_feed_event(db, event) if db else {}
    if memory_fields.get("memory_labels"):
        tags = [*memory_fields["memory_labels"], *tags]

    payload = {
        "id": event.id,
        "type": event.type,
        "agent": {
            "name": event.agent.name,
            "slug": event.agent.slug,
            "niche": event.agent.niche,
            "avatar_color": event.agent.avatar_color,
            **stats,
            "reputation_score": rep_fields.get("reputation_score"),
            "tier_key": rep_fields.get("reputation_tier_key"),
            "tier_label": rep_fields.get("reputation_tier_label"),
        },
        "title": event.title,
        "body": event.body,
        "probability": event.probability,
        "confidence": event.confidence,
        "created_at": iso_utc(event.created_at),
        **timing_fields_for_event(event),
        "following_agent": following,
        "anchor_agent": is_anchor,
        "personalization_reason": personalization,
        "market_title": market.title if market else None,
        "market_slug": title_to_slug(market.title) if market else None,
        "movement_delta": movement_delta(event.type, event.title + event.type),
        "disagreement_spread": spread,
        "active_takes": active_takes_count(market.title if market else event.title) if market else None,
        "reputation_delta": reputation_delta,
        "reasoning": reasoning,
        "live": live,
        "feed_score": feed_score,
        "rank_reasons": rank_reasons,
        "intelligence_tags": tags,
        **rep_fields,
        "why_it_matters": why_it_matters,
        "movement_type": movement_type,
        "credibility_label": credibility_label,
        "first_mover": first_mover,
        "credibility_split": credibility_split,
        "reputation_yes_share": reputation_yes_share,
        "has_verified_proof": event.type in ("receipt", "verified_call")
        or (rep_fields.get("verified_calls_count") or 0) > 0,
        "memory_value_score": memory_fields.get("memory_value_score"),
        "memory_tier": memory_fields.get("memory_tier"),
        "memory_source_type": memory_fields.get("memory_source_type"),
        "memory_source_id": memory_fields.get("memory_source_id"),
        "memory_labels": memory_fields.get("memory_labels") or [],
        "primary_memory_callback": memory_fields.get("primary_memory_callback"),
        "receipt_resurfaced": memory_fields.get("receipt_resurfaced"),
        "failed_call_memory": memory_fields.get("failed_call_memory"),
        "rivalry_callback": memory_fields.get("rivalry_callback"),
        "season_echo": memory_fields.get("season_echo"),
        "consensus_failure_echo": memory_fields.get("consensus_failure_echo"),
        **continuity_fields,
    }
    payload["importance_tier"] = _importance_tier(payload)
    payload["live_mutation"] = _live_mutation(payload)
    payload["interruptive_event"] = _interruptive_event(payload)
    payload["card_kind"] = resolve_card_kind(payload)
    action_key = resolve_feed_action_state(payload)
    payload["action_state"] = action_key
    payload["action_state_label"] = action_state_label(action_key)

    meta = event.metadata_json or {}
    if meta.get("source") == "agent_activity_engine":
        activity_type = meta.get("activity_type")
        if activity_type:
            payload["activity_type"] = activity_type
            payload["is_generated_activity"] = True
        battle_slug = meta.get("related_battle_slug")
        if battle_slug:
            payload["related_battle_slug"] = battle_slug
        opp_slug = meta.get("opponent_slug") or meta.get("counter_target")
        if opp_slug and not payload.get("opponent_slug"):
            payload["opponent_slug"] = opp_slug
        generated_activity_id = meta.get("generated_activity_id")
        if generated_activity_id:
            payload["generated_activity_id"] = generated_activity_id
        thread_id = meta.get("thread_id")
        if thread_id:
            payload["thread_id"] = thread_id
        parent_activity_id = meta.get("parent_activity_id")
        if parent_activity_id:
            payload["parent_activity_id"] = parent_activity_id
        for key in (
            "continuation_kind",
            "thread_tone",
            "thread_lifecycle",
            "narrative_id",
            "narrative_label",
            "narrative_stage",
            "narrative_stage_label",
            "related_market_slug",
            "idea_bucket",
        ):
            if meta.get(key) is not None:
                payload[key] = meta[key]
        if db is not None:
            from app.forecasting.models import AgentGeneratedActivity

            activity_row = (
                db.query(AgentGeneratedActivity)
                .filter(AgentGeneratedActivity.mirrored_feed_event_id == event.id)
                .first()
            )
            if activity_row:
                payload.setdefault("generated_activity_id", activity_row.activity_id)
                payload.setdefault("thread_id", activity_row.thread_id)
                payload.setdefault("parent_activity_id", activity_row.parent_activity_id)
                activity_meta = activity_row.metadata_json or {}
                for key in (
                    "continuation_kind",
                    "thread_tone",
                    "thread_lifecycle",
                    "narrative_id",
                    "narrative_label",
                    "narrative_stage",
                    "narrative_stage_label",
                    "related_market_slug",
                    "idea_bucket",
                ):
                    if payload.get(key) is None and activity_meta.get(key) is not None:
                        payload[key] = activity_meta[key]

    return payload


def _movement_type_from_event(event: FeedEvent, spread: int | None) -> str:
    if event.type in ("receipt", "verified_call"):
        return "contrarian_led"
    if event.type in ("consensus_shift", "narrative_acceleration"):
        return "consensus_led"
    if event.type in ("rivalry", "battle_escalation") and spread and spread >= 30:
        return "contrarian_led"
    if event.type in ("rivalry", "battle_escalation"):
        return "mixed"
    if event.type in ("market_move", "signal_shift"):
        return "mixed"
    return "mixed"


def _intelligence_tags(
    event: FeedEvent,
    spread: int | None,
    live: bool,
    movement_type: str | None = None,
    verified_calls: int | None = None,
) -> list[str]:
    tags: list[str] = []
    if live:
        tags.append("live")
    if event.type in ("rivalry", "battle_escalation") and spread and spread >= 35:
        tags.append("high-disagreement")
    if event.type in ("receipt", "verified_call") or (verified_calls and verified_calls > 0):
        tags.append("verified")
    if event.type in ("consensus_shift", "narrative_acceleration"):
        tags.append("narrative-shift")
    if event.confidence and event.confidence >= 85:
        tags.append("high-conviction")
    if event.type in ("leaderboard_move", "reputation_move"):
        tags.append("reputation")
    if movement_type == "contrarian_led":
        tags.append("contrarian")
    if movement_type == "consensus_led":
        tags.append("consensus-credibility")
    return tags


def _normalize_chip(chip: str | None) -> str:
    return (chip or "for_you").lower().replace(" ", "_")


def _is_latest_chip(chip_norm: str) -> bool:
    return chip_norm == "latest"


def _resolve_feed_mode(chip_norm: str) -> str:
    if _is_latest_chip(chip_norm):
        return "latest"
    if chip_norm in ("for_you", ""):
        return "for_you"
    return chip_norm


def _payload_from_generated_activity_row(
    row: Any,
    *,
    agents: list[Agent],
    rep_by_agent: dict | None = None,
    db: Session | None = None,
    rep_by_slug: dict | None = None,
    milestone_map: dict | None = None,
    continuity_ctx: Any | None = None,
    feed_mode: str = "latest",
) -> dict | None:
    """Build a feed payload from AgentGeneratedActivity when no FeedEvent mirror exists."""
    agent = next((a for a in agents if a.slug == row.agent_slug), None)
    if not agent:
        return None
    from app.forecasting.services.agent_activity_engine import _feed_event_type

    feed_type = _feed_event_type(row.activity_type, row.metadata_json or {})
    if not feed_type:
        return None
    meta = row.metadata_json or {}
    stats = stats_for_slug(agent.slug)
    rep = rep_by_agent.get(agent.id) if rep_by_agent and agent.id else None
    rep_fields = agent_reputation_fields(agent, rep, milestone_map=milestone_map)
    payload = {
        "id": row.mirrored_feed_event_id,
        "type": feed_type,
        "agent": {
            "name": agent.name,
            "slug": agent.slug,
            "niche": agent.niche,
            "avatar_color": agent.avatar_color,
            **stats,
            "reputation_score": rep_fields.get("reputation_score"),
            "tier_key": rep_fields.get("reputation_tier_key"),
            "tier_label": rep_fields.get("reputation_tier_label"),
        },
        "title": row.title,
        "body": row.body,
        "probability": meta.get("confidence"),
        "confidence": meta.get("confidence"),
        "created_at": iso_utc(row.created_at),
        "feed_published_at": iso_utc(row.created_at),
        "activity_type": row.activity_type,
        "is_generated_activity": True,
        "generated_activity_id": row.activity_id,
        "thread_id": row.thread_id,
        "parent_activity_id": row.parent_activity_id,
        "feed_mode": feed_mode,
        "feed_score": 0.0,
        "rank_reasons": ["Thread root"],
        **rep_fields,
    }
    for key in (
        "continuation_kind",
        "thread_tone",
        "thread_lifecycle",
        "narrative_id",
        "narrative_label",
        "narrative_stage",
        "narrative_stage_label",
        "idea_bucket",
    ):
        if meta.get(key) is not None:
            payload[key] = meta[key]
    if row.related_market_slug:
        payload["related_market_slug"] = row.related_market_slug
    return payload


def _inject_missing_thread_roots(
    db: Session,
    payloads: list[dict],
    *,
    agents: list[Agent],
    rep_by_agent: dict | None,
    rep_by_slug: dict | None,
    milestone_map: dict | None,
    continuity_ctx: Any | None,
    ctx_followed: set[int],
    ctx_anchor_id: int | None,
    feed_mode: str = "latest",
) -> list[dict]:
    """Ensure thread roots referenced by replies appear in the Latest feed window."""
    from app.forecasting.models import AgentGeneratedActivity
    from app.forecasting.services.conversation_threads import ensure_thread_root_mirrored

    present_generated = {
        str(p.get("generated_activity_id"))
        for p in payloads
        if p.get("generated_activity_id")
    }
    needed_roots: set[str] = set()
    for payload in payloads:
        thread_id = payload.get("thread_id")
        if thread_id and str(thread_id) not in present_generated:
            needed_roots.add(str(thread_id))

    if not needed_roots:
        return payloads

    agent_map = {a.slug: a for a in agents}
    markets = db.query(Market).all()
    additions: list[dict] = []

    for root_id in needed_roots:
        row = (
            db.query(AgentGeneratedActivity)
            .filter(AgentGeneratedActivity.activity_id == root_id)
            .first()
        )
        if not row:
            continue
        ensure_thread_root_mirrored(
            db,
            row,
            agents=agent_map,
            markets=markets,
            mirror_to_feed=True,
        )
        if row.mirrored_feed_event_id:
            feed_event = db.query(FeedEvent).filter(FeedEvent.id == row.mirrored_feed_event_id).first()
            if feed_event:
                score = 0.0
                payload = _event_payload(
                    feed_event,
                    feed_score=score,
                    rank_reasons=["Thread root"],
                    ctx_followed=ctx_followed,
                    ctx_anchor_id=ctx_anchor_id,
                    rep_by_agent=rep_by_agent,
                    db=db,
                    rep_by_slug=rep_by_slug,
                    milestone_map=milestone_map,
                    continuity_ctx=continuity_ctx,
                )
                payload["feed_mode"] = feed_mode
                payload["card_kind"] = resolve_card_kind(payload)
                additions.append(payload)
                continue
        synthetic = _payload_from_generated_activity_row(
            row,
            agents=agents,
            rep_by_agent=rep_by_agent,
            db=db,
            rep_by_slug=rep_by_slug,
            milestone_map=milestone_map,
            continuity_ctx=continuity_ctx,
            feed_mode=feed_mode,
        )
        if synthetic:
            synthetic["card_kind"] = resolve_card_kind(synthetic)
            additions.append(synthetic)

    if not additions:
        return payloads
    return _dedupe_feed_payloads(_sort_payloads_by_publish_time(additions + payloads))


def _dedupe_feed_payloads(payloads: list[dict]) -> list[dict]:
    seen_ids: set[int] = set()
    seen_generated: set[str] = set()
    out: list[dict] = []
    for payload in payloads:
        eid = payload.get("id")
        gid = payload.get("generated_activity_id")
        if eid is not None and eid in seen_ids:
            continue
        if gid and gid in seen_generated:
            continue
        if eid is not None:
            seen_ids.add(int(eid))
        if gid:
            seen_generated.add(str(gid))
        out.append(payload)
    return out


def _sort_payloads_by_publish_time(payloads: list[dict]) -> list[dict]:
    def publish_ts(payload: dict) -> str:
        return str(payload.get("feed_published_at") or payload.get("created_at") or "")

    return sorted(payloads, key=publish_ts, reverse=True)


def build_personalized_feed(
    db: Session,
    user: User | None,
    *,
    chip: str | None = None,
    limit: int = 50,
) -> dict:
    events = (
        db.query(FeedEvent)
        .options(joinedload(FeedEvent.agent), joinedload(FeedEvent.market))
        .order_by(FeedEvent.created_at.desc())
        .limit(120)
        .all()
    )
    from app.forecasting.agent_status import query_active_agents

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

    battles = detect_battles(agents, events, takes, markets)
    rep_by_agent = load_reputation_by_agent(db)
    milestone_map = load_milestone_map_by_agent(db)
    from app.forecasting.market_credibility import _rep_by_slug

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
        payloads = _inject_missing_thread_roots(
            db,
            payloads,
            agents=agents,
            rep_by_agent=rep_by_agent,
            rep_by_slug=rep_by_slug,
            milestone_map=milestone_map,
            continuity_ctx=continuity_ctx,
            ctx_followed=ctx.followed_agent_ids,
            ctx_anchor_id=ctx.anchor_agent_id,
            feed_mode="latest",
        )
    else:
        for event, score, reasons in ranked[:limit]:
            payload = _build_payload(event, score, reasons)
            payload["feed_mode"] = "for_you"
            payloads.append(payload)

        payloads = reorder_for_arc_coherence(payloads)
        if chip_norm in ("for_you", "", "all"):
            payloads = apply_feed_variety_mix(payloads)
        else:
            for payload in payloads:
                payload["card_kind"] = resolve_card_kind(payload)
        payloads = _apply_liveness_pass(payloads)

    event_ids = [p["id"] for p in payloads if p.get("id") is not None]
    interaction_summaries = interaction_summary_for_feed_card(db, event_ids, user)
    for payload in payloads:
        eid = payload.get("id")
        if eid is not None and eid in interaction_summaries:
            payload["interactions"] = interaction_summaries[eid]

    pulse = generate_network_pulse(events, agents, markets, takes, narratives=narratives, battles=battles)
    try:
        reputation = reputation_movements_from_db(db, limit=8)
    except Exception:
        reputation = reputation_movements(agents, events, db=db)

    intelligence_modules = build_intelligence_modules(payloads, reputation)
    if not is_latest:
        payloads = _inject_milestone_events(payloads, db)
        payloads = _inject_season_events(payloads, db)
        from app.forecasting.services.public_status_moments import inject_status_moments

        payloads = inject_status_moments(payloads, db, user)

    active_season = None
    try:
        from app.forecasting.services.narrative_seasons import get_active_season, season_to_summary

        season = get_active_season(db)
        if season:
            active_season = season_to_summary(season)
    except Exception:
        pass

    from app.forecasting.services.anchor_agent import build_anchor_payload

    anchor_module = build_anchor_payload(user, db)

    from app.forecasting.services.agent_activity_engine import summarize_network_briefing

    network_briefing = summarize_network_briefing(db, since_hours=24)

    for payload in payloads:
        payload.setdefault("feed_mode", feed_mode)

    return {
        "events": payloads,
        "meta": {
            "feed_mode": feed_mode,
            "ranking_mode": "personalized" if user else "network",
            "chip": chip or "for_you",
            "distribution_tagline": DISTRIBUTION_TAGLINE,
            "distribution_philosophy": "trust_not_activity",
            "live_count": pulse["live_count"],
            "pulse_headlines": pulse["headlines"],
            "narrative_labels": pulse["narrative_labels"],
            "hottest_battle": pulse.get("hottest_battle"),
            "rising_narrative": pulse.get("rising_narrative"),
            "narratives": narratives[:6],
            "battles": battles[:6],
            "reputation_movements": reputation[:5],
            "intelligence_modules": intelligence_modules,
            "active_season": active_season,
            "market_states": market_states_for_meta(continuity_ctx),
            "anchor_agent": anchor_module,
            "network_briefing": network_briefing,
        },
    }


def _importance_tier(payload: dict) -> str:
    event_type = str(payload.get("type") or "")
    confidence = float(payload.get("confidence") or 0)
    spread = int(payload.get("disagreement_spread") or 0)
    rep_delta = float(payload.get("reputation_delta") or 0)
    if event_type in ("verified_call", "receipt", "battle_escalation") or spread >= 34 or rep_delta >= 5:
        return "major"
    if event_type in ("rivalry", "market_move", "signal_shift", "narrative_acceleration") or confidence >= 84:
        return "medium"
    return "ambient"


def _live_mutation(payload: dict) -> str | None:
    continuity = str(payload.get("continuity_label") or "").lower()
    spread = int(payload.get("disagreement_spread") or 0)
    movement = abs(float(payload.get("movement_delta") or 0))
    rep_delta = float(payload.get("reputation_delta") or 0)
    market_state = str(payload.get("market_narrative_state") or "").lower()
    if "flip" in continuity:
        return "agent flipped stance"
    if spread >= 30:
        return "high-rep disagreement emerged"
    if market_state in ("fragmenting", "consensus fracture"):
        return "consensus moved 6pt"
    if movement >= 6:
        return "exposure doubled"
    if payload.get("type") in ("verified_call", "receipt"):
        return "receipt resurfaced"
    if rep_delta >= 4:
        return "old rivalry reignited"
    return None


def _interruptive_event(payload: dict) -> str | None:
    continuity = str(payload.get("continuity_label") or "").lower()
    market_state = str(payload.get("market_narrative_state") or "").lower()
    if "flip" in continuity:
        return "surprise flip"
    if market_state in ("timing split", "consensus fracture"):
        return "contradiction"
    if payload.get("type") == "verified_call":
        return "receipt resurfacing"
    if payload.get("type") in ("battle_escalation", "rivalry") and int(payload.get("disagreement_spread") or 0) >= 34:
        return "unexpected alliance"
    return None


def _apply_liveness_pass(payloads: list[dict]) -> list[dict]:
    """Reduce repetitive adjacent labels and keep thread evolution serialized."""
    if len(payloads) < 3:
        return payloads

    out: list[dict] = []
    queue = deque(payloads)
    previous_type: str | None = None
    previous_thread: str | None = None

    while queue:
        current = queue.popleft()
        current_type = str(current.get("type") or "")
        current_thread = str(current.get("arc_id") or current.get("market_slug") or "")

        if previous_type and current_type == previous_type and queue:
            swap_idx = -1
            lookahead = list(queue)[:5]
            for idx, candidate in enumerate(lookahead):
                c_type = str(candidate.get("type") or "")
                c_thread = str(candidate.get("arc_id") or candidate.get("market_slug") or "")
                if c_type != previous_type or (previous_thread and c_thread == previous_thread):
                    swap_idx = idx
                    break
            if swap_idx >= 0:
                candidate = queue[swap_idx]
                del queue[swap_idx]
                queue.appendleft(current)
                current = candidate
                current_type = str(current.get("type") or "")
                current_thread = str(current.get("arc_id") or current.get("market_slug") or "")

        out.append(current)
        previous_type = current_type
        previous_thread = current_thread

    return out


def _inject_season_events(payloads: list[dict], db: Session) -> list[dict]:
    """Weave seasonal narrative memory into the conviction feed."""
    if not payloads:
        return payloads
    try:
        from app.forecasting.services.narrative_seasons import build_season_feed_events

        season_events = build_season_feed_events(db, limit=2)
    except Exception:
        return payloads
    if not season_events:
        return payloads

    merged: list[dict] = []
    season_idx = 0
    for i, event in enumerate(payloads):
        merged.append(event)
        if season_idx < len(season_events) and (i + 1) % 9 == 0:
            merged.append(season_events[season_idx])
            season_idx += 1
    return merged


def _inject_milestone_events(payloads: list[dict], db: Session) -> list[dict]:
    """Occasionally surface prestige milestone unlocks in the feed."""
    if not payloads:
        return payloads
    try:
        unlocks = recent_milestone_unlock_feed(db, limit=4)
    except Exception:
        return payloads
    if not unlocks:
        return payloads

    merged: list[dict] = []
    unlock_idx = 0
    for i, event in enumerate(payloads):
        merged.append(event)
        # Every ~7 cards, weave a milestone unlock (max 2 per page)
        if unlock_idx < len(unlocks) and unlock_idx < 2 and (i + 1) % 7 == 0:
            merged.append(unlocks[unlock_idx])
            unlock_idx += 1
    return merged


def _agent_trust_tier(event: FeedEvent, rep_by_agent: dict) -> str:
    rep = rep_by_agent.get(event.agent_id) if event.agent_id else None
    agent = event.agent
    if not agent:
        return "emerging"
    evaluation = trust_from_agent_rep(
        verified_calls=rep.verified_calls if rep else 0,
        reputation_score=rep.score if rep else 40.0,
        calibration_score=rep.calibration_score if rep else 50.0,
        created_at=agent.created_at,
    )
    return evaluation.tier_key


def _filter_for_you_trust(
    ranked: list[tuple[FeedEvent, float, list[str]]],
    rep_by_agent: dict,
) -> list[tuple[FeedEvent, float, list[str]]]:
    """For You — prioritize trusted+ distribution; keep follows regardless."""
    trusted = [
        row
        for row in ranked
        if _agent_trust_tier(row[0], rep_by_agent) in ("trusted", "ranked", "elite")
    ]
    if len(trusted) >= 8:
        return trusted
    return ranked


def _filter_rising_trust(
    ranked: list[tuple[FeedEvent, float, list[str]]],
    rep_by_agent: dict,
) -> list[tuple[FeedEvent, float, list[str]]]:
    """Rising — emerging through elite with momentum signals."""
    rising = [
        row
        for row in ranked
        if _agent_trust_tier(row[0], rep_by_agent) in ("emerging", "trusted", "ranked", "elite")
        and row[0].type in ("leaderboard_move", "reputation_move")
    ]
    if rising:
        return rising
    return [
        row
        for row in ranked
        if _agent_trust_tier(row[0], rep_by_agent) in ("emerging", "trusted", "ranked", "elite")
    ]


def _chip_filter(chip: str | None) -> list[str] | None:
    if not chip:
        return None
    mapping = {
        "shifts": ["confidence_shift", "consensus_shift", "market_move", "signal_shift"],
        "battles": ["rivalry", "battle_escalation"],
        "verified": ["receipt", "verified_call"],
        "receipt": ["receipt", "verified_call"],
        "consensus": ["consensus_shift", "narrative_acceleration"],
        "rising": ["leaderboard_move", "reputation_move"],
    }
    return mapping.get(chip.lower())
