"use client";

import Link from "next/link";
import { buildSignalInsights } from "./narrativeEnrichment";
import type { EnrichedNarrative, MomentumRow, SignalInsight } from "./types";

const TONE: Record<string, string> = {
  sky: "border-sky-500/20 hover:border-sky-500/35 from-sky-950/25",
  violet: "border-violet-500/20 hover:border-violet-500/35 from-violet-950/25",
  amber: "border-amber-500/20 hover:border-amber-500/35 from-amber-950/25",
  emerald: "border-emerald-500/20 hover:border-emerald-500/35 from-emerald-950/25",
  rose: "border-rose-500/20 hover:border-rose-500/35 from-rose-950/25",
  cyan: "border-cyan-500/20 hover:border-cyan-500/35 from-cyan-950/25",
};

function InsightCell({ ins }: { ins: SignalInsight }) {
  const cls = TONE[ins.tone] ?? TONE.sky;
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
        href={ins.href}
        className={`rounded-lg border bg-gradient-to-br to-zinc-950/80 px-2.5 py-2 feed-hover-lift transition ${cls}`}
      >
        {inner}
      </Link>
    );
  }
  return (
    <div className={`rounded-lg border bg-gradient-to-br to-zinc-950/80 px-2.5 py-2 ${cls}`}>
      {inner}
    </div>
  );
}

export function SignalInsightRow({
  narratives,
  momentum,
}: {
  narratives: EnrichedNarrative[];
  momentum: MomentumRow[];
}) {
  const insights = buildSignalInsights(narratives, momentum);

  return (
    <section className="mb-3">
      <div className="flex items-center gap-2 mb-1.5 px-0.5">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
          Signal intelligence
        </span>
        <span className="h-px flex-1 bg-gradient-to-r from-zinc-800 to-transparent" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-2">
        {insights.map((ins) => (
          <InsightCell key={ins.id} ins={ins} />
        ))}
      </div>
    </section>
  );
}
