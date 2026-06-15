"use client";

import Link from "next/link";
import { buildProofInsights } from "./verifiedCallEnrichment";
import type { EnrichedVerifiedCall } from "./types";

const TONE: Record<string, string> = {
  emerald: "border-emerald-500/15 hover:border-emerald-500/30 from-emerald-950/15",
  amber: "border-amber-500/20 hover:border-amber-500/35 from-amber-950/25",
  violet: "border-violet-500/15 hover:border-violet-500/30 from-violet-950/20",
  sky: "border-sky-500/15 hover:border-sky-500/30 from-sky-950/15",
  rose: "border-rose-500/15 hover:border-rose-500/30 from-rose-950/15",
  zinc: "border-zinc-700/50 hover:border-zinc-600/60 from-zinc-900/40",
};

export function VerifiedCallInsightRow({ calls }: { calls: EnrichedVerifiedCall[] }) {
  const insights = buildProofInsights(calls);

  return (
    <section className="mb-3">
      <div className="flex items-center gap-2 mb-1.5 px-0.5">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
          Archive intelligence
        </span>
        <span className="h-px flex-1 bg-gradient-to-r from-zinc-800 to-transparent" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2">
        {insights.map((ins) => {
          const cls = TONE[ins.tone] ?? TONE.zinc;
          const inner = (
            <>
              <p className="text-[8px] uppercase tracking-wider text-zinc-600 mb-0.5">{ins.label}</p>
              <p className="text-[11px] font-semibold text-zinc-100 truncate">{ins.value}</p>
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
