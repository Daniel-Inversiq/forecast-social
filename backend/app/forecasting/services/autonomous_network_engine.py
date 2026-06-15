"""Autonomous Network Engine v1 — living agent network with paced background ticks."""

from __future__ import annotations

import asyncio
import math
import random
import re
import zlib
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy.orm import Session

from app.forecasting.agent_status import CORE_AGENT_SLUGS, query_active_agents
from app.forecasting.character_bibles import character_bible_for
from app.forecasting.models import (
    Agent,
    AgentGeneratedActivity,
    AgentReputation,
    AgentState,
    FeedEvent,
    ForecastResolution,
    Market,
    MarketTake,
    NetworkNarrative,
    ReputationEvent,
)
from app.forecasting.services.agent_activity_engine import (
    ActivityTrigger,
    _cascade_social_responses,
    _load_recent_hashes,
    _persist_trigger_activity,
)
from app.forecasting.services.battle_detection import detect_battles
from app.forecasting.services.conversation_threads import can_extend_thread, thread_root_id
from app.forecasting.services.narrative_clustering import NARRATIVE_TEMPLATES
from app.forecasting.services.receipt_warfare import (
    create_receipt_warfare_activity,
    pick_receipt_rival,
)
from app.forecasting.services.rivalry_engine import (
    create_rival_reply_activity,
    pick_rival_responder,
    rival_pick_failure,
)
from app.forecasting.services.utils import hash_seed, title_to_slug

# Scheduler cadence (seconds)
MIN_CADENCE_SECONDS = 60
MAX_CADENCE_SECONDS = 300

# Daily activity budget — target 20-80, never hundreds per hour
MIN_DAILY_ACTIVITIES = 20
MAX_DAILY_ACTIVITIES = 80
MAX_ACTIVITIES_PER_TICK = 2

from app.forecasting.services.feed_cooling_policy import (
    CoolingState,
    COOLDOWN_SLOT_MIX,
    RECEIPT_ACTIVITY_TYPES,
    compute_cooling_state,
    count_autonomous_fresh_receipts_since,
    is_calm_cooldown,
    resolve_cooled_slot_plan,
    select_thread_pool,
    should_allow_resolution_receipt,
    should_suppress_receipt_generation,
    should_suppress_rivalry_cascade,
)
from app.forecasting.services.calm_thread_engine import (
    create_calm_thread_reply,
    pick_calm_format,
    pick_calm_responder,
)
from app.forecasting.services.thread_continuation_policy import (
    ACTIVE_THREAD_HOURS,
    NARRATIVE_CONTINUE_CHANCE,
    NEW_ROOT_CHANCE,
    RECEIPT_MOMENT_CHANCE,
    RIVALRY_REPLY_TYPES,
    THREAD_CONTINUE_CHANCE,
    blocks_late_root_after_quote,
    blocks_preemptive_quote,
    compute_continuation_metrics,
    find_reply_source_for_narrative,
    narrative_has_participants,
    narrative_is_contested,
    score_narrative_for_agent,
    stamp_continuation_kind,
)
from app.forecasting.services.thread_lifecycle import (
    init_thread_lifecycle_on_root,
    prepare_lifecycle_thread_context,
    record_autonomous_thread_activity,
)

RESOLUTION_REACTION_LOOKBACK_HOURS = 6

ACTION_TYPES = (
    "create_forecast",
    "conviction_update",
    "reply_to_rival",
    "start_battle",
    "reinforce_narrative",
    "stay_silent",
)

from app.forecasting.services.activity_failure import record_failure
from app.forecasting.services.activity_generation_sources import (
    ACTIVITY_SOURCE_AUTONOMOUS,
    ACTIVITY_SOURCE_MANUAL_DEV,
    stamp_activities_source,
)
from app.forecasting.services.autonomous_recovery import (
    apply_recovery_to_decision,
    recover_continue_thread_failure,
    recover_weighted_action_failure,
)
from app.forecasting.services.dev_resolution_simulation import (
    DEV_RESOLUTION_SOURCE,
    maybe_simulate_dev_resolution_candidate,
)
from app.forecasting.services.resolution_receipt_status import resolution_has_handling_receipt
from app.forecasting.services.receipt_pipeline_debug import (
    clear_receipt_attempt_log,
    compute_receipt_pipeline_metrics,
    record_receipt_generation_attempt,
)

_engine_running = False
_engine_task: asyncio.Task | None = None
_next_tick_at: datetime | None = None
_last_tick_at: datetime | None = None
_last_cadence_seconds: int | None = None
_last_tick_summary: dict[str, Any] | None = None
_decision_log: list[dict[str, Any]] = []
MAX_DECISION_LOG = 20


def _utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _roll(seed: int, threshold: float) -> bool:
    bucket = zlib.crc32(f"autonomous:{seed}:{threshold:.4f}".encode()) % 10_000
    return bucket < int(threshold * 10_000)


HEAT_MODEL_AUTONOMOUS_V1 = "autonomous_v1"
HEAT_WEIGHT_1H = 1.00
HEAT_WEIGHT_6H = 0.45
HEAT_WEIGHT_24H = 0.15
AUTONOMOUS_CONVICTION_GAP_HOURS = 6


@dataclass
class LegacyNetworkHeatSnapshot:
    network_heat_score: float
    active_battles: int
    conviction_gaps: float
    reply_velocity: float
    receipt_frequency: float


@dataclass
class AutonomousNetworkHeatSnapshot:
    network_heat_score: float
    heat_model: str
    battle_score: float
    velocity_score: float
    receipt_score: float
    gap_score: float
    heat_driver: str
    weighted_active_battle_pairs: float
    weighted_replies: float
    weighted_autonomous_receipts: float
    autonomous_conviction_gap: float

    def to_exposure_dict(self, *, legacy: LegacyNetworkHeatSnapshot) -> dict[str, Any]:
        return {
            "network_heat": self.network_heat_score,
            "legacy_network_heat": legacy.network_heat_score,
            "heat_model": self.heat_model,
            "battle_score": self.battle_score,
            "velocity_score": self.velocity_score,
            "receipt_score": self.receipt_score,
            "gap_score": self.gap_score,
            "heat_driver": self.heat_driver,
            "weighted_active_battle_pairs": self.weighted_active_battle_pairs,
            "weighted_replies": self.weighted_replies,
            "weighted_autonomous_receipts": self.weighted_autonomous_receipts,
        }


# Primary heat snapshot used by rate limiter and tick pacing.
NetworkHeatSnapshot = AutonomousNetworkHeatSnapshot


@dataclass
class TickResult:
    skipped: bool = False
    reason: str = ""
    activities_created: list[AgentGeneratedActivity] = field(default_factory=list)
    resolutions_processed: int = 0
    network_heat: float = 0.0
    seed: int = 0
    decisions: list[dict[str, Any]] = field(default_factory=list)


def _record_decision(entry: dict[str, Any]) -> None:
    """Append to the in-memory ring buffer (newest first)."""
    global _decision_log
    payload = {"at": _utcnow().isoformat(), **entry}
    _decision_log.insert(0, payload)
    del _decision_log[MAX_DECISION_LOG:]


def get_decision_log(*, limit: int = MAX_DECISION_LOG) -> list[dict[str, Any]]:
    return list(_decision_log[:limit])


def clear_decision_log() -> None:
    global _decision_log
    _decision_log = []
    clear_receipt_attempt_log()


def is_engine_running() -> bool:
    return _engine_running


def ensure_narratives_initialized(db: Session) -> list[NetworkNarrative]:
    """Seed persistent narrative objects from the template catalog."""
    existing = {n.narrative_id: n for n in db.query(NetworkNarrative).all()}
    created: list[NetworkNarrative] = []
    for template in NARRATIVE_TEMPLATES:
        nid = template["id"]
        if nid in existing:
            continue
        row = NetworkNarrative(
            narrative_id=nid,
            label=template["label"],
            heat=25.0 + hash_seed(nid) % 20,
            supporters_json=[],
            opponents_json=[],
            recent_activity_json=[],
            keywords_json=list(template.get("keywords") or []),
            updated_at=_utcnow(),
        )
        db.add(row)
        created.append(row)
    if created:
        db.commit()
    return list(existing.values()) + created


def _activity_source_expr(source: str):
    return AgentGeneratedActivity.metadata_json["source"].as_string() == source


def count_activities_since(db: Session, *, hours: int = 24) -> int:
    """All generated activities in the window (any source)."""
    cutoff = _utcnow() - timedelta(hours=hours)
    return (
        db.query(AgentGeneratedActivity)
        .filter(
            AgentGeneratedActivity.created_at >= cutoff,
            AgentGeneratedActivity.activity_type != "network_briefing_item",
        )
        .count()
    )


def count_autonomous_activities_since(db: Session, *, hours: int = 24) -> int:
    """Only autonomous-network tick activities count toward the daily cap."""
    cutoff = _utcnow() - timedelta(hours=hours)
    return (
        db.query(AgentGeneratedActivity)
        .filter(
            AgentGeneratedActivity.created_at >= cutoff,
            AgentGeneratedActivity.activity_type != "network_briefing_item",
            _activity_source_expr(ACTIVITY_SOURCE_AUTONOMOUS),
        )
        .count()
    )


def count_receipts_since(db: Session, *, hours: int = 24) -> int:
    """All receipt activities in the window (legacy metric)."""
    cutoff = _utcnow() - timedelta(hours=hours)
    return (
        db.query(AgentGeneratedActivity)
        .filter(
            AgentGeneratedActivity.created_at >= cutoff,
            AgentGeneratedActivity.activity_type.in_(
                ("receipt_reaction", "receipt_challenge", "receipt_victory")
            ),
        )
        .count()
    )


def _load_active_threads(db: Session, *, hours: int = 48) -> list[dict[str, Any]]:
    cutoff = _utcnow() - timedelta(hours=hours)
    rows = (
        db.query(AgentGeneratedActivity)
        .filter(
            AgentGeneratedActivity.created_at >= cutoff,
            AgentGeneratedActivity.thread_id.isnot(None),
        )
        .order_by(AgentGeneratedActivity.created_at.desc())
        .limit(300)
        .all()
    )
    by_thread: dict[str, list[AgentGeneratedActivity]] = defaultdict(list)
    for row in rows:
        tid = thread_root_id(row)
        by_thread[tid].append(row)

    active: list[dict[str, Any]] = []
    for tid, thread_rows in by_thread.items():
        thread_rows.sort(key=lambda r: r.created_at or datetime.min)
        if not thread_rows:
            continue
        latest = thread_rows[-1]
        if latest.created_at and latest.created_at >= cutoff:
            active.append(
                {
                    "thread_id": tid,
                    "rows": thread_rows,
                    "latest": latest,
                    "root": thread_rows[0],
                    "reply_count": max(len(thread_rows) - 1, 0),
                }
            )
    active.sort(key=lambda t: t["latest"].created_at or datetime.min, reverse=True)
    return active


def _lifecycle_thread_context(
    db: Session,
    threads: list[dict[str, Any]],
    *,
    persist: bool = True,
) -> dict[str, Any]:
    return prepare_lifecycle_thread_context(db, threads, persist=persist)


def _thread_has_extendable_headroom(
    thread: dict[str, Any],
    *,
    db: Session,
    session_by_id: dict[str, AgentGeneratedActivity],
    seed: int,
    cooling: CoolingState | None = None,
) -> bool:
    latest: AgentGeneratedActivity = thread["latest"]
    cooling = cooling or CoolingState()
    if is_calm_cooldown(cooling):
        responder = pick_calm_responder(
            latest.agent_slug,
            seed,
            exclude={latest.agent_slug},
        )
    else:
        responder = pick_rival_responder(
            latest.agent_slug,
            seed,
            exclude={latest.agent_slug},
        )
    if not responder:
        return False
    return can_extend_thread(db, latest, responder, by_id=session_by_id)


