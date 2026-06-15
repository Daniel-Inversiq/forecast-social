"""Receipt Warfare — agents weaponize forecast history against rivals."""

from __future__ import annotations

import uuid
import zlib
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy.orm import Session

from app.forecasting.agent_status import CORE_AGENT_SLUGS
from app.forecasting.models import (
    Agent,
    AgentGeneratedActivity,
    FeedEvent,
    ForecastResolution,
    Market,
)
from app.forecasting.services.agent_feed_copy import split_headline_body
from app.forecasting.services.agent_prompt_context import build_reply_relationship_context
from app.forecasting.services.conversation_threads import assign_reply_thread, can_extend_thread
from app.forecasting.services.copy_sanitize import finalize_persisted_copy
from app.forecasting.services.opinion_headlines import ensure_opinion_headline, is_event_driven_headline
from app.forecasting.services.rivalry_engine import eligible_rivals
from app.forecasting.services.utils import hash_seed, title_to_slug
from app.forecasting.services.voice_engine import (
    display_name,
    is_generic_agreement,
    polish_copy,
)

RECEIPT_CHALLENGE_CHANCE = 0.12
RECEIPT_VICTORY_CHANCE = 0.15

RIVALRY_TRIGGER_TYPES = frozenset({"battle_response", "rival_reply"})
VICTORY_TRIGGER_TYPES = frozenset({"receipt_reaction"})

_RECESSION_KW = ("recession", "soft landing", "contraction", "gdp shrink")
_FED_KW = ("fed", "fomc", "cut", "rate", "september", "dot plot", "front-end")
_DIP_KW = ("dip", "pullback", "drawdown", "correction", "selloff", "down 2%", "down 3%")
_SPORTS_KW = ("upset", "underdog", "favourite", "favorite", "line", "injury", "champions")


@dataclass(frozen=True)
class ReceiptAmmunition:
    kind: str
    count: int
    period_label: str
    evidence: list[dict[str, Any]]
    speaker_win: dict[str, Any] | None = None
    target_miss: dict[str, Any] | None = None

    @property
    def has_evidence(self) -> bool:
        return self.count > 0 or bool(self.evidence) or bool(self.speaker_win)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _since(days: int = 180) -> datetime:
    return _utcnow() - timedelta(days=days)


def _text_blob(*parts: str | None) -> str:
    return " ".join(p for p in parts if p).lower()


def _market_title(db: Session, market_id: int | None) -> str:
    if not market_id:
        return ""
    market = db.get(Market, market_id)
    return (market.title if market else "") or ""


def _matches_keywords(text: str, keywords: tuple[str, ...]) -> bool:
    lower = text.lower()
    return any(k in lower for k in keywords)


def _month_label(since: datetime) -> str:
    if since.month == 1 and since.year == _utcnow().year:
        return "January"
    return since.strftime("%B")


def _load_resolutions(
    db: Session,
    agent_id: int,
    *,
    since: datetime,
    correct: bool | None = None,
) -> list[ForecastResolution]:
    q = (
        db.query(ForecastResolution)
        .filter(
            ForecastResolution.agent_id == agent_id,
            ForecastResolution.resolved_at >= since,
        )
        .order_by(ForecastResolution.resolved_at.desc())
    )
    if correct is not None:
        q = q.filter(ForecastResolution.correct.is_(correct))
    return q.limit(80).all()


def _feed_history(
    db: Session,
    agent_id: int,
    *,
    since: datetime,
    limit: int = 60,
) -> list[FeedEvent]:
    return (
        db.query(FeedEvent)
        .filter(
            FeedEvent.agent_id == agent_id,
            FeedEvent.created_at >= since,
        )
        .order_by(FeedEvent.created_at.desc())
        .limit(limit)
        .all()
    )


def _activity_history(
    db: Session,
    agent_slug: str,
    *,
    since: datetime,
    limit: int = 60,
) -> list[AgentGeneratedActivity]:
    return (
        db.query(AgentGeneratedActivity)
        .filter(
            AgentGeneratedActivity.agent_slug == agent_slug,
            AgentGeneratedActivity.created_at >= since,
        )
        .order_by(AgentGeneratedActivity.created_at.desc())
        .limit(limit)
        .all()
    )


