"""Deterministic agent activity generation from character bibles (dev / manual trigger)."""

from __future__ import annotations

import hashlib
import re
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy.orm import Session, joinedload

from app.forecasting.agent_status import CORE_AGENT_SLUGS
from app.forecasting.character_bibles import bible_runtime_context, character_bible_for
from app.forecasting.models import Agent, AgentGeneratedActivity, FeedEvent, Market
from app.forecasting.services.activity_failure import ActivityFailure, record_failure
from app.forecasting.services.agent_feed_copy import agent_feed_title_body, split_headline_body
from app.forecasting.services.opinion_headlines import ensure_opinion_headline, is_event_driven_headline
from app.forecasting.services.battle_detection import detect_battles
from app.forecasting.services.utils import hash_seed, title_to_slug
from app.forecasting.services.conversation_threads import assign_root_thread, thread_root_id
from app.forecasting.services.copy_sanitize import finalize_persisted_copy
from app.forecasting.services.receipt_warfare import (
    generate_receipt_warfare_copy,
    maybe_generate_receipt_warfare,
    maybe_generate_thread_resolution_receipt,
)
from app.forecasting.services.activity_mix import (
    DEFAULT_NETWORK_BATCH,
    MAX_BATCH_SIZE,
    family_counts,
    family_deficit,
    pick_family_with_largest_deficit,
    target_for_family,
    triggers_for_family,
)
from app.forecasting.services.character_fingerprints import fingerprint_passes
from app.forecasting.services.rivalry_engine import (
    create_rival_reply_activity,
    maybe_generate_rival_responses,
    pick_rival_responder,
)
from app.forecasting.services.thread_network_events import maybe_emit_thread_network_events
from app.forecasting.services.activity_generation_sources import (
    ACTIVITY_SOURCE_MANUAL_DEV,
    stamp_activities_source,
)
from app.forecasting.services.voice_engine import (
    agent_specific_opener,
    display_name,
    generate_counter,
    generate_conviction_update_with_meta,
    generate_feed_post_with_meta,
    generate_loss_reaction_with_meta,
    generate_win_reaction_with_meta,
    polish_copy,
)

ACTIVITY_TYPES = frozenset(
    {
        "agent_post",
        "conviction_update",
        "battle_response",
        "rival_reply",
        "receipt_reaction",
        "receipt_challenge",
        "receipt_victory",
        "market_position_update",
        "network_pulse",
        "network_briefing_item",
    }
)

RECENT_HASH_LIMIT = 400
DEFAULT_BATCH_MIN = 5
DEFAULT_BATCH_MAX = 100
CORE_SLUG_LIST = sorted(CORE_AGENT_SLUGS)

_FORBIDDEN_TOPIC_PATTERNS: dict[str, list[re.Pattern[str]]] = {
    "doombot": [
        re.compile(p, re.I)
        for p in (
            r"\bstill buying\b",
            r"\bthe dip is still there\b",
            r"\brisk.on rip\b",
            r"\bcrowd underpositioned\b",
            r"\bgreat news for markets\b",
        )
    ],
    "bullbot": [
        re.compile(p, re.I)
        for p in (
            r"\bsoft landing is cope\b",
            r"\brecession window\b",
            r"\bfragility compounds\b",
            r"\bconsensus is usually late\b",
        )
    ],
    "fed-watcher": [
        re.compile(p, re.I)
        for p in (
            r"\bchampions league\b",
            r"\bupset probability\b",
            r"\binjury cluster\b",
        )
    ],
    "macro-oracle": [
        re.compile(p, re.I)
        for p in (
            r"\bchampions league\b",
            r"\btaking the underdog\b",
            r"\bline is still wrong\b",
        )
    ],
    "sports-chaos": [
        re.compile(p, re.I)
        for p in (
            r"\b2s10s\b",
            r"\bdot plot\b",
            r"\bseptember modal\b",
            r"\brecession odds\b",
            r"\bliquidity impulse\b",
        )
    ],
}


@dataclass(frozen=True)
class ActivityTrigger:
    trigger_id: str
    activity_type: str
    agent_slug: str
    headline_template: str
    event_kind: str
    market_hint: str | None = None
    counter_target: str | None = None
    delay_minutes: int = 0
    narrative_id: str | None = None
    narrative_label: str | None = None
    narrative_stage: str | None = None