def _extendable_threads(
    threads: list[dict[str, Any]],
    *,
    db: Session,
    session_by_id: dict[str, AgentGeneratedActivity],
    seed: int,
    cooling: CoolingState | None = None,
) -> list[dict[str, Any]]:
    return [
        thread
        for thread in threads
        if _thread_has_extendable_headroom(
            thread, db=db, session_by_id=session_by_id, seed=seed, cooling=cooling
        )
    ]


def _ordered_thread_candidates(
    threads: list[dict[str, Any]],
    slot_seed: int,
) -> list[dict[str, Any]]:
    if not threads:
        return []
    start = slot_seed % len(threads)
    return threads[start:] + threads[:start]


def _attempt_immediate_rival_reply(
    db: Session,
    root: AgentGeneratedActivity,
    *,
    agents: dict[str, Agent],
    markets: list[Market],
    recent_hashes: set[str],
    session_by_id: dict[str, AgentGeneratedActivity],
    seed: int,
    mirror_to_feed: bool,
    failure_out: dict[str, Any] | None = None,
) -> AgentGeneratedActivity | None:
    responder = pick_rival_responder(
        root.agent_slug,
        seed,
        exclude={root.agent_slug},
    )
    if not responder:
        return None
    row = create_rival_reply_activity(
        db,
        responder_slug=responder,
        target_slug=root.agent_slug,
        source=root,
        order=1,
        seed=seed + 41,
        mirror_to_feed=mirror_to_feed,
        recent_hashes=recent_hashes,
        agents=agents,
        markets=markets,
        session_by_id=session_by_id,
        failure_out=failure_out,
    )
    if row:
        stamp_continuation_kind(row, "thread_continuation")
    return row


def _bootstrap_threadable_root_and_reply(
    db: Session,
    agent: Agent,
    *,
    agents: dict[str, Agent],
    markets: list[Market],
    recent_hashes: set[str],
    session_by_id: dict[str, AgentGeneratedActivity],
    slot_seed: int,
    mirror_to_feed: bool,
    created_len: int,
    global_recent: set[str],
    narrative: NetworkNarrative | None = None,
    failure_out: dict[str, Any] | None = None,
) -> tuple[list[AgentGeneratedActivity], str]:
    """Create an explicitly threadable root, then attempt one rival reply in-tick."""
    narrative = narrative or _pick_narrative_for_agent(
        db, agent, seed=slot_seed, prefer_contested=True
    )
    trigger = (
        _build_narrative_trigger(db, "create_forecast", agent, narrative, seed=slot_seed)
        if narrative
        else _build_trigger_for_action("create_forecast", agent, narrative, seed=slot_seed)
    )
    root = _persist_trigger_activity(
        db,
        trigger=trigger,
        agents=agents,
        markets=markets,
        recent_hashes=recent_hashes,
        session_by_id=session_by_id,
        base_seed=slot_seed,
        created_len=created_len,
        mirror_to_feed=mirror_to_feed,
        attempt=0,
        global_recent=global_recent,
        failure_out=failure_out,
    )
    if not root:
        return [], "bootstrap_failed"

    stamp_continuation_kind(root, "new_root_post")
    init_thread_lifecycle_on_root(root)
    meta = dict(root.metadata_json or {})
    meta["threadable"] = True
    root.metadata_json = meta
    if narrative and not meta.get("narrative_stage"):
        _stamp_narrative_progression(db, root, narrative, seed=slot_seed)

    created = [root]
    reply = _attempt_immediate_rival_reply(
        db,
        root,
        agents=agents,
        markets=markets,
        recent_hashes=recent_hashes,
        session_by_id=session_by_id,
        seed=slot_seed,
        mirror_to_feed=mirror_to_feed,
        failure_out=failure_out,
    )
    if reply:
        created.append(reply)
    return created, "bootstrap_thread"


def _try_continue_threads(
    db: Session,
    threads: list[dict[str, Any]],
    *,
    agents: dict[str, Agent],
    markets: list[Market],
    recent_hashes: set[str],
    session_by_id: dict[str, AgentGeneratedActivity],
    slot_seed: int,
    mirror_to_feed: bool,
    failure_out: dict[str, Any] | None = None,
    cooling: CoolingState | None = None,
) -> tuple[AgentGeneratedActivity | None, dict[str, Any] | None]:
    candidates = _ordered_thread_candidates(threads, slot_seed)
    last_thread: dict[str, Any] | None = None
    for offset, thread in enumerate(candidates):
        last_thread = thread
        row = _continue_thread(
            db,
            thread,
            agents=agents,
            markets=markets,
            recent_hashes=recent_hashes,
            session_by_id=session_by_id,
            base_seed=slot_seed + offset * 31,
            mirror_to_feed=mirror_to_feed,
            failure_out=failure_out,
            cooling=cooling,
        )
        if row:
            if not (row.metadata_json or {}).get("continuation_kind"):
                stamp_continuation_kind(row, "thread_continuation")
            record_autonomous_thread_activity(db, thread)
            return row, thread
    return None, last_thread


def _serialize_thread(thread: dict[str, Any]) -> dict[str, Any]:
    root: AgentGeneratedActivity = thread["root"]
    latest: AgentGeneratedActivity = thread["latest"]
    rows: list[AgentGeneratedActivity] = thread["rows"]
    return {
        "thread_id": thread["thread_id"],
        "reply_count": max(len(rows) - 1, 0),
        "depth": len(rows),
        "participants": list(dict.fromkeys(r.agent_slug for r in rows)),
        "root_title": root.title,
        "root_agent_slug": root.agent_slug,
        "latest_agent_slug": latest.agent_slug,
        "latest_activity_type": latest.activity_type,
        "latest_at": latest.created_at.isoformat() if latest.created_at else None,
        "thread_lifecycle": thread.get("thread_lifecycle"),
    }


def _serialize_narrative(narrative: NetworkNarrative) -> dict[str, Any]:
    return {
        "narrative_id": narrative.narrative_id,
        "label": narrative.label,
        "heat": round(float(narrative.heat), 1),
        "supporters": list(narrative.supporters_json or []),
        "opponents": list(narrative.opponents_json or []),
        "recent_activity": list(narrative.recent_activity_json or [])[:5],
        "keywords": list(narrative.keywords_json or []),
        "updated_at": narrative.updated_at.isoformat() if narrative.updated_at else None,
    }


def _top_rivalries(db: Session, *, limit: int = 8) -> list[dict[str, Any]]:
    pair_scores: dict[tuple[str, str], dict[str, Any]] = {}

    for agent in query_active_agents(db):
        if agent.slug not in CORE_AGENT_SLUGS:
            continue
        state = db.query(AgentState).filter(AgentState.agent_id == agent.id).first()
        if not state or not state.state_json:
            continue
        for rival_slug, data in (state.state_json.get("rivals") or {}).items():
            if rival_slug not in CORE_AGENT_SLUGS:
                continue
            heat = int((data or {}).get("heat", 0))
            if heat <= 0:
                continue
            key = tuple(sorted([agent.slug, rival_slug]))
            bucket = pair_scores.setdefault(
                key,
                {
                    "agent_a_slug": key[0],
                    "agent_b_slug": key[1],
                    "memory_heat": 0,
                    "battle_score": 0.0,
                },
            )
            bucket["memory_heat"] = max(bucket["memory_heat"], heat)

    agents = query_active_agents(db)
    markets = db.query(Market).all()
    since_24h = _utcnow() - timedelta(hours=24)
    events = (
        db.query(FeedEvent)
        .filter(FeedEvent.created_at >= since_24h)
        .limit(400)
        .all()
    )
    takes = (
        db.query(MarketTake)
        .filter(MarketTake.created_at >= since_24h)
        .limit(400)
        .all()
    )
    for battle in detect_battles(agents, events, takes, markets, limit=limit * 2):
        key = tuple(sorted([battle["agent_a"]["slug"], battle["agent_b"]["slug"]]))
        bucket = pair_scores.setdefault(
            key,
            {
                "agent_a_slug": key[0],
                "agent_b_slug": key[1],
                "memory_heat": 0,
                "battle_score": 0.0,
            },
        )
        bucket["battle_score"] = max(bucket["battle_score"], float(battle["disagreement_score"]))
        bucket["intensity"] = battle.get("intensity")
        bucket["contested_market"] = battle.get("market_title")

    ranked: list[dict[str, Any]] = []
    for bucket in pair_scores.values():
        combined = bucket["memory_heat"] * 2.0 + bucket["battle_score"]
        ranked.append(
            {
                **bucket,
                "combined_heat": round(combined, 1),
            }
        )
    ranked.sort(key=lambda item: -item["combined_heat"])
    return ranked[:limit]


def _heat_time_cutoffs() -> tuple[datetime, datetime, datetime]:
    now = _utcnow()
    return (
        now - timedelta(hours=24),
        now - timedelta(hours=6),
        now - timedelta(hours=1),
    )


def _weighted_bucket_count(n_1h: int, n_6h: int, n_24h: int) -> float:
    return (
        n_1h * HEAT_WEIGHT_1H
        + n_6h * HEAT_WEIGHT_6H
        + n_24h * HEAT_WEIGHT_24H
    )


def _bucket_row_counts(
    rows: list[AgentGeneratedActivity],
    *,
    since_24h: datetime,
    since_6h: datetime,
    since_1h: datetime,
) -> tuple[int, int, int]:
    n_1h = n_6h = n_24h = 0
    for row in rows:
        created_at = row.created_at
        if created_at is None or created_at < since_24h:
            continue
        if created_at >= since_1h:
            n_1h += 1
        elif created_at >= since_6h:
            n_6h += 1
        else:
            n_24h += 1
    return n_1h, n_6h, n_24h


def _is_autonomous_clash_row(row: AgentGeneratedActivity) -> bool:
    meta = row.metadata_json or {}
    if meta.get("source") != ACTIVITY_SOURCE_AUTONOMOUS:
        return False
    if row.activity_type in RIVALRY_REPLY_TYPES:
        return True
    if meta.get("continuation_kind") == "rivalry_reply":
        return True
    if row.activity_type == "battle_response":
        return True
    return False


def _clash_opponent_slug(
    row: AgentGeneratedActivity,
    *,
    by_activity_id: dict[str, AgentGeneratedActivity],
) -> str | None:
    meta = row.metadata_json or {}
    counter_target = meta.get("counter_target")
    if isinstance(counter_target, str) and counter_target and counter_target != row.agent_slug:
        return counter_target
    parent_id = row.parent_activity_id
    if parent_id:
        parent = by_activity_id.get(parent_id)
        if parent and parent.agent_slug and parent.agent_slug != row.agent_slug:
            return parent.agent_slug
    return None


def _weighted_autonomous_battle_pairs(
    rows: list[AgentGeneratedActivity],
    *,
    since_24h: datetime,
    since_6h: datetime,
    since_1h: datetime,
) -> float:
    by_activity_id = {row.activity_id: row for row in rows if row.activity_id}
    pairs_1h: set[tuple[str, str]] = set()
    pairs_6h: set[tuple[str, str]] = set()
    pairs_24h: set[tuple[str, str]] = set()

    for row in rows:
        if not _is_autonomous_clash_row(row):
            continue
        opponent = _clash_opponent_slug(row, by_activity_id=by_activity_id)
        if not opponent or not row.agent_slug:
            continue
        pair = tuple(sorted((row.agent_slug, opponent)))
        created_at = row.created_at
        if created_at is None or created_at < since_24h:
            continue
        if created_at >= since_1h:
            pairs_1h.add(pair)
        elif created_at >= since_6h:
            pairs_6h.add(pair)
        else:
            pairs_24h.add(pair)

    return _weighted_bucket_count(len(pairs_1h), len(pairs_6h), len(pairs_24h))


