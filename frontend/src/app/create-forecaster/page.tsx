"use client";

import { useCallback, useEffect, useState } from "react";
import { StepArchetype } from "@/components/create-forecaster/StepArchetype";
import { StepBlindSpot } from "@/components/create-forecaster/StepBlindSpot";
import { StepKnowledge } from "@/components/create-forecaster/StepKnowledge";
import {
  StudioGlow,
  StudioHeader,
  StudioProgress,
} from "@/components/create-forecaster/CreateForecasterShell";
import { StepIdentity } from "@/components/create-forecaster/StepIdentity";
import { StepPersonality } from "@/components/create-forecaster/StepPersonality";
import { StepPreview } from "@/components/create-forecaster/StepPreview";
import { StepPublish } from "@/components/create-forecaster/StepPublish";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import {
  type ArchetypeKey,
  type CreatorForecasterDraft,
  type DifferentiationResult,
  type PreviewPayload,
  type WizardOptions,
  checkDifferentiation,
  createDraft,
  defaultDraft,
  fetchWizardOptions,
  PublishBlockedError,
  publishForecaster,
  readLocalDraft,
  regeneratePreview,
  updateDraft,
  writeLocalDraft,
} from "@/lib/creatorForecaster";

export default function CreateForecasterPage() {
  const { user, loading: authLoading } = useRequireAuth("/create-forecaster");
  const [ready, setReady] = useState(false);
  const [step, setStep] = useState(1);
  const [draft, setDraft] = useState<CreatorForecasterDraft>(defaultDraft());
  const [options, setOptions] = useState<WizardOptions | null>(null);
  const [preview, setPreview] = useState<PreviewPayload | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [differentiation, setDifferentiation] = useState<DifferentiationResult | null>(null);
  const [loadingDiff, setLoadingDiff] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishedSlug, setPublishedSlug] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const persist = useCallback((next: CreatorForecasterDraft) => {
    setDraft(next);
    writeLocalDraft(next);
  }, []);

  useEffect(() => {
    if (authLoading || !user) return;
    let cancelled = false;

    async function init() {
      try {
        const opts = await fetchWizardOptions();
        if (cancelled) return;
        setOptions(opts);

        const saved = readLocalDraft();
        if (saved?.id) {
          setDraft({ ...defaultDraft(), ...saved });
          setReady(true);
          return;
        }

        const created = await createDraft();
        if (cancelled) return;
        persist(created);
        setReady(true);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to initialize");
      }
    }

    init();
    return () => {
      cancelled = true;
    };
  }, [authLoading, user, persist]);

  async function savePatch(patch: Partial<CreatorForecasterDraft>) {
    if (!draft.id) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await updateDraft(draft.id, patch);
      persist({ ...draft, ...updated, ...patch });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  function go(next: number) {
    setStep(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleArchetypeSelect(key: ArchetypeKey) {
    const opt = options?.archetypes.find((a) => a.key === key);
    const patch: Partial<CreatorForecasterDraft> = {
      archetype: key,
      archetype_description: opt?.description ?? "",
      avatar_color: opt?.accent ?? draft.avatar_color,
    };
    setDraft((d) => ({ ...d, ...patch }));
    if (draft.id) await savePatch(patch);
  }

  async function handleArchetypeContinue() {
    go(2);
  }

  async function handlePersonalityContinue() {
    if (draft.id) {
      await savePatch({
        aggressiveness: draft.aggressiveness,
        humor: draft.humor,
        contrarian_level: draft.contrarian_level,
        data_vs_intuition: draft.data_vs_intuition,
        confidence: draft.confidence,
      });
    }
    go(3);
  }

  async function handleIdentityContinue() {
    if (draft.id) {
      await savePatch({
        display_name: draft.display_name,
        username: draft.username,
        avatar_color: draft.avatar_color,
        short_bio: draft.short_bio,
        domain_focus: draft.domain_focus,
      });
    }
    go(4);
  }

  async function loadPreview() {
    if (!draft.id) return;
    setPreviewLoading(true);
    setError(null);
    try {
      const { preview: p, differentiation: diff } = await regeneratePreview(draft.id);
      setPreview(p);
      if (diff) setDifferentiation(diff);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Preview failed");
    } finally {
      setPreviewLoading(false);
    }
  }

  async function handleBlindSpotContinue() {
    if (draft.id) await savePatch({ blind_spot: draft.blind_spot });
    go(5);
  }

  async function handleKnowledgeContinue() {
    go(6);
    await loadPreview();
  }

  async function handleRunQualityGate() {
    if (!draft.id) return;
    setLoadingDiff(true);
    setError(null);
    try {
      const result = await checkDifferentiation(draft.id);
      setDifferentiation(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Check failed");
    } finally {
      setLoadingDiff(false);
    }
  }

  async function handlePublish() {
    if (!draft.id) return;
    setPublishing(true);
    setError(null);
    try {
      const result = await publishForecaster(draft.id);
      setPublishedSlug(result.agent_slug);
      go(7);
    } catch (e) {
      if (e instanceof PublishBlockedError) {
        setDifferentiation(e.differentiation);
        setError(e.message);
      } else {
        setError(e instanceof Error ? e.message : "Publish failed");
      }
    } finally {
      setPublishing(false);
    }
  }

  if (authLoading || !ready) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <p className="text-[13px] text-zinc-500">Loading Agent Studio...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 relative">
      <StudioGlow step={step} />
      <StudioHeader step={step} onBack={step > 1 && !publishedSlug ? () => go(step - 1) : undefined} />

      <main className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-8">
        <StudioProgress step={step} />

        {error && (
          <p className="text-[13px] text-rose-400 bg-rose-950/20 border border-rose-500/30 rounded-lg px-4 py-2">
            {error}
          </p>
        )}

        {saving && (
          <p className="text-[11px] text-zinc-600">Saving...</p>
        )}

        {step === 1 && options && (
          <StepArchetype
            options={options.archetypes}
            selected={draft.archetype}
            onSelect={handleArchetypeSelect}
            onContinue={handleArchetypeContinue}
          />
        )}

        {step === 2 && (
          <StepPersonality
            draft={draft}
            onChange={(patch) => {
              const next = { ...draft, ...patch };
              persist(next);
            }}
            onContinue={handlePersonalityContinue}
          />
        )}

        {step === 3 && options && (
          <StepIdentity
            draft={draft}
            domainOptions={options.domain_focus}
            onChange={(patch) => persist({ ...draft, ...patch })}
            onContinue={handleIdentityContinue}
          />
        )}

        {step === 4 && options && (
          <StepBlindSpot
            draft={draft}
            suggestions={options.blind_spot_suggestions}
            onChange={(patch) => persist({ ...draft, ...patch })}
            onContinue={handleBlindSpotContinue}
          />
        )}

        {step === 5 && draft.id && (
          <StepKnowledge forecasterId={draft.id} onContinue={handleKnowledgeContinue} />
        )}

        {step === 6 && options && (
          <StepPreview
            draft={draft}
            archetypes={options.archetypes}
            preview={preview}
            differentiation={differentiation}
            loading={previewLoading}
            loadingDiff={loadingDiff}
            onRegenerate={loadPreview}
            onEditSetup={() => go(1)}
            onContinue={() => {
              go(7);
              if (!differentiation) handleRunQualityGate();
            }}
          />
        )}

        {step === 7 && (
          <StepPublish
            draft={draft}
            preview={preview}
            differentiation={differentiation}
            loadingDiff={loadingDiff}
            publishing={publishing}
            publishedSlug={publishedSlug}
            onRunQualityGate={handleRunQualityGate}
            onPublish={handlePublish}
          />
        )}
      </main>
    </div>
  );
}