TRIGGER_CATALOG: tuple[ActivityTrigger, ...] = (
    ActivityTrigger(
        "bullish_jobs_print",
        "agent_post",
        "doombot",
        "Jobs strength — consensus late again",
        "bullish_news",
        market_hint="recession",
        counter_target="bullbot",
    ),
    ActivityTrigger(
        "market_dip_2pct",
        "agent_post",
        "bullbot",
        "Pullback — dip still there",
        "market_dip",
        market_hint="nvidia",
    ),
    ActivityTrigger(
        "cpi_release",
        "agent_post",
        "fed-watcher",
        "CPI — front-end leads",
        "cpi_fed_rates",
        market_hint="fed",
    ),
    ActivityTrigger(
        "fomc_day",
        "conviction_update",
        "fed-watcher",
        "FOMC path update",
        "fomc",
        market_hint="cut",
    ),
    ActivityTrigger(
        "macro_data_release",
        "conviction_update",
        "macro-oracle",
        "Macro model update",
        "macro_data",
        market_hint="recession",
        delay_minutes=120,
    ),
    ActivityTrigger(
        "major_sports_fixture",
        "agent_post",
        "sports-chaos",
        "Pre-match upset path",
        "sports_event",
        market_hint="champions",
    ),
    ActivityTrigger(
        "doombot_bullbot_rivalry",
        "battle_response",
        "doombot",
        "Counter: BullBot momentum read",
        "rivalry",
        market_hint="recession",
        counter_target="bullbot",
    ),
    ActivityTrigger(
        "bullbot_doombot_rivalry",
        "battle_response",
        "bullbot",
        "Counter: DoomBot timing",
        "rivalry",
        market_hint="nvidia",
        counter_target="doombot",
    ),
    ActivityTrigger(
        "receipt_verified",
        "receipt_reaction",
        "bullbot",
        "Receipt verified",
        "receipt_win",
        market_hint="nvidia",
    ),
    ActivityTrigger(
        "receipt_miss",
        "receipt_reaction",
        "macro-oracle",
        "Post-mortem posted",
        "receipt_miss",
        market_hint="recession",
    ),
    ActivityTrigger(
        "receipt_warfare_bull_doom",
        "receipt_challenge",
        "bullbot",
        "Receipt challenge: DoomBot recession calls",
        "receipt_warfare",
        market_hint="recession",
        counter_target="doombot",
    ),
    ActivityTrigger(
        "receipt_warfare_doom_bull",
        "receipt_challenge",
        "doombot",
        "Receipt challenge: BullBot drawdown blind spot",
        "receipt_warfare",
        market_hint="nvidia",
        counter_target="bullbot",
    ),
    ActivityTrigger(
        "receipt_warfare_oracle_fed",
        "receipt_challenge",
        "macro-oracle",
        "Receipt challenge: FedWatcher timing lag",
        "receipt_warfare",
        market_hint="fed",
        counter_target="fed-watcher",
    ),
    ActivityTrigger(
        "receipt_warfare_bull_victory",
        "receipt_victory",
        "bullbot",
        "Receipt victory vs DoomBot",
        "receipt_win",
        market_hint="nvidia",
        counter_target="doombot",
    ),
    ActivityTrigger(
        "ai_consensus_challenge",
        "agent_post",
        "doombot",
        "AI euphoria — priced for perfection",
        "ai_narrative",
        market_hint="ai",
    ),
    ActivityTrigger(
        "position_conviction",
        "market_position_update",
        "fed-watcher",
        "Rates conviction posted",
        "rates_position",
        market_hint="oil",
    ),
    ActivityTrigger(
        "fed_macro_alliance",
        "battle_response",
        "macro-oracle",
        "Rates vs regime — horizon check",
        "alliance_friction",
        market_hint="fed",
        counter_target="fed-watcher",
    ),
    ActivityTrigger(
        "sports_line_move",
        "conviction_update",
        "sports-chaos",
        "Line moved — holding conviction",
        "line_move",
        market_hint="football",
    ),
    ActivityTrigger(
        "bullbot_ai_capex_push",
        "battle_response",
        "bullbot",
        "Counter: DoomBot AI capex doom loop",
        "rivalry",
        market_hint="ai",
        counter_target="doombot",
    ),
    ActivityTrigger(
        "doombot_soft_landing_push",
        "battle_response",
        "doombot",
        "Counter: BullBot soft landing faith",
        "rivalry",
        market_hint="recession",
        counter_target="bullbot",
    ),
    ActivityTrigger(
        "oracle_timing_check",
        "battle_response",
        "macro-oracle",
        "Counter: FedWatcher curve read",
        "rivalry",
        market_hint="fed",
        counter_target="fed-watcher",
    ),
    ActivityTrigger(
        "fedwatcher_model_pushback",
        "battle_response",
        "fed-watcher",
        "Counter: MacroOracle recession window",
        "rivalry",
        market_hint="recession",
        counter_target="macro-oracle",
    ),
    ActivityTrigger(
        "sports_chaos_upset_call",
        "agent_post",
        "sports-chaos",
        "Upset path — public still wrong",
        "sports_event",
        market_hint="champions",
    ),
    ActivityTrigger(
        "bullbot_momentum_thread",
        "agent_post",
        "bullbot",
        "Momentum desk — crowd still underpositioned",
        "market_dip",
        market_hint="nvidia",
        counter_target="doombot",
    ),
    ActivityTrigger(
        "doombot_fragility_thread",
        "conviction_update",
        "doombot",
        "Fragility read update",
        "ai_narrative",
        market_hint="ai",
        counter_target="bullbot",
    ),
    ActivityTrigger(
        "network_trust_bullbot",
        "network_pulse",
        "bullbot",
        "Trust board climb — momentum desk",
        "trust_shift",
        market_hint="nvidia",
    ),
    ActivityTrigger(
        "network_rivalry_heating",
        "network_pulse",
        "doombot",
        "Rivalry heat — BullBot vs DoomBot",
        "rivalry_heat",
        market_hint="recession",
        counter_target="bullbot",
    ),
    ActivityTrigger(
        "network_alliance_fed_oracle",
        "network_pulse",
        "macro-oracle",
        "Alliance watch — rates vs regime",
        "alliance",
        market_hint="fed",
        counter_target="fed-watcher",
    ),
    ActivityTrigger(
        "network_receipts_verified",
        "network_pulse",
        "fed-watcher",
        "Network receipts — credibility reshuffle",
        "receipt_pulse",
        market_hint="cut",
    ),
)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def body_hash(text: str) -> str:
    normalized = re.sub(r"\s+", " ", text.strip().lower())
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


def violates_forbidden_topics(slug: str, body: str) -> bool:
    patterns = _FORBIDDEN_TOPIC_PATTERNS.get(slug, [])
    return any(p.search(body) for p in patterns)


def _load_recent_hashes(db: Session) -> set[str]:
    rows = (
        db.query(AgentGeneratedActivity.body_hash)
        .order_by(AgentGeneratedActivity.created_at.desc())
        .limit(RECENT_HASH_LIMIT)
        .all()
    )
    return {r[0] for r in rows if r[0]}


def _pick_market(markets: list[Market], hint: str | None) -> Market | None:
    if not markets:
        return None
    if hint:
        hint_l = hint.lower()
        for m in markets:
            if hint_l in m.title.lower() or hint_l in (m.category or "").lower():
                return m
    return markets[hash_seed(hint or "default") % len(markets)]


def _pick_battle(db: Session, slug: str, markets: list[Market]) -> dict[str, Any] | None:
    from app.forecasting.agent_status import query_active_agents

    agents = query_active_agents(db)
    events = db.query(FeedEvent).limit(40).all()
    takes = []
    battles = detect_battles(agents, events, takes, markets, limit=8)
    for b in battles:
        if slug in (b["agent_a"]["slug"], b["agent_b"]["slug"]):
            return b
    return battles[0] if battles else None


def _system_event_label(trigger: ActivityTrigger, market: Market | None, agent_slug: str) -> str:
    """Internal trigger descriptor — not shown as feed headline."""
    market_bit = market.title[:48] if market else "Network"
    return trigger.headline_template.replace("{market}", market_bit).replace(
        "{agent}", display_name(agent_slug)
    )


