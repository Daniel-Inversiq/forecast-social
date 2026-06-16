"""Retrieval and assembly of character-bible + runtime context for agent LLM prompts."""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any

from sqlalchemy.orm import Session

from app.forecasting.character_bibles import (
    bible_runtime_context,
    character_bible_for,
    relationship_between,
    relationships_for,
)
from app.forecasting.models import Agent, AgentGeneratedActivity, FeedEvent, ForecastResolution, Market
from app.forecasting.services.agent_memory_v2 import (
    format_episodic_memory_for_prompt,
    gather_episodic_memory_v2,
    resolve_market_id,
    thesis_bucket_from_text,
)

POST_EVENT_TYPES = frozenset(
    {
        "new_take",
        "confidence_shift",
        "rivalry",
        "battle_escalation",
        "receipt",
        "stance_followup",
        "signal_shift",
        "market_move",
        "consensus_shift",
        "narrative_acceleration",
    }
)

FEW_SHOT_MAX = 5
RECEIPT_LIMIT = 5
FORECAST_LIMIT = 5
CONTINUITY_LIMIT = 10
RIVAL_POSTS_PER_RIVAL = 3
RIVAL_POSTS_MAX = 8


@dataclass
class RetrievedContext:
    few_shot_examples: list[str] = field(default_factory=list)
    relationship_context: list[dict[str, Any]] = field(default_factory=list)
    receipts: list[dict[str, Any]] = field(default_factory=list)
    resolved_forecasts: list[dict[str, Any]] = field(default_factory=list)
    agent_continuity: list[dict[str, Any]] = field(default_factory=list)
    rival_posts: list[dict[str, Any]] = field(default_factory=list)
    rituals: dict[str, Any] = field(default_factory=dict)
    memory_guidance: str = ""
    episodic_memory: dict[str, Any] = field(default_factory=dict)

    def as_dict(self) -> dict[str, Any]:
        return {
            "few_shot_examples": self.few_shot_examples,
            "relationship_context": self.relationship_context,
            "receipts": self.receipts,
            "resolved_forecasts": self.resolved_forecasts,
            "agent_continuity": self.agent_continuity,
            "rival_posts": self.rival_posts,
            "rituals": self.rituals,
            "memory_guidance": self.memory_guidance,
            "episodic_memory": self.episodic_memory,
        }


def _rival_slugs(slug: str) -> list[str]:
    bible = character_bible_for(slug)
    notes = bible.get("relationship_notes") or {}
    rivals: list[str] = []
    for key in notes:
        if key.startswith("_"):
            continue
        rivals.append(str(key))
    for enemy in bible.get("recurring_enemies") or []:
        if enemy not in rivals:
            rivals.append(str(enemy))
    for other, edge in relationships_for(slug).items():
        if edge.get("angry") or edge.get("dismiss") or edge.get("respect"):
            if other not in rivals:
                rivals.append(str(other))
    return rivals[:6]


def _dedupe_posts(posts: list[str]) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for p in posts:
        key = re.sub(r"\s+", " ", p.strip().lower())
        if not key or key in seen:
            continue
        seen.add(key)
        out.append(p.strip())
    return out


def gather_few_shot_examples(slug: str, *, limit: int = FEW_SHOT_MAX) -> list[str]:
    """3–5 example posts from character bible (character.md sync)."""
    ctx = bible_runtime_context(slug)
    bible = character_bible_for(slug)
    pool = _dedupe_posts(
        list(ctx.get("sample_posts") or [])
        + list(bible.get("sample_posts") or [])
        + list(bible.get("example_good_posts") or [])
    )
    return pool[:limit]


def build_reply_relationship_context(
    speaker_slug: str,
    target_slug: str,
) -> dict[str, Any]:
    """
    Flat bible slice for rival/counter replies — relationship_notes, rivalry_behavior,
    typical_response, and core_beliefs for the responder toward one target.
    """
    ctx = bible_runtime_context(speaker_slug)
    bible = character_bible_for(speaker_slug)
    notes = bible.get("relationship_notes") or {}
    note = notes.get(target_slug) if isinstance(notes.get(target_slug), dict) else {}
    rivalry = bible.get("rivalry_behavior") or {}
    edge = relationship_between(speaker_slug, target_slug) or {}
    out: dict[str, Any] = {
        "target_slug": target_slug,
        "opponent_slug": target_slug,
        "core_beliefs": list(ctx.get("core_beliefs") or [])[:5],
        "rivalry_behavior": rivalry.get(target_slug),
        "relationship_dynamic": note.get("dynamic"),
        "response_style": note.get("response_style"),
        "typical_response": note.get("typical_response"),
    }
    if note.get("type"):
        out["relationship_type"] = note.get("type")
    if edge.get("note"):
        out["relationship_edge_note"] = edge.get("note")
    return {k: v for k, v in out.items() if v is not None and v != "" and v != []}


