"""Sync Season 1 core character bibles from frontend markdown sources into JSON runtime files."""

from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from app.forecasting.agent_status import CORE_AGENT_SLUGS

_REPO_ROOT = Path(__file__).resolve().parents[4]
_MARKDOWN_ROOT = _REPO_ROOT / "frontend" / "src" / "lib" / "agents"
_BIBLE_DIR = Path(__file__).resolve().parent

FOLDER_TO_SLUG: dict[str, str] = {
    "doombot": "doombot",
    "bullbot": "bullbot",
    "macro_oracle": "macro-oracle",
    "fedwatcher": "fed-watcher",
    "sportschaos": "sports-chaos",
}

HEADING_TO_SLUG: dict[str, str] = {
    "DOOMBOT": "doombot",
    "BULLBOT": "bullbot",
    "MACRO ORACLE": "macro-oracle",
    "MACROORACLE": "macro-oracle",
    "FEDWATCHER": "fed-watcher",
    "SPORTSCHAOS": "sports-chaos",
}

_DISPLAY_NAMES: dict[str, str] = {
    "doombot": "DoomBot",
    "bullbot": "BullBot",
    "macro-oracle": "Macro Oracle",
    "fed-watcher": "FedWatcher",
    "sports-chaos": "SportsChaos",
}


def markdown_agents_root() -> Path:
    return _MARKDOWN_ROOT


def _read(path: Path) -> str:
    return path.read_text(encoding="utf-8") if path.exists() else ""


def _meta(text: str, key: str) -> str | None:
    m = re.search(rf"\*\*{re.escape(key)}:\*\*\s*(.+)", text)
    return m.group(1).strip() if m else None


def _section(text: str, heading: str) -> str:
    pattern = rf"^{re.escape(heading)}\s*$"
    m = re.search(pattern, text, re.MULTILINE | re.IGNORECASE)
    if not m:
        return ""
    start = m.end()
    rest = text[start:]
    nxt = re.search(r"\n## ", rest)
    return rest[: nxt.start()].strip() if nxt else rest.strip()


def _numbered_items(block: str) -> list[str]:
    items: list[str] = []
    for line in block.splitlines():
        m = re.match(r"^\d+\.\s+\*\*(.+?)\*\*\s*(.*)$", line.strip())
        if m:
            items.append(f"{m.group(1)} {m.group(2)}".strip())
        elif re.match(r"^\d+\.\s+", line.strip()):
            items.append(re.sub(r"^\d+\.\s+", "", line.strip()))
    return [i for i in items if i]


def _bullets_after(block: str, marker: str) -> list[str]:
    idx = block.find(marker)
    if idx < 0:
        return []
    tail = block[idx + len(marker) :]
    lines: list[str] = []
    for line in tail.splitlines():
        if line.strip().startswith("**") and not line.strip().startswith("- "):
            break
        m = re.match(r"^-\s+(.+)$", line.strip())
        if m:
            lines.append(m.group(1).strip())
    return lines


def _fenced_blocks(text: str) -> list[str]:
    return [b.strip() for b in re.findall(r"```\s*\n(.*?)```", text, re.DOTALL) if b.strip()]


def _signature_phrases(block: str) -> list[str]:
    sig_block = _section(block, "## VOICE AND LANGUAGE")
    if "**Signature phrases:**" not in sig_block:
        return []
    tail = sig_block.split("**Signature phrases:**", 1)[1]
    phrases: list[str] = []
    for line in tail.splitlines():
        m = re.match(r"^-\s+[\"']?(.+?)[\"']?\s*$", line.strip())
        if m:
            phrases.append(m.group(1).strip().strip('"').strip("'"))
        elif line.strip().startswith("**") or line.strip().startswith("##"):
            break
    return phrases


def _writing_style_rules(block: str) -> list[str]:
    section = _section(block, "## WRITING STYLE RULES")
    return [ln.strip()[2:].strip() for ln in section.splitlines() if ln.strip().startswith("- ")]


def _parse_rituals(block: str) -> dict[str, list[str]]:
    section = _section(block, "## RITUALS")
    return {
        "posting_schedule": _bullets_after(section, "**Posting schedule:**"),
        "trigger_events": _bullets_after(section, "**Trigger events:**"),
        "never_posts_about": _bullets_after(section, "**Never posts about:**"),
    }


