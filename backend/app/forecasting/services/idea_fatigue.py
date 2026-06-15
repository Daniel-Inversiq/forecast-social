"""Idea-level fatigue — rotate semantic takes, not just exact signature phrases."""

from __future__ import annotations

import re
from collections import Counter
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy.orm import Session

from app.forecasting.models import AgentGeneratedActivity
from app.forecasting.services.character_fingerprints import enforce_character_dominance, fingerprint_passes
from app.forecasting.services.utils import hash_seed

IDEA_FATIGUE_WINDOW_HOURS = 24
IDEA_FATIGUE_MAX_USES = 2

_idea_fatigue_hits = 0


@dataclass(frozen=True)
class IdeaBucket:
    id: str
    patterns: tuple[str, ...]
    headlines: tuple[str, ...]


IDEA_BUCKETS: dict[str, tuple[IdeaBucket, ...]] = {
    "bullbot": (
        IdeaBucket(
            "dip_buying",
            (
                r"still buying",
                r"dip is still there",
                r"dip still",
                r"buying the (dip|bid|pullback)",
                r"entry level",
            ),
            (
                "Momentum persists — tape hasn't broken.",
                "The bid is still there. Timing is the job.",
                "Buyers keep showing up on the pullback.",
                "Sold the news? Good. That is where the next leg starts.",
            ),
        ),
        IdeaBucket(
            "crowd_underpositioned",
            (
                r"crowd.{0,20}(scared|underpositioned|too bearish)",
                r"wall of worry",
                r"everyone wants the dip",
                r"positioning.{0,15}light",
            ),
            (
                "You're fighting the tape.",
                "Still too bearish for this tape.",
                "Risk is the opportunity — crowd is late.",
                "The long side wins. It always does.",
            ),
        ),
        IdeaBucket(
            "momentum_tape",
            (
                r"fighting the tape",
                r"momentum",
                r"buyers keep showing up",
                r"breadth held",
                r"reflexivity",
            ),
            (
                "Timing is the job.",
                "Risk-on didn't capitulate.",
                "That's a fade setup, not a thesis.",
                "Momentum does not care about valuation.",
            ),
        ),
        IdeaBucket(
            "risk_on_flows",
            (
                r"risk[- ]on",
                r"flows still",
                r"upside",
                r"next rip",
            ),
            (
                "The wall of worry is still fuel.",
                "Next rip loading — flows matter.",
                "Risk is the opportunity.",
            ),
        ),
        IdeaBucket(
            "bears_late",
            (
                r"still too bearish",
                r"fade setup",
                r"bears.{0,15}late",
                r"panic[- ]chasing",
            ),
            (
                "The bid didn't leave.",
                "Crowd still scared — tape isn't.",
                "Everyone wants the dip. Nobody buys it.",
            ),
        ),
    ),
    "fed-watcher": (
        IdeaBucket(
            "curve_signal",
            (
                r"curve is the signal",
                r"yield curve",
                r"curve (moved|disagrees|steepen|flatten)",
                r"2s10s",
            ),
            (
                "Front-end leads. Drama lags.",
                "Path first. Narrative second.",
                "The 2-year is the tell.",
                "One of them is wrong.",
            ),
        ),
        IdeaBucket(
            "front_end_leads",
            (
                r"front[- ]end",
                r"front end leads",
                r"rates saw it already",
                r"basis points moved",
            ),
            (
                "Markets are running ahead of policy.",
                "Desk literal — path repriced.",
                "September modal repriced.",
                "Watching the statement language, not the decision.",
            ),
        ),
        IdeaBucket(
            "dot_plot_divergence",
            (
                r"dot plot",
                r"september modal",
                r"market.{0,20}diverge",
                r"fomc",
            ),
            (
                "The dot plot says one thing. The market prices another.",
                "The curve moved first.",
                "Path repriced before the headline.",
            ),
        ),
        IdeaBucket(
            "real_rates",
            (
                r"real rates",
                r"term premium",
                r"breakeven",
            ),
            (
                "Real rates still doing the work.",
                "Term premium repriced — curve noticed.",
                "Breakevens moved before the equity tape.",
            ),
        ),
        IdeaBucket(
            "market_pricing",
            (
                r"market pricing",
                r"path repriced",
                r"cut.{0,20}priced",
                r"priced.{0,20}cut",
            ),
            (
                "Cut timing priced before the headline.",
                "Market pricing leads the statement.",
                "Path first — narrative second.",
            ),
        ),
    ),
    "doombot": (
        IdeaBucket(
            "soft_landing_cope",
            (
                r"soft landing.{0,20}cope",
                r"cope.{0,20}soft landing",
                r"soft landing",
            ),
            (
                "Consensus is usually late.",
                "Everyone believes that right before it breaks.",
                "Priced for perfection.",
                "The tape does not lie. The narrative does.",
            ),
        ),
        IdeaBucket(
            "credit_fragility",
            (
                r"credit impulse",
                r"fragility",
                r"funding stress",
                r"ig spreads",
                r"hy says",
            ),
            (
                "Mechanism intact — timing isn't.",
                "Credit breaks on the lag.",
                "Fragility doesn't disappear.",
                "Bear market rally, not a turn.",
            ),
        ),
        IdeaBucket(
            "recession_window",
            (
                r"recession window",
                r"recession odds",
                r"contraction",
                r"gdp shrink",
            ),
            (
                "Early, not wrong.",
                "Not a prediction. A pattern.",
                "The crowd bought the narrative.",
                "Nobody is pricing the downside.",
            ),
        ),
        IdeaBucket(
            "liquidity_break",
            (
                r"liquidity break",
                r"liquidity.{0,15}(dry|tight|stress)",
                r"funding.{0,15}stress",
            ),
            (
                "Consensus is priced.",
                "The bid is narrative, not macro.",
                "Every cycle ends the same way.",
            ),
        ),
        IdeaBucket(
            "consensus_late",
            (
                r"consensus is (usually )?late",
                r"consensus is priced",
                r"everyone believes",
                r"late[- ]cycle",
            ),
            (
                "That's late-cycle thinking.",
                "Priced for perfection.",
                "The tape lies less than the narrative.",
                "Not a pivot.",
            ),
        ),
    ),
}