def _count_themed_posts(
    db: Session,
    agent_id: int,
    agent_slug: str,
    *,
    since: datetime,
    keywords: tuple[str, ...],
    bearish_only: bool = False,
) -> tuple[int, list[dict[str, Any]]]:
    evidence: list[dict[str, Any]] = []
    count = 0
    for row in _feed_history(db, agent_id, since=since):
        blob = _text_blob(row.title, row.body)
        if not _matches_keywords(blob, keywords):
            continue
        if bearish_only and row.probability is not None and row.probability >= 50:
            continue
        count += 1
        evidence.append(
            {
                "source": "feed_event",
                "id": row.id,
                "title": row.title,
                "created_at": row.created_at.isoformat() if row.created_at else None,
            }
        )
    for row in _activity_history(db, agent_slug, since=since):
        blob = _text_blob(row.title, row.body)
        if not _matches_keywords(blob, keywords):
            continue
        count += 1
        evidence.append(
            {
                "source": "generated_activity",
                "id": row.activity_id,
                "title": row.title,
                "created_at": row.created_at.isoformat() if row.created_at else None,
            }
        )
    return count, evidence[:6]


def _count_recession_calls(
    db: Session,
    agent_id: int,
    agent_slug: str,
    *,
    since: datetime,
) -> ReceiptAmmunition:
    evidence: list[dict[str, Any]] = []
    count = 0
    for res in _load_resolutions(db, agent_id, since=since, correct=False):
        title = _market_title(db, res.market_id)
        if not title or not _matches_keywords(title, _RECESSION_KW):
            continue
        if res.side != "NO" and res.predicted_probability < 55:
            continue
        count += 1
        evidence.append(
            {
                "source": "forecast_resolution",
                "id": res.id,
                "market": title,
                "side": res.side,
                "correct": res.correct,
                "resolved_at": res.resolved_at.isoformat() if res.resolved_at else None,
            }
        )
    post_count, post_ev = _count_themed_posts(
        db,
        agent_id,
        agent_slug,
        since=since,
        keywords=_RECESSION_KW,
        bearish_only=True,
    )
    if post_count > count:
        count = post_count
        evidence = post_ev
    return ReceiptAmmunition(
        kind="recession_calls",
        count=count,
        period_label=_month_label(since),
        evidence=evidence,
    )


def _count_ignored_drawdowns(
    db: Session,
    agent_id: int,
    agent_slug: str,
    *,
    since: datetime,
) -> ReceiptAmmunition:
    evidence: list[dict[str, Any]] = []
    count = 0
    for res in _load_resolutions(db, agent_id, since=since, correct=False):
        title = _market_title(db, res.market_id)
        blob = _text_blob(title)
        if res.side == "YES" or res.predicted_probability >= 52:
            count += 1
            evidence.append(
                {
                    "source": "forecast_resolution",
                    "id": res.id,
                    "market": title or "unknown",
                    "side": res.side,
                    "correct": False,
                }
            )
        elif _matches_keywords(blob, _DIP_KW):
            count += 1
            evidence.append(
                {
                    "source": "forecast_resolution",
                    "id": res.id,
                    "market": title,
                    "side": res.side,
                    "correct": False,
                }
            )
    dip_posts, dip_ev = _count_themed_posts(
        db,
        agent_id,
        agent_slug,
        since=since,
        keywords=_DIP_KW,
    )
    if dip_posts:
        count = max(count, dip_posts)
        if not evidence:
            evidence = dip_ev
    return ReceiptAmmunition(
        kind="ignored_drawdowns",
        count=count,
        period_label=_month_label(since),
        evidence=evidence,
    )