def gather_relationship_context(
    slug: str,
    *,
    opponent_slug: str | None = None,
) -> list[dict[str, Any]]:
    """Relationship notes, response_style, rivalry_behavior, typical_response."""
    bible = character_bible_for(slug)
    notes = bible.get("relationship_notes") or {}
    rivalry = bible.get("rivalry_behavior") or {}
    targets = [opponent_slug] if opponent_slug else _rival_slugs(slug)
    out: list[dict[str, Any]] = []
    for rival in targets:
        if not rival or rival.startswith("_"):
            continue
        note_block = notes.get(rival) if isinstance(notes.get(rival), dict) else {}
        edge = relationship_between(slug, rival) or {}
        entry: dict[str, Any] = {"rival_slug": rival}
        if note_block.get("dynamic"):
            entry["dynamic"] = note_block["dynamic"]
        if note_block.get("response_style"):
            entry["response_style"] = note_block["response_style"]
        if note_block.get("typical_response"):
            entry["typical_response"] = note_block["typical_response"]
        if rivalry.get(rival):
            entry["rivalry_behavior"] = rivalry[rival]
        if edge.get("note"):
            entry["relationship_note"] = edge["note"]
        if len(entry) > 1:
            out.append(entry)
    return out


def _market_title(db: Session, market_id: int | None) -> str | None:
    if not market_id:
        return None
    market = db.get(Market, market_id)
    return market.title if market else None


def gather_receipt_memory(db: Session, agent_id: int, *, limit: int = RECEIPT_LIMIT) -> list[dict[str, Any]]:
    rows = (
        db.query(FeedEvent)
        .filter(FeedEvent.agent_id == agent_id, FeedEvent.type == "receipt")
        .order_by(FeedEvent.created_at.desc())
        .limit(limit)
        .all()
    )
    out: list[dict[str, Any]] = []
    for row in rows:
        out.append(
            {
                "title": row.title,
                "body": row.body[:400],
                "market": _market_title(db, row.market_id),
                "created_at": row.created_at.isoformat() if row.created_at else None,
            }
        )
    return out


def gather_resolved_forecasts(
    db: Session, agent_id: int, *, limit: int = FORECAST_LIMIT
) -> list[dict[str, Any]]:
    rows = (
        db.query(ForecastResolution)
        .filter(ForecastResolution.agent_id == agent_id)
        .order_by(ForecastResolution.resolved_at.desc())
        .limit(limit)
        .all()
    )
    out: list[dict[str, Any]] = []
    for row in rows:
        out.append(
            {
                "market": _market_title(db, row.market_id),
                "side": row.side,
                "predicted_probability": row.predicted_probability,
                "correct": row.correct,
                "resolved_at": row.resolved_at.isoformat() if row.resolved_at else None,
            }
        )
    return out


def gather_agent_continuity(
    db: Session, agent_id: int, agent_slug: str, *, limit: int = CONTINUITY_LIMIT
) -> list[dict[str, Any]]:
    feed_rows = (
        db.query(FeedEvent)
        .filter(
            FeedEvent.agent_id == agent_id,
            FeedEvent.type.in_(tuple(POST_EVENT_TYPES)),
        )
        .order_by(FeedEvent.created_at.desc())
        .limit(limit)
        .all()
    )
    activity_rows = (
        db.query(AgentGeneratedActivity)
        .filter(AgentGeneratedActivity.agent_slug == agent_slug)
        .order_by(AgentGeneratedActivity.created_at.desc())
        .limit(limit)
        .all()
    )
    merged: list[tuple[datetime, dict[str, Any]]] = []
    for row in feed_rows:
        ts = row.created_at or datetime.utcnow()
        merged.append(
            (
                ts,
                {
                    "source": "feed_event",
                    "activity_type": row.type,
                    "title": row.title,
                    "body": row.body[:350],
                    "created_at": ts.isoformat(),
                },
            )
        )
    for row in activity_rows:
        ts = row.created_at or datetime.utcnow()
        merged.append(
            (
                ts,
                {
                    "source": "generated_activity",
                    "activity_type": row.activity_type,
                    "title": row.title,
                    "body": row.body[:350],
                    "created_at": ts.isoformat(),
                },
            )
        )
    merged.sort(key=lambda x: x[0], reverse=True)
    return [item for _, item in merged[:limit]]


