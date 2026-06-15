"use client";

import Link from "next/link";
import { titleToSlug } from "@/lib/slugs";
import { HeatPill } from "@/components/feed/shared";
import type { NarrativeCluster } from "./types";
import { AgreementMeter } from "@/components/following/AgreementMeter";

const TONE_BORDER: Record<NarrativeCluster["tone"], string> = {
  violet: "border-violet-500/25 hover:border-violet-500/40",
  sky: "border-sky-500/25 hover:border-sky-500/40",
  rose: "border-rose-500/25 hover:border-rose-500/40",
  emerald: "border-emerald-500/25 hover:border-emerald-500/40",
  amber: "border-amber-500/25 hover:border-amber-500/40",
};

const TONE_GRADIENT: Record<NarrativeCluster["tone"], string> = {
  violet: "from-violet-950/40",
  sky: "from-sky-950/35",
  rose: "from-rose-950/35",
  emerald: "from-emerald-950/30",
  amber: "from-amber-950/35",
};

const DIR_LABEL: Record<NarrativeCluster["direction"], string> = {
  bullish: "Bullish momentum",
  bearish: "Bearish drift",
  split: "Sharp disagreement",
  neutral: "Watching",
};

export function NarrativeClusterCard({ cluster }: { cluster: NarrativeCluster }) {
  const agreement = 100 - Math.min(45, cluster.momentum * 3);

  return (
    <article
      className={`relative shrink-0 w-[220px] sm:w-[240px] rounded-xl border bg-zinc-950/90 overflow-hidden feed-hover-lift feed-card-glow ${TONE_BORDER[cluster.tone]}`}
    >
      <div
        className={`absolute inset-x-0 top-0 h-14 bg-gradient-to-b ${TONE_GRADIENT[cluster.tone]} to-transparent pointer-events-none`}
      />
      <div className="relative p-2.5">
        <div className="flex items-center gap-1.5 mb-2">
          <HeatPill tone={cluster.tone} pulse>
            Narrative
          </HeatPill>
          <span className="text-[9px] text-zinc-600">{DIR_LABEL[cluster.direction]}</span>
        </div>
        <h3 className="text-[11px] font-semibold text-white mb-1">{cluster.label}</h3>
        <p className="text-[9px] text-zinc-500 line-clamp-2 mb-2">{cluster.narrative}</p>
        <AgreementMeter agree={agreement} label="Conviction momentum" compact />
        <p className="text-[9px] text-zinc-600 mt-2">
          {cluster.markets.length} markets · {cluster.agents} agents
        </p>
        <div className="flex flex-wrap gap-1 mt-2">
          {cluster.markets.slice(0, 2).map((title) => (
            <Link
              key={title}
              href={`/markets/${titleToSlug(title)}`}
              className="text-[8px] px-1.5 py-0.5 rounded-md bg-zinc-900/80 border border-zinc-800 text-zinc-400 hover:text-violet-300 hover:border-violet-500/30 truncate max-w-full"
            >
              {title}
            </Link>
          ))}
        </div>
      </div>
    </article>
  );
}