def _count_late_meetings(
    db: Session,
    speaker_id: int,
    target_id: int,
    *,
    since: datetime,
) -> ReceiptAmmunition:
    """Markets where speaker was earlier/correct and target was late or wrong on Fed themes."""
    speaker_rows = _load_resolutions(db, speaker_id, since=since, correct=True)
    target_by_market: dict[int, list[ForecastResolution]] = {}
    for row in _load_resolutions(db, target_id, since=since):
        if row.market_id:
            target_by_market.setdefault(row.market_id, []).append(row)

    count = 0
    evidence: list[dict[str, Any]] = []
    for s_res in speaker_rows:
        title = _market_title(db, s_res.market_id)
        if not title or not _matches_keywords(title, _FED_KW):
            continue
        if not s_res.market_id:
            continue
        target_rows = target_by_market.get(s_res.market_id) or []
        if not target_rows:
            continue
        t_res = target_rows[0]
        speaker_early = int(s_res.days_early or 0)
        target_early = int(t_res.days_early or 0)
        if t_res.correct and target_early >= speaker_early:
            continue
        if not t_res.correct or target_early < max(3, speaker_early - 2):
            count += 1
            evidence.append(
                {
                    "source": "forecast_resolution",
                    "market": title,
                    "speaker_days_early": speaker_early,
                    "target_days_early": target_early,
                    "target_correct": t_res.correct,
                    "speaker_resolution_id": s_res.id,
                    "target_resolution_id": t_res.id,
                }
            )
    if count == 0:
        fed_posts, fed_ev = _count_themed_posts(
            db,
            target_id,
            _agent_slug_for_id(db, target_id) or "",
            since=since,
            keywords=_FED_KW,
        )
        if fed_posts >= 2:
            count = min(fed_posts, 5)
            evidence = fed_ev
    return ReceiptAmmunition(
        kind="late_meetings",
        count=count,
        period_label=_month_label(since),
        evidence=evidence,
    )


def _count_narrative_late(
    db: Session,
    speaker_id: int,
    target_id: int,
    *,
    since: datetime,
) -> ReceiptAmmunition:
    """Rates-first agent lagging narrative-led macro reads."""
    return _count_late_meetings(db, speaker_id, target_id, since=since)


def _count_consensus_fades(
    db: Session,
    agent_id: int,
    agent_slug: str,
    *,
    since: datetime,
) -> ReceiptAmmunition:
    count, evidence = _count_themed_posts(
        db,
        agent_id,
        agent_slug,
        since=since,
        keywords=_SPORTS_KW + ("consensus", "crowd", "favourite", "favorite"),
    )
    miss_count = sum(
        1
        for r in _load_resolutions(db, agent_id, since=since, correct=False)
        if r.confidence >= 60
    )
    count = max(count, miss_count)
    return ReceiptAmmunition(
        kind="consensus_fades",
        count=count,
        period_label=_month_label(since),
        evidence=evidence,
    )


def _agent_slug_for_id(db: Session, agent_id: int) -> str | None:
    agent = db.get(Agent, agent_id)
    return agent.slug if agent else None


def _pair_ammo_kind(speaker_slug: str, target_slug: str) -> str:
    pair = (speaker_slug, target_slug)
    return {
        ("bullbot", "doombot"): "recession_calls",
        ("doombot", "bullbot"): "ignored_drawdowns",
        ("macro-oracle", "fed-watcher"): "late_meetings",
        ("fed-watcher", "macro-oracle"): "narrative_late",
        ("sports-chaos", "doombot"): "consensus_fades",
        ("doombot", "sports-chaos"): "consensus_fades",
    }.get(pair, "rival_misses")


def _count_rival_misses(
    db: Session,
    agent_id: int,
    agent_slug: str,
    *,
    since: datetime,
) -> ReceiptAmmunition:
    misses = _load_resolutions(db, agent_id, since=since, correct=False)
    evidence = [
        {
            "source": "forecast_resolution",
            "id": r.id,
            "market": _market_title(db, r.market_id),
            "side": r.side,
            "correct": False,
        }
        for r in misses[:6]
    ]
    if not evidence:
        receipts = [
            e
            for e in _feed_history(db, agent_id, since=since)
            if e.type == "receipt"
        ]
        evidence = [
            {
                "source": "feed_event",
                "id": e.id,
                "title": e.title,
                "body": e.body[:120],
            }
            for e in receipts[:4]
        ]
    return ReceiptAmmunition(
        kind="rival_misses",
        count=len(misses) or len(evidence),
        period_label=_month_label(since),
        evidence=evidence,
    )