_COMPILED: dict[str, list[tuple[IdeaBucket, list[re.Pattern[str]]]]] = {}


def _compiled_buckets(slug: str) -> list[tuple[IdeaBucket, list[re.Pattern[str]]]]:
    if slug not in _COMPILED:
        rows: list[tuple[IdeaBucket, list[re.Pattern[str]]]] = []
        for bucket in IDEA_BUCKETS.get(slug, ()):
            patterns = [re.compile(p, re.I) for p in bucket.patterns]
            rows.append((bucket, patterns))
        _COMPILED[slug] = rows
    return _COMPILED[slug]


def idea_fatigue_hits() -> int:
    return _idea_fatigue_hits


def reset_idea_fatigue_hits() -> None:
    global _idea_fatigue_hits
    _idea_fatigue_hits = 0


def record_idea_fatigue_hit() -> None:
    global _idea_fatigue_hits
    _idea_fatigue_hits += 1


def _utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def classify_idea_bucket(slug: str, text: str) -> str | None:
    """Map copy to a semantic idea bucket (paraphrases share buckets)."""
    blob = (text or "").strip()
    if not blob:
        return None
    best_id: str | None = None
    best_score = 0
    for bucket, patterns in _compiled_buckets(slug):
        score = sum(1 for pat in patterns if pat.search(blob))
        if score > best_score:
            best_score = score
            best_id = bucket.id
    return best_id


def load_idea_usage(
    db: Session,
    *,
    hours: int = IDEA_FATIGUE_WINDOW_HOURS,
) -> dict[tuple[str, str], int]:
    """Count idea_bucket usage per agent over the rolling window."""
    cutoff = _utcnow() - timedelta(hours=hours)
    rows = (
        db.query(AgentGeneratedActivity)
        .filter(AgentGeneratedActivity.created_at >= cutoff)
        .order_by(AgentGeneratedActivity.created_at.desc())
        .limit(800)
        .all()
    )
    usage: dict[tuple[str, str], int] = {}
    for row in rows:
        meta = row.metadata_json or {}
        bucket = meta.get("idea_bucket")
        if not isinstance(bucket, str) or not bucket:
            bucket = classify_idea_bucket(row.agent_slug, f"{row.title or ''}\n{row.body or ''}")
        if not bucket:
            continue
        key = (row.agent_slug, bucket)
        usage[key] = usage.get(key, 0) + 1
    return usage


def is_idea_fatigued(
    slug: str,
    bucket_id: str,
    usage: dict[tuple[str, str], int],
    *,
    max_uses: int = IDEA_FATIGUE_MAX_USES,
) -> bool:
    return usage.get((slug, bucket_id), 0) >= max_uses


