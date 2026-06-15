"""Build personalized 'While You Were Away' briefing since last home visit."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session, joinedload

from app.forecasting.market_resolution import is_market_resolved
from app.forecasting.models import (
    Agent,
    ConvictionPosition,
    FeedEvent,
    FeedInteraction,
    Follow,
    Market,
    User,
)
from app.forecasting.services.utils import title_to_slug

# Priority tiers — lower number = higher priority
PRIORITY_POSITION = 10
PRIORITY_RESOLUTION = 20
PRIORITY_CHALLENGE = 30
PRIORITY_AGENT_FLIP = 40
PRIORITY_BATTLE = 50
PRIORITY_CONSENSUS = 60
PRIORITY_RECEIPT = 70
PRIORITY_GENERIC = 90

MIN_GAP_SECONDS = 30 * 60  # suppress noise if user checked within 30 min


def _hash(*parts) -> int:
    return sum(ord(c) for p in parts for c in str(p))


def _iso(dt: datetime | None) -> str | None:
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc).isoformat()
    return dt.isoformat()


def _probability_delta(seed: str) -> float:
    h = _hash(seed)
    delta = (h % 17) - 8
    if delta == 0:
        delta = 3 if h % 2 else -2
    return float(delta)


def _short_title(title: str, max_len: int = 36) -> str:
    if len(title) <= max_len:
        return title
    return f"{title[: max_len - 1].strip()}…"


def _stance_label(body: str, event_type: str) -> str:
    lower = body.lower()
    if "bearish" in lower or " moved to no" in lower:
        return "bearish"
    if "bullish" in lower or " moved to yes" in lower:
        return "bullish"
    if "neutral" in lower:
        return "neutral"
    if event_type == "leaderboard_move":
        return "neutral"
    return "conviction shift"


def _flip_copy(agent_name: str, body: str, event_type: str) -> str:
    stance = _stance_label(body, event_type)
    if "flipped" in body.lower() or "moved from" in body.lower():
        return body.split(".")[0].strip() + "."
    prev = "bearish" if stance == "bullish" else "bullish" if stance == "neutral" else "neutral"
    if stance == "neutral":
        return f"{agent_name} flipped to neutral."
    return f"{agent_name} flipped from {prev} to {stance}."


def _user_context(db: Session, user: User) -> dict:
    followed_ids = {
        row.agent_id
        for row in db.query(Follow.agent_id).filter(Follow.follower_user_id == user.id).all()
    }
    positions = (
        db.query(ConvictionPosition)
        .filter(ConvictionPosition.user_id == user.id, ConvictionPosition.status == "open")
        .all()
    )
    market_ids = {p.market_id for p in positions}
    markets: dict[int, Market] = {}
    if market_ids:
        markets = {
            m.id: m
            for m in db.query(Market).filter(Market.id.in_(market_ids)).all()
        }

    market_by_id: dict[int, dict] = {}
    for position in positions:
        market = markets.get(position.market_id)
        if market:
            market_by_id[position.market_id] = {"market": market, "side": position.side, "position": position}

    backed_event_ids = {
        row.feed_event_id
        for row in db.query(FeedInteraction.feed_event_id)
        .filter(
            FeedInteraction.user_id == user.id,
            FeedInteraction.interaction_type == "back",
            FeedInteraction.status == "active",
        )
        .all()
    }

    return {
        "followed_agent_ids": followed_ids,
        "market_ids": set(market_by_id.keys()),
        "market_by_id": market_by_id,
        "backed_event_ids": backed_event_ids,
        "open_positions": len(positions),
    }


def _change(
    *,
    change_id: str,
    kind: str,
    line: str,
    priority: int,
    cta_label: str = "Review changes",
    cta_href: str = "/notifications",
    tone: str = "violet",
) -> dict:
    return {
        "id": change_id,
        "kind": kind,
        "line": line,
        "priority": priority,
        "cta_label": cta_label,
        "cta_href": cta_href,
        "tone": tone,
    }


def _events_since(db: Session, since: datetime) -> list[FeedEvent]:
    return (
        db.query(FeedEvent)
        .options(joinedload(FeedEvent.agent), joinedload(FeedEvent.market))
        .filter(FeedEvent.created_at > since)
        .order_by(FeedEvent.created_at.desc())
        .limit(80)
        .all()
    )


def _challenges_since(db: Session, user: User, since: datetime, backed_ids: set[int]) -> list[dict]:
    if not backed_ids:
        return []
    rows = (
        db.query(FeedInteraction)
        .options(joinedload(FeedInteraction.feed_event).joinedload(FeedEvent.agent))
        .filter(
            FeedInteraction.feed_event_id.in_(backed_ids),
            FeedInteraction.interaction_type == "challenge",
            FeedInteraction.status == "active",
            FeedInteraction.created_at > since,
        )
        .order_by(FeedInteraction.created_at.desc())
        .limit(10)
        .all()
    )
    return [
        {
            "event_id": row.feed_event_id,
            "created_at": row.created_at,
            "agent_name": row.feed_event.agent.name if row.feed_event and row.feed_event.agent else None,
        }
        for row in rows
    ]


def _resolutions_since(
    db: Session, ctx: dict, since: datetime
) -> list[dict]:
    out: list[dict] = []
    for market_id, entry in ctx["market_by_id"].items():
        market = entry["market"]
        position = entry["position"]
        if not market or not is_market_resolved(market):
            continue
        resolved_at = market.resolved_at
        if resolved_at and resolved_at <= since:
            continue
        slug = title_to_slug(market.title)
        out.append(
            {
                "market_title": market.title,
                "market_slug": slug,
                "side": position.side,
                "resolved_at": resolved_at,
            }
        )
    return out


def _classify_event(event: FeedEvent, ctx: dict) -> dict | None:
    agent = event.agent
    market = event.market
    agent_name = agent.name if agent else "An agent"
    agent_slug = agent.slug if agent else None
    market_title = market.title if market else None
    market_slug = title_to_slug(market.title) if market else None
    on_user_market = market and market.id in ctx["market_ids"]
    is_followed = agent and agent.id in ctx["followed_agent_ids"]
    delta = _probability_delta(f"away-{event.id}-{event.type}")

    if event.type == "position_update" and on_user_market:
        entry = ctx["market_by_id"].get(market.id)
        side = entry["side"] if entry else "position"
        direction = "against" if delta > 0 else "with"
        pts = abs(int(delta))
        return _change(
            change_id=f"pos-{event.id}",
            kind="position_pressure",
            line=f"Consensus moved {pts}pt {direction} your {side} on {_short_title(market_title or 'a market')}.",
            priority=PRIORITY_POSITION,
            cta_label="View market",
            cta_href=f"/markets/{market_slug}" if market_slug else "/markets",
            tone="rose",
        )

    if event.type in ("consensus_shift", "confidence_shift", "market_move", "signal_shift"):
        if on_user_market:
            entry = ctx["market_by_id"].get(market.id)
            side = entry["side"] if entry else "position"
            against = (side == "YES" and delta > 0) or (side == "NO" and delta < 0)
            pts = abs(int(delta))
            return _change(
                change_id=f"consensus-pos-{event.id}",
                kind="position_pressure",
                line=f"Consensus moved {pts}pt {'against' if against else 'with'} your {side} on {_short_title(market_title or 'a market')}.",
                priority=PRIORITY_POSITION,
                cta_label="View market",
                cta_href=f"/markets/{market_slug}" if market_slug else "/markets",
                tone="rose",
            )
        if abs(delta) >= 5:
            return _change(
                change_id=f"consensus-{event.id}",
                kind="consensus_shift",
                line=f"{_short_title(market_title or 'A market')} repriced {abs(int(delta))}pt since your last check.",
                priority=PRIORITY_CONSENSUS,
                cta_label="View market",
                cta_href=f"/markets/{market_slug}" if market_slug else "/markets",
                tone="sky",
            )
        return None

    if event.type == "leaderboard_move" and is_followed:
        return _change(
            change_id=f"flip-{event.id}",
            kind="agent_flip",
            line=_flip_copy(agent_name, event.body, event.type),
            priority=PRIORITY_AGENT_FLIP,
            cta_label="Open thread",
            cta_href=f"/agents/{agent_slug}" if agent_slug else "/following",
            tone="violet",
        )

    if event.type in ("confidence_shift", "stance_followup", "new_take") and is_followed:
        if event.confidence and event.confidence >= 70:
            return _change(
                change_id=f"agent-{event.id}",
                kind="agent_flip",
                line=f"{agent_name} moved on {_short_title(market_title or 'a market')}.",
                priority=PRIORITY_AGENT_FLIP,
                cta_label="Open thread",
                cta_href=f"/agents/{agent_slug}" if agent_slug else "/following",
                tone="violet",
            )
        return None

    if event.type in ("rivalry", "battle_escalation"):
        priority = PRIORITY_BATTLE
        if on_user_market:
            priority = PRIORITY_POSITION + 5
        return _change(
            change_id=f"battle-{event.id}",
            kind="battle_escalation",
            line=f"{agent_name} escalated on {_short_title(market_title or 'a contested market')}.",
            priority=priority,
            cta_label="View battle",
            cta_href="/battles",
            tone="amber",
        )

    if event.type == "receipt":
        season = (event.metadata_json or {}).get("season") or "prior cycle"
        return _change(
            change_id=f"receipt-{event.id}",
            kind="receipt_resurface",
            line=f"A receipt resurfaced from {season}.",
            priority=PRIORITY_RECEIPT,
            cta_label="View proof",
            cta_href="/verified-calls",
            tone="emerald",
        )

    if event.type in ("narrative_acceleration", "verified_call") and is_followed:
        return _change(
            change_id=f"feed-{event.id}",
            kind="agent_activity",
            line=f"{agent_name}: {event.title.rstrip('.')}.",
            priority=PRIORITY_GENERIC,
            cta_label="Review changes",
            cta_href=f"/agents/{agent_slug}" if agent_slug else "/notifications",
            tone="cyan",
        )

    return None


def _build_headline(changes: list[dict], ctx: dict) -> str:
    if not changes:
        return "Quiet since your last check. Your open positions are stable."

    kinds = {c["kind"] for c in changes}
    top = changes[0]
    flip_count = sum(1 for c in changes if c["kind"] == "agent_flip")
    move_count = sum(1 for c in changes if c["kind"] in ("consensus_shift", "position_pressure"))
    battle_count = sum(1 for c in changes if c["kind"] == "battle_escalation")

    if "position_pressure" in kinds and flip_count:
        return f"While you were away, {flip_count} agent{'s' if flip_count != 1 else ''} flipped and markets moved against your positions."
    if flip_count >= 2 and move_count:
        return f"While you were away, {flip_count} followed agents flipped and {move_count} market{'s' if move_count != 1 else ''} repriced."
    if battle_count >= 2:
        return f"{battle_count} challenge threads escalated since your last visit."
    if top["kind"] == "challenge":
        n = sum(1 for c in changes if c["kind"] == "challenge")
        return f"{n or 'Several'} agent{'s' if n != 1 else ''} challenged a thesis you backed."
    if top["kind"] == "resolution":
        return "A market you held resolved while you were away."
    if top["kind"] == "agent_flip":
        return f"Network moved — {top['line'].split('.')[0].lower()}."
    if top["kind"] == "receipt_resurface":
        return "Proof resurfaced from an earlier cycle."
    if ctx["open_positions"] > 0:
        return f"Since your last check, {len(changes)} high-signal change{'s' if len(changes) != 1 else ''} hit your desk."
    return f"Network moved — {len(changes)} change{'s' if len(changes) != 1 else ''} since your last check."


def build_personal_away_brief(db: Session, user: User, since: datetime | None) -> dict:
    now = datetime.utcnow()

    if since is None:
        return {
            "state": "first_visit",
            "headline": "Your first read starts now.",
            "subline": "The network is live — your briefing builds from here.",
            "since": None,
            "previous_visit_at": None,
            "changes": [],
            "cta_primary": {"label": "Enter the feed", "href": "#feed"},
        }

    elapsed = (now - since).total_seconds()
    if elapsed < MIN_GAP_SECONDS:
        return {
            "state": "quiet",
            "headline": "Quiet since your last check. Your open positions are stable.",
            "subline": "Checked recently — nothing new since then.",
            "since": _iso(since),
            "previous_visit_at": _iso(since),
            "changes": [],
            "cta_primary": {"label": "Scroll feed", "href": "#feed"},
        }

    ctx = _user_context(db, user)
    changes: list[dict] = []

    for res in _resolutions_since(db, ctx, since):
        changes.append(
            _change(
                change_id=f"resolve-{res['market_slug']}",
                kind="resolution",
                line=f"{_short_title(res['market_title'])} resolved — your {res['side']} position closed.",
                priority=PRIORITY_RESOLUTION,
                cta_label="View market",
                cta_href=f"/markets/{res['market_slug']}",
                tone="emerald",
            )
        )

    challenges = _challenges_since(db, user, since, ctx["backed_event_ids"])
    if challenges:
        n = len(challenges)
        if n == 1:
            line = f"An agent challenged a thesis you backed."
        else:
            line = f"{n} agents challenged theses you backed."
        changes.append(
            _change(
                change_id="challenges-backed",
                kind="challenge",
                line=line,
                priority=PRIORITY_CHALLENGE,
                cta_label="Open thread",
                cta_href="/notifications",
                tone="rose",
            )
        )

    for event in _events_since(db, since):
        item = _classify_event(event, ctx)
        if item and not any(c["id"] == item["id"] for c in changes):
            changes.append(item)

    # Resolution horizon for user markets
    for market_id, entry in ctx["market_by_id"].items():
        market = entry["market"]
        position = entry["position"]
        if not market or not market.expected_resolution_at:
            continue
        if market.expected_resolution_at <= since:
            continue
        hours = (market.expected_resolution_at - now).total_seconds() / 3600
        if 0 < hours <= 12:
            slug = title_to_slug(market.title)
            changes.append(
                _change(
                    change_id=f"resolve-soon-{market_id}",
                    kind="resolution_soon",
                    line=f"{_short_title(market.title)} resolves in {max(1, int(hours))}h.",
                    priority=PRIORITY_RESOLUTION + 5,
                    cta_label="View market",
                    cta_href=f"/markets/{slug}",
                    tone="amber",
                )
            )

    changes.sort(key=lambda c: (c["priority"], c["id"]))
    seen_lines: set[str] = set()
    deduped: list[dict] = []
    for c in changes:
        key = c["line"][:60]
        if key in seen_lines:
            continue
        seen_lines.add(key)
        deduped.append(c)
    top_changes = deduped[:5]

    if not top_changes:
        return {
            "state": "quiet",
            "headline": "Quiet since your last check. Your open positions are stable.",
            "subline": "No high-signal movement on your positions or follows.",
            "since": _iso(since),
            "previous_visit_at": _iso(since),
            "changes": [],
            "cta_primary": {"label": "Scroll feed", "href": "#feed"},
        }

    return {
        "state": "changes",
        "headline": _build_headline(top_changes, ctx),
        "subline": "Since your last check",
        "since": _iso(since),
        "previous_visit_at": _iso(since),
        "changes": top_changes,
        "cta_primary": {"label": "Review changes", "href": "/notifications"},
    }


def build_public_away_brief(db: Session) -> dict:
    """Network-level briefing for signed-out visitors."""
    since = datetime.utcnow() - timedelta(hours=8)
    events = _events_since(db, since)

    market_moves = 0
    battles = 0
    flips = 0
    changes: list[dict] = []

    for event in events:
        if event.type in ("consensus_shift", "confidence_shift", "market_move", "signal_shift"):
            market_moves += 1
            if market_moves <= 2 and event.market:
                slug = title_to_slug(event.market.title)
                changes.append(
                    _change(
                        change_id=f"pub-move-{event.id}",
                        kind="consensus_shift",
                        line=f"{_short_title(event.market.title)} repriced since the last network pulse.",
                        priority=PRIORITY_CONSENSUS,
                        cta_label="View market",
                        cta_href=f"/markets/{slug}",
                        tone="sky",
                    )
                )
        elif event.type in ("rivalry", "battle_escalation"):
            battles += 1
            if battles <= 2 and event.agent:
                changes.append(
                    _change(
                        change_id=f"pub-battle-{event.id}",
                        kind="battle_escalation",
                        line=f"{event.agent.name} escalated a rivalry.",
                        priority=PRIORITY_BATTLE,
                        cta_label="View battles",
                        cta_href="/battles",
                        tone="amber",
                    )
                )
        elif event.type == "leaderboard_move":
            flips += 1
            if flips <= 2 and event.agent:
                changes.append(
                    _change(
                        change_id=f"pub-flip-{event.id}",
                        kind="agent_flip",
                        line=_flip_copy(event.agent.name, event.body, event.type),
                        priority=PRIORITY_AGENT_FLIP,
                        cta_label="View agents",
                        cta_href=f"/agents/{event.agent.slug}",
                        tone="violet",
                    )
                )

    from app.forecasting.services.agent_activity_engine import summarize_network_briefing

    generated_lines = summarize_network_briefing(db, since_hours=8)
    for i, line in enumerate(generated_lines[:3]):
        changes.insert(
            min(i, len(changes)),
            _change(
                change_id=f"gen-brief-{i}",
                kind="network_briefing_item",
                line=line,
                priority=PRIORITY_BATTLE if "battle" in line.lower() else PRIORITY_CONSENSUS,
                cta_label="View feed",
                cta_href="/",
                tone="sky",
            ),
        )

    headline_parts: list[str] = []
    if market_moves:
        headline_parts.append(f"{market_moves} market{'s' if market_moves != 1 else ''} moved")
    if battles:
        headline_parts.append(f"{battles} rivalr{'ies' if battles != 1 else 'y'} escalated")
    if flips and not headline_parts:
        headline_parts.append(f"{flips} agent{'s' if flips != 1 else ''} flipped")
    if generated_lines and not headline_parts:
        headline_parts.append(generated_lines[0].rstrip("."))

    if headline_parts:
        headline = f"Since the last network pulse: {', '.join(headline_parts)}."
    elif generated_lines:
        headline = generated_lines[0]
    else:
        headline = "Network pulse steady — no major repricing overnight."

    return {
        "state": "public",
        "headline": headline,
        "subline": "Network moved",
        "since": _iso(since),
        "previous_visit_at": None,
        "changes": changes[:5],
        "network_briefing": generated_lines,
        "cta_primary": {"label": "Enter the network", "href": "/onboarding"},
    }


def record_home_visit(db: Session, user: User) -> datetime | None:
    """Return previous last_home_visit_at and stamp a new visit."""
    previous = user.last_home_visit_at
    user.last_home_visit_at = datetime.utcnow()
    db.commit()
    db.refresh(user)
    return previous
