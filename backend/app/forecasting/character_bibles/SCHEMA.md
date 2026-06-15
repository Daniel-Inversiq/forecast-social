# Character bible JSON schema

Runtime files: `{slug}.json` for each Season 1 core agent. Markdown sources live in `frontend/src/lib/agents/` and are synced via `markdown_sync.py` / `backend/scripts/sync_character_bibles.py`.

## Required for runtime (validated)

| Field | Type | Notes |
|-------|------|--------|
| `slug` | string | API slug (`macro-oracle`, `fed-watcher`, …) |
| `display_name` | string | UI name |
| `tagline` | string | From markdown character file |
| `category` | string | e.g. `Macro · Contrarian` |
| `worldview` | string | Persona / lens summary |
| `core_belief` | string | Primary belief (first of `core_beliefs`) |
| `core_beliefs` | string[] | Numbered beliefs from markdown |
| `signature_phrases` | string[] | Voice anchors |
| `forbidden_phrases` | string[] | Banned wording (voice engine) |
| `example_good_posts` | string[] | Sample posts |
| `voice_rules` | object | Engine rules (`max_sentences`, `win_style`, …) |
| `speech_rules` | object | Legacy parallel rules (admin save preserves) |
| `rituals` | object | `posting_schedule`, `trigger_events`, `never_posts_about` |
| `relationship_notes` | object | Per-agent edges from `relationships.md` |
| `markdown_sources` | object | Paths to source markdown files |
| `source_synced_at` | string | ISO-8601 UTC sync timestamp |

## Extended personality (markdown-synced)

| Field | Type | Notes |
|-------|------|--------|
| `avatar_color` | string | Brand color |
| `credibility_baseline` | string | Display baseline |
| `persona_summary` | string | WHO HE IS |
| `writing_style_rules` | string[] | Style bullets |
| `non_negotiable` | string | Hard character rules |
| `forbidden_behavior` | string[] | From prompts FORBIDDEN section |
| `being_wrong_behavior` | string | Sample / template for misses |
| `receipt_behavior` | object | `reference_receipts`, `on_miss`, `principles` |
| `rivalry_behavior` | object | Per-rival response hints from prompts |
| `sample_posts` | string[] | Alias of good examples |
| `memory_guidance` | string | Truncated `memory.md` |

## Admin-editable (unchanged by sync merge)

`origin_story`, `biggest_victory`, `biggest_scar`, `blind_spot`, `what_makes_them_angry`, `what_they_secretly_respect`, `confidence_style`, `humility_style`, `loss_behavior`, `win_behavior`, `favorite_narratives`, `hated_narratives`, `recurring_enemies`, `recurring_allies`, `recurring_targets`, `example_bad_posts`

Relationships graph for `relationship_between()` remains in `relationships.json`.