def _autonomous_conviction_gap(db: Session) -> float:
    since_gap = _utcnow() - timedelta(hours=AUTONOMOUS_CONVICTION_GAP_HOURS)
    rows = (
        db.query(AgentGeneratedActivity)
        .filter(
            AgentGeneratedActivity.created_at >= since_gap,
            AgentGeneratedActivity.thread_id.isnot(None),
            _activity_source_expr(ACTIVITY_SOURCE_AUTONOMOUS),
        )
        .limit(300)
        .all()
    )
    by_thread: dict[str, list[AgentGeneratedActivity]] = defaultdict(list)
    for row in rows:
        by_thread[thread_root_id(row)].append(row)

    gap_scores: list[float] = []
    for thread_rows in by_thread.values():
        deltas = [
            (r.metadata_json or {}).get("credibility_delta", 0) for r in thread_rows
        ]
        numeric = [float(d) for d in deltas if isinstance(d, (int, float))]
        if len(numeric) >= 2:
            gap_scores.append(max(numeric) - min(numeric))
    if not gap_scores:
        return 0.0
    return sum(gap_scores) / len(gap_scores)


def _resolve_heat_driver(
    *,
    battle_score: float,
    velocity_score: float,
    receipt_score: float,
    gap_score: float,
) -> str:
    contributions = {
        "battles": battle_score * 0.40,
        "velocity": velocity_score * 0.30,
        "receipts": receipt_score * 0.15,
        "gaps": gap_score * 0.15,
    }
    return max(contributions, key=contributions.get)


def legacy_network_heat(db: Session) -> LegacyNetworkHeatSnapshot:
    """Legacy inventory heat from FeedEvent/MarketTake — debug only."""
    agents = query_active_agents(db)
    markets = db.query(Market).all()
    since_24h = _utcnow() - timedelta(hours=24)
    since_1h = _utcnow() - timedelta(hours=1)

    events = (
        db.query(FeedEvent)
        .filter(FeedEvent.created_at >= since_24h)
        .limit(400)
        .all()
    )
    takes = (
        db.query(MarketTake)
        .filter(MarketTake.created_at >= since_24h)
        .limit(400)
        .all()
    )
    battles = detect_battles(agents, events, takes, markets, limit=20)
    active_battles = len(
        [b for b in battles if b.get("intensity") in ("active", "heated", "legendary")]
    )

    threads = _load_active_threads(db, hours=ACTIVE_THREAD_HOURS)
    gap_scores: list[float] = []
    for thread in threads[:12]:
        deltas = [
            (r.metadata_json or {}).get("credibility_delta", 0)
            for r in thread["rows"]
        ]
        numeric = [float(d) for d in deltas if isinstance(d, (int, float))]
        if len(numeric) >= 2:
            gap_scores.append(max(numeric) - min(numeric))
    conviction_gaps = sum(gap_scores) / max(len(gap_scores), 1)

    replies_1h = (
        db.query(AgentGeneratedActivity)
        .filter(
            AgentGeneratedActivity.created_at >= since_1h,
            AgentGeneratedActivity.parent_activity_id.isnot(None),
        )
        .count()
    )
    reply_velocity = min(100.0, replies_1h * 12.0)

    receipts_24h = count_receipts_since(db, hours=24)
    receipt_frequency = min(100.0, receipts_24h * 8.0)

    raw = (
        active_battles * 8.0
        + conviction_gaps * 2.5
        + reply_velocity * 0.35
        + receipt_frequency * 0.25
    )
    network_heat_score = round(min(100.0, max(0.0, raw)), 1)

    return LegacyNetworkHeatSnapshot(
        network_heat_score=network_heat_score,
        active_battles=active_battles,
        conviction_gaps=round(conviction_gaps, 1),
        reply_velocity=round(reply_velocity, 1),
        receipt_frequency=round(receipt_frequency, 1),
    )


def compute_autonomous_network_heat(db: Session) -> AutonomousNetworkHeatSnapshot:
    """Autonomous-only network heat with time-weighted live signals."""
    since_24h, since_6h, since_1h = _heat_time_cutoffs()

    clash_rows = (
        db.query(AgentGeneratedActivity)
        .filter(
            AgentGeneratedActivity.created_at >= since_24h,
            _activity_source_expr(ACTIVITY_SOURCE_AUTONOMOUS),
        )
        .limit(500)
        .all()
    )
    weighted_active_battle_pairs = round(
        _weighted_autonomous_battle_pairs(
            clash_rows,
            since_24h=since_24h,
            since_6h=since_6h,
            since_1h=since_1h,
        ),
        2,
    )

    reply_rows = [
        row
        for row in clash_rows
        if row.parent_activity_id is not None
    ]
    reply_buckets = _bucket_row_counts(
        reply_rows,
        since_24h=since_24h,
        since_6h=since_6h,
        since_1h=since_1h,
    )
    weighted_replies = round(_weighted_bucket_count(*reply_buckets), 2)

    receipt_rows = [
        row
        for row in clash_rows
        if row.activity_type in RECEIPT_ACTIVITY_TYPES
    ]
    receipt_buckets = _bucket_row_counts(
        receipt_rows,
        since_24h=since_24h,
        since_6h=since_6h,
        since_1h=since_1h,
    )
    weighted_autonomous_receipts = round(_weighted_bucket_count(*receipt_buckets), 2)

    autonomous_conviction_gap = round(_autonomous_conviction_gap(db), 1)

    battle_score = round(
        min(100.0, 18.0 * math.sqrt(max(0.0, weighted_active_battle_pairs))),
        1,
    )
    velocity_score = round(min(100.0, weighted_replies * 15.0), 1)
    receipt_score = round(min(100.0, weighted_autonomous_receipts * 12.0), 1)
    gap_score = round(min(100.0, autonomous_conviction_gap * 8.0), 1)

    raw = (
        battle_score * 0.40
        + velocity_score * 0.30
        + receipt_score * 0.15
        + gap_score * 0.15
    )
    network_heat_score = round(min(100.0, max(0.0, raw)), 1)
    heat_driver = _resolve_heat_driver(
        battle_score=battle_score,
        velocity_score=velocity_score,
        receipt_score=receipt_score,
        gap_score=gap_score,
    )

    return AutonomousNetworkHeatSnapshot(
        network_heat_score=network_heat_score,
        heat_model=HEAT_MODEL_AUTONOMOUS_V1,
        battle_score=battle_score,
        velocity_score=velocity_score,
        receipt_score=receipt_score,
        gap_score=gap_score,
        heat_driver=heat_driver,
        weighted_active_battle_pairs=weighted_active_battle_pairs,
        weighted_replies=weighted_replies,
        weighted_autonomous_receipts=weighted_autonomous_receipts,
        autonomous_conviction_gap=autonomous_conviction_gap,
    )


def compute_network_heat(db: Session) -> AutonomousNetworkHeatSnapshot:
    """Primary network heat metric (autonomous v1)."""
    return compute_autonomous_network_heat(db)


def _agent_credibility(db: Session, agent: Agent) -> float:
    rep = db.query(AgentReputation).filter(AgentReputation.agent_id == agent.id).first()
    return float(rep.score if rep else 38.0)


def _recent_receipt_count(db: Session, agent: Agent, *, days: int = 30) -> int:
    since = _utcnow() - timedelta(days=days)
    return (
        db.query(ForecastResolution)
        .filter(
            ForecastResolution.agent_id == agent.id,
            ForecastResolution.resolved_at >= since,
        )
        .count()
    )


def _rival_heat(db: Session, agent: Agent) -> int:
    state = db.query(AgentState).filter(AgentState.agent_id == agent.id).first()
    if not state or not state.state_json:
        return 0
    rivals = state.state_json.get("rivals") or {}
    return max((int(v.get("heat", 0)) for v in rivals.values()), default=0)


def _parse_credibility_baseline(raw: Any) -> float:
    if raw is None:
        return 50.0
    if isinstance(raw, (int, float)):
        return float(raw)
    match = re.search(r"\d+", str(raw))
    return float(match.group()) if match else 50.0


def _personality_activity_bias(slug: str) -> dict[str, float]:
    bible = character_bible_for(slug)
    enemies = len(bible.get("recurring_enemies") or [])
    favorites = len(bible.get("favorite_narratives") or [])
    baseline = _parse_credibility_baseline(bible.get("credibility_baseline")) / 100.0
    return {
        "reply_to_rival": 0.04 * enemies,
        "start_battle": 0.05 * enemies,
        "reinforce_narrative": 0.03 * favorites,
        "create_forecast": 0.02 * favorites,
        "conviction_update": 0.02 * baseline,
        "stay_silent": -0.03 * baseline,
    }


def _action_weights(
    agent: Agent,
    *,
    db: Session,
    heat: NetworkHeatSnapshot,
    has_active_thread: bool,
) -> dict[str, float]:
    credibility = _agent_credibility(db, agent)
    receipts = _recent_receipt_count(db, agent)
    rival_heat = _rival_heat(db, agent)
    personality = _personality_activity_bias(agent.slug)

    weights = {
        "create_forecast": 0.04,
        "conviction_update": 0.12,
        "reply_to_rival": 0.32,
        "start_battle": 0.14,
        "reinforce_narrative": 0.28,
        "stay_silent": 0.10,
    }

    cred_factor = (credibility - 38.0) / 62.0
    weights["conviction_update"] += 0.06 * cred_factor
    weights["create_forecast"] -= 0.02 * cred_factor
    weights["stay_silent"] -= 0.06 * cred_factor

    weights["reply_to_rival"] += 0.10 * min(rival_heat / 10.0, 1.0)
    weights["start_battle"] += 0.08 * min(rival_heat / 8.0, 1.0)
    weights["reinforce_narrative"] += 0.06 * min(receipts / 5.0, 1.0)

    heat_factor = heat.network_heat_score / 100.0
    weights["reply_to_rival"] += 0.10 * heat_factor
    weights["start_battle"] += 0.08 * heat_factor
    weights["stay_silent"] -= 0.08 * heat_factor

    if has_active_thread:
        weights["reply_to_rival"] += 0.18
        weights["reinforce_narrative"] += 0.10
        weights["create_forecast"] -= 0.03
    if rival_heat >= 4:
        weights["reply_to_rival"] += 0.12
        weights["create_forecast"] -= 0.02

    for action, delta in personality.items():
        weights[action] = weights.get(action, 0.0) + delta

    for key in weights:
        weights[key] = max(0.01, weights[key])
    return weights


def _pick_weighted_action(weights: dict[str, float], seed: int) -> str:
    items = list(weights.items())
    total = sum(w for _, w in items)
    pick = hash_seed("action", str(seed)) % int(total * 1000)
    cursor = 0
    for action, weight in items:
        cursor += int(weight * 1000)
        if pick < cursor:
            return action
    return items[-1][0]


def _pick_narrative_for_agent(
    db: Session,
    agent: Agent,
    *,
    seed: int,
    prefer_contested: bool = True,
) -> NetworkNarrative | None:
    narratives = db.query(NetworkNarrative).order_by(NetworkNarrative.heat.desc()).all()
    if not narratives:
        return None
    bible = character_bible_for(agent.slug)
    favorites = {n.lower() for n in (bible.get("favorite_narratives") or [])}
    hated = {n.lower() for n in (bible.get("hated_narratives") or [])}

    scored: list[tuple[float, NetworkNarrative]] = []
    for narrative in narratives:
        if prefer_contested and not narrative_has_participants(narrative):
            continue
        score = score_narrative_for_agent(
            narrative,
            agent,
            seed=seed,
            bible_favorites=favorites,
            bible_hated=hated,
        )
        scored.append((score, narrative))

    if not scored:
        for narrative in narratives:
            score = score_narrative_for_agent(
                narrative,
                agent,
                seed=seed,
                bible_favorites=favorites,
                bible_hated=hated,
            )
            scored.append((score, narrative))

    scored.sort(key=lambda x: -x[0])
    return scored[0][1]


def _narrative_market_hint(narrative: NetworkNarrative) -> str | None:
    keywords = narrative.keywords_json or []
    return keywords[0] if keywords else narrative.narrative_id.replace("-", " ")


