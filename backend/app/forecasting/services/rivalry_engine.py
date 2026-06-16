"""Rivalry generation layer — agents respond to each other's posts from character bibles."""

from __future__ import annotations

import re
import uuid
import zlib
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy.orm import Session

from app.forecasting.agent_status import CORE_AGENT_SLUGS
from app.forecasting.character_bibles import (
    character_bible_for,
    relationship_between,
    relationships_for,
)
from app.forecasting.models import Agent, AgentGeneratedActivity, Market
from app.forecasting.services.activity_failure import ActivityFailure, record_failure
from app.forecasting.services.agent_prompt_context import build_reply_relationship_context
from app.forecasting.services.conversation_threads import (
    assign_reply_thread,
    thread_agent_slugs,
    thread_extension_failure,
    thread_root_id,
)
from app.forecasting.services.thread_lifecycle import (
    mark_thread_closed,
    thread_dict_from_activity,
)
from app.forecasting.services.agent_feed_copy import split_headline_body
from app.forecasting.services.copy_sanitize import finalize_persisted_copy
from app.forecasting.services.opinion_headlines import ensure_opinion_headline, is_event_driven_headline
from app.forecasting.services.reply_claim_summary import is_broken_reply_grammar
from app.forecasting.services.utils import hash_seed, title_to_slug
from app.forecasting.services.conversational_reply_engine import (
    passes_conversational_reply_quality,
)
from app.forecasting.services.voice_engine import (
    agent_specific_opener,
    display_name,
    generate_rival_reply,
    generate_rival_reply_recovery,
    is_generic_agreement,
    is_generic_disagreement,
    polish_copy,
    reply_references_context,
)

# Conversation-first cascade — every agent_post rolls for a rival exchange.
AGENT_POST_RIVAL_CHANCE = 0.60
SECOND_ORDER_CHANCE = 0.25
THIRD_PARTICIPANT_CHANCE = 0.10
OTHER_POST_RIVAL_CHANCE = 0.35

# Back-compat aliases used in tests.
RIVAL_RESPONSE_CHANCE = AGENT_POST_RIVAL_CHANCE

POST_TRIGGER_TYPES = frozenset(
    {
        "agent_post",
        "conviction_update",
        "market_position_update",
        "battle_response",
    }
)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _activity_helpers():
    from app.forecasting.services import agent_activity_engine as engine

    return engine


def _roll(seed: int, threshold: float) -> bool:
    bucket = zlib.crc32(f"rivalry:{seed}:{threshold:.4f}".encode()) % 10_000
    return bucket < int(threshold * 10_000)


def _rival_weight(poster_slug: str, rival_slug: str) -> float:
    """Score how likely this agent should respond to poster_slug."""
    bible = character_bible_for(rival_slug)
    weight = 0.0
    notes = bible.get("relationship_notes") or {}
    note = notes.get(poster_slug) if isinstance(notes.get(poster_slug), dict) else {}
    rivalry = bible.get("rivalry_behavior") or {}
    if rivalry.get(poster_slug):
        weight += 3.0
    if note.get("dynamic"):
        weight += 2.0
    if note.get("response_style") or note.get("typical_response"):
        weight += 1.5
    if note.get("type") and "rival" in str(note.get("type")).lower():
        weight += 2.5
    if poster_slug in (bible.get("recurring_enemies") or []):
        weight += 2.0
    edge = relationship_between(rival_slug, poster_slug) or {}
    if edge.get("angry"):
        weight += 2.0
    if edge.get("dismiss"):
        weight += 1.5
    if edge.get("respect") and not edge.get("dismiss"):
        weight += 0.8
    # SportsChaos ignores macro; macro agents ignore sports.
    poster_cat = str(character_bible_for(poster_slug).get("category") or "").lower()
    rival_cat = str(bible.get("category") or "").lower()
    if "sport" in poster_cat and "sport" not in rival_cat:
        rb = str(rivalry.get(poster_slug) or "").lower()
        if "do not engage" in rb or "not engage" in rb:
            return 0.0
        weight *= 0.15
    if "sport" in rival_cat and "sport" not in poster_cat:
        rb = str(rivalry.get(poster_slug) or "").lower()
        if "do not engage" in rb or "not engage" in rb:
            return 0.0
        weight *= 0.15
    return weight


