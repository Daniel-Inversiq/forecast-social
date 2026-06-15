"use client";

import Link from "next/link";
import { buildHiddenAlignments } from "./signalIntelligence";
import type { EnrichedNarrative } from "./types";

export function HiddenAlignmentSection({ narratives }: { narratives: EnrichedNarrative[] }) {
  const items = buildHiddenAlignments(narratives);

  return (
    <section className="mb-4 rounded-xl border border-violet-500/15 bg-zinc-950/60 overflow-hidden relative">
      <div className="absolute inset-0 bg-gradient-to-br from-violet-950/25 via-transparent to-zinc-950 pointer-events-none" />
      <div className="relative px-3 sm:px-4 py-3 border-b border-violet-500/10">
        <p className="text-[9px] uppercase tracking-[0.3em] text-violet-400/80 font-mono mb-1">
          Classified
        </p>
        <h2 className="text-sm font-semibold text-white">Hidden Alignment</h2>
        <p className="text-[10px] text-zinc-600 mt-0.5">
          Coordination the network hasn&apos;t priced in yet
        </p>
      </div>
      <ul className="relative divide-y divide-zinc-800/50">
        {items.map((item) => (
          <li key={item.id} className="px-3 sm:px-4 py-2.5 hover:bg-violet-950/15 transition">
            <p className="text-[11px] text-zinc-300 leading-relaxed">{item.copy}</p>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[9px]">
              <span className="text-violet-300/80 tabular-nums">
                {item.coordination_score}% coordination
              </span>
              <span className="text-amber-300/70 tabular-nums">{item.rep_weight} rep weight</span>
              <span className="text-zinc-600">{item.sectors.join(" · ")}</span>
            </div>
            <div className="mt-1.5 flex flex-wrap gap-1">
              {item.agents.map((slug) => (
                <Link
                  key={slug}
                  href={`/agents/${slug}`}
                  className="text-[9px] text-zinc-500 hover:text-violet-300/90 transition"
                >
                  @{slug}
                </Link>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