def _finalize_agent_post(
    slug: str,
    activity_type: str,
    full_copy: str,
    meta: dict[str, Any],
    *,
    trigger: ActivityTrigger,
    market: Market | None,
    db: Session | None = None,
) -> tuple[str, str, dict[str, Any]]:
    """Derive agent-voiced title + supporting body; stash system label in meta."""
    polished = polish_copy(slug, full_copy)
    title, body = agent_feed_title_body(polished, activity_type)
    market_title = market.title if market else None
    invalid, reason = is_event_driven_headline(
        title, slug=slug, market_title=market_title, body=polished
    )
    if invalid:
        meta["headline_regenerated"] = True
        meta["headline_reject_reason"] = reason
    title = ensure_opinion_headline(
        slug,
        title,
        body=polished,
        market_title=market_title,
        event_type=activity_type,
        seed=meta.get("generation_seed"),
    )
    meta["system_event_label"] = _system_event_label(trigger, market, slug)
    meta["activity_type"] = activity_type
    title, body, san_meta = finalize_persisted_copy(
        slug,
        title,
        body,
        seed=meta.get("generation_seed"),
        db=db,
    )
    if san_meta:
        meta.update(san_meta)
    if not body.strip() and title.strip():
        body = title
    return title, body, meta


def _generate_body(
    trigger: ActivityTrigger,
    *,
    market: Market | None,
    seed: int,
    target_slug: str | None = None,
    db: Session | None = None,
) -> tuple[str, str, dict[str, Any]]:
    """Return (title, body, meta)."""
    slug = trigger.agent_slug
    ctx = bible_runtime_context(slug)
    bible = character_bible_for(slug)
    market_title = market.title if market else "the network"
    meta: dict[str, Any] = {
        "trigger_id": trigger.trigger_id,
        "event_kind": trigger.event_kind,
        "tagline": ctx.get("tagline"),
        "generation_seed": seed,
    }
    if trigger.narrative_id:
        meta["narrative_id"] = trigger.narrative_id
    if trigger.narrative_label:
        meta["narrative_label"] = trigger.narrative_label
    if trigger.narrative_stage:
        meta["narrative_stage"] = trigger.narrative_stage

    if trigger.activity_type in ("receipt_challenge", "receipt_victory") and target_slug:
        line, rw_meta = generate_receipt_warfare_copy(
            db,
            slug,
            target_slug,
            trigger.activity_type,
            seed=seed,
        )
        if not line:
            meta["skip_reason"] = rw_meta.get("skip_reason") or "insufficient_history"
            return "", "", meta
        headline = polish_copy(slug, line)
        market_title = market.title if market else None
        title = ensure_opinion_headline(
            slug,
            headline,
            body=headline,
            market_title=market_title,
            event_type=trigger.activity_type,
            seed=seed,
        )
        _, body = split_headline_body(headline, mode="counter")
        meta.update(rw_meta)
        meta["counter_target"] = target_slug
        meta["prompt_debug"] = rw_meta.get("receipt_ammunition")
        meta["system_event_label"] = _system_event_label(trigger, market, slug)
        meta["activity_type"] = trigger.activity_type
        if is_event_driven_headline(title, slug=slug, market_title=market_title)[0]:
            meta["headline_regenerated"] = True
        title, body, san_meta = finalize_persisted_copy(slug, title, body, seed=seed, db=db)
        if san_meta:
            meta.update(san_meta)
        return title, body, meta

    if trigger.activity_type in ("battle_response", "rival_reply") and target_slug:
        counter = generate_counter(
            slug,
            target_slug,
            market_title=market_title,
            seed=seed,
            db=db,
        )
        headline = polish_copy(slug, counter.line)
        market_title = market.title if market else None
        title = ensure_opinion_headline(
            slug,
            headline,
            body=headline,
            market_title=market_title,
            event_type=trigger.activity_type,
            seed=seed,
        )
        _, body = split_headline_body(headline, mode="counter")
        meta["counter_target"] = target_slug
        meta["direction"] = counter.direction
        meta["prompt_debug"] = counter.generation_meta.get("prompt_debug")
        meta["system_event_label"] = _system_event_label(trigger, market, slug)
        meta["activity_type"] = trigger.activity_type
        if is_event_driven_headline(title, slug=slug, market_title=market_title)[0]:
            meta["headline_regenerated"] = True
        title, body, san_meta = finalize_persisted_copy(slug, title, body, seed=seed, db=db)
        if san_meta:
            meta.update(san_meta)
        return title, body, meta

    if trigger.activity_type == "receipt_reaction":
        if trigger.event_kind == "receipt_win":
            body, gen_meta = generate_win_reaction_with_meta(
                slug, market_title=market_title, seed=seed, db=db
            )
        else:
            body, gen_meta = generate_loss_reaction_with_meta(
                slug, market_title=market_title, seed=seed, db=db
            )
        meta.update(gen_meta)
        meta["prompt_debug"] = gen_meta.get("prompt_debug")
        return _finalize_agent_post(
            slug, trigger.activity_type, body, meta, trigger=trigger, market=market, db=db
        )

    if trigger.activity_type == "conviction_update":
        prob = 42 + (hash_seed(slug, str(seed)) % 35)
        body, _, gen_meta = generate_conviction_update_with_meta(
            slug,
            market_title=market_title,
            prob=float(prob),
            event_kind=trigger.event_kind,
            trigger_id=trigger.trigger_id,
            seed=seed,
            db=db,
        )
        meta.update(gen_meta)
        meta["prompt_debug"] = gen_meta.get("prompt_debug")
        return _finalize_agent_post(
            slug, trigger.activity_type, body, meta, trigger=trigger, market=market, db=db
        )

    if trigger.activity_type == "market_position_update":
        side = "YES" if slug in ("bullbot", "sports-chaos") else "NO"
        conf = 58 + hash_seed(slug, str(seed)) % 28
        body, _, gen_meta = generate_conviction_update_with_meta(
            slug,
            market_title=market_title,
            prob=float(conf),
            event_kind=trigger.event_kind,
            trigger_id=trigger.trigger_id,
            seed=seed,
            db=db,
        )
        meta.update(gen_meta)
        meta["side"] = side
        meta["confidence"] = conf
        meta["prompt_debug"] = gen_meta.get("prompt_debug")
        return _finalize_agent_post(
            slug, trigger.activity_type, body, meta, trigger=trigger, market=market, db=db
        )

    if trigger.activity_type in ("network_briefing_item", "network_pulse"):
        allies = ", ".join(
            display_name(s)
            for s in (bible.get("recurring_allies") or [])[:2]
            if s in CORE_AGENT_SLUGS
        )
        enemies = ", ".join(
            display_name(s)
            for s in (bible.get("recurring_enemies") or [])[:2]
            if s in CORE_AGENT_SLUGS
        )
        tagline = str(ctx.get("tagline") or bible.get("tagline") or "Network pulse.")
        if trigger.event_kind == "rivalry_heat" and enemies:
            rivalry_pulse = {
                "doombot": f"{enemies} still pricing hope. {tagline}",
                "bullbot": f"{enemies} fade failed again. {tagline}",
                "fed-watcher": f"{enemies} drama on the tape. 2s10s unchanged. {tagline}",
                "macro-oracle": f"My read: {enemies} disagreement is narrative, not data. {tagline}",
                "sports-chaos": f"{enemies} line fight live. Upset probability rising. {tagline}",
            }
            body = polish_copy(slug, rivalry_pulse.get(slug, f"{enemies} rivalry — {tagline}"), seed=seed)
        elif trigger.event_kind == "alliance" and allies:
            body = polish_copy(slug, f"{allies} path aligned — {tagline}", seed=seed)
        elif trigger.event_kind == "trust_shift":
            trust_pulse = {
                "doombot": f"Trust board moving. Consensus is usually late. {tagline}",
                "bullbot": f"Trust board moving. Bid still there. {tagline}",
                "fed-watcher": f"Trust board moving. Curve is the signal. {tagline}",
                "macro-oracle": f"Trust board moving. Data over narratives. {tagline}",
                "sports-chaos": f"Trust board moving. Momentum beats sentiment. {tagline}",
            }
            body = polish_copy(slug, trust_pulse.get(slug, f"Trust board moving — {tagline}"), seed=seed)
        else:
            desk_pulse = {
                "doombot": f"Recession window watch. {tagline}",
                "bullbot": f"Risk-on desk pulse. {tagline}",
                "fed-watcher": f"Rates desk pulse. Front-end leads. {tagline}",
                "macro-oracle": f"Macro desk pulse. Regime read unchanged. {tagline}",
                "sports-chaos": f"Sports desk pulse. Line still wrong. {tagline}",
            }
            body = polish_copy(slug, desk_pulse.get(slug, f"Network desk pulse — {tagline}"), seed=seed)
        title, body, meta = _finalize_agent_post(
            slug, trigger.activity_type, body, meta, trigger=trigger, market=market, db=db
        )
        if not body.strip():
            body = title
        return title, body, meta

    if trigger.narrative_stage and trigger.narrative_label:
        from app.forecasting.services.narrative_progression import (
            compose_narrative_stage_copy,
            stage_progression_meta,
        )

        title, body = compose_narrative_stage_copy(
            slug,
            trigger.narrative_label,
            trigger.narrative_stage,
            seed=seed,
        )
        meta.update(
            stage_progression_meta(
                trigger.narrative_stage,
                narrative_id=trigger.narrative_id or "",
                narrative_label=trigger.narrative_label,
            )
        )
        meta["generation_mode"] = "narrative_stage"
        meta["system_event_label"] = _system_event_label(trigger, market, slug)
        meta["activity_type"] = trigger.activity_type
        title, body, san_meta = finalize_persisted_copy(slug, title, body, seed=seed, db=db)
        if san_meta:
            meta.update(san_meta)
        if not body.strip() and title.strip():
            body = title
        return title, body, meta

    # agent_post (default)
    event_map = {
        "bullish_news": "bullish_catalyst",
        "market_dip": "pullback",
        "cpi_fed_rates": "cpi",
        "fomc": "fomc",
        "macro_data": "macro_release",
        "sports_event": "sports_preview",
        "ai_narrative": "narrative_shift",
        "rivalry": "rivalry",
    }
    event_type = event_map.get(trigger.event_kind, "post")
    prob = None
    if slug == "macro-oracle":
        prob = float(40 + hash_seed(str(seed)) % 40)
    body, _, gen_meta = generate_feed_post_with_meta(
        slug,
        market_title=market_title,
        prob=prob,
        event_type=event_type,
        seed=seed,
        db=db,
        extra_context={
            "event_kind": trigger.event_kind,
            "trigger_id": trigger.trigger_id,
            "opponent_slug": target_slug,
        },
    )
    meta.update(gen_meta)
    meta["prompt_debug"] = gen_meta.get("prompt_debug")
    if trigger.event_kind == "bullish_news" and slug == "doombot":
        nn = str(ctx.get("non_negotiable") or "")[:120]
        if nn and "bullish" not in body.lower():
            body = polish_copy(slug, f"{body}\nConsensus is usually late.")
    return _finalize_agent_post(
        slug, trigger.activity_type, body, meta, trigger=trigger, market=market, db=db
    )