def pick_alternate_idea_bucket(
    slug: str,
    *,
    seed: int,
    usage: dict[tuple[str, str], int],
    exclude: set[str] | None = None,
) -> IdeaBucket | None:
    """Choose a non-fatigued idea bucket for rotation."""
    exclude_ids = set(exclude or set())
    buckets = IDEA_BUCKETS.get(slug, ())
    if not buckets:
        return None

    fresh = [
        b
        for b in buckets
        if b.id not in exclude_ids and not is_idea_fatigued(slug, b.id, usage)
    ]
    if fresh:
        idx = hash_seed(slug, str(seed), "idea_bucket") % len(fresh)
        return fresh[idx]

    least_used = sorted(
        buckets,
        key=lambda b: usage.get((slug, b.id), 0),
    )
    for bucket in least_used:
        if bucket.id not in exclude_ids:
            return bucket
    return None


def pick_headline_for_bucket(bucket: IdeaBucket, *, slug: str, seed: int) -> str:
    if not bucket.headlines:
        return ""
    idx = hash_seed(slug, bucket.id, str(seed)) % len(bucket.headlines)
    return bucket.headlines[idx]


def rewrite_fatigued_idea(
    slug: str,
    title: str,
    body: str,
    *,
    usage: dict[tuple[str, str], int],
    seed: int,
) -> tuple[str, str, bool, str | None]:
    """
    Rotate to an alternate idea bucket when the current take is fatigued.
    Returns (title, body, did_rewrite, idea_bucket).
    """
    combined = f"{title}\n{body}".strip()
    current = classify_idea_bucket(slug, combined)
    if not current or not is_idea_fatigued(slug, current, usage):
        return title, body, False, current

    alt_bucket = pick_alternate_idea_bucket(slug, seed=seed, usage=usage, exclude={current})
    if alt_bucket is None:
        return title, body, False, current

    headline = pick_headline_for_bucket(alt_bucket, slug=slug, seed=seed)
    if not headline:
        return title, body, False, current

    polished, _fp_meta = enforce_character_dominance(slug, headline, seed=seed)
    if not fingerprint_passes(slug, polished):
        return title, body, False, current

    record_idea_fatigue_hit()
    return polished[:255], body, True, alt_bucket.id


def apply_idea_fatigue(
    db: Session | None,
    slug: str,
    title: str,
    body: str,
    *,
    seed: int | None = None,
) -> tuple[str, str, dict[str, Any]]:
    """Gate before persistence — rotate fatigued idea buckets."""
    meta: dict[str, Any] = {}
    if db is None:
        bucket = classify_idea_bucket(slug, f"{title}\n{body}")
        if bucket:
            meta["idea_bucket"] = bucket
        return title, body, meta

    usage = load_idea_usage(db)
    new_title, new_body, did_rewrite, bucket = rewrite_fatigued_idea(
        slug,
        title,
        body,
        usage=usage,
        seed=seed or 0,
    )
    if did_rewrite:
        meta["idea_fatigue"] = "alternate_bucket"
    if bucket:
        meta["idea_bucket"] = bucket
    elif not did_rewrite:
        detected = classify_idea_bucket(slug, f"{new_title}\n{new_body}")
        if detected:
            meta["idea_bucket"] = detected
    return new_title, new_body, meta


def compute_idea_debug_stats(
    db: Session,
    *,
    hours: int = IDEA_FATIGUE_WINDOW_HOURS,
) -> dict[str, Any]:
    cutoff = _utcnow() - timedelta(hours=hours)
    rows = (
        db.query(AgentGeneratedActivity)
        .filter(AgentGeneratedActivity.created_at >= cutoff)
        .order_by(AgentGeneratedActivity.created_at.desc())
        .limit(800)
        .all()
    )
    per_agent: dict[str, Counter[str]] = {}
    repeated = 0
    classified = 0
    usage: dict[tuple[str, str], int] = {}

    for row in rows:
        meta = row.metadata_json or {}
        bucket = meta.get("idea_bucket")
        if not isinstance(bucket, str) or not bucket:
            bucket = classify_idea_bucket(row.agent_slug, f"{row.title or ''}\n{row.body or ''}")
        if not bucket:
            continue
        classified += 1
        key = (row.agent_slug, bucket)
        usage[key] = usage.get(key, 0) + 1
        per_agent.setdefault(row.agent_slug, Counter())[bucket] += 1

    for count in usage.values():
        if count > IDEA_FATIGUE_MAX_USES:
            repeated += count - IDEA_FATIGUE_MAX_USES

    top_agent_idea_buckets = {
        slug: dict(counter.most_common(5)) for slug, counter in sorted(per_agent.items())
    }
    repeated_rate = round(repeated / max(classified, 1), 4)

    return {
        "idea_fatigue_hits": idea_fatigue_hits(),
        "top_agent_idea_buckets": top_agent_idea_buckets,
        "repeated_idea_rate_24h": repeated_rate,
    }
