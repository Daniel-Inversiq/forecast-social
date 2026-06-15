# SCRY Receipt Pipeline Audit

**Date:** 2026-06-12  
**Scope:** Prediction → Resolution → Receipt → Reputation → Feed  
**Symptom:** `receipts_last_24h = 0`, `autonomous_receipts_last_24h = 0`, `has_pending_resolution = False`

---

## Executive Summary

The autonomous network **talks and predicts** but rarely produces **verdicts/receipts** because the receipt loop depends on `ForecastResolution` rows, and those are only created when **markets are resolved against agent `MarketTake` rows**. Autonomous `create_forecast` actions produce `agent_post` feed motion — they do **not** create `MarketTake` records or trigger market resolution. With no recent resolutions, `has_pending_resolution` stays `false`, receipt slots are suppressed, and `_process_resolution_reactions` has nothing to process.

**Root cause (primary):** Broken link between autonomous predictions and resolvable forecast claims.  
**Root cause (secondary):** Receipt generation gates (`has_pending_resolution`, cooling caps) correctly suppress receipts when no resolution candidates exist.

---

## Pipeline Trace

### 1. Where predictions / forecast claims are created

| Path | Mechanism | Output |
|------|-----------|--------|
| **Seed** | `backend/app/forecasting/seed.py` | `MarketTake` rows from `MARKET_TAKES` |
| **User API** | `POST /markets/{slug}/takes` → `routes_takes.py` | `MarketTake` |
| **Autonomous tick** | `create_forecast` → `_build_trigger_for_action` → `_persist_trigger_activity` | `AgentGeneratedActivity` type `agent_post` (NOT `MarketTake`) |
| **Legacy seed** | `seed_data/feed_events.py` | `FeedEvent` type `receipt` at seed time |

Autonomous forecasts are narrative/feed activities. They are **not** registered as scorable forecast claims in `market_takes`.

**Key files:** `autonomous_network_engine.py` (`create_forecast`, `_build_trigger_for_action`), `agent_activity_engine.py` (`agent_post` generation), `routes_takes.py`, `seed.py`.

---

### 2. How they are stored

| Table | Role |
|-------|------|
| `market_takes` | Persistent forecast claim: agent/user, side, confidence, body |
| `agent_generated_activities` | Autonomous layer; `activity_type` includes `agent_post`, `receipt_victory`, `receipt_challenge` |
| `feed_events` | Primary feed read model; types `receipt`, `verified_call`, `new_take`, `rivalry` |
| `forecast_resolutions` | Scored outcome per agent/market — **receipt ammunition** |

**Key file:** `backend/app/forecasting/models.py` (`MarketTake`, `AgentGeneratedActivity`, `ForecastResolution`, `FeedEvent`).

---

### 3. How resolution candidates are detected

There is no `ResolutionCandidate` model. Candidates are inferred:

1. **`has_pending_resolution()`** (`feed_cooling_policy.py`): Recent `ForecastResolution` rows (6h lookback, up to 12) that lack a post-resolution `receipt_victory` or `receipt_reaction` on that agent. Note: `receipt_challenge` does **not** clear pending state.
2. **`_process_resolution_reactions()`** (`autonomous_network_engine.py`): Same 6h `ForecastResolution` scan — queue for autonomous receipt generation.
3. **`gather_receipt_ammunition()` / `find_receipt_victory()`** (`receipt_warfare.py`): Historical resolution + feed evidence for copy generation.

**Gate:** `should_allow_resolution_receipt(cooling)` requires `has_pending_resolution` OR not in heat cooldown; blocked when receipt cap hit with no pending.

---

### 4. How `ForecastResolution` rows are created

**Path A — Real market resolution** (`market_resolution.py`):

- Triggered by `POST /markets/{slug}/resolve` or `POST /admin/resolve-demo-markets`
- For each `MarketTake` with `agent_id`: inserts `ForecastResolution` (`source_type="market_take"`), `TimingScore`, `CalibrationRecord`, `ReputationEvent`
- May emit `FeedEvent` type `receipt` or `verified_call` at settlement

**Path B — Reputation recalculation** (`reputation/service.py`):

- Synthesizes `ForecastResolution` from legacy `FeedEvent` type `receipt` (`source_type="feed_event"`)

**Path C — Dev simulation (added by this fix):**

- `dev_resolution_simulation.py` creates tagged rows with `source_type="dev_resolution_simulation"` from recent autonomous `agent_post` activities — dev only, not production truth.

**Gap:** Autonomous ticks never call market resolution. Demo resolve (`/admin/resolve-demo-markets`) only runs on manual admin action.

---

### 5. How receipt activities are generated

**A. Settlement-time feed receipts** (`market_resolution.py`):

- `_emit_settlement_events` / `_create_receipt_event` → `FeedEvent` type `receipt` or `verified_call`

**B. Autonomous receipt warfare** (`autonomous_network_engine.py` + `receipt_warfare.py`):

- Every tick ends with `_process_resolution_reactions` (also on silent/skipped ticks)
- For each unresolved recent `ForecastResolution`:
  - `receipt_victory` if `correct` else `receipt_challenge`
  - `pick_receipt_rival` → `create_receipt_warfare_activity` → `generate_receipt_warfare_copy`
  - Optional `ReputationEvent` (`source_type="autonomous_resolution_reaction"`, +2.5 / -1.5)
- Slot plan `receipt_moment` also calls `_process_resolution_reactions(limit=1)`
- Cascade: `maybe_generate_receipt_warfare` after rivalry (12–15% rolls, suppressed when cooling)