def _feed_event_type(activity_type: str, meta: dict[str, Any] | None = None) -> str | None:
    if activity_type == "network_pulse" and meta:
        kind = meta.get("network_event_kind") or meta.get("event_kind")
        if kind == "consensus_shift":
            return "consensus_shift"
        if kind == "battle_intensified":
            return "rivalry"
        if kind == "network_shift":
            return "reputation_move"
    return {
        "agent_post": "new_take",
        "conviction_update": "confidence_shift",
        "battle_response": "rivalry",
        "rival_reply": "rivalry",
        "receipt_reaction": "receipt",
        "receipt_challenge": "rivalry",
        "receipt_victory": "receipt",
        "market_position_update": "stance_followup",
        "network_pulse": "reputation_move",
    }.get(activity_type)


def _mirror_feed_event(
    db: Session,
    *,
    agent: Agent,
    market: Market | None,
    activity_type: str,
    title: str,
    body: str,
    meta: dict[str, Any],
    related_battle_slug: str | None = None,
) -> FeedEvent | None:
    feed_type = _feed_event_type(activity_type, meta)
    if not feed_type:
        return None
    title, body, san_meta = finalize_persisted_copy(
        agent.slug,
        title,
        body,
        seed=hash_seed(title, body, str(meta.get("generation_seed"))),
        db=db,
    )
    if san_meta:
        meta = {**meta, **san_meta}
    from app.forecasting.services.thread_label_copy import mirror_activity_meta_fields

    now = _utcnow()
    feed_meta: dict[str, Any] = {
        "source": "agent_activity_engine",
        "activity_type": activity_type,
        "trigger_id": meta.get("trigger_id"),
        "opponent_slug": meta.get("counter_target") or meta.get("opponent_slug"),
        "related_battle_slug": related_battle_slug,
        "generated_activity_id": meta.get("generated_activity_id"),
        "thread_id": meta.get("thread_id"),
        "parent_activity_id": meta.get("parent_activity_id"),
        **mirror_activity_meta_fields(meta),
    }
    event = FeedEvent(
        type=feed_type,
        agent_id=agent.id,
        market_id=market.id if market else None,
        title=title[:255],
        body=body,
        probability=meta.get("confidence") or (market.current_yes_probability if market else None),
        confidence=meta.get("confidence"),
        metadata_json=feed_meta,
        created_at=now,
        feed_published_at=now,
    )
    db.add(event)
    db.flush()
    return event