def eligible_rivals(poster_slug: str) -> list[tuple[str, float]]:
    """Rivals sorted by bible-defined response weight (highest first)."""
    seen: set[str] = set()
    candidates: list[tuple[str, float]] = []
    bible = character_bible_for(poster_slug)
    for key in (bible.get("relationship_notes") or {}):
        if not key or key.startswith("_"):
            continue
        seen.add(str(key))
    for enemy in bible.get("recurring_enemies") or []:
        seen.add(str(enemy))
    for other in relationships_for(poster_slug):
        seen.add(str(other))
    for rival in sorted(seen):
        if rival == poster_slug or rival not in CORE_AGENT_SLUGS:
            continue
        weight = _rival_weight(poster_slug, rival)
        if weight > 0:
            candidates.append((rival, weight))
    candidates.sort(key=lambda x: (-x[1], x[0]))
    return candidates


def pick_rival_responder(
    poster_slug: str,
    seed: int,
    *,
    exclude: set[str] | None = None,
) -> str | None:
    rivals = [
        (slug, weight)
        for slug, weight in eligible_rivals(poster_slug)
        if not exclude or slug not in exclude
    ]
    if not rivals:
        return None
    total = sum(w for _, w in rivals)
    if total <= 0:
        return None
    pick = hash_seed(poster_slug, str(seed), "rival_pick") % int(total * 100)
    cursor = 0
    for slug, weight in rivals:
        cursor += int(weight * 100)
        if pick < cursor:
            return slug
    return rivals[0][0]


def rival_pick_failure(
    poster_slug: str,
    seed: int,
    *,
    exclude: set[str] | None = None,
) -> ActivityFailure | None:
    """Explain why pick_rival_responder would return None."""
    rivals = [
        (slug, weight)
        for slug, weight in eligible_rivals(poster_slug)
        if not exclude or slug not in exclude
    ]
    if not rivals:
        return ActivityFailure(
            code="no_eligible_rivals",
            source="rivalry_engine.pick_rival_responder",
            missing_prerequisite="eligible_rival",
            recoverable=True,
        )
    total = sum(w for _, w in rivals)
    if total <= 0:
        return ActivityFailure(
            code="zero_rival_weight",
            source="rivalry_engine.pick_rival_responder",
            missing_prerequisite="positive_rival_weight",
            recoverable=True,
        )
    return None


def pick_third_participant(
    anchor_slug: str,
    thread_id: str,
    *,
    seed: int,
    session_by_id: dict[str, AgentGeneratedActivity] | None,
    db: Session,
) -> str | None:
    """Pick a new agent to join an heated thread."""
    existing = thread_agent_slugs(db, thread_id, by_id=session_by_id)
    return pick_rival_responder(anchor_slug, seed, exclude=existing)


def build_rival_context(
    responder_slug: str,
    target_slug: str,
    source: AgentGeneratedActivity,
) -> dict[str, Any]:
    """Assemble bible + post context for rival reply generation."""
    meta = source.metadata_json or {}
    market_title = None
    if source.related_market_slug:
        market_title = source.related_market_slug.replace("-", " ")
    return {
        **build_reply_relationship_context(responder_slug, target_slug),
        "market_title": market_title,
        "event_type": "rival_reply",
        "event_kind": "rivalry",
        "source_post_title": source.title,
        "source_post_body": source.body,
        "source_agent_slug": source.agent_slug,
        "source_activity_type": source.activity_type,
        "in_reply_to_activity_id": source.activity_id,
        "trigger_id": meta.get("trigger_id") or source.trigger_id,
    }


def _finalize_rival_reply(
    responder_slug: str,
    headline: str,
    *,
    market_title: str | None,
    seed: int,
    meta: dict[str, Any],
) -> tuple[str, str]:
    title = ensure_opinion_headline(
        responder_slug,
        headline,
        body=headline,
        market_title=market_title,
        event_type="rival_reply",
        seed=seed,
    )
    _, body = split_headline_body(headline, mode="counter")
    if is_event_driven_headline(title, slug=responder_slug, market_title=market_title)[0]:
        meta["headline_regenerated"] = True
    return title, body