def _persona_summary(block: str) -> str:
    section = _section(block, "## WHO HE IS")
    paragraphs = [
        p.strip()
        for p in re.split(r"\n\s*\n", section)
        if p.strip() and p.strip() != "---"
    ]
    return " ".join(paragraphs).rstrip(" -")


def _non_negotiable(block: str) -> str:
    section = _section(block, "## THE NON-NEGOTIABLE")
    return " ".join(p.strip() for p in section.splitlines() if p.strip())


def _being_wrong_sample(block: str) -> str | None:
    section = _section(block, "## EXAMPLE POSTS")
    for title, body in re.findall(
        r"\*\*(After being wrong|Post-miss|After being wrong):\*\*\s*```\s*\n(.*?)```",
        section,
        re.DOTALL | re.IGNORECASE,
    ):
        _ = title
        return body.strip()
    for body in _fenced_blocks(section):
        lower = body.lower()
        if "wrong" in lower or "post-mortem" in lower or "miss" in lower:
            return body.strip()
    return None


def _prompt_section(prompts: str, heading: str) -> str:
    m = re.search(rf"^{re.escape(heading)}\s*$", prompts, re.MULTILINE)
    if not m:
        return ""
    tail = prompts[m.end() :]
    nxt = re.search(r"\n(?:HOW TO |TRIGGER |IGNORE |## )", tail)
    chunk = tail[: nxt.start()] if nxt else tail
    return re.sub(r"^-\s+", "", chunk, flags=re.MULTILINE).strip()


def _forbidden_from_prompts(prompts: str) -> list[str]:
    block = _prompt_section(prompts, "FORBIDDEN BEHAVIOUR — ABSOLUTE RULES")
    if not block:
        block = _prompt_section(prompts, "FORBIDDEN BEHAVIOUR")
    lines = [ln.strip() for ln in block.splitlines() if ln.strip().startswith("-")]
    out: list[str] = []
    for ln in lines:
        text = re.sub(r"^-\s+", "", ln).strip()
        if text.upper().startswith("PERMITTED"):
            break
        if text.upper().startswith("NEVER "):
            out.append(text)
    if not out and block:
        out = [ln.strip() for ln in block.splitlines() if ln.strip()][:8]
    return out


def _receipt_behavior_from_prompts(prompts: str) -> dict[str, Any]:
    win = _prompt_section(prompts, "HOW TO REFERENCE RECEIPTS")
    wrong = _prompt_section(prompts, "HOW TO RESPOND TO ERRORS")
    return {
        "reference_receipts": win,
        "on_miss": wrong,
        "principles": [
            "All calls are public; outcomes are permanent.",
            "Never remove failed calls.",
            "Acknowledge misses directly without spinning partial wins.",
        ],
    }


def _rivalry_from_prompts(prompts: str) -> dict[str, str]:
    block = _prompt_section(prompts, "HOW TO RESPOND TO RIVALS")
    rivals: dict[str, str] = {}
    for line in block.splitlines():
        m = re.match(r"^To\s+([^:]+):\s*(.+)$", line.strip(), re.IGNORECASE)
        if m:
            name = m.group(1).strip().upper().replace(" ", "")
            key = HEADING_TO_SLUG.get(name) or HEADING_TO_SLUG.get(m.group(1).strip().upper())
            if key:
                rivals[key] = m.group(2).strip()
    return rivals


def _parse_relationships(md: str) -> dict[str, dict[str, Any]]:
    notes: dict[str, dict[str, Any]] = {}
    parts = re.split(r"\n## ", md)
    for part in parts[1:]:
        lines = part.strip().splitlines()
        if not lines:
            continue
        heading = lines[0].strip().upper()
        if heading.startswith("HOW "):
            continue
        target = HEADING_TO_SLUG.get(heading)
        if not target:
            continue
        body = "\n".join(lines[1:])
        entry: dict[str, Any] = {}
        for key, field in (
            ("Type", "type"),
            ("Trust level", "trust_level"),
            ("Dynamic", "dynamic"),
        ):
            val = _meta(body, key)
            if val:
                entry[field] = val
        how = re.search(r"\*\*How .+?:\*\*\s*\n([\s\S]*?)(?:\n\*\*|$)", body)
        if how:
            entry["response_style"] = how.group(1).strip()
        typical = re.findall(r"```\s*\n(.*?)```", body, re.DOTALL)
        if typical:
            entry["typical_response"] = typical[0].strip()
        notes[target] = entry
    challenged = _section(md, "## HOW DOOMBOT RESPONDS TO BEING CHALLENGED")
    if not challenged:
        for h in (
            "## HOW BULLBOT RESPONDS TO BEING CHALLENGED",
            "## HOW MACROORACLE RESPONDS TO BEING CHALLENGED",
            "## HOW FEDWATCHER RESPONDS TO BEING CHALLENGED",
            "## HOW SPORTSCHAOS RESPONDS TO BEING CHALLENGED",
        ):
            challenged = _section(md, h)
            if challenged:
                break
    if challenged:
        templates = _fenced_blocks(challenged)
        if templates:
            notes["_being_challenged_template"] = templates[0]
    return notes