def _update_narrative_after_activity(
    db: Session,
    narrative: NetworkNarrative,
    *,
    agent_slug: str,
    activity_type: str,
    title: str,
    stance: str = "support",
) -> None:
    supporters = list(narrative.supporters_json or [])
    opponents = list(narrative.opponents_json or [])
    if stance == "support" and agent_slug not in supporters:
        supporters.append(agent_slug)
        opponents = [s for s in opponents if s != agent_slug]
    elif stance == "oppose" and agent_slug not in opponents:
        opponents.append(agent_slug)
        supporters = [s for s in supporters if s != agent_slug]

    recent = list(narrative.recent_activity_json or [])
    recent.insert(
        0,
        {
            "agent_slug": agent_slug,
            "activity_type": activity_type,
            "title": title[:120],
            "at": _utcnow().isoformat(),
        },
    )
    narrative.supporters_json = supporters[:12]
    narrative.opponents_json = opponents[:12]
    narrative.recent_activity_json = recent[:20]
    narrative.heat = min(100.0, narrative.heat + (3.0 if stance == "support" else 4.5))
    narrative.updated_at = _utcnow()


def _tick_activity_probability(activities_24h: int, heat: NetworkHeatSnapshot) -> float:
    if activities_24h >= MAX_DAILY_ACTIVITIES:
        return 0.0
    if activities_24h < MIN_DAILY_ACTIVITIES:
        return 0.75 + 0.15 * (heat.network_heat_score / 100.0)
    remaining = MAX_DAILY_ACTIVITIES - activities_24h
    base = 0.12 + 0.25 * (remaining / MAX_DAILY_ACTIVITIES)
    return min(0.85, base + 0.20 * (heat.network_heat_score / 100.0))


def _activities_this_tick(activities_24h: int, heat: NetworkHeatSnapshot, seed: int) -> int:
    if activities_24h >= MAX_DAILY_ACTIVITIES:
        return 0
    prob = _tick_activity_probability(activities_24h, heat)
    if not _roll(seed, prob):
        return 0
    if activities_24h < MIN_DAILY_ACTIVITIES:
        return 1 + (1 if _roll(seed + 1, 0.35) else 0)
    return 1 + (1 if _roll(seed + 2, 0.18 + heat.network_heat_score / 500.0) else 0)


def _build_narrative_trigger(
    db: Session,
    action: str,
    agent: Agent,
    narrative: NetworkNarrative,
    *,
    seed: int,
) -> ActivityTrigger:
    """Build a trigger with narrative progression stage for thesis evolution."""
    from app.forecasting.services.narrative_progression import enrich_trigger_narrative_progression

    trigger = _build_trigger_for_action(action, agent, narrative, seed=seed)
    return enrich_trigger_narrative_progression(
        db,
        trigger,
        narrative_id=narrative.narrative_id,
        narrative_label=narrative.label,
        seed=seed,
    )


def _stamp_narrative_progression(
    db: Session,
    row: AgentGeneratedActivity,
    narrative: NetworkNarrative,
    *,
    seed: int,
) -> None:
    """Attach narrative arc metadata when narrative is bound after generation."""
    from app.forecasting.services.narrative_progression import stamp_activity_narrative_progression

    meta = row.metadata_json or {}
    if meta.get("narrative_stage"):
        return
    stamp_activity_narrative_progression(
        db,
        row,
        narrative_id=narrative.narrative_id,
        narrative_label=narrative.label,
        seed=seed,
    )


def _build_trigger_for_action(
    action: str,
    agent: Agent,
    narrative: NetworkNarrative | None,
    *,
    seed: int,
) -> ActivityTrigger:
    label = narrative.label if narrative else "network read"
    hint = _narrative_market_hint(narrative) if narrative else None
    rival = None
    if narrative and (narrative.opponents_json or narrative.supporters_json):
        pool = narrative.opponents_json or narrative.supporters_json or []
        if pool:
            rival = pool[hash_seed(agent.slug, str(seed)) % len(pool)]

    if action == "conviction_update":
        return ActivityTrigger(
            f"auto_conviction_{seed}",
            "conviction_update",
            agent.slug,
            f"{label} — conviction shift",
            "conviction_shift",
            market_hint=hint,
            counter_target=rival,
        )
    if action == "start_battle":
        return ActivityTrigger(
            f"auto_battle_{seed}",
            "battle_response",
            agent.slug,
            f"Battle line on {label}",
            "battle_escalation",
            market_hint=hint,
            counter_target=rival,
        )
    if action == "reinforce_narrative":
        return ActivityTrigger(
            f"auto_reinforce_{seed}",
            "agent_post",
            agent.slug,
            f"Reinforcing {label}",
            "narrative_reinforce",
            market_hint=hint,
        )
    return ActivityTrigger(
        f"auto_forecast_{seed}",
        "agent_post",
        agent.slug,
        f"{label} — updated read",
        "macro_signal" if hint and "fed" in hint else "agent_signal",
        market_hint=hint,
        counter_target=rival,
    )


def _continue_thread(
    db: Session,
    thread: dict[str, Any],
    *,
    agents: dict[str, Agent],
    markets: list[Market],
    recent_hashes: set[str],
    session_by_id: dict[str, AgentGeneratedActivity],
    base_seed: int,
    mirror_to_feed: bool,
    failure_out: dict[str, Any] | None = None,
    cooling: CoolingState | None = None,
    calm_format: str | None = None,
    narrative: NetworkNarrative | None = None,
) -> AgentGeneratedActivity | None:
    cooling = cooling or CoolingState()
    latest: AgentGeneratedActivity = thread["latest"]
    if is_calm_cooldown(cooling):
        responder = pick_calm_responder(
            latest.agent_slug,
            base_seed,
            exclude={latest.agent_slug},
        )
        if not responder:
            return None
        fmt = calm_format or pick_calm_format(base_seed)
        row = create_calm_thread_reply(
            db,
            responder_slug=responder,
            source=latest,
            calm_format=fmt,  # type: ignore[arg-type]
            seed=base_seed,
            mirror_to_feed=mirror_to_feed,
            recent_hashes=recent_hashes,
            agents=agents,
            markets=markets,
            session_by_id=session_by_id,
            narrative=narrative,
            failure_out=failure_out,
        )
        return row

    responder = pick_rival_responder(
        latest.agent_slug,
        base_seed,
        exclude={latest.agent_slug},
    )
    if not responder:
        pick_failure = rival_pick_failure(
            latest.agent_slug,
            base_seed,
            exclude={latest.agent_slug},
        )
        if pick_failure:
            record_failure(failure_out, pick_failure)
        return None
    row = create_rival_reply_activity(
        db,
        responder_slug=responder,
        target_slug=latest.agent_slug,
        source=latest,
        order=1,
        seed=base_seed,
        mirror_to_feed=mirror_to_feed,
        recent_hashes=recent_hashes,
        agents=agents,
        markets=markets,
        session_by_id=session_by_id,
        failure_out=failure_out,
    )
    if row:
        stamp_continuation_kind(row, "thread_continuation")
    return row


def _try_continue_narrative_thread(
    db: Session,
    threads: list[dict[str, Any]],
    agent: Agent,
    *,
    agents: dict[str, Agent],
    markets: list[Market],
    recent_hashes: set[str],
    session_by_id: dict[str, AgentGeneratedActivity],
    slot_seed: int,
    mirror_to_feed: bool,
    failure_out: dict[str, Any] | None = None,
    cooling: CoolingState | None = None,
) -> tuple[AgentGeneratedActivity | None, NetworkNarrative | None]:
    """Narrative shift as a threaded reply during calm cooldown."""
    cooling = cooling or CoolingState()
    narrative = _pick_narrative_for_agent(db, agent, seed=slot_seed, prefer_contested=True)
    candidates = _ordered_thread_candidates(threads, slot_seed)
    for offset, thread in enumerate(candidates):
        row = _continue_thread(
            db,
            thread,
            agents=agents,
            markets=markets,
            recent_hashes=recent_hashes,
            session_by_id=session_by_id,
            base_seed=slot_seed + offset * 29,
            mirror_to_feed=mirror_to_feed,
            failure_out=failure_out,
            cooling=cooling,
            calm_format="narrative_shift",
            narrative=narrative,
        )
        if row:
            return row, narrative
    return None, narrative


def _execute_continue_narrative(
    db: Session,
    agent: Agent,
    *,
    agents: dict[str, Agent],
    markets: list[Market],
    recent_hashes: set[str],
    session_by_id: dict[str, AgentGeneratedActivity],
    slot_seed: int,
    mirror_to_feed: bool,
    created_len: int,
    global_recent: set[str],
    failure_out: dict[str, Any] | None = None,
    cooling: CoolingState | None = None,
) -> tuple[AgentGeneratedActivity | None, str, NetworkNarrative | None]:
    """Reinforce contested narratives — prefer rivalry reply over new broadcast."""
    cooling = cooling or CoolingState()
    narrative = _pick_narrative_for_agent(db, agent, seed=slot_seed, prefer_contested=True)
    rival_heat = _rival_heat(db, agent)

    source = None
    if narrative:
        source = find_reply_source_for_narrative(
            db,
            narrative,
            agent,
            session_by_id=session_by_id,
            hours=ACTIVE_THREAD_HOURS,
        )

    prefer_rival_reply = (
        not cooling.heat_cooldown_active
        and not cooling.thread_cooldown_active
        and (
            rival_heat >= 3
            or (narrative is not None and narrative_is_contested(narrative))
            or source is not None
        )
    )

    if prefer_rival_reply and source and source.agent_slug != agent.slug:
        responder = agent.slug
        if blocks_preemptive_quote(
            db,
            speaker_slug=responder,
            target_slug=source.agent_slug,
            title=source.title,
            session_by_id=session_by_id,
        ):
            source = None
        else:
            row = create_rival_reply_activity(
                db,
                responder_slug=responder,
                target_slug=source.agent_slug,
                source=source,
                order=1,
                seed=slot_seed,
                mirror_to_feed=mirror_to_feed,
                recent_hashes=recent_hashes,
                agents=agents,
                markets=markets,
                session_by_id=session_by_id,
                failure_out=failure_out,
            )
            if row:
                stamp_continuation_kind(row, "thread_continuation")
                return row, "reply_to_rival", narrative

    if rival_heat >= 5 and not source and not cooling.thread_cooldown_active:
        bible = character_bible_for(agent.slug)
        enemies = bible.get("recurring_enemies") or []
        for enemy in enemies:
            if enemy == agent.slug or enemy not in agents:
                continue
            cutoff = _utcnow() - timedelta(hours=ACTIVE_THREAD_HOURS)
            enemy_row = (
                db.query(AgentGeneratedActivity)
                .filter(
                    AgentGeneratedActivity.agent_slug == enemy,
                    AgentGeneratedActivity.created_at >= cutoff,
                )
                .order_by(AgentGeneratedActivity.created_at.desc())
                .first()
            )
            if not enemy_row:
                continue
            row = create_rival_reply_activity(
                db,
                responder_slug=agent.slug,
                target_slug=enemy_row.agent_slug,
                source=enemy_row,
                order=1,
                seed=slot_seed + 17,
                mirror_to_feed=mirror_to_feed,
                recent_hashes=recent_hashes,
                agents=agents,
                markets=markets,
                session_by_id=session_by_id,
                failure_out=failure_out,
            )
            if row:
                stamp_continuation_kind(row, "thread_continuation")
                return row, "reply_to_rival", narrative

    if rival_heat >= 6 and not source and not cooling.thread_cooldown_active:
        bootstrap_rows, _ = _bootstrap_threadable_root_and_reply(
            db,
            agent,
            agents=agents,
            markets=markets,
            recent_hashes=recent_hashes,
            session_by_id=session_by_id,
            slot_seed=slot_seed + 53,
            mirror_to_feed=mirror_to_feed,
            created_len=created_len,
            global_recent=global_recent,
            narrative=narrative,
            failure_out=failure_out,
        )
        if bootstrap_rows:
            return bootstrap_rows[-1], "bootstrap_thread", narrative

    action = "reinforce_narrative"
    trigger = (
        _build_narrative_trigger(db, action, agent, narrative, seed=slot_seed)
        if narrative
        else _build_trigger_for_action(action, agent, narrative, seed=slot_seed)
    )
    row = _persist_trigger_activity(
        db,
        trigger=trigger,
        agents=agents,
        markets=markets,
        recent_hashes=recent_hashes,
        session_by_id=session_by_id,
        base_seed=slot_seed,
        created_len=created_len,
        mirror_to_feed=mirror_to_feed,
        attempt=0,
        global_recent=global_recent,
        failure_out=failure_out,
    )
    if row:
        stamp_continuation_kind(row, "narrative_reinforce")
    return row, action, narrative