def activity_to_dict(row: AgentGeneratedActivity) -> dict[str, Any]:
    return {
        "activity_id": row.activity_id,
        "created_at": row.created_at.replace(tzinfo=timezone.utc).isoformat(),
        "agent_slug": row.agent_slug,
        "activity_type": row.activity_type,
        "title": row.title,
        "body": row.body,
        "related_market_slug": row.related_market_slug,
        "related_battle_slug": row.related_battle_slug,
        "trigger_id": row.trigger_id,
        "metadata": row.metadata_json or {},
        "mirrored_feed_event_id": row.mirrored_feed_event_id,
        "thread_id": row.thread_id,
        "parent_activity_id": row.parent_activity_id,
    }


def list_generated_activity(
    db: Session,
    *,
    limit: int = 50,
    since_hours: int | None = None,
) -> list[dict[str, Any]]:
    q = db.query(AgentGeneratedActivity).order_by(AgentGeneratedActivity.created_at.desc())
    if since_hours is not None:
        cutoff = _utcnow() - timedelta(hours=since_hours)
        q = q.filter(AgentGeneratedActivity.created_at >= cutoff)
    rows = q.limit(limit).all()
    return [
        activity_to_dict(r)
        for r in rows
        if r.activity_type != "network_briefing_item"
    ]


def _persist_trigger_activity(
    db: Session,
    *,
    trigger: ActivityTrigger,
    agents: dict[str, Agent],
    markets: list[Market],
    recent_hashes: set[str],
    session_by_id: dict[str, AgentGeneratedActivity],
    base_seed: int,
    created_len: int,
    mirror_to_feed: bool,
    attempt: int = 0,
    global_recent: set[str] | None = None,
    failure_out: dict[str, Any] | None = None,
) -> AgentGeneratedActivity | None:
    agent = agents.get(trigger.agent_slug)
    if not agent:
        record_failure(
            failure_out,
            ActivityFailure(
                code="unknown_agent",
                source="agent_activity_engine._persist_trigger_activity",
                missing_prerequisite="core_agent",
                recoverable=False,
            ),
        )
        return None

    market = _pick_market(markets, trigger.market_hint)
    battle = None
    battle_slug = None
    target_slug = trigger.counter_target
    if trigger.activity_type == "battle_response":
        battle = _pick_battle(db, trigger.agent_slug, markets)
        if battle:
            battle_slug = battle.get("id")
            if not target_slug:
                other = (
                    battle["agent_b"]["slug"]
                    if battle["agent_a"]["slug"] == trigger.agent_slug
                    else battle["agent_a"]["slug"]
                )
                target_slug = other

    title = ""
    body = ""
    meta: dict[str, Any] = {}
    h = ""
    last_block: str | None = None
    for retry in range(12):
        item_seed = base_seed + hash_seed(
            trigger.trigger_id,
            str(created_len),
            str(attempt),
            str(retry),
            str(base_seed ^ created_len ^ attempt),
        )
        title, body, meta = _generate_body(
            trigger,
            market=market,
            seed=item_seed,
            target_slug=target_slug,
            db=db,
        )
        if not body.strip():
            last_block = "empty_body"
            continue
        if not fingerprint_passes(
            trigger.agent_slug, f"{title} {body}".strip()
        ):
            last_block = "fingerprint_rejected"
            continue
        if violates_forbidden_topics(trigger.agent_slug, body):
            record_failure(
                failure_out,
                ActivityFailure(
                    code="forbidden_topic",
                    source="agent_activity_engine._persist_trigger_activity",
                    missing_prerequisite="forbidden_topic_compliance",
                    recoverable=True,
                ),
            )
            return None
        h = body_hash(body)
        global_seen = global_recent is not None and h in global_recent
        if h not in recent_hashes and not global_seen:
            break
        last_block = "duplicate_body_hash"
        if h not in recent_hashes and retry >= 4:
            # Late retries may diverge from global history when filling large batches.
            break
    else:
        if last_block == "duplicate_body_hash":
            market_label = market.title if market else (trigger.market_hint or "this market")
            target = target_slug or trigger.counter_target
            for dup_offset in (331, 887, 1559):
                recovery_seed = base_seed + hash_seed(
                    trigger.trigger_id, str(dup_offset), "hash_recovery"
                )
                opener = agent_specific_opener(
                    trigger.agent_slug,
                    seed=recovery_seed,
                    market=market_label,
                    target_slug=target,
                )
                recovery_title, recovery_body, recovery_meta = _generate_body(
                    trigger,
                    market=market,
                    seed=recovery_seed,
                    target_slug=target_slug,
                    db=db,
                )
                if not recovery_body.strip():
                    continue
                combined = polish_copy(
                    trigger.agent_slug,
                    f"{opener} {recovery_body}".strip(),
                    seed=recovery_seed,
                    max_sentences=3,
                )
                if not fingerprint_passes(
                    trigger.agent_slug, f"{recovery_title} {combined}".strip()
                ):
                    continue
                if violates_forbidden_topics(trigger.agent_slug, combined):
                    continue
                recovery_h = body_hash(combined)
                global_seen = global_recent is not None and recovery_h in global_recent
                if recovery_h in recent_hashes or global_seen:
                    continue
                title = recovery_title
                body = combined
                meta = recovery_meta
                h = recovery_h
                item_seed = recovery_seed
                break
            else:
                record_failure(
                    failure_out,
                    ActivityFailure(
                        code="duplicate_body_hash",
                        source="agent_activity_engine._persist_trigger_activity",
                        missing_prerequisite="unique_body_hash",
                        recoverable=True,
                    ),
                )
                return None
        else:
            code = last_block or "generation_exhausted"
            record_failure(
                failure_out,
                ActivityFailure(
                    code=code,
                    source="agent_activity_engine._persist_trigger_activity",
                    missing_prerequisite={
                        "empty_body": "non_empty_body",
                        "fingerprint_rejected": "character_fingerprint",
                        "duplicate_body_hash": "unique_body_hash",
                    }.get(code, "persistable_body"),
                    recoverable=True,
                ),
            )
            return None

    title, body, san_meta = finalize_persisted_copy(
        trigger.agent_slug,
        title,
        body,
        seed=item_seed,
        db=db,
        regenerate=lambda: _generate_body(
            trigger,
            market=market,
            seed=item_seed + 888_888,
            target_slug=target_slug,
            db=db,
        )[:2],
    )
    if san_meta:
        meta.update(san_meta)
    if not body.strip() and title.strip():
        body = title

    from app.forecasting.services.thread_continuation_policy import (
        blocks_late_root_after_quote,
        blocks_preemptive_quote,
    )

    if target_slug and blocks_preemptive_quote(
        db,
        speaker_slug=trigger.agent_slug,
        target_slug=target_slug,
        title=title,
        session_by_id=session_by_id,
    ):
        record_failure(
            failure_out,
            ActivityFailure(
                code="preemptive_quote_blocked",
                source="agent_activity_engine._persist_trigger_activity",
                missing_prerequisite="target_thesis_published",
                recoverable=True,
            ),
        )
        return None

    if trigger.activity_type in ("agent_post", "conviction_update") and blocks_late_root_after_quote(
        db,
        agent_slug=trigger.agent_slug,
        title=title,
        session_by_id=session_by_id,
    ):
        record_failure(
            failure_out,
            ActivityFailure(
                code="late_root_after_quote_blocked",
                source="agent_activity_engine._persist_trigger_activity",
                missing_prerequisite="unique_root_thesis",
                recoverable=True,
            ),
        )
        return None

    now = _utcnow()
    if trigger.delay_minutes:
        now = now - timedelta(minutes=trigger.delay_minutes)

    meta["credibility_delta"] = (hash_seed(trigger.agent_slug, trigger.trigger_id) % 23) - 5
    if trigger.narrative_id and trigger.narrative_stage:
        from app.forecasting.services.narrative_progression import commit_narrative_stage

        commit_narrative_stage(db, trigger.agent_slug, trigger.narrative_id, trigger.narrative_stage)
    activity_id = str(uuid.uuid4())
    row = AgentGeneratedActivity(
        activity_id=activity_id,
        activity_type=trigger.activity_type,
        agent_id=agent.id,
        agent_slug=agent.slug,
        title=title[:255],
        body=body,
        body_hash=h,
        related_market_slug=title_to_slug(market.title) if market else None,
        related_battle_slug=battle_slug,
        trigger_id=trigger.trigger_id,
        metadata_json=meta,
        created_at=now,
    )
    assign_root_thread(row)
    meta["thread_id"] = row.thread_id
    meta["parent_activity_id"] = row.parent_activity_id
    meta["generated_activity_id"] = activity_id
    if mirror_to_feed and trigger.activity_type != "network_briefing_item":
        feed_ev = _mirror_feed_event(
            db,
            agent=agent,
            market=market,
            activity_type=trigger.activity_type,
            title=title,
            body=body,
            meta=meta,
            related_battle_slug=battle_slug,
        )
        if feed_ev:
            row.mirrored_feed_event_id = feed_ev.id

    db.add(row)
    recent_hashes.add(h)
    session_by_id[row.activity_id] = row
    return row


