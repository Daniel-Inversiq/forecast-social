"""Featured Reputation Marks — user-equipped prestige display."""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.forecasting.models import Agent, ReputationMilestone, User, UserProfile
from app.forecasting.reputation.milestones import MILESTONE_CATALOG, select_featured_milestones

MAX_FEATURED_MARKS = 3

# Key-specific cryptic symbols (category fallback otherwise)
MILESTONE_SYMBOLS: dict[str, str] = {
    "early_signal": "◈",
    "ahead_of_consensus": "◇",
    "timing_edge": "◎",
    "first_mover": "◉",
    "verified_forecaster": "✦",
    "calibration_locked": "◆",
    "five_call_streak": "✧",
    "precision_desk": "✶",
    "consensus_breaker": "◈",
    "crowd_fade": "◌",
    "lone_wolf": "◍",
    "narrative_divergence": "◎",
    "battle_winner": "▣",
    "beat_a_legendary": "✪",
    "split_dominator": "◫",
    "macro_slayer": "⟁",
    "trusted": "○",
    "proven": "◐",
    "elite": "◑",
    "legendary": "⬡",
    "crypto_specialist": "◇",
    "macro_desk": "⟁",
    "sports_edge": "◆",
    "ai_forecaster": "✦",
}

_CATEGORY_SYMBOLS: dict[str, str] = {
    "timing": "◎",
    "accuracy": "✦",
    "contrarian": "◈",
    "battle": "⟁",
    "reputation": "⬡",
    "specialization": "◉",
}


def milestone_symbol(key: str, category: str) -> str:
    return MILESTONE_SYMBOLS.get(key) or _CATEGORY_SYMBOLS.get(category, "○")


def get_agent_unlocked_keys(db: Session, agent_id: int) -> set[str]:
    rows = (
        db.query(ReputationMilestone.milestone_key)
        .filter(ReputationMilestone.agent_id == agent_id)
        .all()
    )
    return {r[0] for r in rows}


def get_user_unlocked_keys(db: Session, user: User) -> set[str]:
    """Users inherit unlocked milestones from a linked agent slug, if any."""
    agent = db.query(Agent).filter(Agent.slug == user.username).first()
    if agent:
        return get_agent_unlocked_keys(db, agent.id)
    return set()


def _normalize_keys(keys: list[str] | None) -> list[str]:
    if not keys:
        return []
    seen: set[str] = set()
    out: list[str] = []
    for key in keys:
        if not key or not isinstance(key, str):
            continue
        k = key.strip().lower()
        if k in seen:
            continue
        seen.add(k)
        out.append(k)
        if len(out) >= MAX_FEATURED_MARKS:
            break
    return out


def validate_featured_keys(keys: list[str], unlocked: set[str]) -> tuple[list[str], list[str]]:
    """Return (valid_keys, errors)."""
    normalized = _normalize_keys(keys)
    errors: list[str] = []
    valid: list[str] = []
    catalog_keys = {m.key for m in MILESTONE_CATALOG}
    for key in normalized:
        if key not in catalog_keys:
            errors.append(f"Unknown milestone: {key}")
            continue
        if key not in unlocked:
            errors.append(f"Milestone not unlocked: {key}")
            continue
        valid.append(key)
    return valid, errors


def resolve_featured_marks(
    keys: list[str],
    milestone_by_key: dict[str, dict],
    *,
    fallback_milestones: list[dict] | None = None,
) -> list[dict]:
    """Resolve equipped keys to compact prestige marks."""
    marks: list[dict] = []
    for key in _normalize_keys(keys):
        m = milestone_by_key.get(key)
        if not m:
            continue
        marks.append({
            "key": key,
            "title": m["title"],
            "category": m["category"],
            "symbol": milestone_symbol(key, m["category"]),
        })
    if marks:
        return marks
    if fallback_milestones:
        return [
            {
                "key": m["key"],
                "title": m["title"],
                "category": m["category"],
                "symbol": milestone_symbol(m["key"], m["category"]),
            }
            for m in select_featured_milestones(fallback_milestones, max_count=MAX_FEATURED_MARKS)
        ]
    return []


def resolve_featured_milestone_records(
    keys: list[str],
    milestone_by_key: dict[str, dict],
    *,
    fallback_milestones: list[dict] | None = None,
) -> list[dict]:
    """Full milestone records in equipped order."""
    records: list[dict] = []
    for key in _normalize_keys(keys):
        m = milestone_by_key.get(key)
        if m:
            records.append({**m, "symbol": milestone_symbol(key, m["category"])})
    if records:
        return records
    if fallback_milestones:
        return [
            {**m, "symbol": milestone_symbol(m["key"], m["category"])}
            for m in select_featured_milestones(fallback_milestones, max_count=MAX_FEATURED_MARKS)
        ]
    return []


def get_agent_equipped_keys(agent: Agent) -> list[str]:
    raw = agent.featured_milestone_keys
    if isinstance(raw, list):
        return _normalize_keys(raw)
    return []


def get_user_equipped_keys(profile: UserProfile | None) -> list[str]:
    if not profile:
        return []
    raw = profile.featured_milestone_keys
    if isinstance(raw, list):
        return _normalize_keys(raw)
    return []


def set_agent_featured_keys(db: Session, agent: Agent, keys: list[str]) -> list[str]:
    unlocked = get_agent_unlocked_keys(db, agent.id)
    valid, errors = validate_featured_keys(keys, unlocked)
    if errors:
        from fastapi import HTTPException

        raise HTTPException(status_code=400, detail={"errors": errors})
    agent.featured_milestone_keys = valid
    db.commit()
    db.refresh(agent)
    return valid


def set_user_featured_keys(db: Session, user: User, keys: list[str]) -> list[str]:
    profile = user.profile
    if not profile:
        from app.forecasting.models import UserProfile as UP

        profile = UP(user_id=user.id, selected_interests=[])
        db.add(profile)
        db.flush()
    unlocked = get_user_unlocked_keys(db, user)
    valid, errors = validate_featured_keys(keys, unlocked)
    if errors:
        from fastapi import HTTPException

        raise HTTPException(status_code=400, detail={"errors": errors})
    profile.featured_milestone_keys = valid
    db.commit()
    db.refresh(profile)
    return valid


def load_milestone_map_by_agent(db: Session) -> dict[int, dict[str, dict]]:
    """agent_id -> milestone_key -> record dict."""
    from app.forecasting.reputation.milestones import MILESTONE_CATALOG

    prestige = {m.key: m.prestige for m in MILESTONE_CATALOG}
    out: dict[int, dict[str, dict]] = {}
    rows = db.query(ReputationMilestone).all()
    for row in rows:
        out.setdefault(row.agent_id, {})[row.milestone_key] = {
            "key": row.milestone_key,
            "title": row.title,
            "description": row.description,
            "category": row.category,
            "prestige": prestige.get(row.milestone_key, 50),
        }
    return out


def agent_featured_payload(
    agent: Agent,
    milestone_list: list[dict],
) -> dict:
    """Build featured marks fields for API responses."""
    by_key = {m["key"]: m for m in milestone_list}
    equipped = get_agent_equipped_keys(agent)
    marks = resolve_featured_marks(equipped, by_key, fallback_milestones=milestone_list)
    records = resolve_featured_milestone_records(
        equipped, by_key, fallback_milestones=milestone_list
    )
    return {
        "featured_milestone_keys": equipped,
        "featured_reputation_marks": marks,
        "featured_milestones": records,
    }
