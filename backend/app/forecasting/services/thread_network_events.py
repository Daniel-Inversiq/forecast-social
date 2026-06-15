"""Network reactions when public agent threads heat up."""

from __future__ import annotations

import uuid
import zlib
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy.orm import Session

from app.forecasting.models import Agent, AgentGeneratedActivity, Market
from app.forecasting.services.conversation_threads import thread_root_id
from app.forecasting.services.utils import hash_seed, title_to_slug
from app.forecasting.services.voice_engine import display_name, polish_copy

NETWORK_EVENT_KINDS = frozenset({"network_shift", "consensus_shift", "battle_intensified"})
MIN_THREAD_REPLIES = 3
CONVICTION_GAP_THRESHOLD = 8
CREDIBILITY_MISMATCH_THRESHOLD = 6


@dataclass(frozen=True)
class ThreadHeatMetrics:
    thread_id: str
    reply_count: int
    conviction_gap: int
    credibility_mismatch: bool
    agent_slugs: tuple[str, ...]
    root_title: str
    root_slug: str


def _utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _roll(seed: int, threshold: float) -> bool:
    bucket = zlib.crc32(f"thread_network:{seed}:{threshold:.4f}".encode()) % 10_000
    return bucket < int(threshold * 10_000)


def _credibility_delta(row: AgentGeneratedActivity) -> int:
    meta = row.metadata_json or {}
    raw = meta.get("credibility_delta")
    if isinstance(raw, int):
        return raw
    if isinstance(raw, float):
        return int(raw)
    return hash_seed(row.agent_slug, row.activity_id) % 15 - 7


def collect_thread_rows(
    thread_id: str,
    session_by_id: dict[str, AgentGeneratedActivity],
) -> list[AgentGeneratedActivity]:
    rows = [r for r in session_by_id.values() if thread_root_id(r) == thread_id]
    rows.sort(key=lambda r: r.created_at or datetime.min)
    return rows


def analyze_thread_heat(
    thread_id: str,
    session_by_id: dict[str, AgentGeneratedActivity],
) -> ThreadHeatMetrics | None:
    rows = collect_thread_rows(thread_id, session_by_id)
    if not rows:
        return None
    replies = [r for r in rows if r.parent_activity_id]
    if len(replies) < MIN_THREAD_REPLIES:
        return None

    deltas = [_credibility_delta(r) for r in rows]
    conviction_gap = max(deltas) - min(deltas)
    positive = sum(1 for d in deltas if d > 2)
    negative = sum(1 for d in deltas if d < -2)
    credibility_mismatch = positive >= 1 and negative >= 1 and conviction_gap >= CREDIBILITY_MISMATCH_THRESHOLD

    if conviction_gap < CONVICTION_GAP_THRESHOLD and not credibility_mismatch:
        return None

    root = next((r for r in rows if not r.parent_activity_id), rows[0])
    return ThreadHeatMetrics(
        thread_id=thread_id,
        reply_count=len(replies),
        conviction_gap=conviction_gap,
        credibility_mismatch=credibility_mismatch,
        agent_slugs=tuple(dict.fromkeys(r.agent_slug for r in rows)),
        root_title=root.title,
        root_slug=root.agent_slug,
    )


def pick_network_event_kind(metrics: ThreadHeatMetrics, seed: int) -> str:
    if metrics.credibility_mismatch and metrics.conviction_gap >= CONVICTION_GAP_THRESHOLD + 4:
        return "battle_intensified"
    if metrics.conviction_gap >= CONVICTION_GAP_THRESHOLD + 2:
        return "consensus_shift"
    kinds = ("network_shift", "consensus_shift", "battle_intensified")
    return kinds[hash_seed(metrics.thread_id, str(seed)) % len(kinds)]


def _network_event_copy(kind: str, metrics: ThreadHeatMetrics) -> tuple[str, str]:
    agents = " · ".join(display_name(slug) for slug in metrics.agent_slugs[:3])
    topic = metrics.root_title.split("—")[0].strip() or metrics.root_title[:48]
    if kind == "battle_intensified":
        title = f"Battle intensified — {topic}"
        body = (
            f"{agents} are publicly split ({metrics.reply_count} replies, "
            f"{metrics.conviction_gap}-pt conviction gap)."
        )
    elif kind == "consensus_shift":
        title = f"Consensus shift on {topic}"
        body = (
            f"Network repricing after {metrics.reply_count} public counters. "
            f"{agents} no longer aligned."
        )
    else:
        title = f"Network shift — {topic}"
        body = (
            f"Desk attention clustering on {topic}. "
            f"{metrics.reply_count} replies pulled {agents} into the open."
        )
    return title, body


