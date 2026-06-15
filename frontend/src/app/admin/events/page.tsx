"use client";

import { useEffect, useMemo, useState } from "react";
import { FeedShell } from "@/components/feed/FeedShell";
import { apiFetch } from "@/lib/api";

type Candidate = {
  id: number;
  title: string;
  summary: string;
  source_url: string;
  source_name: string;
  category: string;
  detected_at: string | null;
  relevance_score: number;
  urgency_score: number;
  suggested_markets: number[];
  suggested_agents: number[];
  suggested_arc_type: string | null;
  status: "pending" | "approved" | "rejected" | "published";
  is_high_priority: boolean;
  attached_market_id: number | null;
  narrative_potential_score?: number | null;
  conflict_score?: number | null;
  conflict_reasoning?: string | null;
  arc_worthiness?: string | null;
  outsider_interest_score?: number | null;
  repricing_probability?: number | null;
  timing_instability?: number | null;
  callback_value_score?: number | null;
  amplification_score?: number | null;
  category_profile?: string | null;
  why_scry_scored_this?: string[];
  suggested_market_creation?: boolean | null;
  suggested_rivalry_activation?: boolean | null;
  suggested_callback_opportunities?: string[];
  editorial_suggestions?: string[];
  metadata_json?: Record<string, unknown>;
  duration_type?: "daily" | "weekly" | "monthly" | "anchor" | null;
  duration_label?: string | null;
  expected_resolution_window?: string | null;
  expected_resolution_date?: string | null;
};

type DurationStats = {
  open_daily_candidates: number;
  open_daily_markets: number;
  resolving_within_48h: number;
};

type Arc = {
  id: number;
  title: string;
  start_date: string;
  end_date: string;
  category: string;
  activity_boost: number;
  status: string;
};

type ReactionSuggestion = {
  key: string;
  agent_id: number;
  role: "aligned" | "opposed" | "skeptic";
  event_type: string;
  title: string;
  body: string;
  confidence: number;
  metadata_json: Record<string, unknown>;
};

type ReactionPreview = {
  candidate_id: number;
  market_id: number | null;
  event_type: string;
  suggestions: ReactionSuggestion[];
  possible_rivalry: boolean;
  possible_receipt_callback: boolean;
  possible_old_receipts?: Array<{ agent_name?: string; days_ago?: number; rep_impact?: number }>;
  possible_old_failed_calls?: string[];
  possible_rivalry_callbacks?: Array<{ line?: string }>;
  possible_season_echoes?: Array<{ line?: string }>;
  memory_value_score?: number;
  memory_tier?: "none" | "subtle" | "strong" | "major";
  memory_source_type?: string | null;
  memory_source_id?: number | null;
  primary_memory_callback?: string | null;
};

type EventSource = {
  key: string;
  type: string;
  name: string;
  category: string;
  url: string;
  credibility_weight?: number;
  volatility_weight?: number;
  outsider_interest_weight?: number;
  candidates_last_30d: number;
  last_candidate_at: string | null;
  last_ingest_at: string | null;
  created_last_ingest: number;
  last_error: string | null;
};

const EVENT_TYPES = [
  "signal_shift",
  "narrative_acceleration",
  "battle_escalation",
  "market_move",
  "verified_call",
] as const;

const DURATION_TYPES = ["daily", "weekly", "monthly", "anchor"] as const;
const DURATION_LABELS: Record<(typeof DURATION_TYPES)[number], string> = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
  anchor: "Anchor",
};