def _derive_speech_rules(
    slug: str,
    character: str,
    prompts: str,
    existing: dict[str, Any],
) -> dict[str, Any]:
    speech = dict(existing.get("speech_rules") or {})
    voice = dict(existing.get("voice_rules") or {})
    rules_block = _section(character, "## WRITING STYLE RULES")
    max_sent = 2
    if "maximum 4" in rules_block.lower():
        max_sent = 4
    elif "maximum 3" in rules_block.lower() or "3 sentences" in rules_block.lower():
        max_sent = 3
    elif "maximum 200" in rules_block.lower():
        max_sent = 4
    speech.setdefault("max_sentences_per_thought", max_sent)
    voice.setdefault("max_sentences", max_sent)
    never = _prompt_section(prompts, "VOICE RULES — FOLLOW EXACTLY")
    never_use: list[str] = []
    for ln in never.splitlines():
        if "never use" in ln.lower() or "no \"" in ln.lower():
            never_use.extend(re.findall(r'"([^"]+)"', ln))
    if never_use:
        speech["never_use"] = never_use[:12]
    return speech, voice


def _merge_voice_rules(existing: dict[str, Any], voice: dict[str, Any], character: str) -> dict[str, Any]:
    merged = dict(existing.get("voice_rules") or {})
    merged.update({k: v for k, v in voice.items() if v is not None})
    if not merged.get("win_style"):
        merged["win_style"] = existing.get("win_behavior", "")
    if not merged.get("loss_style"):
        merged["loss_style"] = existing.get("loss_behavior", "")
    sig = _signature_phrases(character)
    if sig and not merged.get("required_style_traits"):
        merged["required_style_traits"] = ["markdown_synced"]
    return merged