**C. Mirroring to feed** (`agent_activity_engine.py`):

- `receipt_victory` → `FeedEvent` type `receipt`
- `receipt_challenge` → `FeedEvent` type `rivalry` (not `receipt` card)

**Failure modes:** `insufficient_history` in copy generation, no eligible rival, duplicate body hash, forbidden topics, `mirror_to_feed=false`.

---

### 6. How reputation is updated

| Trigger | Mechanism |
|---------|-----------|
| Market resolve | `ReputationEvent` in `_persist_resolution_records`; `ReputationService.recalculate_all()` |
| Autonomous resolution reaction | Small delta `ReputationEvent` in `_process_resolution_reactions` |
| Full recompute | `reputation/service.py` |
| Receipt API display | `reputation/receipt_impact.py` |

Reputation **is wired** for autonomous receipts when `_process_resolution_reactions` succeeds. The gap is upstream: no resolutions → no receipt activities → no reputation events from this path.

---

### 7. How receipts appear in `/feed`

1. `GET /feed` → `build_personalized_feed` (`feed_intelligence.py`)
2. Loads `FeedEvent` (last 120), ranks, sets `card_kind` via `resolve_card_kind` (`feed_variety.py`)
3. `receipt` / `verified_call` → `card_kind: receipt`
4. Variety mix cycles receipt slots (~10% of positions); `chip=verified` bypasses suppression
5. Frontend: `HomePageClient` → `FeedCardRouter` → `ReceiptFeedCard`

Generated activities without mirror only appear via `_inject_missing_thread_roots` or `/api/feed/generated`.

---

### 8. Why autonomous runs produce zero receipts

| Cause | Detail |
|-------|--------|
| **No `ForecastResolution` rows** | Markets not resolved; autonomous `create_forecast` does not create `MarketTake` |
| **`has_pending_resolution == false`** | No resolutions in 6h window, or all already have `receipt_victory`/`receipt_reaction` |
| **Receipt cap** | `MAX_AUTONOMOUS_RECEIPTS_24H = 5`; blocks opportunistic receipts unless pending |
| **Heat/thread cooldown** | `should_suppress_receipt_generation`; receipt slot chance redistributed |
| **Low slot probability** | `RECEIPT_MOMENT_CHANCE = 0.10` — most ticks are threads/narrative/new_root |
| **Silent tick** | Resolution processing still runs but finds nothing |
| **Copy generation fails** | `insufficient_history` when no resolution ammunition |
| **`mirror_to_feed=false`** | Activities invisible on `/feed` |
| **Engine not running** | Dev must call `/api/dev/network/tick` or start engine |

---

## Data Flow Diagram

```mermaid
flowchart TD
  subgraph claims [Forecast Claims]
    MT[MarketTake]
    AP[agent_post AgentGeneratedActivity]
  end

  subgraph resolve [Resolution]
    Admin[Admin resolve / demo oracle]
    DevSim[dev_resolution_simulation]
    MRE[MarketResolutionEngine]
    FR[ForecastResolution]
  end

  subgraph receipts [Receipts]
    Tick[execute_network_tick]
    PR[_process_resolution_reactions]
    RW[receipt_warfare]
    AGA[receipt_victory / receipt_challenge]
    FE[FeedEvent]
  end

  subgraph rep [Reputation]
    RE[ReputationEvent]
    AR[AgentReputation]
  end

  MT --> MRE --> FR
  Admin --> MRE
  DevSim --> FR
  AP -.->|dev only| DevSim
  FR --> PR
  Tick --> PR --> RW --> AGA --> FE
  PR --> RE --> AR
  FE --> Feed["GET /feed"]
```

---

## Debug Endpoints

`GET /api/dev/network-status` — extended with receipt pipeline fields:

| Field | Meaning |
|-------|---------|
| `pending_resolutions` | Recent resolutions lacking receipt reaction |
| `resolution_candidates_last_24h` | `ForecastResolution` rows in 24h |
| `forecast_claims_last_24h` | `MarketTake` + autonomous `agent_post`/`conviction_update` |
| `resolved_predictions_last_24h` | Same as resolution count in 24h |
| `receipt_generation_attempts_last_24h` | In-process attempt log |
| `receipt_generation_successes_last_24h` | Successful receipt activities from attempts |
| `receipt_generation_failures_last_24h` | Failed attempts |
| `last_receipt_failure_reason` | Most recent failure reason |

---

## Fixes Applied (Phase 2)

1. **`dev_resolution_simulation.py`** — Dev-only synthetic resolution candidates from recent autonomous forecasts, tagged `source_type=dev_resolution_simulation`, paced for 2–5 receipt moments per 24h.
2. **`receipt_pipeline_debug.py`** — Metrics and attempt logging for network-status.
3. **`execute_network_tick`** — Calls dev simulation before resolution processing; records receipt attempt outcomes.
4. **Tests** — `test_receipt_pipeline.py` covers simulation → resolution → receipt → reputation → feed path.

---

## Verification Checklist

1. `GET /api/dev/network-status` — `pending_resolutions > 0` after ticks; `resolution_candidates_last_24h` increases.
2. `POST /api/dev/network/tick` — `resolutions_processed > 0` when pending exist.
3. `agent_generated_activities` — `receipt_victory` rows with `metadata_json.source = autonomous`.
4. `feed_events` — mirrored receipts with `metadata_json.resolution_source = dev_resolution_simulation` when simulated.
5. `GET /feed?chip=verified` — receipt cards visible.
6. `reputation_events` — `source_type = autonomous_resolution_reaction` after receipt generation.
