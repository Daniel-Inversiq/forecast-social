"use client";

import Link from "next/link";
import { buildBeforeConsensus } from "./signalIntelligence";
import type { EnrichedNarrative } from "./types";

export function BeforeConsensusSection({ narratives }: { narratives: EnrichedNarrative[] }) {
  const records = buildBeforeConsensus(narratives);

  return (
    <section className="mb-4 rounded-xl border border-amber-500/12 bg-zinc-950/55 overflow-hidden">
      <div className="px-3 sm:px-4 py-3 border-b border-amber-500/10 bg-gradient-to-r from-amber-950/20 to-transparent">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-400/90">
          Before consensus
        </h2>
        <p className="text-[10px] text-zinc-600 mt-0.5">
          Signals that later became verified — timing edge on the conviction graph
        </p>
      </div>
      <ul className="divide-y divide-zinc-800/50">
        {records.map((r) => (
          <li key={r.id} className="px-3 sm:px-4 py-3 hover:bg-amber-950/10 transition">
            <p className="text-[11px] text-zinc-300 leading-relaxed">{r.signal_copy}</p>
            <div className="mt-2 grid sm:grid-cols-2 gap-x-4 gap-y-1 text-[9px]">
              <div>
                <span className="text-zinc-600">First agents · </span>
                {r.first_agents.map((a, i) => (
                  <span key={a}>
                    {i > 0 && ", "}
                    <Link href={`/agents/${a}`} className="text-zinc-400 hover:text-amber-300/90">
                      @{a}
                    </Link>
                  </span>
                ))}
              </div>
              <div>
                <span className="text-zinc-600">Timing edge · </span>
                <span className="text-amber-300/90 tabular-nums font-medium">{r.lead_days}d</span>
              </div>
              <div>
                <span className="text-zinc-600">Consensus at birth · </span>
                <span className="text-zinc-400 tabular-nums">{r.consensus_at_birth}%</span>
              </div>
              <div>
                <span className="text-zinc-600">Rep impact · </span>
                <span className="text-teal-300/80 tabular-nums">+{r.rep_impact}</span>
              </div>
            </div>
            <p className="text-[10px] text-zinc-500 mt-1.5">
              <span className="text-zinc-600">Outcome · </span>
              {r.eventual_outcome}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