def build_bible_from_markdown(
    slug: str,
    folder: str,
    *,
    existing: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Build a merged runtime bible dict for a core slug from markdown sources."""
    base = dict(existing or {})
    root = markdown_agents_root() / folder
    character = _read(root / "character.md")
    relationships = _read(root / "relationships.md")
    prompts = _read(root / "prompts.md")
    receipts = _read(root / "receipts.md")
    memory = _read(root / "memory.md")

    core_beliefs = _numbered_items(_section(character, "## CORE BELIEFS"))
    signature = _signature_phrases(character)
    sample_posts = _fenced_blocks(_section(character, "## EXAMPLE POSTS"))
    persona = _persona_summary(character)
    rituals = _parse_rituals(character)
    rel_notes = _parse_relationships(relationships)
    forbidden_behavior = _forbidden_from_prompts(prompts)
    if not forbidden_behavior:
        nn = _non_negotiable(character)
        if nn:
            forbidden_behavior = [nn]

    being_wrong = _being_wrong_sample(character) or base.get("loss_behavior", "")
    receipt_behavior = _receipt_behavior_from_prompts(prompts)
    if receipts.strip():
        receipt_behavior["archive_note"] = receipts.splitlines()[2].strip() if len(receipts.splitlines()) > 2 else ""

    speech, voice_patch = _derive_speech_rules(slug, character, prompts, base)
    voice_rules = _merge_voice_rules(base, voice_patch, character)

    merged: dict[str, Any] = {
        **base,
        "slug": slug,
        "display_name": base.get("display_name") or _DISPLAY_NAMES.get(slug, slug),
        "tagline": _meta(character, "Tagline") or base.get("tagline"),
        "category": _meta(character, "Category") or base.get("category"),
        "avatar_color": _meta(character, "Avatar color") or base.get("avatar_color"),
        "credibility_baseline": _meta(character, "Credibility score baseline") or base.get("credibility_baseline"),
        "persona_summary": persona or base.get("persona_summary"),
        "worldview": persona[:280] if persona else base.get("worldview", ""),
        "core_belief": (core_beliefs[0] if core_beliefs else base.get("core_belief", "")),
        "core_beliefs": core_beliefs or base.get("core_beliefs", []),
        "signature_phrases": signature or base.get("signature_phrases", []),
        "example_good_posts": sample_posts or base.get("example_good_posts", []),
        "sample_posts": sample_posts or base.get("sample_posts", []),
        "rituals": rituals or base.get("rituals", {}),
        "writing_style_rules": _writing_style_rules(character) or base.get("writing_style_rules", []),
        "non_negotiable": _non_negotiable(character) or base.get("non_negotiable"),
        "forbidden_behavior": forbidden_behavior or base.get("forbidden_behavior", []),
        "being_wrong_behavior": being_wrong,
        "receipt_behavior": receipt_behavior,
        "rivalry_behavior": _rivalry_from_prompts(prompts) or base.get("rivalry_behavior", {}),
        "relationship_notes": rel_notes or base.get("relationship_notes", {}),
        "speech_rules": speech,
        "voice_rules": voice_rules,
        "markdown_sources": {
            "character": f"frontend/src/lib/agents/{folder}/character.md",
            "relationships": f"frontend/src/lib/agents/{folder}/relationships.md",
            "prompts": f"frontend/src/lib/agents/{folder}/prompts.md",
            "receipts": f"frontend/src/lib/agents/{folder}/receipts.md",
            "memory": f"frontend/src/lib/agents/{folder}/memory.md",
        },
        "source_synced_at": datetime.now(timezone.utc).isoformat(),
    }
    if memory.strip():
        merged["memory_guidance"] = memory.strip()[:2000]

    # Keep editor/admin fields when present
    for field in (
        "origin_story",
        "biggest_victory",
        "biggest_scar",
        "blind_spot",
        "what_makes_them_angry",
        "what_they_secretly_respect",
        "confidence_style",
        "humility_style",
        "loss_behavior",
        "win_behavior",
        "forbidden_phrases",
        "favorite_narratives",
        "hated_narratives",
        "recurring_enemies",
        "recurring_allies",
        "recurring_targets",
        "example_bad_posts",
    ):
        if field in base and field not in merged:
            merged[field] = base[field]

    if being_wrong and not merged.get("loss_behavior"):
        merged["loss_behavior"] = being_wrong.splitlines()[0][:200]

    return merged


def sync_all_core_bibles(*, write: bool = True) -> dict[str, dict[str, Any]]:
    """Read markdown for all core agents and optionally persist JSON bibles."""
    from app.forecasting.character_bibles import clear_character_bible_cache, load_character_bible

    results: dict[str, dict[str, Any]] = {}
    for folder, slug in FOLDER_TO_SLUG.items():
        if slug not in CORE_AGENT_SLUGS:
            continue
        existing = load_character_bible(slug) or {}
        merged = build_bible_from_markdown(slug, folder, existing=existing)
        results[slug] = merged
        if write:
            path = _BIBLE_DIR / f"{slug}.json"
            with path.open("w", encoding="utf-8") as f:
                json.dump(merged, f, indent=2, ensure_ascii=False)
                f.write("\n")
    if write:
        clear_character_bible_cache()
    return results


def validate_core_bibles() -> list[str]:
    """Return list of validation errors (empty if all core bibles load)."""
    from app.forecasting.character_bibles import load_character_bible

    errors: list[str] = []
    required_scalar = ("slug", "display_name", "worldview", "core_belief", "tagline", "category")
    required_arrays = ("signature_phrases", "example_good_posts", "forbidden_phrases")
    required_objects = ("voice_rules", "speech_rules", "rituals", "relationship_notes")

    for slug in sorted(CORE_AGENT_SLUGS):
        bible = load_character_bible(slug)
        if bible is None:
            errors.append(f"{slug}: load_character_bible returned None")
            continue
        for field in required_scalar:
            if not bible.get(field):
                errors.append(f"{slug}: missing or empty {field}")
        for field in required_arrays:
            val = bible.get(field)
            if not isinstance(val, list) or not val:
                errors.append(f"{slug}: {field} must be a non-empty list")
        for field in required_objects:
            val = bible.get(field)
            if not isinstance(val, dict):
                errors.append(f"{slug}: {field} must be an object")
        if not bible.get("core_beliefs"):
            errors.append(f"{slug}: core_beliefs must be non-empty")
        if not bible.get("markdown_sources"):
            errors.append(f"{slug}: markdown_sources missing (not synced)")
    return errors
