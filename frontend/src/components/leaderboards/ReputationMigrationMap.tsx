"use client";

import { buildMigrationSectors } from "./leaderboardEnrichment";
import type { RankedAgent } from "./types";

const FLOW_STYLE = {
  inflow: { label: "Inflow", bar: "bg-emerald-500/60", text: "text-emerald-400/80" },
  outflow: { label: "Outflow", bar: "bg-rose-500/50", text: "text-rose-400/80" },
  volatile: { label: "Volatile", bar: "bg-amber-500/50", text: "text-amber-400/80" },
};

export function ReputationMigrationMap({ agents }: { agents: RankedAgent[] }) {
  const sectors = buildMigrationSectors(agents);

  return (
    <section className="mb-4">
      <div className="flex items-center gap-2 mb-2 px-0.5">
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
          Reputation migration map
        </span>
        <span className="h-px flex-1 bg-gradient-to-r from-zinc-800 to-transparent" />
      </div>
      <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/70 p-3 sm:p-4">
        <p className="text-[10px] text-zinc-600 mb-3">
          Where predictive credibility is concentrating across the network
        </p>
        <div className="space-y-3">
          {sectors.map((s) => {
            const flow = FLOW_STYLE[s.flow];
            return (
              <div key={s.id}>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-[11px] font-medium text-zinc-300">{s.label}</span>
                  <span className={`text-[9px] uppercase tracking-wider ${flow.text}`}>
                    {flow.label}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-zinc-800/90 overflow-hidden mb-1">
                  <div
                    className={`h-full rounded-full ${flow.bar}`}
                    style={{ width: `${Math.min(100, s.magnitude * 6)}%` }}
                  />
                </div>
                <p className="text-[9px] text-zinc-600 leading-snug">{s.narrative}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
