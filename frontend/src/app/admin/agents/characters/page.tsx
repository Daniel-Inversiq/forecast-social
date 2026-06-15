"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { FeedShell } from "@/components/feed/FeedShell";
import { API_BASE, apiFetch } from "@/lib/api";

type CharacterIndexRow = {
  slug: string;
  display_name: string;
  preview_url: string;
};

type ModelConfigFields = {
  model_provider: string;
  model_name: string;
  temperature: number;
  top_p: number;
  max_tokens: number;
  frequency_penalty: number;
  presence_penalty: number;
};

type ModelConfigPayload = {
  slug: string;
  effective: ModelConfigFields;
  override: ModelConfigFields | null;
  uses_global_default: boolean;
  provider_configured: boolean;
  generation_modes: { llm: boolean; template: boolean };
};

type ModelPresetsMeta = {
  supported_providers: string[];
  provider_model_hints: Record<string, string[]>;
  global_default: ModelConfigFields;
  presets: Record<string, ModelConfigFields & { label?: string }>;
  llm_providers_configured: Record<string, boolean>;
};

type GenerationMeta = {
  generation_mode?: string;
  model_provider?: string;
  model_name?: string;
  temperature?: number;
  llm_fallback?: boolean;
  llm_skip_reason?: string;
};

type CharacterDetail = {
  slug: string;
  display_name: string;
  character_bible: Record<string, unknown>;
  voice_rules: Record<string, unknown>;
  relationships: Record<string, unknown>;
  model_config: ModelConfigPayload;
  samples: {
    post: string;
    post_consistency: Record<string, number | boolean>;
    post_generation?: GenerationMeta;
    counter: string;
    counter_generation?: GenerationMeta;
    win: string;
    win_generation?: GenerationMeta;
    loss: string;
    loss_generation?: GenerationMeta;
    battle?: string;
    battle_generation?: GenerationMeta;
  };
};

type BlindSample = {
  anonymous_id: string;
  body: string;
  consistency: Record<string, number | boolean>;
};

type BlindTest = {
  instructions: string;
  seed: number | null;
  samples: BlindSample[];
  answers: { anonymous_id: string; slug: string }[];
};

const PRESET_ORDER = ["precise", "volatile", "terse", "creative", "institutional"] as const;

type BibleFields = {
  origin_story: string;
  worldview: string;
  core_belief: string;
  biggest_victory: string;
  biggest_scar: string;
  blind_spot: string;
  what_makes_them_angry: string;
  what_they_secretly_respect: string;
  confidence_style: string;
  humility_style: string;
  loss_behavior: string;
  win_behavior: string;
  forbidden_phrases: string[];
  signature_phrases: string[];
  favorite_narratives: string[];
  hated_narratives: string[];
  recurring_enemies: string[];
  recurring_allies: string[];
  recurring_targets: string[];
  example_good_posts: string[];
  example_bad_posts: string[];
  voice_rules: Record<string, unknown>;
};

const BIBLE_TEXT_FIELDS: { key: keyof BibleFields; label: string; rows?: number }[] = [
  { key: "origin_story", label: "Origin story", rows: 3 },
  { key: "worldview", label: "Worldview", rows: 2 },
  { key: "core_belief", label: "Core belief", rows: 2 },
  { key: "biggest_victory", label: "Biggest victory", rows: 2 },
  { key: "biggest_scar", label: "Biggest scar", rows: 2 },
  { key: "blind_spot", label: "Blind spot", rows: 2 },
  { key: "what_makes_them_angry", label: "What makes them angry", rows: 2 },
  { key: "what_they_secretly_respect", label: "What they secretly respect", rows: 2 },
  { key: "confidence_style", label: "Confidence style", rows: 2 },
  { key: "humility_style", label: "Humility style", rows: 2 },
  { key: "loss_behavior", label: "Loss behavior", rows: 2 },
  { key: "win_behavior", label: "Win behavior", rows: 2 },
];

