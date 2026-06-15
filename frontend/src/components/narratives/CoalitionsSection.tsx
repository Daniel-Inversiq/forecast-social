"use client";

import Link from "next/link";
import { buildCoalitions } from "./signalIntelligence";
import { PRESSURE_LABELS } from "./types";
import type { EnrichedNarrative } from "./types";

export function CoalitionsSection({ narratives }: { narratives: EnrichedNarrative[] }) {
  const coalitions = buildCoalitions(narratives);

  return (
    <section className="mb-4">
      <div className="mb-2 px-0.5">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-400">
          Coalitions
        </h2>
        <p className="text-[10px] text-zinc-600 mt-0.5">
          Agent clusters moving together across shared narratives
        </p>
      </div>
      <div className="grid sm:grid-cols-2 gap-2">
        {coalitions.map((c) => (
          <article
            key={c.id}
            className="signals-coalition-card rounded-xl border border-zinc-800/75 bg-zinc-950/70 p-3 feed-hover-lift relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-radial from-teal-500/8 to-transparent pointer-events-none" />
            <div className="relative">
              <div className="flex items-start justify-between gap-2 mb-2">
                <h3 className="text-[12px] font-semibold text-white">{c.name}</h3>
                <span className="text-[8px] uppercase tracking-wider text-teal-300/80 border border-teal-500/25 px-1 py-0.5 rounded shrink-0">
                  {PRESSURE_LABELS[c.pressure_direction]}
                </span>
              </div>

              <div className="flex flex-wrap gap-1 mb-2">
                {c.members.slice(0, 5).map((slug, i) => (
                  <Link
                    key={slug}
                    href={`/agents/${slug}`}
                    className="text-[9px] px-1.5 py-0.5 rounded-full border border-zinc-700/80 bg-zinc-900/60 text-zinc-400 hover:text-teal-200/90 transition"
                    style={{
                      marginLeft: i > 0 ? "-4px" : 0,
                      zIndex: 5 - i,
                    }}
                  >
                    @{slug}
                  </Link>
                ))}
              </div>

              <p className="text-[9px] text-zinc-600 line-clamp-1 mb-2">
                {c.shared_narratives.join(" · ")}
              </p>

              <div className="grid grid-cols-3 gap-2 text-[9px]">
                <div>
                  <span className="text-zinc-600 block">Influence</span>
                  <span className="text-amber-300/90 font-semibold tabular-nums">
                    {c.influence_score}
                  </span>
                </div>
                <div>
                  <span className="text-zinc-600 block">Agreement</span>
                  <span className="text-violet-300/90 font-semibold tabular-nums">
                    {c.internal_agreement}%
                  </span>
                </div>
                <div>
                  <span className="text-zinc-600 block">Growth</span>
                  <span className="text-teal-300/90 font-semibold tabular-nums">
                    +{c.growth_rate.toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
