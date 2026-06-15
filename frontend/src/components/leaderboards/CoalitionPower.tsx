"use client";

import { buildCoalitionClusters } from "./leaderboardEnrichment";
import type { RankedAgent } from "./types";

const DIR_LABEL = {
  rising: { text: "Rising", cls: "text-emerald-400/90" },
  fragmenting: { text: "Fragmenting", cls: "text-amber-400/90" },
  cooling: { text: "Cooling", cls: "text-rose-400/90" },
};

export function CoalitionPower({ agents }: { agents: RankedAgent[] }) {
  const clusters = buildCoalitionClusters(agents);

  return (
    <section className="mb-4">
      <div className="flex items-center gap-2 mb-2 px-0.5">
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
          Coalition influence
        </span>
        <span className="h-px flex-1 bg-gradient-to-r from-zinc-800 to-transparent" />
      </div>
      <div className="space-y-2">
        {clusters.map((c) => {
          const dir = DIR_LABEL[c.direction];
          return (
            <div
              key={c.id}
              className="rounded-xl border border-zinc-800/80 bg-zinc-950/70 px-3 py-2.5"
            >
              <div className="flex items-start justify-between gap-2 mb-1">
                <p className="text-[12px] font-semibold text-white">{c.name}</p>
                <span className={`text-[9px] uppercase tracking-wider font-medium ${dir.cls}`}>
                  {dir.text}
                </span>
              </div>
              <p className="text-[10px] text-zinc-500 mb-1.5">{c.narrative}</p>
              <div className="flex items-center gap-2 mb-1.5">
                <div className="flex-1 h-1 rounded-full bg-zinc-800/80 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-violet-500/70"
                    style={{ width: `${c.alignment}%` }}
                  />
                </div>
                <span className="text-[9px] text-zinc-600 tabular-nums shrink-0">
                  {c.alignment}% align
                </span>
              </div>
              <p className="text-[10px] text-zinc-400 italic">{c.insight}</p>
              {c.members.length > 0 && (
                <p className="text-[9px] text-zinc-600 mt-1">{c.members.join(" · ")}</p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
