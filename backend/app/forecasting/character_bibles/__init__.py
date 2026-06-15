"""Season 1 core agent character bibles — structured identity data separate from AGENT_VOICE."""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any

from app.forecasting.agent_status import CORE_AGENT_SLUGS

_BIBLE_DIR = Path(__file__).resolve().parent
_RELATIONSHIPS_FILE = _BIBLE_DIR / "relationships.json"


@lru_cache(maxsize=1)
def _load_relationships_raw() -> dict[str, Any]:
    if not _RELATIONSHIPS_FILE.exists():
        return {"pairs": {}, "agents": {}}
    with _RELATIONSHIPS_FILE.open(encoding="utf-8") as f:
        return json.load(f)


@lru_cache(maxsize=32)
def load_character_bible(slug: str) -> dict[str, Any] | None:
    """Load structured bible for a core agent slug, or None if not defined."""
    if slug not in CORE_AGENT_SLUGS:
        return None
    path = _BIBLE_DIR / f"{slug}.json"
    if not path.exists():
        return None
    with path.open(encoding="utf-8") as f:
        return json.load(f)


def character_bible_for(slug: str) -> dict[str, Any]:
    """Return bible dict; empty dict if missing (non-core or file absent)."""
    return load_character_bible(slug) or {}


def all_core_bibles() -> dict[str, dict[str, Any]]:
    return {slug: character_bible_for(slug) for slug in sorted(CORE_AGENT_SLUGS)}


def relationships_for(slug: str) -> dict[str, Any]:
    """Per-agent relationship edges keyed by other slug."""
    raw = _load_relationships_raw()
    agents = raw.get("agents") or {}
    return dict(agents.get(slug) or {})


def relationship_between(slug_a: str, slug_b: str) -> dict[str, Any] | None:
    """Directed relationship from slug_a toward slug_b."""
    edges = relationships_for(slug_a)
    return edges.get(slug_b)


def pair_dynamic(slug_a: str, slug_b: str) -> str | None:
    """Named rivalry dynamic if defined (e.g. ideological_rivalry)."""
    pairs = (_load_relationships_raw().get("pairs") or {})
    key = tuple(sorted([slug_a, slug_b]))
    for entry in pairs.values() if isinstance(pairs, dict) else []:
        if not isinstance(entry, dict):
            continue
        slugs = entry.get("slugs") or []
        if sorted(slugs) == list(key):
            return entry.get("dynamic")
    agents = _load_relationships_raw().get("agents") or {}
    edge = (agents.get(slug_a) or {}).get(slug_b) or {}
    return edge.get("dynamic")


def voice_rules_for(slug: str) -> dict[str, Any]:
    bible = character_bible_for(slug)
    rules = bible.get("voice_rules")
    return dict(rules) if isinstance(rules, dict) else {}


def clear_character_bible_cache() -> None:
    load_character_bible.cache_clear()


def bible_runtime_context(slug: str) -> dict[str, Any]:
    """Rich personality slice for LLM prompts and voice checks (markdown-synced fields)."""
    bible = character_bible_for(slug)
    if not bible:
        return {}
    rituals = bible.get("rituals") if isinstance(bible.get("rituals"), dict) else {}
    return {
        "tagline": bible.get("tagline"),
        "category": bible.get("category"),
        "persona_summary": bible.get("persona_summary"),
        "core_beliefs": list(bible.get("core_beliefs") or []),
        "non_negotiable": bible.get("non_negotiable"),
        "forbidden_behavior": list(bible.get("forbidden_behavior") or []),
        "being_wrong_behavior": bible.get("being_wrong_behavior"),
        "receipt_behavior": bible.get("receipt_behavior"),
        "rivalry_behavior": bible.get("rivalry_behavior"),
        "relationship_notes": bible.get("relationship_notes"),
        "rituals": rituals,
        "sample_posts": list(bible.get("sample_posts") or bible.get("example_good_posts") or []),
        "writing_style_rules": list(bible.get("writing_style_rules") or []),
    }


def ideology_fields_from_bible(slug: str) -> dict[str, Any]:
    """Map bible → ideology_profile_for merge shape."""
    bible = character_bible_for(slug)
    if not bible:
        return {}
    rel = relationships_for(slug)
    enemies = [k for k, v in rel.items() if v.get("dismiss") or v.get("angry")]
    allies = [k for k, v in rel.items() if v.get("respect") and not v.get("dismiss")]
    core_beliefs = list(bible.get("core_beliefs") or [])
    return {
        "worldview": bible.get("worldview"),
        "core_belief": bible.get("core_belief"),
        "core_beliefs": core_beliefs or None,
        "tagline": bible.get("tagline"),
        "category": bible.get("category"),
        "blind_spots": [bible["blind_spot"]] if bible.get("blind_spot") else None,
        "hated_narratives": bible.get("hated_narratives"),
        "favorite_narratives": bible.get("favorite_narratives"),
        "preferred_evidence_type": (bible.get("speech_rules") or {}).get("evidence_style"),
        "never_admits": (bible.get("speech_rules") or {}).get("never_admits"),
        "signature_phrases": bible.get("signature_phrases"),
        "recurring_enemies": bible.get("recurring_enemies") or enemies[:5],
        "recurring_allies": bible.get("recurring_allies") or allies[:5],
        "recurring_targets": bible.get("recurring_targets"),
        "confidence_style": bible.get("confidence_style"),
        "humility_level": bible.get("humility_style"),
        "forbidden_phrases": bible.get("forbidden_phrases"),
        "origin_story": bible.get("origin_story"),
    }
