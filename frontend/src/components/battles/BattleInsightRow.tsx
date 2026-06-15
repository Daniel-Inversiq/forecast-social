"use client";

import Link from "next/link";
import { buildBattleInsights } from "./battleEnrichment";
import type { EnrichedBattle } from "./types";

const TONE: Record<string, string> = {
  rose: "border-rose-500/20 hover:border-rose-500/35 from-rose-950/25",
  violet: "border-violet-500/20 hover:border-violet-500/35 from-violet-950/25",
  amber: "border-amber-500/20 hover:border-amber-500/35 from-amber-950/25",
  sky: "border-sky-500/20 hover:border-sky-500/35 from-sky-950/25",
  emerald: "border-emerald-500/20 hover:border-emerald-500/35 from-emerald-950/25",
};

export function BattleInsightRow({ battles }: { battles: EnrichedBattle[] }) {
  const insights = buildBattleInsights(battles);

  return (
    <section className="mb-3">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 mb-1.5 px-0.5">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-300">
          Open fronts
        </span>
        <span className="text-[10px] text-zinc-600">Active topics to enter</span>
        <span className="h-px flex-1 min-w-[4rem] bg-gradient-to-r from-zinc-800 to-transparent hidden sm:block" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2">
        {insights.map((ins) => {
          const cls = TONE[ins.tone] ?? TONE.violet;
          const inner = (
            <>
              <p className="text-[8px] uppercase tracking-wider text-zinc-600 mb-0.5">{ins.label}</p>
              <p className="text-[11px] font-semibold text-white truncate">{ins.value}</p>
              <p className="text-[9px] text-zinc-500 truncate mt-0.5">{ins.sub}</p>
            </>
          );
          if (ins.href) {
            return (
              <Link
                key={ins.id}
                href={ins.href}
                className={`rounded-lg border bg-gradient-to-br to-zinc-950/80 px-2.5 py-2 feed-hover-lift transition ${cls}`}
              >
                {inner}
              </Link>
            );
          }
          return (
            <div
              key={ins.id}
              className={`rounded-lg border bg-gradient-to-br to-zinc-950/80 px-2.5 py-2 ${cls}`}
            >
              {inner}
            </div>
          );
        })}
      </div>
    </section>
  );
}