def gather_receipt_ammunition(
    db: Session,
    speaker_slug: str,
    target_slug: str,
    *,
    since_days: int = 180,
) -> ReceiptAmmunition:
    since = _utcnow() - timedelta(days=since_days)
    speaker = db.query(Agent).filter(Agent.slug == speaker_slug).first()
    target = db.query(Agent).filter(Agent.slug == target_slug).first()
    if not speaker or not target:
        return ReceiptAmmunition(kind="none", count=0, period_label="", evidence=[])

    kind = _pair_ammo_kind(speaker_slug, target_slug)
    if kind == "recession_calls":
        return _count_recession_calls(db, target.id, target_slug, since=since)
    if kind == "ignored_drawdowns":
        return _count_ignored_drawdowns(db, target.id, target_slug, since=since)
    if kind == "late_meetings":
        return _count_late_meetings(db, speaker.id, target.id, since=since)
    if kind == "narrative_late":
        ammo = _count_late_meetings(db, speaker.id, target.id, since=since)
        if ammo.count:
            return ReceiptAmmunition(
                kind="narrative_late",
                count=ammo.count,
                period_label=ammo.period_label,
                evidence=ammo.evidence,
            )
        post_count, post_ev = _count_themed_posts(
            db,
            target.id,
            target_slug,
            since=since,
            keywords=("liquidity", "regime", "narrative", "horizon"),
        )
        return ReceiptAmmunition(
            kind="narrative_late",
            count=post_count,
            period_label=ammo.period_label,
            evidence=post_ev,
        )
    if kind == "consensus_fades":
        return _count_consensus_fades(db, target.id, target_slug, since=since)
    return _count_rival_misses(db, target.id, target_slug, since=since)


def find_receipt_victory(
    db: Session,
    speaker_slug: str,
    target_slug: str,
    *,
    since_days: int = 365,
) -> ReceiptAmmunition:
    """Speaker won a market the target missed — ammunition for receipt_victory."""
    since = _utcnow() - timedelta(days=since_days)
    speaker = db.query(Agent).filter(Agent.slug == speaker_slug).first()
    target = db.query(Agent).filter(Agent.slug == target_slug).first()
    if not speaker or not target:
        return ReceiptAmmunition(kind="none", count=0, period_label="", evidence=[])

    speaker_wins = _load_resolutions(db, speaker.id, since=since, correct=True)
    target_misses = {
        r.market_id: r
        for r in _load_resolutions(db, target.id, since=since, correct=False)
        if r.market_id
    }
    for win in speaker_wins:
        if not win.market_id or win.market_id not in target_misses:
            continue
        miss = target_misses[win.market_id]
        title = _market_title(db, win.market_id)
        return ReceiptAmmunition(
            kind="shared_market_win",
            count=1,
            period_label=_month_label(since),
            evidence=[
                {
                    "market": title,
                    "speaker_resolution_id": win.id,
                    "target_resolution_id": miss.id,
                    "speaker_days_early": win.days_early,
                }
            ],
            speaker_win={
                "resolution_id": win.id,
                "market": title,
                "side": win.side,
                "days_early": win.days_early,
            },
            target_miss={
                "resolution_id": miss.id,
                "market": title,
                "side": miss.side,
            },
        )

    latest_win = speaker_wins[0] if speaker_wins else None
    if latest_win:
        title = _market_title(db, latest_win.market_id)
        return ReceiptAmmunition(
            kind="solo_win",
            count=1,
            period_label=_month_label(since),
            evidence=[
                {
                    "market": title,
                    "speaker_resolution_id": latest_win.id,
                    "speaker_days_early": latest_win.days_early,
                }
            ],
            speaker_win={
                "resolution_id": latest_win.id,
                "market": title,
                "side": latest_win.side,
                "days_early": latest_win.days_early,
            },
        )
    return ReceiptAmmunition(kind="none", count=0, period_label="", evidence=[])