def gather_rival_posts(
    db: Session,
    slug: str,
    *,
    per_rival: int = RIVAL_POSTS_PER_RIVAL,
    max_total: int = RIVAL_POSTS_MAX,
) -> list[dict[str, Any]]:
    rivals = _rival_slugs(slug)
    if not rivals:
        return []
    agents = db.query(Agent).filter(Agent.slug.in_(rivals)).all()
    slug_to_id = {a.slug: a.id for a in agents}
    out: list[dict[str, Any]] = []
    for rival_slug in rivals:
        rival_id = slug_to_id.get(rival_slug)
        if not rival_id:
            continue
        rows = (
            db.query(FeedEvent)
            .filter(
                FeedEvent.agent_id == rival_id,
                FeedEvent.type.in_(tuple(POST_EVENT_TYPES)),
            )
            .order_by(FeedEvent.created_at.desc())
            .limit(per_rival)
            .all()
        )
        for row in rows:
            out.append(
                {
                    "rival_slug": rival_slug,
                    "title": row.title,
                    "body": row.body[:280],
                    "activity_type": row.type,
                    "created_at": row.created_at.isoformat() if row.created_at else None,
                }
            )
        if len(out) >= max_total:
            break
    return out[:max_total]


def gather_rituals(
    slug: str,
    *,
    event_type: str | None = None,
    event_kind: str | None = None,
    trigger_id: str | None = None,
) -> dict[str, Any]:
    ctx = bible_runtime_context(slug)
    rituals = ctx.get("rituals") if isinstance(ctx.get("rituals"), dict) else {}
    schedule = list(rituals.get("posting_schedule") or [])
    triggers = list(rituals.get("trigger_events") or [])
    never = list(rituals.get("never_posts_about") or [])
    matched_triggers: list[str] = []
    if event_type or event_kind or trigger_id:
        hay = " ".join(filter(None, [event_type, event_kind, trigger_id])).lower()
        for t in triggers:
            if any(word in t.lower() for word in hay.split() if len(word) > 3):
                matched_triggers.append(t)
    return {
        "posting_schedule": schedule,
        "trigger_events": triggers,
        "never_posts_about": never,
        "matched_trigger_events": matched_triggers[:4],
        "event_type": event_type,
        "event_kind": event_kind,
        "trigger_id": trigger_id,
    }


def build_retrieved_context(
    db: Session | None,
    slug: str,
    *,
    opponent_slug: str | None = None,
    event_type: str | None = None,
    event_kind: str | None = None,
    trigger_id: str | None = None,
    market_id: int | None = None,
    market_title: str | None = None,
    thesis_bucket: str | None = None,
) -> RetrievedContext:
    ctx = RetrievedContext()
    ctx.few_shot_examples = gather_few_shot_examples(slug)
    ctx.relationship_context = gather_relationship_context(slug, opponent_slug=opponent_slug)
    bible = character_bible_for(slug)
    ctx.memory_guidance = str(bible.get("memory_guidance") or "")[:1800]
    ctx.rituals = gather_rituals(
        slug,
        event_type=event_type,
        event_kind=event_kind,
        trigger_id=trigger_id,
    )
    if db is None:
        return ctx
    agent = db.query(Agent).filter(Agent.slug == slug).first()
    if not agent:
        return ctx
    ctx.receipts = gather_receipt_memory(db, agent.id)
    ctx.resolved_forecasts = gather_resolved_forecasts(db, agent.id)
    ctx.agent_continuity = gather_agent_continuity(db, agent.id, slug)
    ctx.rival_posts = gather_rival_posts(db, slug)
    resolved_market_id = resolve_market_id(
        db,
        market_id=market_id,
        market_title=market_title,
    )
    rival_id = None
    if opponent_slug:
        rival = db.query(Agent).filter(Agent.slug == opponent_slug).first()
        rival_id = rival.id if rival else None
    bucket = thesis_bucket_from_text(thesis_bucket) if thesis_bucket else None
    if not bucket and market_title:
        bucket = thesis_bucket_from_text(market_title)
    ctx.episodic_memory = gather_episodic_memory_v2(
        db,
        agent.id,
        market_id=resolved_market_id,
        rival_id=rival_id,
        thesis_bucket=bucket,
    )
    return ctx


