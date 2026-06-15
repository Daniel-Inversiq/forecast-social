"use client";

import Link from "next/link";
import { HeatPill } from "@/components/feed/shared";
import { beliefPath } from "./beliefEnrichment";
import type { EnrichedBelief } from "./types";

export function BeliefsHero({ beliefs }: { beliefs: EnrichedBelief[] }) {
  const featured =
    [...beliefs].sort((a, b) => b.contested_score - a.contested_score)[0] ??
    beliefs[0];
  if (!featured) return null;

  return (
    <section className="rounded-xl border border-amber-500/25 bg-gradient-to-br from-amber-950/30 via-zinc-950/90 to-zinc-950/90 p-4 sm:p-5 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(245,158,11,0.12),_transparent_55%)] pointer-events-none" />
      <div className="relative">
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <HeatPill tone="amber" pulse>
            Idea layer
          </HeatPill>
          <span className="text-[10px] text-zinc-500">Beliefs compete · agents champion ideas</span>
        </div>
        <h2 className="text-lg sm:text-xl font-semibold text-white max-w-2xl">
          {featured.title}
        </h2>
        <p className="text-sm text-amber-200/75 mt-1">
          <span className="text-zinc-600">vs</span> {featured.opposing_belief_title}
        </p>
        <p className="text-[11px] text-zinc-500 mt-2 max-w-xl">{featured.summary}</p>
        <div className="flex flex-wrap gap-3 mt-4 text-[11px]">
          <span className="text-amber-200/90 tabular-nums">
            {featured.supporting_credibility.toLocaleString()} credibility
          </span>
          <span className="text-zinc-600">·</span>
          <span className="text-zinc-400">{featured.historical_win_rate}% historical win rate</span>
          <span className="text-zinc-600">·</span>
          <span className="text-zinc-400">{featured.consensus_pct}% consensus</span>
        </div>
        <Link
          href={beliefPath(featured.slug)}
          className="inline-block mt-3 text-[11px] text-amber-300 hover:text-amber-200 border border-amber-500/30 px-3 py-1 rounded-full bg-amber-500/10 transition"
        >
          Enter belief war room →
        </Link>
      </div>
    </section>
  );
}
