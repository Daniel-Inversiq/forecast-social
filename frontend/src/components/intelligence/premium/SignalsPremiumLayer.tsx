"use client";

import Link from "next/link";
import { agentSlugFromName } from "@/lib/slugs";
import { buildPremiumSignals } from "@/lib/intelligencePremium";
import type { EnrichedNarrative } from "@/components/narratives/types";
import { IntelligenceDeskShell } from "../IntelligenceDeskShell";

export function SignalsPremiumLayer({ narratives }: { narratives: EnrichedNarrative[] }) {
  const rows = buildPremiumSignals(narratives);
  if (rows.length === 0) return null;

  return (
    <IntelligenceDeskShell
      title="High-resolution signal layer"
      subtitle="Before-consensus formation · hidden alignment · coalition confidence"
    >
      <div className="space-y-2.5">
        {rows.map((row) => (
          <article
            key={row.id}
            className="rounded-lg border border-zinc-800/90 bg-zinc-900/40 px-3 py-2.5"
          >
            <div className="flex flex-wrap items-start justify-between gap-2 mb-1.5">
              <p className="text-[11px] font-medium text-zinc-200 leading-snug">{row.title}</p>
              <span className="text-[9px] text-amber-300/80 border border-amber-500/20 rounded-full px-2 py-0.5">
                {row.stage}
              </span>
            </div>
            <p className="text-[10px] text-zinc-500 leading-relaxed">{row.hiddenAlignment}</p>
            <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-[9px] tabular-nums">
              <Metric label="Coalition" value={`${row.coalitionConfidence}%`} />
              <Metric label="Pre-consensus" value={`${row.beforeConsensusProb}%`} />
              <Metric label="Fragility" value={`${row.signalFragility}%`} />
              <Metric label="Analog" value="linked" />
            </div>
            <p className="text-[9px] text-zinc-600 mt-1.5 line-clamp-2">{row.historicalAnalog}</p>
            <div className="mt-1.5 flex flex-wrap gap-1">
              {row.agents.map((name) => {
                const slug = agentSlugFromName(name);
                return (
                  <Link
                    key={name}
                    href={`/agents/${slug}`}
                    className="text-[9px] text-zinc-500 hover:text-amber-300/90"
                  >
                    @{slug}
                  </Link>
                );
              })}
            </div>
          </article>
        ))}
      </div>
    </IntelligenceDeskShell>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-zinc-800/80 bg-zinc-950/60 px-2 py-1">
      <p className="text-zinc-600 uppercase tracking-wider text-[8px]">{label}</p>
      <p className="text-zinc-300 font-medium mt-0.5">{value}</p>
    </div>
  );
}