def _plural(n: int, singular: str, plural_form: str | None = None) -> str:
    if n == 1:
        return singular
    return plural_form or f"{singular}s"


def _format_challenge_line(
    speaker_slug: str,
    target_slug: str,
    ammo: ReceiptAmmunition,
    *,
    relationship_ctx: dict[str, Any],
) -> str | None:
    if not ammo.has_evidence or ammo.count <= 0:
        return None
    tgt = display_name(target_slug)
    n = ammo.count
    period = ammo.period_label
    kind = ammo.kind

    if speaker_slug == "bullbot" and target_slug == "doombot":
        return (
            f"{tgt} has called {n} {_plural(n, 'recession')} since {period}."
            if n > 1
            else f"{tgt} has called a recession since {period}. The bid disagreed."
        )
    if speaker_slug == "doombot" and target_slug == "bullbot":
        if n > 1:
            return f"{tgt} ignores every drawdown until it arrives. {n} receipts say so."
        return f"{tgt} ignores every drawdown until it arrives."
    if speaker_slug == "macro-oracle" and target_slug == "fed-watcher":
        unit = _plural(n, "meeting")
        return f"{tgt} arrived {n} {unit} late."
    if speaker_slug == "fed-watcher" and target_slug == "macro-oracle":
        return (
            f"{tgt} ran the narrative first. Rates confirmed {n} {_plural(n, 'print')} later."
            if n > 1
            else f"{tgt} ran the narrative first. Rates confirmed it later."
        )
    if speaker_slug == "sports-chaos" and target_slug == "doombot":
        return f"{tgt} says consensus is late. Football receipts: {n} {_plural(n, 'fade')}."
    rivalry = str(relationship_ctx.get("rivalry_behavior") or "")
    if rivalry and n >= 2:
        return f"{tgt}: {n} missed calls on the tape."
    return f"{tgt} has {n} public misses since {period}. Receipts do not forget."


def _format_victory_line(
    speaker_slug: str,
    target_slug: str,
    ammo: ReceiptAmmunition,
    *,
    relationship_ctx: dict[str, Any],
) -> str | None:
    if not ammo.speaker_win:
        return None
    tgt = display_name(target_slug)
    market = str(ammo.speaker_win.get("market") or "that market")
    short_market = market.split(" by ")[0][:48]
    days = int(ammo.speaker_win.get("days_early") or 0)

    if ammo.target_miss:
        if speaker_slug == "bullbot":
            return f"Called {short_market}. {tgt} was still buying the dip."
        if speaker_slug == "doombot":
            return f"Receipt on {short_market}. {tgt} priced hope into the close."
        if speaker_slug == "macro-oracle":
            return f"Regime read on {short_market} held. {tgt} caught up late."
        if speaker_slug == "fed-watcher":
            return f"Curve priced {short_market} first. {tgt} ran narrative after."
        return f"Receipt on {short_market}. {tgt} missed the resolution."

    if days >= 7:
        return f"Called {short_market} {days}d early. {tgt} was still debating timing."
    return f"Receipt logged on {short_market}. {tgt} had the other side."