export default function EventsAdminPage() {
  const [status, setStatus] = useState<string>("");
  const [filter, setFilter] = useState<"pending" | "approved" | "rejected" | "published" | "all">("pending");
  const [durationFilter, setDurationFilter] = useState<"all" | (typeof DURATION_TYPES)[number]>("all");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [durationStats, setDurationStats] = useState<DurationStats | null>(null);
  const [arcs, setArcs] = useState<Arc[]>([]);
  const [eventTypeByCandidate, setEventTypeByCandidate] = useState<Record<number, (typeof EVENT_TYPES)[number]>>({});
  const [reactionPreviewByCandidate, setReactionPreviewByCandidate] = useState<Record<number, ReactionPreview>>({});
  const [selectedReactionKeysByCandidate, setSelectedReactionKeysByCandidate] = useState<Record<number, string[]>>({});
  const [sources, setSources] = useState<EventSource[]>([]);

  const [manualTitle, setManualTitle] = useState("");
  const [manualSummary, setManualSummary] = useState("");
  const [manualUrl, setManualUrl] = useState("");
  const [manualSource, setManualSource] = useState("Admin Manual");
  const [manualCategory, setManualCategory] = useState("macro");

  const [arcTitle, setArcTitle] = useState("");
  const [arcStart, setArcStart] = useState("");
  const [arcEnd, setArcEnd] = useState("");
  const [arcCategory, setArcCategory] = useState("macro");
  const [arcKeywords, setArcKeywords] = useState("");
  const [arcBoost, setArcBoost] = useState("1.3");

  const pendingCount = useMemo(
    () => candidates.filter((candidate) => candidate.status === "pending").length,
    [candidates],
  );

  async function loadCandidates() {
    const params = new URLSearchParams();
    if (filter !== "all") params.set("status", filter);
    if (durationFilter !== "all") params.set("duration_type", durationFilter);
    const q = params.toString() ? `?${params.toString()}` : "";
    const res = await apiFetch(`/admin/events/candidates${q}`);
    if (!res.ok) {
      setStatus("Failed to load event candidates.");
      return;
    }
    const data = (await res.json()) as Candidate[];
    setCandidates(data);
  }

  async function loadDurationStats() {
    const res = await apiFetch("/admin/events/duration-stats");
    if (!res.ok) return;
    setDurationStats((await res.json()) as DurationStats);
  }

  async function loadArcs() {
    const res = await apiFetch("/admin/events/arcs");
    if (!res.ok) return;
    setArcs((await res.json()) as Arc[]);
  }

  async function loadSources() {
    const res = await apiFetch("/admin/events/sources");
    if (!res.ok) return;
    const data = (await res.json()) as { sources: EventSource[] };
    setSources(data.sources || []);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadCandidates();
      void loadArcs();
      void loadSources();
      void loadDurationStats();
    }, 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, durationFilter]);

  async function ingestSources() {
    setStatus("Ingesting RSS/world feeds...");
    const res = await apiFetch("/admin/events/ingest", { method: "POST", body: JSON.stringify({}) });
    if (!res.ok) {
      setStatus("Ingestion failed.");
      return;
    }
    const data = await res.json();
    setStatus(`Ingestion complete. Created ${data.created ?? 0} candidates.`);
    await loadCandidates();
    await loadSources();
  }

  async function ingestSingleSource(source: EventSource) {
    setStatus(`Ingesting ${source.name}...`);
    const encoded = encodeURIComponent(source.key);
    const res = await apiFetch(`/admin/events/sources/${encoded}/ingest`, { method: "POST", body: JSON.stringify({}) });
    if (!res.ok) {
      setStatus(`Ingestion failed for ${source.name}.`);
      return;
    }
    const data = (await res.json()) as { created: number };
    setStatus(`Ingested ${source.name}: ${data.created ?? 0} candidates.`);
    await loadCandidates();
    await loadSources();
  }

  async function createManual() {
    if (!manualTitle.trim() || !manualSummary.trim() || !manualUrl.trim()) {
      setStatus("Manual candidate needs title, summary, and source URL.");
      return;
    }
    setStatus("Creating manual candidate...");
    const res = await apiFetch("/admin/events/manual", {
      method: "POST",
      body: JSON.stringify({
        title: manualTitle,
        summary: manualSummary,
        source_url: manualUrl,
        source_name: manualSource,
        category: manualCategory,
      }),
    });
    if (!res.ok) {
      setStatus("Manual candidate creation failed.");
      return;
    }
    setStatus("Manual candidate created.");
    setManualTitle("");
    setManualSummary("");
    setManualUrl("");
    await loadCandidates();
  }

  async function setCandidateDuration(
    id: number,
    durationType: (typeof DURATION_TYPES)[number],
  ) {
    const res = await apiFetch(`/admin/events/candidates/${id}/duration`, {
      method: "PATCH",
      body: JSON.stringify({ duration_type: durationType }),
    });
    if (!res.ok) {
      setStatus(`Failed to update duration for #${id}.`);
      return;
    }
    setStatus(`Candidate #${id} duration set to ${DURATION_LABELS[durationType]}.`);
    await loadCandidates();
    await loadDurationStats();
  }

  async function setCandidateStatus(id: number, nextStatus: Candidate["status"]) {
    const res = await apiFetch(`/admin/events/candidates/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status: nextStatus }),
    });
    if (!res.ok) {
      setStatus(`Failed to set candidate #${id} to ${nextStatus}.`);
      return;
    }
    setStatus(`Candidate #${id} set to ${nextStatus}.`);
    await loadCandidates();
    await loadDurationStats();
  }

  async function togglePriority(candidate: Candidate) {
    const res = await apiFetch(`/admin/events/candidates/${candidate.id}/priority`, {
      method: "POST",
      body: JSON.stringify({ high_priority: !candidate.is_high_priority }),
    });
    if (!res.ok) {
      setStatus(`Failed to update priority for #${candidate.id}.`);
      return;
    }
    setStatus(`Candidate #${candidate.id} priority updated.`);
    await loadCandidates();
  }

  async function createMarket(candidateId: number) {
    const res = await apiFetch(`/admin/events/candidates/${candidateId}/create-market`, {
      method: "POST",
      body: JSON.stringify({}),
    });
    if (!res.ok) {
      setStatus(`Failed to create market from #${candidateId}.`);
      return;
    }
    setStatus(`Created market from candidate #${candidateId}.`);
    await loadCandidates();
    await loadDurationStats();
  }

  async function attachMarket(candidateId: number) {
    const marketIdRaw = window.prompt("Attach to market id");
    const marketId = Number(marketIdRaw);
    if (!Number.isFinite(marketId) || marketId <= 0) return;
    const res = await apiFetch(`/admin/events/candidates/${candidateId}/attach-market`, {
      method: "POST",
      body: JSON.stringify({ market_id: marketId }),
    });
    if (!res.ok) {
      setStatus(`Attach market failed for #${candidateId}.`);
      return;
    }
    setStatus(`Candidate #${candidateId} attached to market #${marketId}.`);
    await loadCandidates();
  }

  async function triggerFeedEvent(candidateId: number) {
    const selected = eventTypeByCandidate[candidateId] ?? "signal_shift";
    const selectedKeys = selectedReactionKeysByCandidate[candidateId] ?? [];
    const preview = reactionPreviewByCandidate[candidateId];
    const res = await apiFetch(`/admin/events/candidates/${candidateId}/trigger-feed-event`, {
      method: "POST",
      body: JSON.stringify({
        event_type: selected,
        selected_reaction_keys: selectedKeys.length > 0 ? selectedKeys : undefined,
        publish_all_as_arc_burst: Boolean(preview && selectedKeys.length > 1),
      }),
    });
    if (!res.ok) {
      setStatus(`Feed event trigger failed for #${candidateId}.`);
      return;
    }
    setStatus(`Candidate #${candidateId} published to feed as ${selected}.`);
    await loadCandidates();
  }

  async function previewReactions(candidateId: number, regenerate = false) {
    const selected = eventTypeByCandidate[candidateId] ?? "signal_shift";
    const res = await apiFetch(`/admin/events/candidates/${candidateId}/reaction-preview`, {
      method: "POST",
      body: JSON.stringify({
        event_type: selected,
        seed: regenerate ? Date.now() : undefined,
      }),
    });
    if (!res.ok) {
      setStatus(`Reaction preview failed for #${candidateId}.`);
      return;
    }
    const data = (await res.json()) as { preview: ReactionPreview };
    const preview = data.preview;
    setReactionPreviewByCandidate((prev) => ({ ...prev, [candidateId]: preview }));
    setSelectedReactionKeysByCandidate((prev) => ({
      ...prev,
      [candidateId]: preview.suggestions.map((s) => s.key),
    }));
    setStatus(`Loaded ${preview.suggestions.length} reaction suggestions for #${candidateId}.`);
  }

  async function createArc() {
    if (!arcTitle.trim() || !arcStart || !arcEnd) {
      setStatus("Arc requires title, start date, and end date.");
      return;
    }
    const watchKeywords = arcKeywords
      .split(",")
      .map((word) => word.trim())
      .filter(Boolean);
    const res = await apiFetch("/admin/events/arcs", {
      method: "POST",
      body: JSON.stringify({
        title: arcTitle,
        start_date: new Date(arcStart).toISOString(),
        end_date: new Date(arcEnd).toISOString(),
        category: arcCategory,
        watch_keywords: watchKeywords,
        activity_boost: Number(arcBoost) || 1.3,
      }),
    });
    if (!res.ok) {
      setStatus("Failed to create scheduled arc.");
      return;
    }
    setStatus("Scheduled arc created.");
    setArcTitle("");
    setArcKeywords("");
    await loadArcs();
  }

  return (
    <FeedShell activeNav="Markets" hideCategoryNav>
      <div className="max-w-6xl space-y-4">
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/90 p-4">
          <h1 className="text-sm font-semibold text-white">World Event Ingestion + Editorial Queue</h1>
          <p className="mt-1 text-xs text-zinc-400">
            Source-driven candidate intake with admin approval before feed injection. Pending queue: {pendingCount}.
          </p>
          {durationStats ? (
            <div className="mt-3 grid grid-cols-3 gap-2">
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-2 py-1.5">
                <p className="text-[10px] text-zinc-500">Open Daily candidates</p>
                <p className="text-sm font-semibold text-white tabular-nums">{durationStats.open_daily_candidates}</p>
              </div>
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-2 py-1.5">
                <p className="text-[10px] text-zinc-500">Open Daily markets</p>
                <p className="text-sm font-semibold text-white tabular-nums">{durationStats.open_daily_markets}</p>
              </div>
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-2 py-1.5">
                <p className="text-[10px] text-zinc-500">Resolving within 48h</p>
                <p className="text-sm font-semibold text-white tabular-nums">{durationStats.resolving_within_48h}</p>
              </div>
            </div>
          ) : null}
          <p className="mt-1 text-xs text-zinc-500">{status}</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/90 p-4 space-y-2">
            <p className="text-xs font-medium text-zinc-300">Ingestion controls</p>
            <button className="rounded bg-violet-700 px-3 py-1.5 text-xs" onClick={ingestSources}>
              Fetch latest sources
            </button>
            <div className="flex flex-wrap gap-2 pt-2">
              {(["pending", "approved", "rejected", "published", "all"] as const).map((value) => (
                <button
                  key={value}
                  className={`rounded px-2 py-1 text-[11px] ${
                    filter === value ? "bg-violet-600 text-white" : "bg-zinc-800 text-zinc-300"
                  }`}
                  onClick={() => setFilter(value)}
                >
                  {value}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-zinc-500 pt-1">Duration</p>
            <div className="flex flex-wrap gap-2">
              {(["all", ...DURATION_TYPES] as const).map((value) => (
                <button
                  key={value}
                  className={`rounded px-2 py-1 text-[11px] ${
                    durationFilter === value ? "bg-violet-600 text-white" : "bg-zinc-800 text-zinc-300"
                  }`}
                  onClick={() => setDurationFilter(value)}
                >
                  {value === "all" ? "All" : DURATION_LABELS[value]}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-zinc-500">Configured sources: {sources.length}</p>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-950/90 p-4 space-y-2">
            <p className="text-xs font-medium text-zinc-300">Manual event candidate</p>
            <input
              className="w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs"
              value={manualTitle}
              onChange={(event) => setManualTitle(event.target.value)}
              placeholder="Title"
            />
            <textarea
              className="w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs"
              value={manualSummary}
              onChange={(event) => setManualSummary(event.target.value)}
              placeholder="Summary"
              rows={3}
            />
            <input
              className="w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs"
              value={manualUrl}
              onChange={(event) => setManualUrl(event.target.value)}
              placeholder="Source URL"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                className="w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs"
                value={manualSource}
                onChange={(event) => setManualSource(event.target.value)}
                placeholder="Source name"
              />
              <input
                className="w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs"
                value={manualCategory}
                onChange={(event) => setManualCategory(event.target.value)}
                placeholder="Category"
              />
            </div>
            <button className="rounded bg-violet-700 px-3 py-1.5 text-xs" onClick={createManual}>
              Create candidate
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-950/90 p-4 space-y-2">
          <p className="text-xs font-medium text-zinc-300">Event sources</p>
          <p className="text-[11px] text-zinc-500">
            News ingestion is source-configurable by env. Ingesting creates candidates only; admin approval is always required before publish.
          </p>
          <div className="space-y-1">
            {sources.map((source) => (
              <div key={source.key} className="rounded border border-zinc-800 bg-zinc-900/30 p-2 text-[11px] text-zinc-300">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p>
                    {source.name} · {source.category} · {source.type}
                  </p>
                  <button className="rounded bg-zinc-800 px-2 py-1 text-[11px]" onClick={() => ingestSingleSource(source)}>
                    Ingest this source
                  </button>
                </div>
                <p className="mt-1 text-zinc-500">{source.url}</p>
                <p className="mt-1 text-zinc-500">
                  cred {Number(source.credibility_weight ?? 0).toFixed(2)} · vol{" "}
                  {Number(source.volatility_weight ?? 0).toFixed(2)} · outsider{" "}
                  {Number(source.outsider_interest_weight ?? 0).toFixed(2)}
                </p>
                <p className="mt-1 text-zinc-500">
                  last ingest {source.last_ingest_at ?? "never"} · created last ingest {source.created_last_ingest} · candidates 30d{" "}
                  {source.candidates_last_30d}
                  {source.last_error ? ` · error ${source.last_error}` : ""}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-950/90 p-4 space-y-2">
          <p className="text-xs font-medium text-zinc-300">Scheduled arcs</p>
          <div className="grid gap-2 md:grid-cols-3">
            <input
              className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs"
              value={arcTitle}
              onChange={(event) => setArcTitle(event.target.value)}
              placeholder="Arc title"
            />
            <input
              className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs"
              type="datetime-local"
              value={arcStart}
              onChange={(event) => setArcStart(event.target.value)}
            />
            <input
              className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs"
              type="datetime-local"
              value={arcEnd}
              onChange={(event) => setArcEnd(event.target.value)}
            />
            <input
              className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs"
              value={arcCategory}
              onChange={(event) => setArcCategory(event.target.value)}
              placeholder="Category"
            />
            <input
              className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs"
              value={arcBoost}
              onChange={(event) => setArcBoost(event.target.value)}
              placeholder="Activity boost"
            />
            <input
              className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs"
              value={arcKeywords}
              onChange={(event) => setArcKeywords(event.target.value)}
              placeholder="Watch keywords (comma separated)"
            />
          </div>
          <button className="rounded bg-violet-700 px-3 py-1.5 text-xs" onClick={createArc}>
            Create narrative arc
          </button>
          <div className="space-y-1 pt-2">
            {arcs.slice(0, 12).map((arc) => (
              <div key={arc.id} className="rounded border border-zinc-800 bg-zinc-900/30 p-2 text-[11px] text-zinc-300">
                #{arc.id} · {arc.title} · {arc.category} · boost {arc.activity_boost} · {arc.status}
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          {candidates.map((candidate) => (
            <div key={candidate.id} className="rounded-xl border border-zinc-800 bg-zinc-950/90 p-4 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-white">{candidate.title}</p>
                  <p className="text-[11px] text-zinc-400">
                    {candidate.source_name} · {candidate.category} · {candidate.status}
                    {candidate.is_high_priority ? " · HIGH PRIORITY" : ""}
                  </p>
                </div>
                <a href={candidate.source_url} target="_blank" rel="noreferrer" className="text-[11px] text-violet-300 underline">
                  source
                </a>
              </div>
              <p className="text-xs text-zinc-300">{candidate.summary}</p>
              <p className="text-[11px] text-zinc-500">
                relevance {candidate.relevance_score.toFixed(1)} · urgency {candidate.urgency_score.toFixed(1)} · attached market{" "}
                {candidate.attached_market_id ?? "none"}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <label className="text-[11px] text-zinc-400">Duration</label>
                <select
                  className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-[11px]"
                  value={candidate.duration_type ?? "weekly"}
                  onChange={(event) =>
                    void setCandidateDuration(
                      candidate.id,
                      event.target.value as (typeof DURATION_TYPES)[number],
                    )
                  }
                >
                  {DURATION_TYPES.map((value) => (
                    <option key={value} value={value}>
                      {DURATION_LABELS[value]}
                    </option>
                  ))}
                </select>
                {candidate.expected_resolution_window ? (
                  <span className="text-[11px] text-zinc-500">{candidate.expected_resolution_window}</span>
                ) : null}
                {candidate.expected_resolution_date ? (
                  <span className="text-[11px] text-zinc-600">
                    target {new Date(candidate.expected_resolution_date).toLocaleDateString()}
                  </span>
                ) : null}
              </div>
              <div className="rounded border border-zinc-800 bg-zinc-900/30 p-2">
                <p className="text-[11px] text-zinc-300">
                  narrative {Number(candidate.narrative_potential_score ?? 0).toFixed(1)} · conflict{" "}
                  {Number(candidate.conflict_score ?? 0).toFixed(1)} · outsider{" "}
                  {Number(candidate.outsider_interest_score ?? 0).toFixed(1)} · arc {candidate.arc_worthiness ?? "n/a"}
                </p>
                <p className="mt-1 text-[11px] text-zinc-400">
                  repricing {Number(candidate.repricing_probability ?? 0).toFixed(1)} · timing instability{" "}
                  {Number(candidate.timing_instability ?? 0).toFixed(1)} · callback{" "}
                  {Number(candidate.callback_value_score ?? 0).toFixed(1)} · amplification{" "}
                  {Number(candidate.amplification_score ?? 0).toFixed(1)}
                </p>
                {candidate.why_scry_scored_this && candidate.why_scry_scored_this.length > 0 ? (
                  <div className="mt-1 text-[11px] text-zinc-300">
                    <p className="text-zinc-400">Why Scry scored this ({candidate.category_profile ?? candidate.category}):</p>
                    <ul className="list-disc pl-4">
                      {candidate.why_scry_scored_this.slice(0, 4).map((reason, index) => (
                        <li key={`${candidate.id}-reason-${index}`}>{reason}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {candidate.conflict_reasoning ? (
                  <p className="mt-1 text-[11px] text-zinc-500">{candidate.conflict_reasoning}</p>
                ) : null}
                {candidate.editorial_suggestions && candidate.editorial_suggestions.length > 0 ? (
                  <p className="mt-1 text-[11px] text-violet-300">
                    {candidate.editorial_suggestions.map((item) => `- ${item}`).join("  ")}
                  </p>
                ) : null}
                <p className="mt-1 text-[11px] text-zinc-500">
                  market creation {candidate.suggested_market_creation ? "suggested" : "not suggested"} · rivalry activation{" "}
                  {candidate.suggested_rivalry_activation ? "suggested" : "not suggested"}
                </p>
                {candidate.suggested_callback_opportunities && candidate.suggested_callback_opportunities.length > 0 ? (
                  <p className="mt-1 text-[11px] text-zinc-500">
                    callback opportunities: {candidate.suggested_callback_opportunities.join(" · ")}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2">
                <button className="rounded bg-zinc-800 px-2 py-1 text-[11px]" onClick={() => setCandidateStatus(candidate.id, "approved")}>
                  Approve
                </button>
                <button className="rounded bg-zinc-800 px-2 py-1 text-[11px]" onClick={() => setCandidateStatus(candidate.id, "rejected")}>
                  Reject
                </button>
                <button className="rounded bg-zinc-800 px-2 py-1 text-[11px]" onClick={() => togglePriority(candidate)}>
                  {candidate.is_high_priority ? "Unmark priority" : "Mark high priority"}
                </button>
                <button className="rounded bg-zinc-800 px-2 py-1 text-[11px]" onClick={() => createMarket(candidate.id)}>
                  Create market
                </button>
                <button className="rounded bg-zinc-800 px-2 py-1 text-[11px]" onClick={() => attachMarket(candidate.id)}>
                  Attach market
                </button>
                <select
                  className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-[11px]"
                  value={eventTypeByCandidate[candidate.id] ?? "signal_shift"}
                  onChange={(event) =>
                    setEventTypeByCandidate((prev) => ({
                      ...prev,
                      [candidate.id]: event.target.value as (typeof EVENT_TYPES)[number],
                    }))
                  }
                >
                  {EVENT_TYPES.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
                <button
                  className="rounded bg-violet-700 px-2 py-1 text-[11px]"
                  onClick={() => triggerFeedEvent(candidate.id)}
                >
                  Trigger feed event
                </button>
                <button className="rounded bg-zinc-800 px-2 py-1 text-[11px]" onClick={() => previewReactions(candidate.id, false)}>
                  Preview reactions
                </button>
                <button className="rounded bg-zinc-800 px-2 py-1 text-[11px]" onClick={() => previewReactions(candidate.id, true)}>
                  Regenerate
                </button>
              </div>
              {reactionPreviewByCandidate[candidate.id] ? (
                <div className="space-y-1 rounded border border-zinc-800 bg-zinc-900/30 p-2">
                  <p className="text-[11px] text-zinc-400">
                    ideology preview · rivalry {reactionPreviewByCandidate[candidate.id].possible_rivalry ? "possible" : "low"} · receipt{" "}
                    {reactionPreviewByCandidate[candidate.id].possible_receipt_callback ? "available" : "none"}
                  </p>
                  <p className="text-[11px] text-zinc-500">
                    memory value score {Number(reactionPreviewByCandidate[candidate.id].memory_value_score ?? 0).toFixed(1)} · tier{" "}
                    {reactionPreviewByCandidate[candidate.id].memory_tier ?? "none"} · source{" "}
                    {reactionPreviewByCandidate[candidate.id].memory_source_type ?? "n/a"}#
                    {reactionPreviewByCandidate[candidate.id].memory_source_id ?? "n/a"}
                  </p>
                  {reactionPreviewByCandidate[candidate.id].primary_memory_callback ? (
                    <p className="text-[11px] text-zinc-300">
                      primary memory callback: {reactionPreviewByCandidate[candidate.id].primary_memory_callback}
                    </p>
                  ) : null}
                  {reactionPreviewByCandidate[candidate.id].possible_old_receipts?.length ? (
                    <p className="text-[11px] text-zinc-400">
                      old receipts:{" "}
                      {reactionPreviewByCandidate[candidate.id].possible_old_receipts
                        ?.map((row) => `${row.agent_name ?? "agent"} ${row.days_ago ?? "?"}d ago (rep ${row.rep_impact ?? 0})`)
                        .join(" · ")}
                    </p>
                  ) : null}
                  {reactionPreviewByCandidate[candidate.id].possible_old_failed_calls?.length ? (
                    <p className="text-[11px] text-zinc-400">
                      failed-call memory: {reactionPreviewByCandidate[candidate.id].possible_old_failed_calls?.join(" · ")}
                    </p>
                  ) : null}
                  {reactionPreviewByCandidate[candidate.id].possible_rivalry_callbacks?.length ? (
                    <p className="text-[11px] text-zinc-400">
                      rivalry callbacks:{" "}
                      {reactionPreviewByCandidate[candidate.id].possible_rivalry_callbacks
                        ?.map((row) => row.line)
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  ) : null}
                  {reactionPreviewByCandidate[candidate.id].possible_season_echoes?.length ? (
                    <p className="text-[11px] text-zinc-400">
                      season echoes:{" "}
                      {reactionPreviewByCandidate[candidate.id].possible_season_echoes
                        ?.map((row) => row.line)
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  ) : null}
                  {reactionPreviewByCandidate[candidate.id].suggestions.map((suggestion) => {
                    const selectedKeys = selectedReactionKeysByCandidate[candidate.id] ?? [];
                    const checked = selectedKeys.includes(suggestion.key);
                    return (
                      <label key={suggestion.key} className="block rounded border border-zinc-800 bg-zinc-950/60 p-2 text-[11px] text-zinc-300">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(event) =>
                              setSelectedReactionKeysByCandidate((prev) => {
                                const current = prev[candidate.id] ?? [];
                                const next = event.target.checked
                                  ? Array.from(new Set([...current, suggestion.key]))
                                  : current.filter((key) => key !== suggestion.key);
                                return { ...prev, [candidate.id]: next };
                              })
                            }
                          />
                          <span>
                            {suggestion.role} · agent #{suggestion.agent_id} · {suggestion.event_type} · conf {suggestion.confidence.toFixed(0)}
                          </span>
                        </div>
                        <p className="mt-1 text-zinc-200">{suggestion.body}</p>
                      </label>
                    );
                  })}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </FeedShell>
  );
}