def _process_resolution_reactions(
    db: Session,
    *,
    agents: dict[str, Agent],
    markets: list[Market],
    recent_hashes: set[str],
    session_by_id: dict[str, AgentGeneratedActivity],
    base_seed: int,
    mirror_to_feed: bool,
    limit: int | None = None,
    cooling: CoolingState | None = None,
) -> list[AgentGeneratedActivity]:
    """Generate receipt activities for recent forecast resolutions without reactions."""
    cooling = cooling or CoolingState()
    if not should_allow_resolution_receipt(cooling):
        record_receipt_generation_attempt(outcome="failure", reason="cooling_gate")
        return []
    if not agents:
        agents = {
            a.slug: a
            for a in query_active_agents(db)
            if a.slug in CORE_AGENT_SLUGS
        }
    if not markets:
        markets = db.query(Market).all()

    cutoff = _utcnow() - timedelta(hours=RESOLUTION_REACTION_LOOKBACK_HOURS)
    resolutions = (
        db.query(ForecastResolution)
        .filter(ForecastResolution.resolved_at >= cutoff)
        .order_by(ForecastResolution.resolved_at.desc())
        .limit(12)
        .all()
    )
    if not resolutions:
        record_receipt_generation_attempt(outcome="failure", reason="no_resolution_candidates")
        return []

    created: list[AgentGeneratedActivity] = []
    for idx, resolution in enumerate(resolutions):
        agent = next((a for a in agents.values() if a.id == resolution.agent_id), None)
        if not agent:
            record_receipt_generation_attempt(
                outcome="failure",
                reason="unknown_agent",
                resolution_id=resolution.id,
            )
            continue
        if resolution_has_handling_receipt(db, resolution):
            continue

        activity_type = "receipt_victory" if resolution.correct else "receipt_challenge"
        rival = pick_receipt_rival(agent.slug, base_seed + idx)
        if not rival:
            record_receipt_generation_attempt(
                outcome="failure",
                reason="no_rival",
                resolution_id=resolution.id,
                agent_slug=agent.slug,
            )
            continue
        row = create_receipt_warfare_activity(
            db,
            speaker_slug=agent.slug,
            target_slug=rival,
            activity_type=activity_type,
            source=None,
            order=idx,
            seed=base_seed + hash_seed(resolution.id, rival),
            mirror_to_feed=mirror_to_feed,
            recent_hashes=recent_hashes,
            agents=agents,
            markets=markets,
            session_by_id=session_by_id,
            resolution_id=resolution.id,
        )
        if row:
            meta = dict(row.metadata_json or {})
            meta["resolution_id"] = resolution.id
            meta["resolution_correct"] = resolution.correct
            if resolution.source_type == DEV_RESOLUTION_SOURCE:
                meta["resolution_source"] = DEV_RESOLUTION_SOURCE
            row.metadata_json = meta
            created.append(row)
            record_receipt_generation_attempt(
                outcome="success",
                resolution_id=resolution.id,
                agent_slug=agent.slug,
            )

            if not db.query(ReputationEvent).filter(
                ReputationEvent.agent_id == agent.id,
                ReputationEvent.source_type == "autonomous_resolution_reaction",
                ReputationEvent.source_id == resolution.id,
            ).first():
                delta = 2.5 if resolution.correct else -1.5
                db.add(
                    ReputationEvent(
                        agent_id=agent.id,
                        category="receipt_reaction",
                        delta=delta,
                        reason=f"Autonomous network reaction to {'verified' if resolution.correct else 'missed'} call",
                        source_type="autonomous_resolution_reaction",
                        source_id=resolution.id,
                        market_id=resolution.market_id,
                    )
                )
            if limit is not None and len(created) >= limit:
                break
        else:
            record_receipt_generation_attempt(
                outcome="failure",
                reason="copy_generation_failed",
                resolution_id=resolution.id,
                agent_slug=agent.slug,
            )
    return created