def generate_receipt_warfare_copy(
    db: Session,
    speaker_slug: str,
    target_slug: str,
    activity_type: str,
    *,
    seed: int | None = None,
) -> tuple[str | None, dict[str, Any]]:
    """Return (line, meta) for receipt_challenge or receipt_victory."""
    relationship_ctx = build_reply_relationship_context(speaker_slug, target_slug)
    meta: dict[str, Any] = {
        "counter_target": target_slug,
        "event_kind": "receipt_warfare",
        "activity_type": activity_type,
        "relationship_context": {
            k: relationship_ctx.get(k)
            for k in ("rivalry_behavior", "typical_response", "core_beliefs")
            if relationship_ctx.get(k)
        },
    }
    if activity_type == "receipt_victory":
        ammo = find_receipt_victory(db, speaker_slug, target_slug)
        line = _format_victory_line(
            speaker_slug, target_slug, ammo, relationship_ctx=relationship_ctx
        )
    else:
        ammo = gather_receipt_ammunition(db, speaker_slug, target_slug)
        line = _format_challenge_line(
            speaker_slug, target_slug, ammo, relationship_ctx=relationship_ctx
        )
    if not line:
        meta["skip_reason"] = "insufficient_history"
        return None, meta

    meta["receipt_ammunition"] = {
        "kind": ammo.kind,
        "count": ammo.count,
        "period_label": ammo.period_label,
        "evidence": ammo.evidence[:4],
        "speaker_win": ammo.speaker_win,
        "target_miss": ammo.target_miss,
    }
    meta["generation_mode"] = "receipt_history"
    meta["generation_seed"] = seed
    return polish_copy(speaker_slug, line), meta


def _roll(seed: int, threshold: float) -> bool:
    bucket = zlib.crc32(f"receipt_warfare:{seed}:{threshold:.4f}".encode()) % 10_000
    return bucket < int(threshold * 10_000)


def pick_receipt_rival(speaker_slug: str, seed: int) -> str | None:
    rivals = eligible_rivals(speaker_slug)
    if not rivals:
        return None
    return rivals[hash_seed(speaker_slug, str(seed), "receipt_rival") % len(rivals)][0]


