"""Tests for admin character bible edit/backup/restore."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from app.forecasting.agent_status import CORE_AGENT_SLUGS
from app.forecasting.character_bibles import character_bible_editor as editor


def _sample_fields(**overrides) -> dict:
    base = {
        "origin_story": "Origin.",
        "worldview": "World.",
        "core_belief": "Belief.",
        "biggest_victory": "Win.",
        "biggest_scar": "Scar.",
        "blind_spot": "Blind.",
        "what_makes_them_angry": "Angry.",
        "what_they_secretly_respect": "Respect.",
        "confidence_style": "Flat.",
        "humility_style": "None.",
        "loss_behavior": "Loss.",
        "win_behavior": "Win.",
        "forbidden_phrases": ["however"],
        "signature_phrases": ["called it"],
        "favorite_narratives": ["narrative a"],
        "hated_narratives": ["narrative b"],
        "recurring_enemies": ["bullbot"],
        "recurring_allies": ["fed-watcher"],
        "recurring_targets": ["consensus"],
        "example_good_posts": ["Good post."],
        "example_bad_posts": ["Bad post."],
        "voice_rules": {"max_sentences": 2, "opening_style": "conclusion_first"},
    }
    base.update(overrides)
    return base


def test_validate_rejects_empty_required_fields() -> None:
    payload = _sample_fields(origin_story="")
    normalized, errors = editor.validate_bible_edit(payload)
    assert normalized is None
    assert any("origin_story" in e for e in errors)


def test_validate_rejects_non_array_forbidden_phrases() -> None:
    payload = _sample_fields(forbidden_phrases="not-a-list")
    normalized, errors = editor.validate_bible_edit(payload)
    assert normalized is None
    assert any("forbidden_phrases" in e for e in errors)


def test_validate_rejects_empty_voice_rules() -> None:
    payload = _sample_fields(voice_rules={})
    normalized, errors = editor.validate_bible_edit(payload)
    assert normalized is None
    assert any("voice_rules" in e for e in errors)


def test_validate_accepts_good_payload() -> None:
    normalized, errors = editor.validate_bible_edit(_sample_fields())
    assert errors == []
    assert normalized is not None
    assert normalized["voice_rules"]["max_sentences"] == 2


def test_save_and_restore_roundtrip(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    slug = "doombot"
    bible_dir = tmp_path / "character_bibles"
    bible_dir.mkdir()
    source = Path(__file__).resolve().parents[1] / "app" / "forecasting" / "character_bibles" / f"{slug}.json"
    original = json.loads(source.read_text(encoding="utf-8"))
    (bible_dir / f"{slug}.json").write_text(json.dumps(original, indent=2) + "\n", encoding="utf-8")

    monkeypatch.setattr(editor, "_BIBLE_DIR", bible_dir)

    updated = _sample_fields(worldview="Updated worldview for test.")
    saved = editor.save_character_bible(slug, updated)
    assert saved["worldview"] == "Updated worldview for test."
    assert saved["display_name"] == original["display_name"]
    assert saved.get("speech_rules") == original.get("speech_rules")

    backups = editor._list_backups(slug)
    assert len(backups) == 1

    restored = editor.restore_latest_backup(slug)
    assert restored["worldview"] == original["worldview"]


def test_rejects_non_core_slug() -> None:
    with pytest.raises(ValueError, match="core"):
        editor.save_character_bible("rate-cut-copium", _sample_fields())


def test_core_slugs_only_five() -> None:
    assert len(CORE_AGENT_SLUGS) == 5