def _cascade_social_responses(
    db: Session,
    row: AgentGeneratedActivity,
    *,
    base_seed: int,
    mirror_to_feed: bool,
    recent_hashes: set[str],
    agents: dict[str, Agent],
    markets: list[Market],
    session_by_id: dict[str, AgentGeneratedActivity],
    created: list[AgentGeneratedActivity],
    target_total: int,
    emitted_thread_networks: set[str],
    resolved_thread_receipts: set[str],
    cooling: Any | None = None,
) -> None:
    """Agents react to each other first; receipts only when mix allows."""
    from app.forecasting.services.feed_cooling_policy import (
        CoolingState,
        should_suppress_receipt_generation,
        should_suppress_rivalry_cascade,
    )

    cooling = cooling or CoolingState()
    if len(created) >= target_total:
        return
    counts = family_counts(created)
    rival_rows: list[AgentGeneratedActivity] = []
    if not should_suppress_rivalry_cascade(cooling):
        rival_rows = maybe_generate_rival_responses(
            db,
            row,
            seed=base_seed + hash_seed(row.activity_id),
            mirror_to_feed=mirror_to_feed,
            recent_hashes=recent_hashes,
            agents=agents,
            markets=markets,
            session_by_id=session_by_id,
        )
    thread_id = thread_root_id(row)
    for rival_row in rival_rows:
        if len(created) >= target_total:
            break
        created.append(rival_row)
        thread_id = thread_root_id(rival_row)
        counts = family_counts(created)
        if (
            not should_suppress_receipt_generation(cooling)
            and family_deficit(counts, "receipt", target_total) > 0
        ):
            receipt_rows = maybe_generate_receipt_warfare(
                db,
                rival_row,
                seed=base_seed + hash_seed(rival_row.activity_id, "receipt"),
                mirror_to_feed=mirror_to_feed,
                recent_hashes=recent_hashes,
                agents=agents,
                markets=markets,
                session_by_id=session_by_id,
            )
            for receipt_row in receipt_rows:
                created.append(receipt_row)

    if rival_rows:
        for network_row in maybe_emit_thread_network_events(
            db,
            thread_id=thread_id,
            session_by_id=session_by_id,
            agents=agents,
            markets=markets,
            seed=base_seed + hash_seed(thread_id, "network"),
            mirror_to_feed=mirror_to_feed,
            recent_hashes=recent_hashes,
            emitted_threads=emitted_thread_networks,
        ):
            if len(created) >= target_total:
                break
            created.append(network_row)

        if (
            not should_suppress_receipt_generation(cooling)
            and len(rival_rows) >= 2
            and family_deficit(family_counts(created), "receipt", target_total) > 0
        ):
            resolution = maybe_generate_thread_resolution_receipt(
                db,
                thread_id=thread_id,
                session_by_id=session_by_id,
                seed=base_seed + hash_seed(thread_id, "resolve"),
                mirror_to_feed=mirror_to_feed,
                recent_hashes=recent_hashes,
                agents=agents,
                markets=markets,
                resolved_threads=resolved_thread_receipts,
            )
            if resolution and len(created) < target_total:
                created.append(resolution)

    counts = family_counts(created)
    if (
        not should_suppress_receipt_generation(cooling)
        and family_deficit(counts, "receipt", target_total) > 0
        and row.activity_type in ("receipt_reaction", "battle_response", "rival_reply")
    ):
        receipt_rows = maybe_generate_receipt_warfare(
            db,
            row,
            seed=base_seed + hash_seed(row.activity_id, "receipt_primary"),
            mirror_to_feed=mirror_to_feed,
            recent_hashes=recent_hashes,
            agents=agents,
            markets=markets,
            session_by_id=session_by_id,
        )
        for receipt_row in receipt_rows:
            created.append(receipt_row)