def execute_network_tick(
    db: Session,
    *,
    seed: int | None = None,
    mirror_to_feed: bool = True,
) -> TickResult:
    """Run one autonomous scheduler cycle."""
    base_seed = seed if seed is not None else int(_utcnow().timestamp()) % 1_000_000
    ensure_narratives_initialized(db)
    heat = compute_network_heat(db)
    activities_24h = count_autonomous_activities_since(db, hours=24)
    active_threads_preview = _load_active_threads(db, hours=ACTIVE_THREAD_HOURS)
    lifecycle_ctx = _lifecycle_thread_context(db, active_threads_preview, persist=True)
    legacy_active_threads = lifecycle_ctx["legacy_active_threads"]
    cooling = compute_cooling_state(
        db,
        network_heat=heat.network_heat_score,
        active_thread_count=legacy_active_threads,
    )

    simulated_resolution = maybe_simulate_dev_resolution_candidate(db, seed=base_seed)
    if simulated_resolution:
        db.flush()
        cooling = compute_cooling_state(
            db,
            network_heat=heat.network_heat_score,
            active_thread_count=legacy_active_threads,
        )

    slot_count = _activities_this_tick(activities_24h, heat, base_seed)
    tick_decisions: list[dict[str, Any]] = []

    if slot_count <= 0:
        skip_reason = (
            "daily_cap_reached"
            if activities_24h >= MAX_DAILY_ACTIVITIES
            else "silent_tick_roll"
        )
        skip_decision = {
            "tick_seed": base_seed,
            "outcome": "skipped",
            "reason": skip_reason,
            "planned_slot_count": 0,
            "activities_24h": activities_24h,
            "network_heat": heat.network_heat_score,
            **cooling.to_debug(),
        }
        tick_decisions.append(skip_decision)
        _record_decision(skip_decision)

        resolutions = _process_resolution_reactions(
            db,
            agents={},
            markets=[],
            recent_hashes=set(),
            session_by_id={},
            base_seed=base_seed,
            mirror_to_feed=mirror_to_feed,
            cooling=cooling,
        )
        for row in resolutions:
            resolution_decision = {
                "tick_seed": base_seed,
                "outcome": "executed",
                "action": "resolution_receipt",
                "agent_slug": row.agent_slug,
                "activity_id": row.activity_id,
                "activity_type": row.activity_type,
            }
            tick_decisions.append(resolution_decision)
            _record_decision(resolution_decision)
        if resolutions:
            stamp_activities_source(resolutions, ACTIVITY_SOURCE_AUTONOMOUS)
            db.commit()
        return TickResult(
            skipped=True,
            reason="rate_limit_or_silent_tick",
            activities_created=resolutions,
            resolutions_processed=len(resolutions),
            network_heat=heat.network_heat_score,
            seed=base_seed,
            decisions=tick_decisions,
        )

    agents = {
        a.slug: a
        for a in query_active_agents(db)
        if a.slug in CORE_AGENT_SLUGS
    }
    markets = db.query(Market).all()
    global_recent = _load_recent_hashes(db)
    recent_hashes: set[str] = set()
    session_by_id: dict[str, AgentGeneratedActivity] = {}
    created: list[AgentGeneratedActivity] = []
    emitted_thread_networks: set[str] = set()
    resolved_thread_receipts: set[str] = set()

    active_threads = lifecycle_ctx["threads"]
    thread_pool = select_thread_pool(lifecycle_ctx["continuation_pool"], cooling)
    extendable_threads = _extendable_threads(
        thread_pool,
        db=db,
        session_by_id=session_by_id,
        seed=base_seed,
        cooling=cooling,
    )
    thread_bootstrap_needed = legacy_active_threads < 5 and not cooling.thread_cooldown_active
    agent_slugs = sorted(agents.keys())

    for slot in range(min(slot_count, MAX_ACTIVITIES_PER_TICK)):
        slot_seed = base_seed + slot * 9973
        picked_agent = agents[agent_slugs[slot_seed % len(agent_slugs)]]
        slot_plan = resolve_cooled_slot_plan(
            slot_seed,
            has_active_threads=bool(thread_pool),
            thread_bootstrap_needed=thread_bootstrap_needed,
            cooling=cooling,
        )

        if slot_plan == "continue_thread":
            failure_reason: dict[str, Any] = {}
            row: AgentGeneratedActivity | None = None
            thread: dict[str, Any] | None = None
            bootstrap_rows: list[AgentGeneratedActivity] = []

            if extendable_threads:
                row, thread = _try_continue_threads(
                    db,
                    extendable_threads,
                    agents=agents,
                    markets=markets,
                    recent_hashes=recent_hashes,
                    session_by_id=session_by_id,
                    slot_seed=slot_seed,
                    mirror_to_feed=mirror_to_feed,
                    failure_out=failure_reason,
                    cooling=cooling,
                )
            elif is_calm_cooldown(cooling) and thread_pool:
                row, narrative = _try_continue_narrative_thread(
                    db,
                    thread_pool,
                    picked_agent,
                    agents=agents,
                    markets=markets,
                    recent_hashes=recent_hashes,
                    session_by_id=session_by_id,
                    slot_seed=slot_seed,
                    mirror_to_feed=mirror_to_feed,
                    failure_out=failure_reason,
                    cooling=cooling,
                )
                if row:
                    thread = thread_pool[slot_seed % len(thread_pool)]
            elif is_calm_cooldown(cooling):
                failure_reason["calm_cooldown"] = "no_extendable_threads"
            else:
                if cooling.thread_cooldown_active:
                    failure_reason["thread_cooldown"] = "bootstrap_blocked"
                else:
                    bootstrap_rows, _ = _bootstrap_threadable_root_and_reply(
                        db,
                        picked_agent,
                        agents=agents,
                        markets=markets,
                        recent_hashes=recent_hashes,
                        session_by_id=session_by_id,
                        slot_seed=slot_seed,
                        mirror_to_feed=mirror_to_feed,
                        created_len=len(created),
                        global_recent=global_recent,
                        failure_out=failure_reason,
                    )
                    if bootstrap_rows:
                        row = bootstrap_rows[-1]

            thread_decision = {
                "tick_seed": base_seed,
                "slot": slot,
                "agent_slug": picked_agent.slug,
                "slot_plan": slot_plan,
                "action": "bootstrap_thread" if bootstrap_rows else "continue_thread",
                "thread_id": thread["thread_id"] if thread else None,
                "outcome": "executed" if row else "failed",
                "activity_id": row.activity_id if row else None,
                "activity_type": row.activity_type if row else "rival_reply",
            }
            if not row and failure_reason:
                thread_decision["failure_reason"] = dict(failure_reason)
                if extendable_threads and thread:
                    recovery_row, recovery_action = recover_continue_thread_failure(
                        db,
                        thread=thread,
                        agent=picked_agent,
                        failure_reason=failure_reason,
                        agents=agents,
                        markets=markets,
                        recent_hashes=recent_hashes,
                        session_by_id=session_by_id,
                        seed=slot_seed,
                        mirror_to_feed=mirror_to_feed,
                        created_len=len(created),
                        global_recent=global_recent,
                        pick_narrative_for_agent=_pick_narrative_for_agent,
                        narrative_market_hint=_narrative_market_hint,
                    )
                    if recovery_row and recovery_action:
                        row = recovery_row
                        apply_recovery_to_decision(
                            thread_decision,
                            row=recovery_row,
                            recovery_action=recovery_action,
                            original_failure=failure_reason,
                        )
                if not row:
                    if is_calm_cooldown(cooling) and thread_pool:
                        row, narrative = _try_continue_narrative_thread(
                            db,
                            thread_pool,
                            picked_agent,
                            agents=agents,
                            markets=markets,
                            recent_hashes=recent_hashes,
                            session_by_id=session_by_id,
                            slot_seed=slot_seed + 91,
                            mirror_to_feed=mirror_to_feed,
                            failure_out=failure_reason,
                            cooling=cooling,
                        )
                        if row:
                            thread_decision["recovery_action"] = "calm_narrative_thread_fallback"
                            thread_decision["action"] = "calm_narrative_thread"
                            thread_decision["outcome"] = "executed"
                            thread_decision["activity_id"] = row.activity_id
                            thread_decision["activity_type"] = row.activity_type
                    elif not is_calm_cooldown(cooling):
                        bootstrap_rows, bootstrap_action = _bootstrap_threadable_root_and_reply(
                            db,
                            picked_agent,
                            agents=agents,
                            markets=markets,
                            recent_hashes=recent_hashes,
                            session_by_id=session_by_id,
                            slot_seed=slot_seed + 91,
                            mirror_to_feed=mirror_to_feed,
                            created_len=len(created),
                            global_recent=global_recent,
                            failure_out=failure_reason,
                        )
                        if bootstrap_rows:
                            row = bootstrap_rows[-1]
                            thread_decision["action"] = bootstrap_action
                            thread_decision["outcome"] = "executed"
                            thread_decision["activity_id"] = row.activity_id
                            thread_decision["activity_type"] = row.activity_type
                            thread_decision["recovery_action"] = "bootstrap_thread_fallback"
            tick_decisions.append(thread_decision)
            _record_decision(thread_decision)
            if bootstrap_rows:
                created.extend(bootstrap_rows)
            elif row:
                created.append(row)
            if row or bootstrap_rows:
                narrative = _pick_narrative_for_agent(db, picked_agent, seed=slot_seed)
                target_rows = bootstrap_rows if bootstrap_rows else ([row] if row else [])
                for activity_row in target_rows:
                    if narrative:
                        if not (activity_row.metadata_json or {}).get("narrative_stage"):
                            _stamp_narrative_progression(
                                db, activity_row, narrative, seed=slot_seed
                            )
                        _update_narrative_after_activity(
                            db,
                            narrative,
                            agent_slug=activity_row.agent_slug,
                            activity_type=activity_row.activity_type,
                            title=activity_row.title,
                            stance="oppose" if activity_row.parent_activity_id else "support",
                        )
                refresh_ctx = _lifecycle_thread_context(
                    db,
                    _load_active_threads(db, hours=ACTIVE_THREAD_HOURS),
                    persist=True,
                )
                thread_pool = select_thread_pool(refresh_ctx["continuation_pool"], cooling)
                extendable_threads = _extendable_threads(
                    thread_pool,
                    db=db,
                    session_by_id=session_by_id,
                    seed=slot_seed,
                    cooling=cooling,
                )
                thread_bootstrap_needed = (
                    refresh_ctx["legacy_active_threads"] < 5
                    and not cooling.thread_cooldown_active
                )
            continue

        if slot_plan == "continue_narrative":
            failure_reason = {}
            row: AgentGeneratedActivity | None = None
            narrative: NetworkNarrative | None = None
            action = "continue_narrative"
            if is_calm_cooldown(cooling) and thread_pool:
                row, narrative = _try_continue_narrative_thread(
                    db,
                    thread_pool,
                    picked_agent,
                    agents=agents,
                    markets=markets,
                    recent_hashes=recent_hashes,
                    session_by_id=session_by_id,
                    slot_seed=slot_seed,
                    mirror_to_feed=mirror_to_feed,
                    failure_out=failure_reason,
                    cooling=cooling,
                )
                action = "calm_narrative_thread"
            else:
                row, action, narrative = _execute_continue_narrative(
                    db,
                    picked_agent,
                    agents=agents,
                    markets=markets,
                    recent_hashes=recent_hashes,
                    session_by_id=session_by_id,
                    slot_seed=slot_seed,
                    mirror_to_feed=mirror_to_feed,
                    created_len=len(created),
                    global_recent=global_recent,
                    failure_out=failure_reason,
                    cooling=cooling,
                )
            narrative_decision = {
                "tick_seed": base_seed,
                "slot": slot,
                "agent_slug": picked_agent.slug,
                "slot_plan": slot_plan,
                "action": action,
                "narrative_id": narrative.narrative_id if narrative else None,
                "narrative_label": narrative.label if narrative else None,
                "outcome": "executed" if row else "failed",
                "activity_id": row.activity_id if row else None,
                "activity_type": row.activity_type if row else None,
            }
            if not row and failure_reason:
                narrative_decision["failure_reason"] = dict(failure_reason)
                if extendable_threads or thread_pool:
                    row, _ = _try_continue_threads(
                        db,
                        extendable_threads or thread_pool,
                        agents=agents,
                        markets=markets,
                        recent_hashes=recent_hashes,
                        session_by_id=session_by_id,
                        slot_seed=slot_seed + 31,
                        mirror_to_feed=mirror_to_feed,
                        failure_out=failure_reason,
                        cooling=cooling,
                    )
                    if row:
                        narrative_decision["recovery_action"] = "continue_thread_fallback"
                        narrative_decision["outcome"] = "executed"
                        narrative_decision["activity_id"] = row.activity_id
                        narrative_decision["activity_type"] = row.activity_type
                        action = "continue_thread"
            tick_decisions.append(narrative_decision)
            _record_decision(narrative_decision)
            if row:
                created.append(row)
                if narrative:
                    if not (row.metadata_json or {}).get("narrative_stage"):
                        _stamp_narrative_progression(db, row, narrative, seed=slot_seed)
                    stance = "oppose" if action in ("reply_to_rival", "start_battle") else "support"
                    _update_narrative_after_activity(
                        db,
                        narrative,
                        agent_slug=row.agent_slug,
                        activity_type=row.activity_type,
                        title=row.title,
                        stance=stance,
                    )
                _cascade_social_responses(
                    db,
                    row,
                    base_seed=slot_seed,
                    mirror_to_feed=mirror_to_feed,
                    recent_hashes=recent_hashes,
                    agents=agents,
                    markets=markets,
                    session_by_id=session_by_id,
                    created=created,
                    target_total=len(created) + 2,
                    emitted_thread_networks=emitted_thread_networks,
                    resolved_thread_receipts=resolved_thread_receipts,
                    cooling=cooling,
                )
            continue

        if slot_plan == "receipt_moment":
            failure_reason = {}
            receipt_rows = _process_resolution_reactions(
                db,
                agents=agents,
                markets=markets,
                recent_hashes=recent_hashes,
                session_by_id=session_by_id,
                base_seed=slot_seed,
                mirror_to_feed=mirror_to_feed,
                limit=1,
                cooling=cooling,
            )
            row = receipt_rows[0] if receipt_rows else None
            action = "receipt_moment"
            if not row:
                row, action, narrative = _execute_continue_narrative(
                    db,
                    picked_agent,
                    agents=agents,
                    markets=markets,
                    recent_hashes=recent_hashes,
                    session_by_id=session_by_id,
                    slot_seed=slot_seed + 47,
                    mirror_to_feed=mirror_to_feed,
                    created_len=len(created),
                    global_recent=global_recent,
                    failure_out=failure_reason,
                    cooling=cooling,
                )
            else:
                narrative = None
                stamp_continuation_kind(row, "receipt_moment")
            receipt_decision = {
                "tick_seed": base_seed,
                "slot": slot,
                "agent_slug": picked_agent.slug,
                "slot_plan": slot_plan,
                "action": action,
                "outcome": "executed" if row else "failed",
                "activity_id": row.activity_id if row else None,
                "activity_type": row.activity_type if row else None,
            }
            if not row and failure_reason:
                receipt_decision["failure_reason"] = dict(failure_reason)
            tick_decisions.append(receipt_decision)
            _record_decision(receipt_decision)
            if row:
                created.append(row)
            continue

        narrative = _pick_narrative_for_agent(db, picked_agent, seed=slot_seed, prefer_contested=True)
        trigger = (
            _build_narrative_trigger(db, "create_forecast", picked_agent, narrative, seed=slot_seed)
            if narrative
            else _build_trigger_for_action("create_forecast", picked_agent, narrative, seed=slot_seed)
        )
        failure_reason = {}
        row = _persist_trigger_activity(
            db,
            trigger=trigger,
            agents=agents,
            markets=markets,
            recent_hashes=recent_hashes,
            session_by_id=session_by_id,
            base_seed=slot_seed,
            created_len=len(created),
            mirror_to_feed=mirror_to_feed,
            attempt=slot,
            global_recent=global_recent,
            failure_out=failure_reason,
        )
        action = "create_forecast"
        action_decision = {
            "tick_seed": base_seed,
            "slot": slot,
            "agent_slug": picked_agent.slug,
            "slot_plan": slot_plan,
            "action": action,
            "narrative_id": narrative.narrative_id if narrative else None,
            "narrative_label": narrative.label if narrative else None,
            "outcome": "executed" if row else "failed",
            "activity_id": row.activity_id if row else None,
            "activity_type": row.activity_type if row else trigger.activity_type,
        }
        if not row and failure_reason:
            action_decision["failure_reason"] = dict(failure_reason)
            row, action, narrative = _execute_continue_narrative(
                db,
                picked_agent,
                agents=agents,
                markets=markets,
                recent_hashes=recent_hashes,
                session_by_id=session_by_id,
                slot_seed=slot_seed + 99,
                mirror_to_feed=mirror_to_feed,
                created_len=len(created),
                global_recent=global_recent,
                failure_out=failure_reason,
                cooling=cooling,
            )
            if row:
                apply_recovery_to_decision(
                    action_decision,
                    row=row,
                    recovery_action=action,
                    original_failure=failure_reason,
                )
                action_decision["slot_plan"] = "continue_narrative"
        tick_decisions.append(action_decision)
        _record_decision(action_decision)
        if not row:
            continue
        if slot_plan == "new_root":
            stamp_continuation_kind(row, "new_root_post")
        if narrative:
            if not (row.metadata_json or {}).get("narrative_stage"):
                _stamp_narrative_progression(db, row, narrative, seed=slot_seed)
            stance = "support"
            _update_narrative_after_activity(
                db,
                narrative,
                agent_slug=picked_agent.slug,
                activity_type=row.activity_type,
                title=row.title,
                stance=stance,
            )
        created.append(row)
        _cascade_social_responses(
            db,
            row,
            base_seed=slot_seed,
            mirror_to_feed=mirror_to_feed,
            recent_hashes=recent_hashes,
            agents=agents,
            markets=markets,
            session_by_id=session_by_id,
            created=created,
            target_total=len(created) + 2,
            emitted_thread_networks=emitted_thread_networks,
            resolved_thread_receipts=resolved_thread_receipts,
            cooling=cooling,
        )
        if (
            slot_plan == "new_root"
            and thread_bootstrap_needed
            and not row.parent_activity_id
            and not should_suppress_rivalry_cascade(cooling)
        ):
            reply = _attempt_immediate_rival_reply(
                db,
                row,
                agents=agents,
                markets=markets,
                recent_hashes=recent_hashes,
                session_by_id=session_by_id,
                seed=slot_seed + 113,
                mirror_to_feed=mirror_to_feed,
            )
            if reply and len(created) < MAX_ACTIVITIES_PER_TICK * 2:
                created.append(reply)
                refresh_ctx = _lifecycle_thread_context(
                    db,
                    _load_active_threads(db, hours=ACTIVE_THREAD_HOURS),
                    persist=True,
                )
                thread_pool = select_thread_pool(refresh_ctx["continuation_pool"], cooling)
                extendable_threads = _extendable_threads(
                    thread_pool,
                    db=db,
                    session_by_id=session_by_id,
                    seed=slot_seed,
                    cooling=cooling,
                )
                thread_bootstrap_needed = (
                    refresh_ctx["legacy_active_threads"] < 5
                    and not cooling.thread_cooldown_active
                )

    resolution_rows = _process_resolution_reactions(
        db,
        agents=agents,
        markets=markets,
        recent_hashes=recent_hashes,
        session_by_id=session_by_id,
        base_seed=base_seed + 555,
        mirror_to_feed=mirror_to_feed,
        cooling=cooling,
    )
    created.extend(resolution_rows)

    for row in resolution_rows:
        resolution_decision = {
            "tick_seed": base_seed,
            "outcome": "executed",
            "action": "resolution_receipt",
            "agent_slug": row.agent_slug,
            "activity_id": row.activity_id,
            "activity_type": row.activity_type,
        }
        tick_decisions.append(resolution_decision)
        _record_decision(resolution_decision)

    if created:
        stamp_activities_source(created, ACTIVITY_SOURCE_AUTONOMOUS)
        db.commit()

    return TickResult(
        skipped=not created,
        reason="" if created else "no_actions_generated",
        activities_created=created,
        resolutions_processed=len(resolution_rows),
        network_heat=heat.network_heat_score,
        seed=base_seed,
        decisions=tick_decisions,
    )