def _reply_quality_failure(
    body: str,
    *,
    speaker_slug: str,
    target_slug: str,
    source: AgentGeneratedActivity,
) -> ActivityFailure | None:
    if is_generic_agreement(body):
        return ActivityFailure(
            code="generic_agreement",
            source="rivalry_engine._reply_quality_ok",
            missing_prerequisite="substantive_disagreement",
            recoverable=True,
        )
    if is_generic_disagreement(body):
        return ActivityFailure(
            code="generic_disagreement",
            source="rivalry_engine._reply_quality_ok",
            missing_prerequisite="substantive_counterpoint",
            recoverable=True,
        )
    if is_broken_reply_grammar(
        body, source_title=source.title, source_body=source.body
    ):
        return ActivityFailure(
            code="broken_reply_grammar",
            source="rivalry_engine._reply_quality_ok",
            missing_prerequisite="clean_claim_reference",
            recoverable=True,
        )
    if passes_conversational_reply_quality(speaker_slug, body):
        return None
    if not reply_references_context(
        body,
        target_slug=target_slug,
        source_title=source.title,
        source_body=source.body,
    ):
        return ActivityFailure(
            code="missing_context_reference",
            source="rivalry_engine._reply_quality_ok",
            missing_prerequisite="source_context_reference",
            recoverable=True,
        )
    return None


def _reply_quality_ok(
    body: str,
    *,
    speaker_slug: str,
    target_slug: str,
    source: AgentGeneratedActivity,
) -> bool:
    if is_generic_agreement(body) or is_generic_disagreement(body):
        return False
    if is_broken_reply_grammar(
        body, source_title=source.title, source_body=source.body
    ):
        return False
    if passes_conversational_reply_quality(speaker_slug, body):
        return True
    return reply_references_context(
        body,
        target_slug=target_slug,
        source_title=source.title,
        source_body=source.body,
    )


