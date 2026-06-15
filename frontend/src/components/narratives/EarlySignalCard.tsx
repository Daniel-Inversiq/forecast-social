"use client";

import Link from "next/link";
import { LiveDot, MiniSparkline } from "@/components/feed/shared";
import { titleToSlug } from "@/lib/slugs";
import type { EnrichedNarrative } from "./types";

const STAGE_STYLE: Record<string, string> = {
  FORMING: "text-zinc-400 border-zinc-600/40 bg-zinc-900/50",
  CLUSTERING: "text-amber-300/90 border-amber-500/30 bg-amber-950/30",
  CONTESTED: "text-violet-300/90 border-violet-500/30 bg-violet-950/25",
  BREAKOUT: "text-teal-300/90 border-teal-500/30 bg-teal-950/25",
  MAINSTREAM: "text-zinc-500 border-zinc-700/40 bg-zinc-900/40",
  COLLAPSING: "text-rose-300/80 border-rose-500/25 bg-rose-950/20",
};

export function EarlySignalCard({
  narrative,
  index,
}: {
  narrative: EnrichedNarrative;
  index: number;
}) {
  const stagger = `feed-stagger-${Math.min(index, 12)}`;
  const stageCls = STAGE_STYLE[narrative.signal_stage] ?? STAGE_STYLE.FORMING;

  return (
    <article
      className={`signals-early-card feed-card-enter ${stagger} rounded-xl border border-zinc-800/75 bg-zinc-950/75 overflow-hidden feed-hover-lift relative`}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-violet-600/4 via-transparent to-amber-600/6 pointer-events-none" />

      <div className="relative px-3 sm:px-4 pt-3 pb-2.5 border-b border-zinc-800/50">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            {narrative.is_live && <LiveDot color="amber" />}
            <span
              className={`text-[8px] font-mono uppercase tracking-widest px-1.5 py-0.5 rounded border ${stageCls}`}
            >
              {narrative.signal_stage}
            </span>
            <span className="text-[9px] text-zinc-600 uppercase tracking-wider">
              {narrative.lifecycle_phase.replace(/_/g, " ")}
            </span>
          </div>
          <MiniSparkline seed={narrative.id} tone="violet" width={48} height={14} />
        </div>

        <p className="text-[12px] sm:text-[13px] text-zinc-300 leading-relaxed font-medium">
          <span className="text-zinc-500">{narrative.cluster_size}</span> agents ·{" "}
          {narrative.early_signal_copy}
        </p>
        <p className="text-[10px] text-zinc-600 mt-1 line-clamp-1">{narrative.title}</p>
      </div>

      <div className="relative px-3 sm:px-4 py-3">
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {[
            { label: "Confidence", value: `${Math.round(narrative.confidence_density)}%` },
            { label: "Rep weight", value: `${Math.round(narrative.rep_weight)}` },
            { label: "Spread vel", value: narrative.spread_velocity.toFixed(1) },
            { label: "Accel", value: narrative.narrative_acceleration.toFixed(1) },
            { label: "Coord", value: `${narrative.coordination_score}%` },
            { label: "Cluster", value: String(narrative.cluster_size) },
          ].map((m) => (
            <div key={m.label} className="text-center sm:text-left">
              <p className="text-[7px] uppercase tracking-wider text-zinc-600">{m.label}</p>
              <p className="text-[11px] font-semibold text-white tabular-nums mt-0.5">{m.value}</p>
            </div>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap gap-1">
          {narrative.driver_agents.slice(0, 3).map((slug) => (
            <Link
              key={slug}
              href={`/agents/${slug}`}
              className="text-[9px] px-1.5 py-0.5 rounded text-zinc-500 hover:text-amber-200/90 border border-zinc-800/70 transition"
            >
              @{slug}
            </Link>
          ))}
          {narrative.cluster_markets.slice(0, 2).map((title) => (
            <Link
              key={title}
              href={`/markets/${titleToSlug(title)}`}
              className="text-[9px] px-1.5 py-0.5 rounded text-zinc-600 hover:text-teal-300/90 border border-zinc-800/60 truncate max-w-[140px] transition"
            >
              {title}
            </Link>
          ))}
        </div>
      </div>
    </article>
  );
}