def format_retrieved_for_user_prompt(retrieved: RetrievedContext) -> str:
    sections: list[str] = []
    if retrieved.few_shot_examples:
        lines = ["## Voice examples (match this style, do not copy verbatim)"]
        for i, ex in enumerate(retrieved.few_shot_examples, 1):
            lines.append(f"Example {i}:\n{ex}")
        sections.append("\n".join(lines))
    if retrieved.relationship_context:
        lines = ["## Relationship context"]
        for rel in retrieved.relationship_context:
            rival = rel.get("rival_slug", "?")
            lines.append(f"--- {rival} ---")
            for key in (
                "dynamic",
                "response_style",
                "typical_response",
                "rivalry_behavior",
                "relationship_note",
            ):
                if rel.get(key):
                    lines.append(f"{key}: {rel[key]}")
        sections.append("\n".join(lines))
    if retrieved.receipts:
        lines = ["## Recent receipts (reference when relevant)"]
        for r in retrieved.receipts:
            market = r.get("market") or "unknown market"
            lines.append(f"- [{r.get('created_at', '?')}] {market}: {r.get('body', '')[:200]}")
        sections.append("\n".join(lines))
    if retrieved.resolved_forecasts:
        lines = ["## Recent resolved forecasts"]
        for f in retrieved.resolved_forecasts:
            outcome = "correct" if f.get("correct") else "miss"
            lines.append(
                f"- {f.get('market', '?')}: {f.get('side')} @ {f.get('predicted_probability')}% — {outcome}"
            )
        sections.append("\n".join(lines))
    if retrieved.agent_continuity:
        lines = ["## Your recent posts (maintain continuity)"]
        for p in retrieved.agent_continuity:
            lines.append(f"- [{p.get('created_at', '?')}] {p.get('body', '')[:220]}")
        sections.append("\n".join(lines))
    if retrieved.rival_posts:
        lines = ["## Recent rival posts (you may respond to these themes)"]
        for p in retrieved.rival_posts:
            lines.append(
                f"- {p.get('rival_slug')}: {p.get('body', '')[:200]}"
            )
        sections.append("\n".join(lines))
    rituals = retrieved.rituals
    if rituals.get("posting_schedule") or rituals.get("trigger_events"):
        lines = ["## Posting rituals"]
        for item in rituals.get("posting_schedule") or []:
            lines.append(f"Schedule: {item}")
        for item in rituals.get("matched_trigger_events") or rituals.get("trigger_events") or []:
            lines.append(f"Trigger: {item}")
        for item in rituals.get("never_posts_about") or []:
            lines.append(f"Never post about: {item}")
        sections.append("\n".join(lines))
    if retrieved.memory_guidance.strip():
        sections.append(f"## Memory guidance\n{retrieved.memory_guidance[:1200]}")
    episodic_block = format_episodic_memory_for_prompt(retrieved.episodic_memory)
    if episodic_block:
        sections.append(episodic_block)
    return "\n\n".join(sections)


def estimate_bible_coverage_pct(slug: str, system_prompt: str, user_prompt: str) -> float:
    """Rough fraction of synced bible text represented in prompts."""
    bible = character_bible_for(slug)
    if not bible:
        return 0.0
    raw = json.dumps(bible, ensure_ascii=False)
    bible_chars = len(re.sub(r"\s+", " ", raw))
    if bible_chars == 0:
        return 0.0
    combined = (system_prompt + user_prompt).lower()
    bible_text = re.sub(r'[{}\[\]",]', " ", raw.lower())
    tokens = {t for t in re.findall(r"[a-z]{5,}", bible_text)}
    if not tokens:
        return 0.0
    matched = sum(1 for t in tokens if t in combined)
    return round(min(100.0, (matched / len(tokens)) * 100), 1)


def reconstruct_context_from_activity(row: AgentGeneratedActivity) -> dict[str, Any]:
    meta = row.metadata_json or {}
    ctx: dict[str, Any] = {
        "market_title": row.related_market_slug.replace("-", " ") if row.related_market_slug else None,
        "event_type": row.activity_type,
        "event_kind": meta.get("event_kind"),
        "trigger_id": meta.get("trigger_id") or row.trigger_id,
        "opponent_slug": meta.get("counter_target"),
        "target_slug": meta.get("counter_target"),
    }
    if meta.get("confidence") is not None:
        ctx["prob"] = meta.get("confidence")
    return {k: v for k, v in ctx.items() if v is not None}


def task_for_activity_type(activity_type: str) -> str:
    return {
        "battle_response": "counter",
        "rival_reply": "counter",
        "receipt_challenge": "counter",
        "receipt_victory": "reaction",
        "receipt_reaction": "reaction",
        "conviction_update": "conviction_update",
    }.get(activity_type, "post")
