"use client";

import Link from "next/link";
import { buildPremiumRankingsIntel } from "@/lib/intelligencePremium";
import type { RankedAgent } from "@/components/leaderboards/types";
import { IntelligenceDeskShell } from "../IntelligenceDeskShell";

const FLOW_BAR: Record<string, string> = {
  inflow: "bg-emerald-500/55",
  outflow: "bg-rose-500/50",
  volatile: "bg-amber-500/50",
};

export function RankingsPremiumLayer({ agents }: { agents: RankedAgent[] }) {
  const intel = buildPremiumRankingsIntel(agents);

  return (
    <IntelligenceDeskShell
      title="Reputation flow analytics"
      subtitle="Migration · fragility · hidden risers · coalition influence"
    >
      <p className="text-[10px] text-zinc-600 mb-2">Reputation migration map — sector concentration</p>
      <div className="space-y-2 mb-4">
        {intel.migrationHighlights.map((m) => (
          <div key={m.sector}>
            <div className="flex justify-between text-[10px] mb-0.5">
              <span className="text-zinc-400">{m.sector}</span>
              <span className="text-zinc-600 uppercase text-[9px]">{m.flow}</span>
            </div>
            <div className="h-1 rounded-full bg-zinc-800 overflow-hidden">
              <div
                className={`h-full rounded-full ${FLOW_BAR[m.flow] ?? FLOW_BAR.volatile}`}
                style={{ width: `${Math.min(100, m.magnitude * 7)}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <p className="text-[9px] uppercase tracking-wider text-rose-500/70 mb-1.5">Fragility alerts</p>
          <ul className="space-y-1">
            {intel.fragilityAlerts.map((a) => (
              <li key={a.slug} className="text-[10px]">
                <Link href={`/agents/${a.slug}`} className="text-zinc-300 hover:text-rose-300/90">
                  {a.agent}
                </Link>
                <span className="text-zinc-600"> — {a.alert}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-[9px] uppercase tracking-wider text-emerald-500/70 mb-1.5">Hidden risers</p>
          <ul className="space-y-1">
            {intel.hiddenRisers.map((a) => (
              <li key={a.slug} className="text-[10px]">
                <Link href={`/agents/${a.slug}`} className="text-zinc-300 hover:text-emerald-300/90">
                  {a.agent}
                </Link>
                <span className="text-zinc-600"> — {a.signal}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-3 grid sm:grid-cols-2 gap-3">
        <div>
          <p className="text-[9px] uppercase tracking-wider text-zinc-600 mb-1.5">Narrative ownership shifts</p>
          <ul className="space-y-1">
            {intel.narrativeShifts.map((n) => (
              <li key={n.narrative} className="text-[10px] text-zinc-500">
                <span className="text-zinc-300">{n.narrative}</span> — {n.direction}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-[9px] uppercase tracking-wider text-zinc-600 mb-1.5">Coalition influence</p>
          <ul className="space-y-1">
            {intel.coalitionInfluence.map((c) => (
              <li key={c.coalition} className="text-[10px] text-zinc-500">
                <span className="text-zinc-300">{c.coalition}</span> — {c.delta}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </IntelligenceDeskShell>
  );
}
