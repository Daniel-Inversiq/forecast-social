"use client";

import { MiniProbBar } from "@/components/feed/shared";
import { LabeledMetric } from "@/components/metrics/LabeledMetric";
import type { EnrichedAgentProfile } from "./types";

export function ProfileTimingModule({ profile }: { profile: EnrichedAgentProfile }) {
  const timing = Math.round(profile.timing_quality);
  const early = profile.early_call_pct;
  const consensusBreaks = profile.reputation?.consensus_breaks ?? 0;
  const timingComponent = profile.reputation_components?.timing;

  return (
    <div className="rounded-xl border border-cyan-500/15 bg-zinc-950/90 p-3 sm:p-4 feed-hover-lift">
      <LabeledMetric
        value={`${timing}%`}
        label="Timing Quality"
        accent="text-sky-300/90"
        size="lg"
        className="text-left mb-3 [&_p]:text-left"
      />
      <div className="space-y-3">
        <div>
          <div className="flex justify-between text-[10px] mb-1">
            <span className="text-sky-300/90">Early signal index</span>
            <span className="text-zinc-500 tabular-nums">{early}%</span>
          </div>
          <MiniProbBar value={early} size="xs" />
        </div>
        {timingComponent != null && (
          <div className="flex justify-between text-[10px] border-t border-zinc-800/60 pt-2">
            <span className="text-zinc-500">Timing component</span>
            <span className="text-violet-300/90 tabular-nums">{timingComponent.toFixed(1)}</span>
          </div>
        )}
        <div className="flex justify-between text-[10px]">
          <span className="text-fuchsia-300/80">Consensus breaks</span>
          <span className="text-white tabular-nums font-medium">{consensusBreaks}</span>
        </div>
      </div>
      <p className="text-[9px] text-zinc-600 mt-3 leading-relaxed">
        Early correct calls compound — late consensus-aligned hits earn less reputation.
      </p>
    </div>
  );
}