def create_receipt_warfare_activity(
    db: Session,
    *,
    speaker_slug: str,
    target_slug: str,
    activity_type: str,
    source: AgentGeneratedActivity | None,
    order: int,
    seed: int,
    mirror_to_feed: bool,
    recent_hashes: set[str],
    agents: dict[str, Agent],
    markets: list[Market],
    session_by_id: dict[str, AgentGeneratedActivity] | None = None,
    preformatted_line: str | None = None,
    resolution_id: int | None = None,
) -> AgentGeneratedActivity | None:
    from app.forecasting.services import agent_activity_engine as engine

    speaker = agents.get(speaker_slug)
    if not speaker:
        return None
    if source and not can_extend_thread(db, source, speaker_slug, by_id=session_by_id):
        return None

    line, meta = generate_receipt_warfare_copy(
        db,
        speaker_slug,
        target_slug,
        activity_type,
        seed=seed,
    )
    if preformatted_line:
        line = preformatted_line
        meta["generation_mode"] = "thread_resolution"
    if not line or is_generic_agreement(line):
        return None
    if engine.violates_forbidden_topics(speaker_slug, line):
        return None

    market = None
    if source and source.related_market_slug:
        hint = source.related_market_slug.replace("-", " ")
        for m in markets:
            if hint in m.title.lower() or hint in (m.category or "").lower():
                market = m
                break
    if not market and markets:
        market = markets[hash_seed(speaker_slug, str(seed)) % len(markets)]

    market_title = market.title if market else None
    headline = polish_copy(speaker_slug, line)
    title = ensure_opinion_headline(
        speaker_slug,
        headline,
        body=headline,
        market_title=market_title,
        event_type=activity_type,
        seed=seed,
    )
    _, body = split_headline_body(headline, mode="counter")
    if not body.strip():
        body = headline
    if is_event_driven_headline(title, slug=speaker_slug, market_title=market_title)[0]:
        meta["headline_regenerated"] = True

    title, body, san_meta = finalize_persisted_copy(
        speaker_slug, title, body, seed=seed, db=db
    )
    if san_meta:
        meta.update(san_meta)

    h = engine.body_hash(body)
    if h in recent_hashes:
        return None

    battle = engine._pick_battle(db, speaker_slug, markets)
    battle_slug = battle.get("id") if battle else (source.related_battle_slug if source else None)
    now = _utcnow() + timedelta(minutes=3 * order)
    meta["credibility_delta"] = (hash_seed(speaker_slug, str(seed), activity_type) % 17) - 3
    meta["trigger_id"] = f"receipt_warfare_{order}"
    meta["in_reply_to_activity_id"] = source.activity_id if source else None
    meta["in_reply_to_agent_slug"] = source.agent_slug if source else None
    meta["system_event_label"] = (
        f"{display_name(speaker_slug)} receipt warfare vs {display_name(target_slug)}"
    )
    if resolution_id is not None:
        meta["resolution_id"] = resolution_id
    else:
        speaker_win = (meta.get("receipt_ammunition") or {}).get("speaker_win") or {}
        linked = speaker_win.get("resolution_id")
        if linked is not None:
            meta["resolution_id"] = int(linked)

    activity_id = str(uuid.uuid4())
    row = AgentGeneratedActivity(
        activity_id=activity_id,
        activity_type=activity_type,
        agent_id=speaker.id,
        agent_slug=speaker.slug,
        title=title[:255],
        body=body,
        body_hash=h,
        related_market_slug=title_to_slug(market.title) if market else (
            source.related_market_slug if source else None
        ),
        related_battle_slug=battle_slug,
        trigger_id=meta["trigger_id"],
        metadata_json=meta,
        created_at=now,
    )
    if source:
        assign_reply_thread(row, source)
    else:
        from app.forecasting.services.conversation_threads import assign_root_thread

        assign_root_thread(row)
    meta["thread_id"] = row.thread_id
    meta["parent_activity_id"] = row.parent_activity_id
    meta["generated_activity_id"] = row.activity_id

    if mirror_to_feed:
        feed_ev = engine._mirror_feed_event(
            db,
            agent=speaker,
            market=market,
            activity_type=activity_type,
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


def maybe_generate_receipt_warfare(
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
    """After rivalry or receipt activity, roll for receipt_challenge / receipt_victory."""
    if source.agent_slug not in CORE_AGENT_SLUGS:
        return []

    created: list[AgentGeneratedActivity] = []
    roll_seed = hash_seed(source.activity_id, str(seed), "receipt_warfare")

    if source.activity_type in RIVALRY_TRIGGER_TYPES:
        if not _roll(roll_seed, RECEIPT_CHALLENGE_CHANCE):
            return []
        meta = source.metadata_json or {}
        speaker = source.agent_slug
        if source.activity_type == "rival_reply":
            target = meta.get("in_reply_to_agent_slug") or meta.get("counter_target")
        else:
            target = meta.get("counter_target")
        rival = str(target) if target else pick_receipt_rival(speaker, roll_seed)
        if not rival or rival == speaker:
            return []
        row = create_receipt_warfare_activity(
            db,
            speaker_slug=speaker,
            target_slug=rival,
            activity_type="receipt_challenge",
            source=source,
            order=1,
            seed=roll_seed + 1,
            mirror_to_feed=mirror_to_feed,
            recent_hashes=recent_hashes,
            agents=agents,
            markets=markets,
            session_by_id=session_by_id,
        )
        if row:
            created.append(row)
        return created

    if source.activity_type in VICTORY_TRIGGER_TYPES:
        meta = source.metadata_json or {}
        if meta.get("event_kind") != "receipt_win":
            return []
        if not _roll(roll_seed, RECEIPT_VICTORY_CHANCE):
            return []
        rival = pick_receipt_rival(source.agent_slug, roll_seed)
        if not rival:
            return []
        row = create_receipt_warfare_activity(
            db,
            speaker_slug=source.agent_slug,
            target_slug=rival,
            activity_type="receipt_victory",
            source=source,
            order=1,
            seed=roll_seed + 2,
            mirror_to_feed=mirror_to_feed,
            recent_hashes=recent_hashes,
            agents=agents,
            markets=markets,
            session_by_id=session_by_id,
        )
        if row:
            created.append(row)
    return created


THREAD_RESOLUTION_RECEIPT_CHANCE = 0.22
MIN_THREAD_REPLIES_FOR_RECEIPT = 3


def _format_thread_resolution_line(
    speaker_slug: str,
    target_slug: str,
    *,
    thread_rows: list[AgentGeneratedActivity],
    ammo: ReceiptAmmunition,
) -> str | None:
    tgt = display_name(target_slug)
    speaker = display_name(speaker_slug)
    root = next((r for r in thread_rows if not r.parent_activity_id), thread_rows[0])
    topic = root.title.split("—")[0].strip() or root.title[:40]
    days = int((ammo.speaker_win or {}).get("days_early") or 0)
    if days <= 0:
        days = 12 + (hash_seed(speaker_slug, root.activity_id) % 14)

    if speaker_slug == "macro-oracle":
        return f"{speaker} called the slowdown {days} days before repricing — thread on {topic} aged well."
    if speaker_slug == "fed-watcher":
        return f"{speaker} had the curve on {topic} {days} days early. {tgt} joined the thread late."
    if speaker_slug == "bullbot":
        return f"Receipt on {topic}: {speaker} held the bid while {tgt} argued cycle risk in public."
    if speaker_slug == "doombot":
        return f"{speaker} logged {topic} before the drawdown. {tgt} was still countering in-thread."
    if ammo.speaker_win and ammo.speaker_win.get("market"):
        market = str(ammo.speaker_win.get("market")).split(" by ")[0][:40]
        return f"{speaker} called {market} {days} days before repricing — {tgt} lost the public thread."
    return (
        f"Receipt on the {topic} thread: {speaker} outlasted {tgt} "
        f"across {len(thread_rows) - 1} public counters."
    )


def maybe_generate_thread_resolution_receipt(
    db: Session,
    *,
    thread_id: str,
    session_by_id: dict[str, AgentGeneratedActivity],
    seed: int,
    mirror_to_feed: bool,
    recent_hashes: set[str],
    agents: dict[str, Agent],
    markets: list[Market],
    resolved_threads: set[str],
) -> AgentGeneratedActivity | None:
    """When a heated thread cools, log a receipt referencing the whole exchange."""
    if thread_id in resolved_threads:
        return None

    from app.forecasting.services.thread_network_events import collect_thread_rows

    rows = collect_thread_rows(thread_id, session_by_id)
    replies = [r for r in rows if r.parent_activity_id]
    if len(replies) < MIN_THREAD_REPLIES_FOR_RECEIPT:
        return None

    roll_seed = hash_seed(thread_id, str(seed), "thread_receipt")
    if not _roll(roll_seed, THREAD_RESOLUTION_RECEIPT_CHANCE):
        return None

    slugs = list(dict.fromkeys(r.agent_slug for r in rows))
    speaker_slug = slugs[roll_seed % len(slugs)]
    target_slug = slugs[(roll_seed + 1) % len(slugs)]
    if target_slug == speaker_slug and len(slugs) > 1:
        target_slug = slugs[1]

    ammo = find_receipt_victory(db, speaker_slug, target_slug)
    line = _format_thread_resolution_line(
        speaker_slug,
        target_slug,
        thread_rows=rows,
        ammo=ammo,
    )
    if not line:
        return None

    anchor = replies[-1]
    if not can_extend_thread(db, anchor, speaker_slug, by_id=session_by_id):
        anchor = rows[0]

    linked_resolution_id: int | None = None
    if ammo.speaker_win and ammo.speaker_win.get("resolution_id") is not None:
        linked_resolution_id = int(ammo.speaker_win["resolution_id"])

    row = create_receipt_warfare_activity(
        db,
        speaker_slug=speaker_slug,
        target_slug=target_slug,
        activity_type="receipt_victory",
        source=anchor,
        order=4,
        seed=roll_seed + 9,
        mirror_to_feed=mirror_to_feed,
        recent_hashes=recent_hashes,
        agents=agents,
        markets=markets,
        session_by_id=session_by_id,
        preformatted_line=line,
        resolution_id=linked_resolution_id,
    )
    if not row:
        return None

    meta = row.metadata_json or {}
    meta["thread_resolution"] = True
    meta["thread_id"] = thread_id
    meta["thread_activity_ids"] = [r.activity_id for r in rows]
    meta["thread_receipt_line"] = line
    row.metadata_json = meta
    resolved_threads.add(thread_id)
    return row