def create_rival_reply_activity(
    db: Session,
    *,
    responder_slug: str,
    target_slug: str,
    source: AgentGeneratedActivity,
    order: int,
    seed: int,
    mirror_to_feed: bool,
    recent_hashes: set[str],
    agents: dict[str, Agent],
    markets: list[Market],
    session_by_id: dict[str, AgentGeneratedActivity] | None = None,
    failure_out: dict[str, Any] | None = None,
    recovery_attempt: bool = False,
) -> AgentGeneratedActivity | None:
    """Generate and persist one rival_reply activity, or None if skipped."""
    responder = agents.get(responder_slug)
    if not responder:
        record_failure(
            failure_out,
            ActivityFailure(
                code="unknown_responder",
                source="rivalry_engine.create_rival_reply_activity",
                missing_prerequisite="core_agent",
                recoverable=False,
            ),
        )
        return None
    block = thread_extension_failure(
        db, source, responder_slug, by_id=session_by_id
    )
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
                source="conversation_threads.can_extend_thread",
                missing_prerequisite=(
                    "thread_depth_headroom"
                    if block == "thread_depth_limit"
                    else "thread_agent_slot"
                ),
                recoverable=True,
            ),
        )
        return None

    market = None
    if source.related_market_slug:
        hint = source.related_market_slug.replace("-", " ")
        for m in markets:
            if hint in m.title.lower() or hint in (m.category or "").lower():
                market = m
                break
    if not market and markets:
        market = markets[hash_seed(responder_slug, str(seed)) % len(markets)]

    market_title = market.title if market else None
    context = build_rival_context(responder_slug, target_slug, source)
    engine = _activity_helpers()
    headline = ""
    body = ""
    meta: dict[str, Any] = {}
    counter = None
    last_quality_failure: ActivityFailure | None = None
    generate_fn = generate_rival_reply_recovery if recovery_attempt else generate_rival_reply
    retry_budget = 1 if recovery_attempt else 8
    for retry in range(retry_budget):
        item_seed = seed + retry * 9973
        if recovery_attempt:
            counter = generate_rival_reply_recovery(
                responder_slug,
                target_slug,
                market_title=market_title,
                source_context=context,
                seed=item_seed,
            )
        else:
            counter = generate_rival_reply(
                responder_slug,
                target_slug,
                market_title=market_title,
                source_context=context,
                seed=item_seed,
                db=db,
            )
        headline = polish_copy(
            responder_slug,
            counter.line,
            seed=item_seed,
            max_sentences=2 if recovery_attempt else None,
        )
        quality_failure = _reply_quality_failure(
            headline,
            speaker_slug=responder_slug,
            target_slug=target_slug,
            source=source,
        )
        if quality_failure:
            last_quality_failure = quality_failure
            continue
        if engine.violates_forbidden_topics(responder_slug, headline):
            record_failure(
                failure_out,
                ActivityFailure(
                    code="forbidden_topic",
                    source="rivalry_engine.create_rival_reply_activity",
                    missing_prerequisite="forbidden_topic_compliance",
                    recoverable=True,
                ),
            )
            return None
        break
    else:
        record_failure(
            failure_out,
            last_quality_failure
            or ActivityFailure(
                code="quality_gate_exhausted",
                source="rivalry_engine.create_rival_reply_activity",
                missing_prerequisite="quality_reply",
                recoverable=True,
            ),
        )
        return None

    meta = {
        "event_kind": "rivalry",
        "trigger_id": f"rival_reply_{order}",
        "counter_target": target_slug,
        "direction": counter.direction,
        "rivalry_order": order,
        "in_reply_to_activity_id": source.activity_id,
        "in_reply_to_agent_slug": source.agent_slug,
        "source_post_title": source.title,
        "source_post_body": source.body,
        "prompt_debug": counter.generation_meta.get("prompt_debug"),
        "generation_seed": seed,
        "activity_type": "rival_reply",
        "system_event_label": (
            f"{display_name(responder_slug)} replies to {display_name(target_slug)}"
        ),
    }
    title, body = _finalize_rival_reply(
        responder_slug,
        headline,
        market_title=market_title,
        seed=seed,
        meta=meta,
    )
    if not body.strip():
        body = headline
    if market and db:
        from app.forecasting.services.agent_memory_v2 import (
            apply_episodic_memory_pipeline,
            thesis_bucket_from_text,
        )

        combined = f"{title}\n{body}".strip()
        combined, mem_meta = apply_episodic_memory_pipeline(
            combined,
            db=db,
            agent_slug=responder_slug,
            path="rivalry",
            market_id=market.id,
            market_title=market.title,
            rival_slug=target_slug,
            thesis_bucket=thesis_bucket_from_text(market.title),
            seed=seed,
            generation_mode=str(counter.generation_meta.get("generation_mode") or "template"),
            weave=counter.generation_meta.get("generation_mode") != "llm",
            already_applied=bool(counter.generation_meta.get("memory_pipeline_applied")),
        )
        if mem_meta:
            meta.update(mem_meta)
        from app.forecasting.services.agent_feed_copy import agent_feed_title_body

        title, body = agent_feed_title_body(combined, "rival_reply")
    title, body, san_meta = finalize_persisted_copy(
        responder_slug, title, body, seed=seed, db=db
    )
    if san_meta:
        meta.update(san_meta)
    from app.forecasting.services.thread_label_copy import classify_rival_thread_tone

    meta["thread_tone"] = classify_rival_thread_tone(
        title,
        body,
        opponent_name=display_name(target_slug),
        opponent_slug=target_slug,
        parent_agent_name=display_name(source.agent_slug),
    )
    post_sanitize_failure = _reply_quality_failure(
        body,
        speaker_slug=responder_slug,
        target_slug=target_slug,
        source=source,
    )
    if post_sanitize_failure:
        record_failure(failure_out, post_sanitize_failure)
        return None

    h = engine.body_hash(body)
    if h in recent_hashes:
        market_label = market_title or "this market"
        for dup_offset in (997, 1993, 2999):
            opener = agent_specific_opener(
                responder_slug,
                seed=seed + dup_offset,
                market=market_label,
                target_slug=target_slug,
            )
            variant = polish_copy(
                responder_slug,
                f"{opener} {body}",
                seed=seed + dup_offset,
                max_sentences=3,
            )
            variant_h = engine.body_hash(variant)
            if variant_h not in recent_hashes and _reply_quality_failure(
                variant,
                speaker_slug=responder_slug,
                target_slug=target_slug,
                source=source,
            ) is None:
                body = variant
                h = variant_h
                break
        else:
            record_failure(
                failure_out,
                ActivityFailure(
                    code="duplicate_body_hash",
                    source="rivalry_engine.create_rival_reply_activity",
                    missing_prerequisite="unique_body_hash",
                    recoverable=True,
                ),
            )
            return None

    battle = engine._pick_battle(db, responder_slug, markets)
    battle_slug = battle.get("id") if battle else source.related_battle_slug

    now = _utcnow() + timedelta(minutes=2 * order)
    meta["credibility_delta"] = (hash_seed(responder_slug, str(seed), str(order)) % 19) - 4

    activity_id = str(uuid.uuid4())
    row = AgentGeneratedActivity(
        activity_id=activity_id,
        activity_type="rival_reply",
        agent_id=responder.id,
        agent_slug=responder.slug,
        title=title[:255],
        body=body,
        body_hash=h,
        related_market_slug=title_to_slug(market.title) if market else source.related_market_slug,
        related_battle_slug=battle_slug,
        trigger_id=f"rival_reply_{order}",
        metadata_json=meta,
        created_at=now,
    )
    assign_reply_thread(row, source)
    meta["thread_id"] = row.thread_id
    meta["parent_activity_id"] = row.parent_activity_id
    meta["generated_activity_id"] = activity_id
    from app.forecasting.services.conversation_threads import (
        ensure_thread_root_mirrored,
        resolve_thread_root,
    )

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
            activity_type="rival_reply",
            title=title,
            body=body,
            meta=meta,
            related_battle_slug=battle_slug,
        )
        if feed_ev:
            row.mirrored_feed_event_id = feed_ev.id

    db.add(row)
    recent_hashes.add(h)
    if session_by_id is not None:
        session_by_id[row.activity_id] = row
    return row


