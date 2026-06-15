"use client";

import { useMemo } from "react";
import type {
  ArchetypeOption,
  CreatorForecasterDraft,
  DifferentiationResult,
  PreviewPayload,
} from "@/lib/creatorForecaster";
import {
  buildForecastingIdentity,
  buildLaunchTrajectory,
  buildMonetizationSummary,
  buildNetworkPositioning,
} from "@/lib/previewLaunchIntel";
import { DifferentiationPanel } from "./DifferentiationPanel";
import {
  ForecastingIdentityPanel,
  IfLaunchedTodayPanel,
  MonetizationPotentialPanel,
  NetworkPositioningPanel,
} from "./PreviewLaunchSections";
import { StepPanel, StudioPrimaryButton } from "./CreateForecasterShell";

function SampleBlock({ label, lines }: { label: string; lines: string[] }) {
  return (
    <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 overflow-hidden">
      <div className="px-4 py-2 border-b border-zinc-800/60 bg-zinc-900/40">
        <span className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</span>
      </div>
      <ul className="divide-y divide-zinc-800/50">
        {lines.map((line, i) => (
          <li key={i} className="px-4 py-3 text-[13px] text-zinc-300 leading-relaxed">
            {line}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function StepPreview({
  draft,
  archetypes,
  preview,
  differentiation,
  loading,
  loadingDiff,
  onRegenerate,
  onEditSetup,
  onContinue,
}: {
  draft: CreatorForecasterDraft;
  archetypes: ArchetypeOption[];
  preview: PreviewPayload | null;
  differentiation: DifferentiationResult | null;
  loading: boolean;
  loadingDiff?: boolean;
  onRegenerate: () => void;
  onEditSetup: () => void;
  onContinue: () => void;
}) {
  const knowledgeUsed = preview?.knowledge_used ?? false;
  const knowledgeSources = preview?.knowledge_sources ?? [];

  const identity = useMemo(
    () => buildForecastingIdentity(draft, archetypes, differentiation),
    [draft, archetypes, differentiation]
  );
  const positioning = useMemo(
    () => buildNetworkPositioning(draft, differentiation),
    [draft, differentiation]
  );
  const monetization = useMemo(() => buildMonetizationSummary(draft), [draft]);
  const launch = useMemo(
    () => buildLaunchTrajectory(draft, differentiation),
    [draft, differentiation]
  );

  const showLaunchIntel = !loading && (preview != null || differentiation != null);

  return (
    <StepPanel
      title="Launch preview"
      subtitle="Why publish this forecaster? See identity, network position, and how you'll enter SCRY — then validate the voice."
    >
      {loading && (
        <p className="text-[13px] text-zinc-500 animate-pulse">Generating samples...</p>
      )}

      {(differentiation || loadingDiff) && (
        <DifferentiationPanel result={differentiation} loading={loadingDiff} hero />
      )}

      {showLaunchIntel && (
        <div className="space-y-4">
          <ForecastingIdentityPanel identity={identity} />
          <NetworkPositioningPanel positioning={positioning} />
          <MonetizationPotentialPanel monetization={monetization} />
          <IfLaunchedTodayPanel launch={launch} />
        </div>
      )}

      {preview && !loading && (
        <div className="space-y-4">
          <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-4 space-y-2">
            <p className="text-[10px] uppercase tracking-wider text-zinc-500">Knowledge context</p>
            {knowledgeUsed ? (
              <>
                <p className="text-[13px] text-emerald-300/90">
                  Custom knowledge influenced these samples.
                </p>
                {knowledgeSources.map((src, i) => (
                  <div key={i} className="text-[12px] text-zinc-400 space-y-1">
                    <p className="text-zinc-300">{src.filename}</p>
                    {src.summary && <p>{src.summary}</p>}
                    {src.key_claims.length > 0 && (
                      <ul className="list-disc list-inside text-zinc-500">
                        {src.key_claims.slice(0, 3).map((c, j) => (
                          <li key={j}>{c}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </>
            ) : (
              <p className="text-[13px] text-zinc-500">
                No uploaded knowledge — samples use archetype and personality only.
              </p>
            )}
          </div>

          <SampleBlock label="Sample forecasts" lines={preview.forecasts} />
          <SampleBlock label="Rivalry reactions" lines={preview.rivalry_reactions} />
          <SampleBlock
            label="Win / loss reactions"
            lines={[preview.winning_reaction, preview.losing_reaction]}
          />
        </div>
      )}

      <div className="flex flex-wrap gap-3 justify-between pt-2 border-t border-zinc-800/50">
        <div className="flex gap-2">
          <StudioPrimaryButton variant="ghost" onClick={onEditSetup}>
            Edit setup
          </StudioPrimaryButton>
          <StudioPrimaryButton variant="ghost" onClick={onRegenerate} disabled={loading}>
            Regenerate
          </StudioPrimaryButton>
        </div>
        <StudioPrimaryButton onClick={onContinue} disabled={!preview || loading}>
          Enter the Network
        </StudioPrimaryButton>
      </div>
    </StepPanel>
  );
}
