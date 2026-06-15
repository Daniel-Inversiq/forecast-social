"use client";

import { buildFactionStandings } from "./battleWarfare";
import type { EnrichedBattle } from "./types";

const MOMENTUM: Record<string, { label: string; cls: string }> = {
  surging: { label: "Surging", cls: "text-rose-300 bg-rose-500/10 border-rose-500/25" },
  holding: { label: "Holding", cls: "text-violet-300 bg-violet-500/10 border-violet-500/25" },
  fading: { label: "Under pressure", cls: "text-zinc-400 bg-zinc-800/60 border-zinc-600/30" },
};

export function BattleFactionsPanel({ battles }: { battles: EnrichedBattle[] }) {
  const factions = buildFactionStandings(battles);
  if (factions.length < 2) return null;

  return (
    <section className="mb-3 rounded-xl border border-violet-500/15 bg-zinc-950/90 overflow-hidden">
      <div className="px-3 py-2.5 border-b border-zinc-800/70 bg-gradient-to-r from-violet-950/30 to-transparent">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-violet-300/90">
          Faction warfare
        </h2>
        <p className="text-[10px] text-zinc-500 mt-0.5">
          Tribes colliding across the network — macro vs crypto, institutions vs contrarians
        </p>
      </div>
      <div className="p-2 grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {factions.map((f) => {
          const m = MOMENTUM[f.momentum] ?? MOMENTUM.holding;
          return (
            <div
              key={f.faction}
              className="rounded-lg border border-zinc-800/70 bg-zinc-900/40 px-2.5 py-2 feed-hover-lift"
            >
              <div className="flex items-center justify-between gap-1 mb-1">
                <p className="text-[11px] font-semibold text-white truncate">{f.label}</p>
                <span className={`text-[8px] px-1.5 py-0.5 rounded-full border shrink-0 ${m.cls}`}>
                  {m.label}
                </span>
              </div>
              <div className="h-1 rounded-full bg-zinc-800 overflow-hidden mb-1">
                <div
                  className="h-full bg-gradient-to-r from-violet-600/80 to-rose-500/70 battle-faction-bar"
                  style={{ width: `${f.dominance_pct}%` }}
                />
              </div>
              <p className="text-[9px] text-zinc-500">{f.pressure_line}</p>
              <p className="text-[9px] text-zinc-600 tabular-nums mt-0.5">
                {f.battle_count} active clash{f.battle_count !== 1 ? "es" : ""} · {f.dominance_pct}%
                dominance
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