def _primary_rival_chance(source: AgentGeneratedActivity) -> float:
    if source.activity_type == "agent_post":
        return AGENT_POST_RIVAL_CHANCE
    return OTHER_POST_RIVAL_CHANCE


def maybe_generate_rival_responses(
    db: Session,
    source: AgentGeneratedActivity,
    *,
    seed: int,
    mirror_to_feed: bool,
    recent_hashes: set[str],
    agents: dict[str, Agent],
    markets: list[Market],
    session_by_id: dict[str, AgentGeneratedActivity] | None = None,
) -> list[AgentGeneratedActivity]:
    """
    After a new agent post, roll for rival reply (60%), counter-reply (25%), third voice (10%).
    Returns created rival_reply rows (0–3).
    """
    if source.activity_type not in POST_TRIGGER_TYPES:
        return []
    if source.agent_slug not in CORE_AGENT_SLUGS:
        return []

    created: list[AgentGeneratedActivity] = []
    roll_seed = hash_seed(source.activity_id, str(seed))

    if not _roll(roll_seed, _primary_rival_chance(source)):
        return []

    rival_slug = pick_rival_responder(source.agent_slug, roll_seed)
    if not rival_slug or rival_slug == source.agent_slug:
        return []

    first = create_rival_reply_activity(
        db,
        responder_slug=rival_slug,
        target_slug=source.agent_slug,
        source=source,
        order=1,
        seed=roll_seed + 1,
        mirror_to_feed=mirror_to_feed,
        recent_hashes=recent_hashes,
        agents=agents,
        markets=markets,
        session_by_id=session_by_id,
    )
    if not first:
        return []

    created.append(first)
    latest = first

    second_seed = hash_seed(first.activity_id, str(seed), "second_order")
    if _roll(second_seed, SECOND_ORDER_CHANCE):
        second = create_rival_reply_activity(
            db,
            responder_slug=source.agent_slug,
            target_slug=rival_slug,
            source=first,
            order=2,
            seed=second_seed,
            mirror_to_feed=mirror_to_feed,
            recent_hashes=recent_hashes,
            agents=agents,
            markets=markets,
            session_by_id=session_by_id,
        )
        if second:
            created.append(second)
            latest = second

    third_seed = hash_seed(latest.activity_id, str(seed), "third_participant")
    if _roll(third_seed, THIRD_PARTICIPANT_CHANCE):
        thread_id = thread_root_id(source)
        third_slug = pick_third_participant(
            latest.agent_slug,
            thread_id,
            seed=third_seed,
            session_by_id=session_by_id,
            db=db,
        )
        if third_slug and third_slug not in {source.agent_slug, rival_slug, latest.agent_slug}:
            third = create_rival_reply_activity(
                db,
                responder_slug=third_slug,
                target_slug=latest.agent_slug,
                source=latest,
                order=3,
                seed=third_seed + 3,
                mirror_to_feed=mirror_to_feed,
                recent_hashes=recent_hashes,
                agents=agents,
                markets=markets,
                session_by_id=session_by_id,
            )
            if third:
                created.append(third)

    return created