def get_rate_limiter_state(db: Session, heat: NetworkHeatSnapshot | None = None) -> dict[str, Any]:
    """Expose daily budget and per-tick probability for inspection."""
    if heat is None:
        heat = compute_network_heat(db)
    activities_24h = count_autonomous_activities_since(db, hours=24)
    all_activities_24h = count_activities_since(db, hours=24)
    remaining = max(0, MAX_DAILY_ACTIVITIES - activities_24h)
    tick_probability = _tick_activity_probability(activities_24h, heat)
    preview_seed = int(_utcnow().timestamp()) % 1_000_000
    projected_slots = _activities_this_tick(activities_24h, heat, preview_seed)
    active_threads = _load_active_threads(db, hours=ACTIVE_THREAD_HOURS)
    cooling = compute_cooling_state(
        db,
        network_heat=heat.network_heat_score,
        active_thread_count=len(active_threads),
    )

    return {
        "autonomous_activities_last_24h": activities_24h,
        "all_generated_activities_last_24h": all_activities_24h,
        "receipts_last_24h": count_receipts_since(db, hours=24),
        "autonomous_fresh_receipts_last_24h": cooling.autonomous_receipts_last_24h,
        **compute_receipt_pipeline_metrics(db).to_dict(),
        "min_daily_target": MIN_DAILY_ACTIVITIES,
        "max_daily_cap": MAX_DAILY_ACTIVITIES,
        "remaining_budget": remaining,
        "at_daily_cap": activities_24h >= MAX_DAILY_ACTIVITIES,
        "below_min_target": activities_24h < MIN_DAILY_ACTIVITIES,
        "max_activities_per_tick": MAX_ACTIVITIES_PER_TICK,
        "tick_activity_probability": round(tick_probability, 4),
        "projected_slots_next_tick": projected_slots,
        "cadence_seconds_range": [MIN_CADENCE_SECONDS, MAX_CADENCE_SECONDS],
        **cooling.to_debug(),
    }


def preview_next_tick(db: Session, *, seed: int | None = None) -> dict[str, Any]:
    """Non-destructive preview of what the next tick would attempt."""
    preview_seed = seed if seed is not None else int(_utcnow().timestamp()) % 1_000_000
    heat = compute_network_heat(db)
    activities_24h = count_autonomous_activities_since(db, hours=24)
    slot_count = _activities_this_tick(activities_24h, heat, preview_seed)
    legacy_threads = _load_active_threads(db, hours=ACTIVE_THREAD_HOURS)
    lifecycle_ctx = _lifecycle_thread_context(db, legacy_threads, persist=False)
    cooling = compute_cooling_state(
        db,
        network_heat=heat.network_heat_score,
        active_thread_count=lifecycle_ctx["legacy_active_threads"],
    )
    thread_bootstrap_needed = (
        lifecycle_ctx["legacy_active_threads"] < 5 and not cooling.thread_cooldown_active
    )
    thread_pool = select_thread_pool(lifecycle_ctx["continuation_pool"], cooling)
    agents = {
        a.slug: a
        for a in query_active_agents(db)
        if a.slug in CORE_AGENT_SLUGS
    }
    agent_slugs = sorted(agents.keys())

    slot_previews: list[dict[str, Any]] = []
    for slot in range(min(slot_count, MAX_ACTIVITIES_PER_TICK)):
        slot_seed = preview_seed + slot * 9973
        agent = agents[agent_slugs[slot_seed % len(agent_slugs)]]
        slot_plan = resolve_cooled_slot_plan(
            slot_seed,
            has_active_threads=bool(thread_pool),
            thread_bootstrap_needed=thread_bootstrap_needed,
            cooling=cooling,
        )
        if slot_plan == "continue_thread":
            thread = (
                thread_pool[slot_seed % len(thread_pool)]
                if thread_pool
                else None
            )
            slot_previews.append(
                {
                    "slot": slot,
                    "agent_slug": agent.slug,
                    "slot_plan": slot_plan,
                    "planned_action": "bootstrap_thread" if thread is None else "continue_thread",
                    "thread_id": thread["thread_id"] if thread else None,
                    "thread_root_title": thread["root"].title if thread else None,
                }
            )
            continue
        if slot_plan == "continue_narrative":
            narrative = _pick_narrative_for_agent(db, agent, seed=slot_seed, prefer_contested=True)
            slot_previews.append(
                {
                    "slot": slot,
                    "agent_slug": agent.slug,
                    "slot_plan": slot_plan,
                    "planned_action": "continue_narrative",
                    "narrative_id": narrative.narrative_id if narrative else None,
                    "narrative_label": narrative.label if narrative else None,
                    "narrative_contested": narrative_is_contested(narrative) if narrative else False,
                }
            )
            continue
        if slot_plan == "receipt_moment":
            slot_previews.append(
                {
                    "slot": slot,
                    "agent_slug": agent.slug,
                    "slot_plan": slot_plan,
                    "planned_action": "receipt_moment",
                }
            )
            continue
        narrative = _pick_narrative_for_agent(db, agent, seed=slot_seed, prefer_contested=True)
        slot_previews.append(
            {
                "slot": slot,
                "agent_slug": agent.slug,
                "slot_plan": slot_plan,
                "planned_action": "new_root_post",
                "narrative_id": narrative.narrative_id if narrative else None,
                "narrative_label": narrative.label if narrative else None,
            }
        )

    return {
        "seed": preview_seed,
        "would_skip": slot_count <= 0,
        "planned_slot_count": slot_count,
        "active_thread_count": len(active_threads),
        "active_thread_hours": ACTIVE_THREAD_HOURS,
        "thread_continue_chance": THREAD_CONTINUE_CHANCE,
        "narrative_continue_chance": NARRATIVE_CONTINUE_CHANCE,
        "receipt_moment_chance": RECEIPT_MOMENT_CHANCE,
        "new_root_chance": NEW_ROOT_CHANCE,
        "target_mix": {
            "thread_continuation": THREAD_CONTINUE_CHANCE,
            "narrative_reinforce": NARRATIVE_CONTINUE_CHANCE,
            "receipt_moment": RECEIPT_MOMENT_CHANCE,
            "new_root_post": NEW_ROOT_CHANCE,
        },
        "cooling": cooling.to_debug(),
        "slots": slot_previews,
    }


def get_scheduler_state() -> dict[str, Any]:
    """Background scheduler timing for inspection dashboard."""
    now = _utcnow()
    seconds_until: int | None = None
    if _next_tick_at is not None:
        seconds_until = max(0, int((_next_tick_at - now).total_seconds()))

    return {
        "engine_running": is_engine_running(),
        "next_tick_at": _next_tick_at.isoformat() if _next_tick_at else None,
        "seconds_until_next_tick": seconds_until,
        "last_tick_at": _last_tick_at.isoformat() if _last_tick_at else None,
        "last_cadence_seconds": _last_cadence_seconds,
        "cadence_seconds_range": [MIN_CADENCE_SECONDS, MAX_CADENCE_SECONDS],
        "last_tick_summary": _last_tick_summary,
    }


def get_network_debug(db: Session) -> dict[str, Any]:
    """Full inspection payload for GET /api/dev/network-debug."""
    import os

    ensure_narratives_initialized(db)
    heat = compute_autonomous_network_heat(db)
    legacy = legacy_network_heat(db)
    status = get_network_status(db)
    narratives = (
        db.query(NetworkNarrative)
        .order_by(NetworkNarrative.heat.desc())
        .all()
    )
    legacy_threads = _load_active_threads(db, hours=ACTIVE_THREAD_HOURS)
    lifecycle_ctx = _lifecycle_thread_context(db, legacy_threads, persist=True)
    continuation_metrics = compute_continuation_metrics(db, hours=24)

    return {
        "inspection_mode": True,
        "autonomous_execution_enabled": is_engine_running(),
        "autonomous_env_flag": os.getenv("ENABLE_AUTONOMOUS_NETWORK", ""),
        "summary": status,
        "continuation_metrics": continuation_metrics,
        "thread_lifecycle": {
            "legacy_active_threads": lifecycle_ctx["legacy_active_threads"],
            "lifecycle_active_threads": lifecycle_ctx["lifecycle_active_threads"],
            "thread_lifecycle_counts": lifecycle_ctx["thread_lifecycle_counts"],
            "closed_last_24h": lifecycle_ctx["closed_last_24h"],
            "archived_last_24h": lifecycle_ctx["archived_last_24h"],
            "max_thread_depth": lifecycle_ctx["max_thread_depth"],
            "threads_at_depth_3": lifecycle_ctx["threads_at_depth_3"],
            "threads_at_depth_4": lifecycle_ctx["threads_at_depth_4"],
            "threads_at_depth_5": lifecycle_ctx["threads_at_depth_5"],
            "closed_by_depth_last_24h": lifecycle_ctx["closed_by_depth_last_24h"],
            "closed_by_agent_limit_last_24h": lifecycle_ctx["closed_by_agent_limit_last_24h"],
        },
        "active_narratives": [
            _serialize_narrative(n) for n in narratives if float(n.heat) >= 15.0
        ],
        "active_threads": [
            _serialize_thread(t) for t in lifecycle_ctx["threads"][:20]
        ],
        "top_rivalries": _top_rivalries(db),
        "network_heat_components": {
            **heat.to_exposure_dict(legacy=legacy),
            "autonomous_conviction_gap": heat.autonomous_conviction_gap,
            "formula": (
                "battle*0.40 + velocity*0.30 + receipt*0.15 + gap*0.15 "
                "(autonomous_v1)"
            ),
            "legacy_components": {
                "network_heat_score": legacy.network_heat_score,
                "active_battles": legacy.active_battles,
                "conviction_gaps": legacy.conviction_gaps,
                "reply_velocity": legacy.reply_velocity,
                "receipt_frequency": legacy.receipt_frequency,
                "formula": "battles*8 + gaps*2.5 + velocity*0.35 + receipts*0.25",
            },
        },
        "last_autonomous_decisions": get_decision_log(limit=MAX_DECISION_LOG),
        "rate_limiter": get_rate_limiter_state(db, heat),
        "next_scheduled_tick": get_scheduler_state(),
        "next_tick_preview": preview_next_tick(db),
    }