def create_thread_network_event(
    db: Session,
    *,
    metrics: ThreadHeatMetrics,
    kind: str,
    agents: dict[str, Agent],
    markets: list[Market],
    session_by_id: dict[str, AgentGeneratedActivity],
    seed: int,
    mirror_to_feed: bool,
    recent_hashes: set[str],
) -> AgentGeneratedActivity | None:
    from app.forecasting.services import agent_activity_engine as engine

    speaker_slug = metrics.agent_slugs[hash_seed(metrics.thread_id, kind, str(seed)) % len(metrics.agent_slugs)]
    speaker = agents.get(speaker_slug)
    if not speaker:
        return None

    title, body = _network_event_copy(kind, metrics)
    body = polish_copy(speaker_slug, body, seed=seed)
    if engine.violates_forbidden_topics(speaker_slug, body):
        return None

    from app.forecasting.services.copy_sanitize import finalize_persisted_copy

    title, body, san_meta = finalize_persisted_copy(speaker_slug, title, body, seed=seed)
    if san_meta:
        meta_pre = san_meta
    else:
        meta_pre = {}

    h = engine.body_hash(body)
    if h in recent_hashes:
        return None

    market = None
    root_rows = collect_thread_rows(metrics.thread_id, session_by_id)
    root = root_rows[0] if root_rows else None
    if root and root.related_market_slug:
        hint = root.related_market_slug.replace("-", " ")
        for m in markets:
            if hint in m.title.lower():
                market = m
                break
    if not market and markets:
        market = markets[hash_seed(speaker_slug, metrics.thread_id) % len(markets)]

    meta: dict[str, Any] = {
        "event_kind": kind,
        "network_event_kind": kind,
        "thread_id": metrics.thread_id,
        "thread_reply_count": metrics.reply_count,
        "conviction_gap": metrics.conviction_gap,
        "credibility_mismatch": metrics.credibility_mismatch,
        "thread_agents": list(metrics.agent_slugs),
        "trigger_id": f"thread_network_{kind}",
        "activity_type": "network_pulse",
        "system_event_label": title,
    }
    meta.update(meta_pre)

    activity_id = str(uuid.uuid4())
    row = AgentGeneratedActivity(
        activity_id=activity_id,
        activity_type="network_pulse",
        agent_id=speaker.id,
        agent_slug=speaker.slug,
        title=title[:255],
        body=body,
        body_hash=h,
        related_market_slug=title_to_slug(market.title) if market else (root.related_market_slug if root else None),
        related_battle_slug=root.related_battle_slug if root else None,
        trigger_id=meta["trigger_id"],
        metadata_json=meta,
        thread_id=metrics.thread_id,
        parent_activity_id=None,
        created_at=_utcnow() + timedelta(minutes=7),
    )
    meta["thread_id"] = row.thread_id
    meta["generated_activity_id"] = row.activity_id

    if mirror_to_feed:
        feed_ev = engine._mirror_feed_event(
            db,
            agent=speaker,
            market=market,
            activity_type="network_pulse",
            title=title,
            body=body,
            meta=meta,
            related_battle_slug=row.related_battle_slug,
        )
        if feed_ev:
            row.mirrored_feed_event_id = feed_ev.id

    db.add(row)
    recent_hashes.add(h)
    session_by_id[row.activity_id] = row
    return row


def maybe_emit_thread_network_events(
    db: Session,
    *,
    thread_id: str,
    session_by_id: dict[str, AgentGeneratedActivity],
    agents: dict[str, Agent],
    markets: list[Market],
    seed: int,
    mirror_to_feed: bool,
    recent_hashes: set[str],
    emitted_threads: set[str],
) -> list[AgentGeneratedActivity]:
    """Emit at most one network reaction per heated thread."""
    if thread_id in emitted_threads:
        return []
    metrics = analyze_thread_heat(thread_id, session_by_id)
    if not metrics:
        return []

    roll_seed = hash_seed(thread_id, str(seed), "thread_network")
    if not _roll(roll_seed, 0.55):
        return []

    kind = pick_network_event_kind(metrics, roll_seed)
    row = create_thread_network_event(
        db,
        metrics=metrics,
        kind=kind,
        agents=agents,
        markets=markets,
        session_by_id=session_by_id,
        seed=roll_seed,
        mirror_to_feed=mirror_to_feed,
        recent_hashes=recent_hashes,
    )
    if not row:
        return []
    emitted_threads.add(thread_id)
    return [row]


def _thread_metrics_from_rows(thread: dict[str, Any]) -> ThreadHeatMetrics | None:
    """Build pulse metrics from a loaded thread without heat thresholds."""
    rows: list[AgentGeneratedActivity] = thread.get("rows") or []
    if len(rows) < 2:
        return None
    root: AgentGeneratedActivity = thread.get("root") or rows[0]
    replies = [r for r in rows if r.parent_activity_id]
    deltas = [_credibility_delta(r) for r in rows]
    conviction_gap = max(deltas) - min(deltas) if len(deltas) >= 2 else 4
    positive = sum(1 for d in deltas if d > 2)
    negative = sum(1 for d in deltas if d < -2)
    credibility_mismatch = positive >= 1 and negative >= 1
    return ThreadHeatMetrics(
        thread_id=thread["thread_id"],
        reply_count=max(len(replies), 1),
        conviction_gap=max(conviction_gap, 4),
        credibility_mismatch=credibility_mismatch,
        agent_slugs=tuple(dict.fromkeys(r.agent_slug for r in rows)),
        root_title=root.title,
        root_slug=root.agent_slug,
    )


def create_thread_summary_pulse(
    db: Session,
    thread: dict[str, Any],
    *,
    agents: dict[str, Agent],
    markets: list[Market],
    session_by_id: dict[str, AgentGeneratedActivity],
    seed: int,
    mirror_to_feed: bool,
    recent_hashes: set[str],
) -> AgentGeneratedActivity | None:
    """Summarize a capped thread as a network_pulse (autonomous recovery path)."""
    metrics = _thread_metrics_from_rows(thread)
    if not metrics:
        return None
    kind = pick_network_event_kind(metrics, seed)
    return create_thread_network_event(
        db,
        metrics=metrics,
        kind=kind,
        agents=agents,
        markets=markets,
        session_by_id=session_by_id,
        seed=seed,
        mirror_to_feed=mirror_to_feed,
        recent_hashes=recent_hashes,
    )
