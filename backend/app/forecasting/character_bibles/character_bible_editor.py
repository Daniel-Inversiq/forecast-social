"""Admin-only character bible read/write with validation and timestamped backups."""

from __future__ import annotations

import json
import re
import time
from copy import deepcopy
from pathlib import Path
from typing import Any

from app.forecasting.agent_status import CORE_AGENT_SLUGS
from app.forecasting.character_bibles import clear_character_bible_cache, load_character_bible

_BIBLE_DIR = Path(__file__).resolve().parent
_BACKUP_SUFFIX = re.compile(r"^\.backup\.(\d+)\.json$")

EDITABLE_TEXT_FIELDS: tuple[str, ...] = (
    "origin_story",
    "worldview",
    "core_belief",
    "biggest_victory",
    "biggest_scar",
    "blind_spot",
    "what_makes_them_angry",
    "what_they_secretly_respect",
    "confidence_style",
    "humility_style",
    "loss_behavior",
    "win_behavior",
)

EDITABLE_ARRAY_FIELDS: tuple[str, ...] = (
    "forbidden_phrases",
    "signature_phrases",
    "favorite_narratives",
    "hated_narratives",
    "recurring_enemies",
    "recurring_allies",
    "recurring_targets",
    "example_good_posts",
    "example_bad_posts",
)

EDITABLE_OBJECT_FIELDS: tuple[str, ...] = ("voice_rules",)


def _bible_path(slug: str) -> Path:
    if slug not in CORE_AGENT_SLUGS:
        raise ValueError(f"Not a Season 1 core character slug: {slug}")
    return _BIBLE_DIR / f"{slug}.json"


def _assert_core_slug(slug: str) -> None:
    if slug not in CORE_AGENT_SLUGS:
        raise ValueError(f"Not a Season 1 core character slug: {slug}")


def _non_empty_str(value: Any, field: str, errors: list[str]) -> str | None:
    if not isinstance(value, str):
        errors.append(f"{field} must be a string")
        return None
    text = value.strip()
    if not text:
        errors.append(f"{field} must not be empty")
        return None
    return text


def _string_list(value: Any, field: str, errors: list[str]) -> list[str] | None:
    if not isinstance(value, list):
        errors.append(f"{field} must be an array of strings")
        return None
    if not value:
        errors.append(f"{field} must contain at least one item")
        return None
    out: list[str] = []
    for i, item in enumerate(value):
        if not isinstance(item, str):
            errors.append(f"{field}[{i}] must be a string")
            continue
        text = item.strip()
        if not text:
            errors.append(f"{field}[{i}] must not be empty")
            continue
        out.append(text)
    if not out:
        errors.append(f"{field} must contain at least one non-empty string")
        return None
    return out


def _object_field(value: Any, field: str, errors: list[str]) -> dict[str, Any] | None:
    if not isinstance(value, dict):
        errors.append(f"{field} must be a JSON object")
        return None
    if not value:
        errors.append(f"{field} must not be empty")
        return None
    return dict(value)


def validate_bible_edit(payload: dict[str, Any]) -> tuple[dict[str, Any] | None, list[str]]:
    """Validate admin bible edit payload; return normalized fields or errors."""
    errors: list[str] = []
    normalized: dict[str, Any] = {}

    for field in EDITABLE_TEXT_FIELDS:
        if field not in payload:
            errors.append(f"{field} is required")
            continue
        text = _non_empty_str(payload[field], field, errors)
        if text is not None:
            normalized[field] = text

    for field in EDITABLE_ARRAY_FIELDS:
        if field not in payload:
            errors.append(f"{field} is required")
            continue
        items = _string_list(payload[field], field, errors)
        if items is not None:
            normalized[field] = items

    for field in EDITABLE_OBJECT_FIELDS:
        if field not in payload:
            errors.append(f"{field} is required")
            continue
        obj = _object_field(payload[field], field, errors)
        if obj is not None:
            normalized[field] = obj

    if errors:
        return None, errors
    return normalized, []


def editable_bible_fields(slug: str) -> dict[str, Any]:
    """Return only admin-editable bible fields for a core slug."""
    _assert_core_slug(slug)
    bible = load_character_bible(slug) or {}
    out: dict[str, Any] = {}
    for field in EDITABLE_TEXT_FIELDS:
        out[field] = bible.get(field, "")
    for field in EDITABLE_ARRAY_FIELDS:
        raw = bible.get(field)
        out[field] = list(raw) if isinstance(raw, list) else []
    for field in EDITABLE_OBJECT_FIELDS:
        raw = bible.get(field)
        out[field] = dict(raw) if isinstance(raw, dict) else {}
    return out


def _backup_path(slug: str, timestamp: int | None = None) -> Path:
    ts = timestamp if timestamp is not None else int(time.time())
    return _BIBLE_DIR / f"{slug}.backup.{ts}.json"


def _list_backups(slug: str) -> list[tuple[int, Path]]:
    _assert_core_slug(slug)
    matches: list[tuple[int, Path]] = []
    prefix = f"{slug}.backup."
    for path in _BIBLE_DIR.iterdir():
        if not path.is_file() or not path.name.startswith(prefix):
            continue
        suffix = path.name[len(slug) :]
        m = _BACKUP_SUFFIX.match(suffix)
        if m:
            matches.append((int(m.group(1)), path))
    matches.sort(key=lambda x: x[0])
    return matches


def save_character_bible(slug: str, fields: dict[str, Any]) -> dict[str, Any]:
    """Validate, backup, persist editable fields; preserve slug/display_name/speech_rules."""
    _assert_core_slug(slug)
    normalized, errors = validate_bible_edit(fields)
    if errors:
        raise ValueError("; ".join(errors))

    path = _bible_path(slug)
    existing = load_character_bible(slug) or {}
    if path.exists():
        backup = _backup_path(slug)
        backup.write_text(path.read_text(encoding="utf-8"), encoding="utf-8")

    merged = deepcopy(existing)
    merged.update(normalized)
    merged["slug"] = slug
    if existing.get("display_name"):
        merged["display_name"] = existing["display_name"]
    if existing.get("speech_rules"):
        merged["speech_rules"] = existing["speech_rules"]

    with path.open("w", encoding="utf-8") as f:
        json.dump(merged, f, indent=2)
        f.write("\n")

    clear_character_bible_cache()
    return merged


def restore_latest_backup(slug: str) -> dict[str, Any]:
    """Restore the most recent timestamped backup for a core slug."""
    _assert_core_slug(slug)
    backups = _list_backups(slug)
    if not backups:
        raise ValueError(f"No backups found for {slug}")

    _, latest = backups[-1]
    with latest.open(encoding="utf-8") as f:
        data = json.load(f)

    path = _bible_path(slug)
    current_backup = _backup_path(slug)
    if path.exists():
        current_backup.write_text(path.read_text(encoding="utf-8"), encoding="utf-8")

    with path.open("w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)
        f.write("\n")

    clear_character_bible_cache()
    return data


def latest_backup_timestamp(slug: str) -> int | None:
    backups = _list_backups(slug)
    if not backups:
        return None
    return backups[-1][0]