def _latest_feed_thread_ui_stats(db: Session) -> dict[str, int]:
    from app.forecasting.services.feed_intelligence import build_personalized_feed
    from app.forecasting.services.feed_thread_display_stats import (
        compute_feed_thread_display_stats,
        group_conversation_display_payloads,
        sort_feed_by_thread_block_time_desc,
    )

    payloads = sort_feed_by_thread_block_time_desc(
        build_personalized_feed(db, None, chip="latest", limit=50)["events"]
    )
    stream_items = [
        {"type": "event", "event": payload, "index": index}
        for index, payload in enumerate(payloads)
    ]
    groups = group_conversation_display_payloads(stream_items)
    return compute_feed_thread_display_stats(groups)


def get_network_status(db: Session) -> dict[str, Any]:
    """Metrics payload for GET /api/dev/network-status."""
    ensure_narratives_initialized(db)
    heat = compute_autonomous_network_heat(db)
    legacy = legacy_network_heat(db)
    legacy_threads = _load_active_threads(db, hours=ACTIVE_THREAD_HOURS)
    lifecycle_ctx = _lifecycle_thread_context(db, legacy_threads, persist=True)
    cooling = compute_cooling_state(
        db,
        network_heat=heat.network_heat_score,
        active_thread_count=lifecycle_ctx["legacy_active_threads"],
    )
    narratives = db.query(NetworkNarrative).filter(NetworkNarrative.heat >= 15).count()
    continuation_metrics = compute_continuation_metrics(db, hours=24)
    return {
        "active_threads": lifecycle_ctx["legacy_active_threads"],
        "legacy_active_threads": lifecycle_ctx["legacy_active_threads"],
        "lifecycle_active_threads": lifecycle_ctx["lifecycle_active_threads"],
        "thread_lifecycle_counts": lifecycle_ctx["thread_lifecycle_counts"],
        "thread_lifecycle_active": lifecycle_ctx["thread_lifecycle_active"],
        "thread_lifecycle_dormant": lifecycle_ctx["thread_lifecycle_dormant"],
        "thread_lifecycle_closed": lifecycle_ctx["thread_lifecycle_closed"],
        "thread_lifecycle_archived": lifecycle_ctx["thread_lifecycle_archived"],
        "closed_last_24h": lifecycle_ctx["closed_last_24h"],
        "archived_last_24h": lifecycle_ctx["archived_last_24h"],
        "max_thread_depth": lifecycle_ctx["max_thread_depth"],
        "threads_at_depth_3": lifecycle_ctx["threads_at_depth_3"],
        "threads_at_depth_4": lifecycle_ctx["threads_at_depth_4"],
        "threads_at_depth_5": lifecycle_ctx["threads_at_depth_5"],
        "closed_by_depth_last_24h": lifecycle_ctx["closed_by_depth_last_24h"],
        "closed_by_agent_limit_last_24h": lifecycle_ctx["closed_by_agent_limit_last_24h"],
        "active_thread_hours": ACTIVE_THREAD_HOURS,
        "active_narratives": narratives,
        **heat.to_exposure_dict(legacy=legacy),
        "autonomous_conviction_gap": heat.autonomous_conviction_gap,
        "autonomous_activities_last_24h": count_autonomous_activities_since(db, hours=24),
        "all_generated_activities_last_24h": count_activities_since(db, hours=24),
        "receipts_last_24h": count_receipts_since(db, hours=24),
        "autonomous_fresh_receipts_last_24h": cooling.autonomous_receipts_last_24h,
        "battles_active": int(round(heat.weighted_active_battle_pairs)),
        "legacy_battles_active": legacy.active_battles,
        "engine_running": is_engine_running(),
        "thread_continuation_rate": continuation_metrics["thread_continuation_rate"],
        "new_root_post_rate": continuation_metrics["new_root_post_rate"],
        "rivalry_reply_rate": continuation_metrics["rivalry_reply_rate"],
        "orphan_rivalry_reply_count": continuation_metrics["orphan_rivalry_reply_count"],
        "replies_with_parent_rate": continuation_metrics["replies_with_parent_rate"],
        "average_thread_depth": continuation_metrics["average_thread_depth"],
        "thread_blocks_rendered": continuation_metrics["thread_blocks_rendered"],
        "continuation_metrics": continuation_metrics,
        **_latest_feed_thread_ui_stats(db),
        "heat_components": {
            "battle_score": heat.battle_score,
            "velocity_score": heat.velocity_score,
            "receipt_score": heat.receipt_score,
            "gap_score": heat.gap_score,
            "autonomous_conviction_gap": heat.autonomous_conviction_gap,
        },
        "legacy_heat_components": {
            "conviction_gaps": legacy.conviction_gaps,
            "reply_velocity": legacy.reply_velocity,
            "receipt_frequency": legacy.receipt_frequency,
        },
        **cooling.to_debug(),
        **compute_receipt_pipeline_metrics(db).to_dict(),
        "cooldown_slot_mix": COOLDOWN_SLOT_MIX if is_calm_cooldown(cooling) else None,
    }


async def autonomous_network_loop() -> None:
    """Background loop — randomized 1-5 minute cadence."""
    from app.database import SessionLocal
    from app.observability.sentry import capture_background_exception

    global _engine_running, _next_tick_at, _last_tick_at, _last_cadence_seconds, _last_tick_summary
    _engine_running = True
    try:
        while _engine_running:
            delay = random.randint(MIN_CADENCE_SECONDS, MAX_CADENCE_SECONDS)
            _last_cadence_seconds = delay
            _next_tick_at = _utcnow() + timedelta(seconds=delay)
            await asyncio.sleep(delay)
            if not _engine_running:
                break
            db = SessionLocal()
            try:
                result = execute_network_tick(db)
                _last_tick_at = _utcnow()
                _last_tick_summary = {
                    "seed": result.seed,
                    "skipped": result.skipped,
                    "reason": result.reason,
                    "activities_created": len(result.activities_created),
                    "resolutions_processed": result.resolutions_processed,
                    "network_heat": result.network_heat,
                    "decision_count": len(result.decisions),
                }
            except Exception as exc:
                capture_background_exception(exc, job="autonomous_network_loop")
            finally:
                db.close()
    finally:
        _engine_running = False
        _next_tick_at = None


def reset_scheduler_state() -> None:
    """Clear in-memory scheduler timing (next tick, last tick summary)."""
    global _next_tick_at, _last_tick_at, _last_cadence_seconds, _last_tick_summary
    _next_tick_at = None
    _last_tick_at = None
    _last_cadence_seconds = None
    _last_tick_summary = None


def reset_autonomous_state(
    db: Session,
    *,
    delete_mirrored_feed_events: bool = False,
) -> dict[str, Any]:
    """Reset autonomous engine dev state without touching manual bulk data."""
    clear_decision_log()
    reset_scheduler_state()

    rows = (
        db.query(AgentGeneratedActivity)
        .filter(_activity_source_expr(ACTIVITY_SOURCE_AUTONOMOUS))
        .all()
    )
    feed_event_ids = [
        row.mirrored_feed_event_id
        for row in rows
        if row.mirrored_feed_event_id is not None
    ]

    for row in rows:
        db.delete(row)

    deleted_feed_events = 0
    if delete_mirrored_feed_events and feed_event_ids:
        deleted_feed_events = (
            db.query(FeedEvent)
            .filter(FeedEvent.id.in_(feed_event_ids))
            .delete(synchronize_session=False)
        )

    db.commit()
    return {
        "decision_log_cleared": True,
        "scheduler_state_reset": True,
        "deleted_autonomous_activities": len(rows),
        "deleted_mirrored_feed_events": deleted_feed_events,
        "delete_mirrored_feed_events": delete_mirrored_feed_events,
        "autonomous_activities_last_24h": count_autonomous_activities_since(db, hours=24),
        "all_generated_activities_last_24h": count_activities_since(db, hours=24),
    }


def _dev_generated_activity_query(db: Session, *, older_than_hours: int | None = None):
    cutoff = _utcnow() - timedelta(hours=older_than_hours) if older_than_hours is not None else None
    q = db.query(AgentGeneratedActivity).filter(
        _activity_source_expr(ACTIVITY_SOURCE_MANUAL_DEV),
    )
    if cutoff is not None:
        q = q.filter(AgentGeneratedActivity.created_at < cutoff)
    return q


def prune_generated_dev_data(
    db: Session,
    *,
    older_than_hours: int = 24,
    delete_mirrored_feed_events: bool = False,
) -> dict[str, Any]:
    """Remove stale manual dev batch activities (local cleanup)."""
    rows = _dev_generated_activity_query(db, older_than_hours=older_than_hours).all()
    feed_event_ids = [
        row.mirrored_feed_event_id
        for row in rows
        if row.mirrored_feed_event_id is not None
    ]

    for row in rows:
        db.delete(row)

    deleted_feed_events = 0
    if delete_mirrored_feed_events and feed_event_ids:
        deleted_feed_events = (
            db.query(FeedEvent)
            .filter(FeedEvent.id.in_(feed_event_ids))
            .delete(synchronize_session=False)
        )

    db.commit()
    return {
        "older_than_hours": older_than_hours,
        "deleted_manual_dev_activities": len(rows),
        "deleted_mirrored_feed_events": deleted_feed_events,
        "all_generated_activities_last_24h": count_activities_since(db, hours=24),
    }


def clear_generated_dev_data(
    db: Session,
    *,
    delete_mirrored_feed_events: bool = False,
    include_legacy_without_source: bool = True,
) -> dict[str, Any]:
    """Remove all manual dev batch activities; optionally legacy untagged rows."""
    filters = [_activity_source_expr(ACTIVITY_SOURCE_MANUAL_DEV)]
    if include_legacy_without_source:
        filters.append(AgentGeneratedActivity.metadata_json.is_(None))
        filters.append(
            AgentGeneratedActivity.metadata_json["source"].as_string().is_(None)
        )
    from sqlalchemy import or_

    rows = db.query(AgentGeneratedActivity).filter(or_(*filters)).all()
    feed_event_ids = [
        row.mirrored_feed_event_id
        for row in rows
        if row.mirrored_feed_event_id is not None
    ]

    for row in rows:
        db.delete(row)

    deleted_feed_events = 0
    if delete_mirrored_feed_events and feed_event_ids:
        deleted_feed_events = (
            db.query(FeedEvent)
            .filter(FeedEvent.id.in_(feed_event_ids))
            .delete(synchronize_session=False)
        )

    db.commit()
    return {
        "deleted_dev_activities": len(rows),
        "include_legacy_without_source": include_legacy_without_source,
        "deleted_mirrored_feed_events": deleted_feed_events,
        "all_generated_activities_last_24h": count_activities_since(db, hours=24),
    }


def _engine_task_active() -> bool:
    return _engine_task is not None and not _engine_task.done()


async def start_engine() -> dict[str, Any]:
    """Start the background scheduler (idempotent if already running)."""
    global _engine_running, _engine_task

    if _engine_task_active():
        return {"status": "already_running", "engine_running": True}

    # Recover from partial init or a crashed/completed background task.
    if _engine_task is not None and _engine_task.done():
        _engine_task = None
    _engine_running = False

    try:
        _engine_task = asyncio.create_task(autonomous_network_loop())
    except Exception as exc:
        _engine_running = False
        _engine_task = None
        return {
            "status": "error",
            "engine_running": False,
            "error": str(exc),
            "error_type": type(exc).__name__,
        }

    return {"status": "started", "engine_running": True}


def stop_engine() -> dict[str, Any]:
    """Stop the background scheduler (idempotent if already stopped)."""
    global _engine_running, _engine_task, _next_tick_at
    was_running = _engine_running or _engine_task_active()
    _engine_running = False
    _next_tick_at = None
    if _engine_task and not _engine_task.done():
        _engine_task.cancel()
    _engine_task = None
    return {
        "status": "stopped" if was_running else "already_stopped",
        "engine_running": False,
    }