const BIBLE_ARRAY_FIELDS: { key: keyof BibleFields; label: string; rows?: number }[] = [
  { key: "forbidden_phrases", label: "Forbidden phrases" },
  { key: "signature_phrases", label: "Signature phrases" },
  { key: "favorite_narratives", label: "Favorite narratives" },
  { key: "hated_narratives", label: "Hated narratives" },
  { key: "recurring_enemies", label: "Recurring enemies" },
  { key: "recurring_allies", label: "Recurring allies" },
  { key: "recurring_targets", label: "Recurring targets" },
  { key: "example_good_posts", label: "Example good posts", rows: 3 },
  { key: "example_bad_posts", label: "Example bad posts", rows: 3 },
];

function linesToList(text: string): string[] {
  return text
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

function listToLines(items: string[]): string {
  return items.join("\n");
}

function parseApiErrors(detail: unknown): string[] {
  if (typeof detail === "string") {
    return detail.split("; ").filter(Boolean);
  }
  if (Array.isArray(detail)) {
    return detail.map((d) => (typeof d === "object" && d && "msg" in d ? String(d.msg) : String(d)));
  }
  return ["Request failed."];
}

export default function CharacterAdminPage() {
  const [index, setIndex] = useState<CharacterIndexRow[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<CharacterDetail | null>(null);
  const [modelMeta, setModelMeta] = useState<ModelPresetsMeta | null>(null);
  const [modelForm, setModelForm] = useState<ModelConfigFields | null>(null);
  const [blind, setBlind] = useState<BlindTest | null>(null);
  const [showAnswers, setShowAnswers] = useState(false);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingModel, setSavingModel] = useState(false);
  const [activeTab, setActiveTab] = useState<"samples" | "bible">("samples");
  const [bibleForm, setBibleForm] = useState<BibleFields | null>(null);
  const [voiceRulesJson, setVoiceRulesJson] = useState("");
  const [bibleErrors, setBibleErrors] = useState<string[]>([]);
  const [savingBible, setSavingBible] = useState(false);
  const [restoringBible, setRestoringBible] = useState(false);
  const [runningBlind, setRunningBlind] = useState(false);

  const loadIndex = useCallback(async () => {
    const res = await fetch(`${API_BASE}/admin/agents/characters`);
    if (!res.ok) {
      setStatus("Failed to load characters (dev admin only).");
      return;
    }
    setIndex(await res.json());
  }, []);

  const loadModelMeta = useCallback(async () => {
    const res = await fetch(`${API_BASE}/admin/agents/characters/model-presets`);
    if (res.ok) setModelMeta(await res.json());
  }, []);

  const loadDetail = useCallback(async (slug: string, seed?: number) => {
    setStatus(`Loading ${slug}…`);
    const q = seed != null ? `?seed=${seed}` : "";
    const res = await fetch(`${API_BASE}/admin/agents/characters/${slug}${q}`);
    if (!res.ok) {
      setStatus("Failed to load character detail.");
      return;
    }
    const data: CharacterDetail = await res.json();
    setDetail(data);
    setModelForm({ ...data.model_config.effective });
    setStatus("");
  }, []);

  const loadBibleForm = useCallback(async (slug: string) => {
    const res = await fetch(`${API_BASE}/admin/agents/characters/${slug}/bible`);
    if (!res.ok) {
      setBibleErrors(["Failed to load bible fields."]);
      return;
    }
    const data = await res.json();
    const fields = data.fields as BibleFields;
    setBibleForm(fields);
    setVoiceRulesJson(JSON.stringify(fields.voice_rules ?? {}, null, 2));
    setBibleErrors([]);
  }, []);

  const loadBlind = useCallback(async (seed?: number) => {
    setShowAnswers(false);
    const q = seed != null ? `?seed=${seed}` : "";
    const res = await fetch(`${API_BASE}/admin/agents/characters/blind-test${q}`);
    if (!res.ok) {
      setStatus("Failed to load blind test.");
      return;
    }
    setBlind(await res.json());
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await Promise.all([loadIndex(), loadBlind(), loadModelMeta()]);
      setLoading(false);
    })();
  }, [loadIndex, loadBlind, loadModelMeta]);

  useEffect(() => {
    if (selected) {
      loadDetail(selected);
      loadBibleForm(selected);
    }
  }, [selected, loadDetail, loadBibleForm]);

  async function regenerate(slug: string) {
    setStatus("Regenerating samples with current model settings…");
    const res = await apiFetch(`/admin/agents/characters/${slug}/regenerate-samples`, {
      method: "POST",
      body: JSON.stringify({ seed: Date.now() }),
    });
    if (!res.ok) {
      setStatus("Regenerate failed.");
      return;
    }
    const data = await res.json();
    setDetail(data);
    setModelForm({ ...data.model_config.effective });
    setStatus("Samples regenerated.");
  }

  async function saveModelConfig(slug: string) {
    if (!modelForm) return;
    setSavingModel(true);
    setStatus("Saving model settings…");
    const res = await apiFetch(`/admin/agents/characters/${slug}/model-config`, {
      method: "PUT",
      body: JSON.stringify(modelForm),
    });
    setSavingModel(false);
    if (!res.ok) {
      setStatus("Could not save model settings.");
      return;
    }
    setStatus("Model settings saved.");
    await loadDetail(slug);
  }

  async function applyPreset(slug: string, presetKey: string) {
    setStatus(`Applying ${presetKey} preset…`);
    const res = await apiFetch(
      `/admin/agents/characters/${slug}/model-config/preset/${presetKey}`,
      { method: "POST" }
    );
    if (!res.ok) {
      setStatus("Preset apply failed.");
      return;
    }
    const data = await res.json();
    setModelForm({ ...data.config.effective });
    setStatus(`Preset "${presetKey}" applied. Regenerate samples to compare.`);
    await loadDetail(slug);
  }

  async function resetToGlobal(slug: string) {
    setStatus("Resetting to global default…");
    const res = await apiFetch(`/admin/agents/characters/${slug}/model-config`, {
      method: "PUT",
      body: JSON.stringify({
        ...modelForm,
        clear_override: true,
      }),
    });
    if (!res.ok) {
      setStatus("Reset failed.");
      return;
    }
    await loadDetail(slug);
    setStatus("Using global default model settings.");
  }

  async function saveBible(slug: string) {
    if (!bibleForm) return;
    setSavingBible(true);
    setBibleErrors([]);
    setStatus("Saving bible…");

    let voiceRules: Record<string, unknown>;
    try {
      voiceRules = JSON.parse(voiceRulesJson) as Record<string, unknown>;
      if (!voiceRules || typeof voiceRules !== "object" || Array.isArray(voiceRules)) {
        throw new Error("voice_rules must be a JSON object");
      }
    } catch {
      setSavingBible(false);
      setBibleErrors(["voice_rules must be valid JSON object"]);
      setStatus("Bible save failed — fix validation errors.");
      return;
    }

    const payload = { ...bibleForm, voice_rules: voiceRules };
    const res = await apiFetch(
      `/admin/agents/characters/${slug}/bible?seed=${Date.now()}`,
      { method: "PUT", body: JSON.stringify(payload) }
    );
    setSavingBible(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setBibleErrors(parseApiErrors(err.detail));
      setStatus("Bible save failed.");
      return;
    }
    const data = await res.json();
    setDetail(data);
    setModelForm({ ...data.model_config.effective });
    if (data.fields) {
      setBibleForm(data.fields as BibleFields);
      setVoiceRulesJson(JSON.stringify((data.fields as BibleFields).voice_rules ?? {}, null, 2));
    } else if (data.character_bible) {
      await loadBibleForm(slug);
    }
    setActiveTab("samples");
    setStatus("Bible saved — samples regenerated with new voice.");
  }

  async function restoreBible(slug: string) {
    setRestoringBible(true);
    setBibleErrors([]);
    setStatus("Restoring latest backup…");
    const res = await apiFetch(
      `/admin/agents/characters/${slug}/bible/restore-latest-backup?seed=${Date.now()}`,
      { method: "POST" }
    );
    setRestoringBible(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setBibleErrors(parseApiErrors(err.detail));
      setStatus("Restore failed.");
      return;
    }
    const data = await res.json();
    setDetail(data);
    setModelForm({ ...data.model_config.effective });
    await loadBibleForm(slug);
    setActiveTab("samples");
    setStatus("Restored latest backup — samples regenerated.");
  }

  async function runBlindWithCurrentBibles() {
    setRunningBlind(true);
    setShowAnswers(false);
    setStatus("Running blind test with current bibles…");
    const res = await apiFetch(
      `/admin/agents/characters/blind-test?seed=${Date.now()}`,
      { method: "POST" }
    );
    setRunningBlind(false);
    if (!res.ok) {
      setStatus("Blind test failed.");
      return;
    }
    setBlind(await res.json());
    setStatus("Blind test ready — guess the authors, then reveal answers.");
  }

  const hints =
    modelForm && modelMeta?.provider_model_hints[modelForm.model_provider];

  return (
    <FeedShell>
      <div className="max-w-4xl mx-auto py-6 px-4 space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold text-white">Character bible (admin)</h1>
            <p className="text-[11px] text-zinc-500 mt-1">
              Season 1 core cast — voice rules, model settings, and sample copy for manual QA.
            </p>
          </div>
          <Link href="/admin/agents" className="text-[11px] text-violet-400 hover:text-violet-300">
            ← Agent roster
          </Link>
        </div>

        {status && <p className="text-[11px] text-zinc-400">{status}</p>}
        {loading && <p className="text-[11px] text-zinc-600">Loading…</p>}

        <section className="space-y-3 border border-zinc-800 rounded-lg p-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="text-sm font-medium text-zinc-200">Blind voice test</h2>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={runningBlind}
                onClick={runBlindWithCurrentBibles}
                className="text-[11px] px-2.5 py-1 rounded bg-violet-900/50 text-violet-200 hover:bg-violet-800/60 disabled:opacity-50"
              >
                Run blind test with current bibles
              </button>
              <button
                type="button"
                onClick={() => loadBlind(Date.now())}
                className="text-[11px] text-violet-400 hover:text-violet-300"
              >
                New seed (cached)
              </button>
            </div>
          </div>
          <p className="text-[11px] text-zinc-500">{blind?.instructions}</p>
          {blind?.samples.map((s) => (
            <div key={s.anonymous_id} className="rounded bg-zinc-900/80 p-3 text-[12px] text-zinc-300">
              <span className="text-zinc-500 font-mono text-[10px]">{s.anonymous_id}</span>
              <p className="mt-1 whitespace-pre-wrap">{s.body}</p>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setShowAnswers((v) => !v)}
            className="text-[11px] text-amber-400/90 hover:text-amber-300"
          >
            {showAnswers ? "Hide answers" : "Reveal answers"}
          </button>
          {showAnswers && blind?.answers && (
            <ul className="text-[11px] text-zinc-400 font-mono space-y-1">
              {blind.answers.map((a) => (
                <li key={a.anonymous_id}>
                  {a.anonymous_id} → {a.slug}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="flex flex-wrap gap-2">
          {index.map((row) => (
            <button
              key={row.slug}
              type="button"
              onClick={() => setSelected(row.slug)}
              className={`text-[11px] px-3 py-1.5 rounded-full border ${
                selected === row.slug
                  ? "border-violet-500 text-violet-200 bg-violet-950/40"
                  : "border-zinc-700 text-zinc-400 hover:border-zinc-500"
              }`}
            >
              {row.display_name}
            </button>
          ))}
        </section>

        {detail && modelForm && (
          <section className="space-y-4 border border-zinc-800 rounded-lg p-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h2 className="text-sm font-medium text-white">{detail.display_name}</h2>
              <div className="flex flex-wrap gap-2 items-center">
                <div className="flex rounded border border-zinc-700 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setActiveTab("samples")}
                    className={`text-[11px] px-3 py-1.5 ${
                      activeTab === "samples"
                        ? "bg-violet-950/60 text-violet-200"
                        : "text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    Model &amp; samples
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("bible")}
                    className={`text-[11px] px-3 py-1.5 border-l border-zinc-700 ${
                      activeTab === "bible"
                        ? "bg-violet-950/60 text-violet-200"
                        : "text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    Edit bible
                  </button>
                </div>
                {activeTab === "samples" && (
                  <button
                    type="button"
                    onClick={() => regenerate(detail.slug)}
                    className="text-[11px] text-violet-400 hover:text-violet-300"
                  >
                    Regenerate samples
                  </button>
                )}
              </div>
            </div>

            {activeTab === "bible" && bibleForm && (
              <div className="space-y-4 border border-zinc-800 rounded-lg p-3">
                <p className="text-[10px] text-zinc-500">
                  Edit personality fields only. Slug, display name, and speech_rules stay unchanged.
                  Saves create a timestamped backup on disk.
                </p>

                {bibleErrors.length > 0 && (
                  <ul className="text-[11px] text-red-400/90 space-y-0.5 list-disc list-inside">
                    {bibleErrors.map((e) => (
                      <li key={e}>{e}</li>
                    ))}
                  </ul>
                )}

                <div className="grid gap-3 sm:grid-cols-2">
                  {BIBLE_TEXT_FIELDS.map(({ key, label, rows }) => (
                    <label key={key} className="text-[10px] text-zinc-500 sm:col-span-2">
                      {label}
                      <textarea
                        value={String(bibleForm[key] ?? "")}
                        onChange={(e) =>
                          setBibleForm({ ...bibleForm, [key]: e.target.value })
                        }
                        rows={rows ?? 2}
                        className="mt-0.5 w-full rounded bg-zinc-950 border border-zinc-700 text-[11px] text-zinc-200 px-2 py-1.5"
                      />
                    </label>
                  ))}
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  {BIBLE_ARRAY_FIELDS.map(({ key, label, rows }) => (
                    <label key={key} className="text-[10px] text-zinc-500">
                      {label}
                      <span className="text-zinc-600"> — one item per line</span>
                      <textarea
                        value={listToLines(bibleForm[key] as string[])}
                        onChange={(e) =>
                          setBibleForm({ ...bibleForm, [key]: linesToList(e.target.value) })
                        }
                        rows={rows ?? 4}
                        className="mt-0.5 w-full rounded bg-zinc-950 border border-zinc-700 text-[11px] text-zinc-200 px-2 py-1.5 font-mono"
                      />
                      {(bibleForm[key] as string[]).length > 0 && (
                        <span className="mt-1 flex flex-wrap gap-1">
                          {(bibleForm[key] as string[]).map((item) => (
                            <span
                              key={item}
                              className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400"
                            >
                              {item}
                            </span>
                          ))}
                        </span>
                      )}
                    </label>
                  ))}
                </div>

                <label className="block text-[10px] text-zinc-500">
                  voice_rules (JSON)
                  <textarea
                    value={voiceRulesJson}
                    onChange={(e) => setVoiceRulesJson(e.target.value)}
                    rows={10}
                    spellCheck={false}
                    className="mt-0.5 w-full rounded bg-zinc-950 border border-zinc-700 text-[10px] text-zinc-200 px-2 py-1.5 font-mono"
                  />
                </label>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={savingBible}
                    onClick={() => saveBible(detail.slug)}
                    className="text-[11px] px-3 py-1.5 rounded bg-violet-700/80 text-white hover:bg-violet-600 disabled:opacity-50"
                  >
                    Save bible
                  </button>
                  <button
                    type="button"
                    disabled={restoringBible}
                    onClick={() => restoreBible(detail.slug)}
                    className="text-[11px] px-3 py-1.5 rounded border border-zinc-700 text-zinc-400 hover:text-zinc-200 disabled:opacity-50"
                  >
                    Restore latest backup
                  </button>
                </div>
              </div>
            )}

            {activeTab === "samples" && (
              <>
            <div className="border border-zinc-800 rounded-lg p-3 space-y-3">
              <h3 className="text-[12px] font-medium text-zinc-200">Model settings</h3>
              <p className="text-[10px] text-zinc-500">
                API keys stay on the server.{" "}
                {detail.model_config.uses_global_default
                  ? "Using global default."
                  : "Per-agent override active."}{" "}
                {detail.model_config.generation_modes.llm
                  ? "LLM available for this provider."
                  : "Template fallback (set API key or use template provider)."}
              </p>

              <div className="flex flex-wrap gap-1.5">
                {PRESET_ORDER.map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => applyPreset(detail.slug, key)}
                    className="text-[10px] px-2 py-1 rounded border border-zinc-700 text-zinc-400 hover:border-violet-600 hover:text-violet-300"
                  >
                    {modelMeta?.presets[key]?.label ?? key}
                  </button>
                ))}
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <label className="text-[10px] text-zinc-500">
                  Provider
                  <select
                    value={modelForm.model_provider}
                    onChange={(e) =>
                      setModelForm({ ...modelForm, model_provider: e.target.value })
                    }
                    className="mt-0.5 w-full rounded bg-zinc-950 border border-zinc-700 text-[11px] text-zinc-200 px-2 py-1.5"
                  >
                    {(modelMeta?.supported_providers ?? ["openai", "anthropic", "template"]).map(
                      (p) => (
                        <option key={p} value={p}>
                          {p}
                          {modelMeta?.llm_providers_configured[p] === false && p !== "template"
                            ? " (no key)"
                            : ""}
                        </option>
                      )
                    )}
                  </select>
                </label>
                <label className="text-[10px] text-zinc-500">
                  Model
                  {hints && hints.length > 0 ? (
                    <select
                      value={modelForm.model_name}
                      onChange={(e) =>
                        setModelForm({ ...modelForm, model_name: e.target.value })
                      }
                      className="mt-0.5 w-full rounded bg-zinc-950 border border-zinc-700 text-[11px] text-zinc-200 px-2 py-1.5"
                    >
                      {hints.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      value={modelForm.model_name}
                      onChange={(e) =>
                        setModelForm({ ...modelForm, model_name: e.target.value })
                      }
                      className="mt-0.5 w-full rounded bg-zinc-950 border border-zinc-700 text-[11px] text-zinc-200 px-2 py-1.5"
                    />
                  )}
                </label>
                <label className="text-[10px] text-zinc-500">
                  Temperature
                  <input
                    type="number"
                    step="0.05"
                    min={0}
                    max={2}
                    value={modelForm.temperature}
                    onChange={(e) =>
                      setModelForm({ ...modelForm, temperature: parseFloat(e.target.value) })
                    }
                    className="mt-0.5 w-full rounded bg-zinc-950 border border-zinc-700 text-[11px] text-zinc-200 px-2 py-1.5"
                  />
                </label>
                <label className="text-[10px] text-zinc-500">
                  Top P
                  <input
                    type="number"
                    step="0.05"
                    min={0}
                    max={1}
                    value={modelForm.top_p}
                    onChange={(e) =>
                      setModelForm({ ...modelForm, top_p: parseFloat(e.target.value) })
                    }
                    className="mt-0.5 w-full rounded bg-zinc-950 border border-zinc-700 text-[11px] text-zinc-200 px-2 py-1.5"
                  />
                </label>
                <label className="text-[10px] text-zinc-500">
                  Max tokens
                  <input
                    type="number"
                    min={32}
                    max={2048}
                    value={modelForm.max_tokens}
                    onChange={(e) =>
                      setModelForm({ ...modelForm, max_tokens: parseInt(e.target.value, 10) })
                    }
                    className="mt-0.5 w-full rounded bg-zinc-950 border border-zinc-700 text-[11px] text-zinc-200 px-2 py-1.5"
                  />
                </label>
                <label className="text-[10px] text-zinc-500">
                  Frequency penalty
                  <input
                    type="number"
                    step="0.05"
                    min={0}
                    max={2}
                    value={modelForm.frequency_penalty}
                    onChange={(e) =>
                      setModelForm({
                        ...modelForm,
                        frequency_penalty: parseFloat(e.target.value),
                      })
                    }
                    className="mt-0.5 w-full rounded bg-zinc-950 border border-zinc-700 text-[11px] text-zinc-200 px-2 py-1.5"
                  />
                </label>
                <label className="text-[10px] text-zinc-500 sm:col-span-2">
                  Presence penalty
                  <input
                    type="number"
                    step="0.05"
                    min={0}
                    max={2}
                    value={modelForm.presence_penalty}
                    onChange={(e) =>
                      setModelForm({
                        ...modelForm,
                        presence_penalty: parseFloat(e.target.value),
                      })
                    }
                    className="mt-0.5 w-full rounded bg-zinc-950 border border-zinc-700 text-[11px] text-zinc-200 px-2 py-1.5"
                  />
                </label>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={savingModel}
                  onClick={() => saveModelConfig(detail.slug)}
                  className="text-[11px] px-3 py-1.5 rounded bg-violet-700/80 text-white hover:bg-violet-600 disabled:opacity-50"
                >
                  Save model settings
                </button>
                <button
                  type="button"
                  onClick={() => resetToGlobal(detail.slug)}
                  className="text-[11px] px-3 py-1.5 rounded border border-zinc-700 text-zinc-400 hover:text-zinc-200"
                >
                  Use global default
                </button>
                <button
                  type="button"
                  onClick={() => regenerate(detail.slug)}
                  className="text-[11px] px-3 py-1.5 rounded border border-violet-800 text-violet-300 hover:bg-violet-950/50"
                >
                  Regenerate with these settings
                </button>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <SampleCard
                title="Sample post"
                body={detail.samples.post}
                meta={detail.samples.post_consistency}
                generation={detail.samples.post_generation}
              />
              <SampleCard title="Win reaction" body={detail.samples.win} generation={detail.samples.win_generation} />
              <SampleCard title="Loss reaction" body={detail.samples.loss} generation={detail.samples.loss_generation} />
              <div className="sm:col-span-2">
                <SampleCard
                  title="Sample counter"
                  body={detail.samples.counter}
                  generation={detail.samples.counter_generation}
                />
              </div>
              {detail.samples.battle && (
                <div className="sm:col-span-2">
                  <SampleCard
                    title="Sample battle"
                    body={detail.samples.battle}
                    generation={detail.samples.battle_generation}
                  />
                </div>
              )}
            </div>

            <details className="text-[11px] text-zinc-400">
              <summary className="cursor-pointer text-zinc-300">Character bible JSON</summary>
              <pre className="mt-2 overflow-auto max-h-64 text-[10px] bg-zinc-950 p-2 rounded">
                {JSON.stringify(detail.character_bible, null, 2)}
              </pre>
            </details>
            <details className="text-[11px] text-zinc-400">
              <summary className="cursor-pointer text-zinc-300">Voice rules</summary>
              <pre className="mt-2 overflow-auto max-h-40 text-[10px] bg-zinc-950 p-2 rounded">
                {JSON.stringify(detail.voice_rules, null, 2)}
              </pre>
            </details>
            <details className="text-[11px] text-zinc-400">
              <summary className="cursor-pointer text-zinc-300">Relationships</summary>
              <pre className="mt-2 overflow-auto max-h-40 text-[10px] bg-zinc-950 p-2 rounded">
                {JSON.stringify(detail.relationships, null, 2)}
              </pre>
            </details>
              </>
            )}
          </section>
        )}

        {!selected && !loading && (
          <p className="text-[11px] text-zinc-600">Select an agent to preview bible and samples.</p>
        )}
      </div>
    </FeedShell>
  );
}

function SampleCard({
  title,
  body,
  meta,
  generation,
}: {
  title: string;
  body: string;
  meta?: Record<string, number | boolean>;
  generation?: GenerationMeta;
}) {
  return (
    <div className="rounded bg-zinc-900/80 p-3">
      <p className="text-[10px] uppercase tracking-wide text-zinc-500">{title}</p>
      <p className="mt-1 text-[12px] text-zinc-300 whitespace-pre-wrap">{body}</p>
      {generation && (
        <p className="mt-2 text-[10px] font-mono text-zinc-600">
          {generation.generation_mode ?? "?"}
          {generation.model_name ? ` · ${generation.model_provider}/${generation.model_name}` : ""}
          {generation.temperature != null ? ` · t=${generation.temperature}` : ""}
          {generation.llm_fallback ? " · template fallback" : ""}
        </p>
      )}
      {meta && (
        <p className="mt-1 text-[10px] font-mono text-zinc-600">
          voice {String(meta.voice)} · generic_risk {String(meta.generic_risk)}
        </p>
      )}
    </div>
  );
}
