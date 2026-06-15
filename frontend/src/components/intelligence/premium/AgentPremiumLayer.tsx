"use client";

import Link from "next/link";
import { buildPremiumAgentIntel } from "@/lib/intelligencePremium";
import type { EnrichedAgentProfile } from "@/components/agents/profile/types";
import { IntelligenceDeskShell } from "../IntelligenceDeskShell";

export function AgentPremiumLayer({ profile }: { profile: EnrichedAgentProfile }) {
  const intel = buildPremiumAgentIntel(profile);

  return (
    <IntelligenceDeskShell
      title="Deep agent memory"
      subtitle="Thesis history · rivalry · timing · narrative ownership"
    >
      <p className="text-[11px] text-zinc-400 leading-relaxed border-l-2 border-amber-500/30 pl-2.5 mb-3">
        {intel.memorySummary}
      </p>

      <div className="grid lg:grid-cols-2 gap-3">
        <div>
          <p className="text-[9px] uppercase tracking-wider text-zinc-600 mb-1.5">Thesis history</p>
          <ul className="space-y-1.5">
            {intel.thesisHistory.map((t) => (
              <li
                key={t.thesis}
                className="text-[10px] text-zinc-400 border border-zinc-800/80 rounded-md px-2 py-1.5"
              >
                <span className="text-zinc-300">{t.thesis}</span>
                <span className="text-zinc-600"> · {t.status} · {t.timing}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-[9px] uppercase tracking-wider text-zinc-600 mb-1.5">Rivalry history</p>
          <ul className="space-y-1.5">
            {intel.rivalryHistory.map((r) => (
              <li key={r.slug} className="text-[10px]">
                <Link href={`/agents/${r.slug}`} className="text-zinc-300 hover:text-violet-300/90">
                  {r.rival}
                </Link>
                <span className="text-zinc-600"> — {r.record}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-3 grid sm:grid-cols-2 gap-2">
        <div className="rounded-lg border border-zinc-800/80 bg-zinc-900/40 p-2.5">
          <p className="text-[9px] text-zinc-600 uppercase tracking-wider">Timing pattern</p>
          <p className="text-[10px] text-zinc-400 mt-1 leading-relaxed">{intel.timingPattern}</p>
        </div>
        <div className="rounded-lg border border-zinc-800/80 bg-zinc-900/40 p-2.5">
          <p className="text-[9px] text-zinc-600 uppercase tracking-wider">Calibration vulnerability</p>
          <p className="text-[10px] text-zinc-400 mt-1 leading-relaxed">{intel.calibrationVulnerability}</p>
        </div>
      </div>

      <p className="text-[9px] uppercase tracking-wider text-zinc-600 mt-3 mb-1.5">Narrative ownership map</p>
      <div className="space-y-1.5">
        {intel.narrativeOwnership.map((n) => (
          <div key={n.narrative}>
            <div className="flex justify-between text-[10px] mb-0.5">
              <span className="text-zinc-400">{n.narrative}</span>
              <span className="text-amber-300/80 tabular-nums">{n.share}%</span>
            </div>
            <div className="h-1 rounded-full bg-zinc-800 overflow-hidden">
              <div
                className="h-full rounded-full bg-amber-500/50"
                style={{ width: `${n.share}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </IntelligenceDeskShell>
  );
}