def _pick_weighted_trigger(
    candidates: list[ActivityTrigger],
    *,
    used: set[str],
    base_seed: int,
    attempt: int,
) -> ActivityTrigger | None:
    pool = [t for t in candidates if t.trigger_id not in used]
    if not pool:
        return None
    weights = [
        1.0 + (hash_seed(t.trigger_id, str(base_seed), str(attempt)) % 5)
        for t in pool
    ]
    total = sum(weights)
    roll = hash_seed(str(base_seed), str(attempt), "trigger") % int(total * 100)
    cursor = 0.0
    for trigger, weight in zip(pool, weights):
        cursor += weight * 100
        if roll < cursor:
            return trigger
    return pool[-1]


def _force_rival_exchange(
    db: Session,
    *,
    source: AgentGeneratedActivity,
    base_seed: int,
    mirror_to_feed: bool,
    recent_hashes: set[str],
    agents: dict[str, Agent],
    markets: list[Market],
    session_by_id: dict[str, AgentGeneratedActivity],
) -> AgentGeneratedActivity | None:
    rival_slug = pick_rival_responder(
        source.agent_slug,
        hash_seed(source.activity_id, str(base_seed), "force"),
    )
    if not rival_slug or rival_slug == source.agent_slug:
        return None
    return create_rival_reply_activity(
        db,
        responder_slug=rival_slug,
        target_slug=source.agent_slug,
        source=source,
        order=1,
        seed=hash_seed(source.activity_id, str(base_seed), "force_reply"),
        mirror_to_feed=mirror_to_feed,
        recent_hashes=recent_hashes,
        agents=agents,
        markets=markets,
        session_by_id=session_by_id,
    )


def _synthetic_trigger(slot: int, family: str, base_seed: int) -> ActivityTrigger:
    slug = CORE_SLUG_LIST[slot % len(CORE_SLUG_LIST)]
    rival = CORE_SLUG_LIST[(slot + 2) % len(CORE_SLUG_LIST)]
    if family == "open_battle":
        return ActivityTrigger(
            f"slot_{base_seed}_{family}_{slot}",
            "battle_response",
            slug,
            f"{display_name(slug)} counters {display_name(rival)}",
            "rivalry",
            counter_target=rival,
        )
    if family == "receipt":
        return ActivityTrigger(
            f"slot_{base_seed}_{family}_{slot}",
            "receipt_reaction",
            slug,
            f"{display_name(slug)} receipt beat {slot}",
            "receipt_win" if slot % 2 else "receipt_miss",
        )
    if family == "network_event":
        return ActivityTrigger(
            f"slot_{base_seed}_{family}_{slot}",
            "network_pulse",
            slug,
            f"{display_name(slug)} network pulse {slot}",
            "trust_shift" if slot % 2 else "rivalry_heat",
            counter_target=rival,
        )
    return ActivityTrigger(
        f"slot_{base_seed}_{family}_{slot}",
        "agent_post" if slot % 3 else "conviction_update",
        slug,
        f"{display_name(slug)} desk beat {slot}",
        "ai_narrative" if slug == "doombot" else "market_dip",
        counter_target=rival,
    )


def _persist_slot(
    db: Session,
    *,
    trigger: ActivityTrigger,
    agents: dict[str, Agent],
    markets: list[Market],
    recent_hashes: set[str],
    session_by_id: dict[str, AgentGeneratedActivity],
    base_seed: int,
    created: list[AgentGeneratedActivity],
    mirror_to_feed: bool,
    global_recent: set[str],
    slot: int,
) -> AgentGeneratedActivity | None:
    row = _persist_trigger_activity(
        db,
        trigger=trigger,
        agents=agents,
        markets=markets,
        recent_hashes=recent_hashes,
        session_by_id=session_by_id,
        base_seed=base_seed,
        created_len=len(created),
        mirror_to_feed=mirror_to_feed,
        attempt=slot,
        global_recent=global_recent,
    )
    if row:
        created.append(row)
    return row


