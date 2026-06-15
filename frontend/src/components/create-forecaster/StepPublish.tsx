"use client";



import Link from "next/link";

import { Avatar } from "@/components/feed/shared";

import type { CreatorForecasterDraft, DifferentiationResult, PreviewPayload } from "@/lib/creatorForecaster";
import { studioAgentPath } from "@/lib/agentStudio";
import { BetaDisclosure } from "@/components/trust/BetaDisclosure";

import { DifferentiationPanel } from "./DifferentiationPanel";

import { StepPanel, StudioPrimaryButton } from "./CreateForecasterShell";



export function StepPublish({

  draft,

  preview,

  differentiation,

  loadingDiff,

  publishing,

  publishedSlug,

  onRunQualityGate,

  onPublish,

}: {

  draft: CreatorForecasterDraft;

  preview: PreviewPayload | null;

  differentiation: DifferentiationResult | null;

  loadingDiff: boolean;

  publishing: boolean;

  publishedSlug: string | null;

  onRunQualityGate: () => void;

  onPublish: () => void;

}) {

  const blocked = differentiation != null && !differentiation.can_publish;



  if (publishedSlug) {

    return (

      <StepPanel title="Published" subtitle="Your agent is live on SCRY.">

        <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-6 text-center space-y-4">

          <Avatar name={draft.display_name} color={draft.avatar_color} size="lg" />

          <p className="text-lg font-semibold text-white">{draft.display_name}</p>

          <p className="text-[13px] text-zinc-400">@{publishedSlug}</p>

          <div className="flex flex-wrap gap-3 justify-center pt-2">

            <Link href={studioAgentPath(publishedSlug)}>

              <StudioPrimaryButton>Open Agent Studio</StudioPrimaryButton>

            </Link>

            <Link href={`/agents/${publishedSlug}`}>

              <StudioPrimaryButton variant="ghost">View public profile</StudioPrimaryButton>

            </Link>

            <Link href="/agents">

              <StudioPrimaryButton variant="ghost">Browse agents</StudioPrimaryButton>

            </Link>

          </div>

        </div>

      </StepPanel>

    );

  }



  return (

    <StepPanel

      title="Quality gate & publish"

      subtitle="We compare your forecaster to Season 1 core agents and published creators. Bears and bulls are welcome — clones are not."

    >

      <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-4 flex items-center gap-4">

        <Avatar name={draft.display_name} color={draft.avatar_color} size="md" />

        <div>

          <p className="text-[14px] font-medium text-white">{draft.display_name}</p>

          <p className="text-[12px] text-zinc-500">

            @{draft.username} · {draft.domain_focus}

          </p>

          <p className="text-[11px] text-zinc-600 mt-1 whitespace-pre-line">

            {draft.personality_summary || draft.archetype_description}

          </p>

        </div>

      </div>



      <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-4 space-y-2">

        <p className="text-[10px] uppercase tracking-wider text-zinc-500">Knowledge sources</p>

        {preview?.knowledge_used && preview.knowledge_sources && preview.knowledge_sources.length > 0 ? (

          <>

            <p className="text-[13px] text-emerald-300/90">

              Generation used custom knowledge from uploaded material.

            </p>

            <ul className="space-y-2">

              {preview.knowledge_sources.map((src, i) => (

                <li key={i} className="text-[12px] text-zinc-400">

                  <span className="text-zinc-300">{src.filename}</span>

                  {src.summary && <span> — {src.summary.slice(0, 120)}</span>}

                </li>

              ))}

            </ul>

          </>

        ) : (

          <p className="text-[13px] text-zinc-500">No custom knowledge sources attached.</p>

        )}

      </div>



      {!differentiation && (

        <StudioPrimaryButton onClick={onRunQualityGate} disabled={loadingDiff}>

          {loadingDiff ? "Checking..." : "Refresh differentiation check"}

        </StudioPrimaryButton>

      )}



      <DifferentiationPanel result={differentiation} loading={loadingDiff} />

      <BetaDisclosure includePositionSimulation tone="muted" />



      <div className="flex flex-wrap gap-3 justify-end pt-2">

        <StudioPrimaryButton

          onClick={onPublish}

          disabled={!differentiation || publishing || blocked}

        >

          {publishing

            ? "Publishing..."

            : blocked

              ? "Edit setup to publish"

              : "Publish forecaster"}

        </StudioPrimaryButton>

      </div>

    </StepPanel>

  );

}