def generate_agent_activity_batch(
    db: Session,
    *,
    count: int | None = None,
    seed: int | None = None,
    mirror_to_feed: bool = True,
) -> list[AgentGeneratedActivity]:
    """Generate bible-voiced agent-network activity toward 40/40/10/10 card mix."""
    target = count if count is not None else DEFAULT_NETWORK_BATCH
    target = max(DEFAULT_BATCH_MIN, min(MAX_BATCH_SIZE, target))
    base_seed = seed if seed is not None else int(_utcnow().timestamp()) % 1_000_000

    from app.forecasting.agent_status import query_active_agents

    agents = {a.slug: a for a in query_active_agents(db) if a.slug in CORE_AGENT_SLUGS}
    markets = db.query(Market).all()
    global_recent = _load_recent_hashes(db)
    recent_hashes: set[str] = set()
    created: list[AgentGeneratedActivity] = []
    session_by_id: dict[str, AgentGeneratedActivity] = {}
    emitted_thread_networks: set[str] = set()
    resolved_thread_receipts: set[str] = set()
    used_triggers: set[str] = set()
    primary_agents_posted: set[str] = set()
    slot = 0

    def persist_family(family: str, want: int) -> None:
        nonlocal slot
        catalog = triggers_for_family(family, TRIGGER_CATALOG)
        attempts = 0
        while (
            len(created) < target
            and family_deficit(family_counts(created), family, target) > 0
            and attempts < want * 4
        ):
            attempts += 1
            slot += 1
            trigger = _pick_weighted_trigger(
                catalog,
                used=used_triggers,
                base_seed=base_seed,
                attempt=slot,
            )
            if trigger is None:
                trigger = _synthetic_trigger(slot, family, base_seed)
            row = _persist_slot(
                db,
                trigger=trigger,
                agents=agents,
                markets=markets,
                recent_hashes=recent_hashes,
                session_by_id=session_by_id,
                base_seed=base_seed,
                created=created,
                mirror_to_feed=mirror_to_feed,
                global_recent=global_recent,
                slot=slot,
            )
            if not row:
                continue
            used_triggers.add(trigger.trigger_id)
            primary_agents_posted.add(trigger.agent_slug)
            if row.activity_type in (
                "agent_post",
                "conviction_update",
                "market_position_update",
                "battle_response",
            ):
                _cascade_social_responses(
                    db,
                    row,
                    base_seed=base_seed,
                    mirror_to_feed=mirror_to_feed,
                    recent_hashes=recent_hashes,
                    agents=agents,
                    markets=markets,
                    session_by_id=session_by_id,
                    created=created,
                    target_total=target,
                    emitted_thread_networks=emitted_thread_networks,
                    resolved_thread_receipts=resolved_thread_receipts,
                )

    # Markets spark conversations — originals first, then social cascades dominate.
    persist_family("agent_post", target_for_family("agent_post", target))
    persist_family("open_battle", target_for_family("open_battle", target))

    chain_guard = 0
    while (
        len(created) < target
        and family_deficit(family_counts(created), "open_battle", target) > 0
        and chain_guard < target * 2
    ):
        chain_guard += 1
        sources = [
            r
            for r in reversed(created)
            if r.activity_type in ("agent_post", "conviction_update", "rival_reply", "battle_response")
        ]
        if not sources:
            break
        source = sources[chain_guard % len(sources)]
        rival_row = _force_rival_exchange(
            db,
            source=source,
            base_seed=base_seed + chain_guard,
            mirror_to_feed=mirror_to_feed,
            recent_hashes=recent_hashes,
            agents=agents,
            markets=markets,
            session_by_id=session_by_id,
        )
        if rival_row:
            created.append(rival_row)

    persist_family("receipt", target_for_family("receipt", target))
    persist_family("network_event", target_for_family("network_event", target))

    while len(created) < target and slot < target * 12:
        slot += 1
        family = pick_family_with_largest_deficit(family_counts(created), target)
        trigger = _synthetic_trigger(slot, family, base_seed)
        _persist_slot(
            db,
            trigger=trigger,
            agents=agents,
            markets=markets,
            recent_hashes=recent_hashes,
            session_by_id=session_by_id,
            base_seed=base_seed,
            created=created,
            mirror_to_feed=mirror_to_feed,
            global_recent=global_recent,
            slot=slot,
        )

    for slug in sorted(CORE_AGENT_SLUGS):
        if slug in primary_agents_posted:
            continue
        slot += 1
        if len(created) >= target + len(CORE_AGENT_SLUGS):
            break
        row = None
        for fill_try in range(6):
            fallback = ActivityTrigger(
                f"fallback_{base_seed}_{slug}_{fill_try}",
                "agent_post",
                slug,
                f"{display_name(slug)} — network read {fill_try}",
                "sports_event" if slug == "sports-chaos" else "fallback",
                market_hint="champions" if slug == "sports-chaos" else None,
            )
            row = _persist_slot(
                db,
                trigger=fallback,
                agents=agents,
                markets=markets,
                recent_hashes=recent_hashes,
                session_by_id=session_by_id,
                base_seed=base_seed + fill_try * 131,
                created=created,
                mirror_to_feed=mirror_to_feed,
                global_recent=global_recent,
                slot=slot + fill_try,
            )
            if row:
                break
        if row:
            primary_agents_posted.add(slug)
            _cascade_social_responses(
                db,
                row,
                base_seed=base_seed,
                mirror_to_feed=mirror_to_feed,
                recent_hashes=recent_hashes,
                agents=agents,
                markets=markets,
                session_by_id=session_by_id,
                created=created,
                target_total=target,
                emitted_thread_networks=emitted_thread_networks,
                resolved_thread_receipts=resolved_thread_receipts,
            )

    stamp_activities_source(created, ACTIVITY_SOURCE_MANUAL_DEV)
    db.commit()
    for row in created:
        db.refresh(row)
    if len(created) <= target:
        return created
    priority: list[AgentGeneratedActivity] = []
    seen_agents: set[str] = set()
    for row in created:
        if row.agent_slug in CORE_AGENT_SLUGS and row.agent_slug not in seen_agents:
            priority.append(row)
            seen_agents.add(row.agent_slug)
    remainder = [row for row in created if row not in priority]
    return (priority + remainder)[:target]


def summarize_network_briefing(db: Session, *, since_hours: int = 24) -> list[str]:
    """Build insider-style briefing lines from recent generated activity."""
    cutoff = _utcnow() - timedelta(hours=since_hours)
    rows = (
        db.query(AgentGeneratedActivity)
        .options(joinedload(AgentGeneratedActivity.agent))
        .filter(AgentGeneratedActivity.created_at >= cutoff)
        .order_by(AgentGeneratedActivity.created_at.desc())
        .limit(80)
        .all()
    )
    if not rows:
        return ["Network agents are calibrating — run dev generation to populate live motion."]

    battles = sum(
        1
        for r in rows
        if r.activity_type in ("battle_response", "rival_reply", "receipt_challenge")
    )
    receipts = sum(
        1
        for r in rows
        if r.activity_type in ("receipt_reaction", "receipt_victory")
    )
    lines: list[str] = []

    if battles:
        lines.append(f"{battles} battle{'s' if battles != 1 else ''} escalated across core desks.")
    if receipts:
        verified = sum(
            1
            for r in rows
            if r.activity_type == "receipt_reaction"
            and (r.metadata_json or {}).get("event_kind") == "receipt_win"
        )
        if verified:
            lines.append(f"{verified} receipt{'s' if verified != 1 else ''} verified in the last window.")
        elif receipts:
            lines.append(f"{receipts} receipt reaction{'s' if receipts != 1 else ''} posted.")

    cred_lines: list[str] = []
    for r in rows:
        delta = (r.metadata_json or {}).get("credibility_delta")
        if isinstance(delta, int) and delta >= 8:
            cred_lines.append(f"{display_name(r.agent_slug)} gained +{delta} credibility.")
        elif isinstance(delta, int) and delta <= -6:
            cred_lines.append(f"{display_name(r.agent_slug)} slipped {delta} on a public miss.")
    lines.extend(cred_lines[:2])

    challenge = next(
        (r for r in rows if r.agent_slug == "doombot" and r.trigger_id == "ai_consensus_challenge"),
        None,
    )
    if challenge:
        topic = (challenge.related_market_slug or "consensus").replace("-", " ")
        lines.append(f"DoomBot challenged the {topic} consensus.")
    elif any(r.agent_slug == "doombot" and r.activity_type == "agent_post" for r in rows):
        lines.append("DoomBot pushed back on risk-on narrative timing.")

    if len(lines) < 2:
        agents_active = len({r.agent_slug for r in rows})
        lines.append(f"{agents_active} core agents posted new conviction in the last {since_hours}h.")

    return lines[:4]
