"use client";

import Link from "next/link";
import {
  HeatPill,
  MiniSparkline,
  MomentumIndicator,
  MoveBadge,
  NarrativeStrengthBar,
} from "@/components/feed/shared";
import { TYPE_STYLES } from "./narrativeEnrichment";
import type { EnrichedNarrative } from "./types";

function StripCard({ narrative }: { narrative: EnrichedNarrative }) {
  const style = TYPE_STYLES[narrative.type] ?? TYPE_STYLES.momentum_up;
  const dir =
    narrative.direction === "up"
      ? "up"
      : narrative.direction === "down"
        ? "down"
        : "flat";

  return (
    <div
      className={`narrative-strip-card feed-hover-lift group shrink-0 w-[200px] sm:w-[228px] flex flex-col gap-1.5 p-2.5 rounded-xl border border-zinc-800/80 bg-zinc-950/90 hover:border-sky-500/30 relative overflow-hidden ${style.glow}`}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-sky-500/6 via-transparent to-violet-500/8 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity" />
      <div className="relative flex items-center justify-between gap-1">
        <span
          className={`text-[8px] font-semibold uppercase px-1 py-0.5 rounded-full border ${style.badge}`}
        >
          {narrative.category}
        </span>
        <MoveBadge delta={Math.round(narrative.change)} />
      </div>
      <p className="relative text-[11px] font-semibold text-white leading-snug line-clamp-2 min-h-[2.25rem] group-hover:text-sky-100 transition-colors">
        {narrative.title}
      </p>
      <div className="relative flex items-center justify-between gap-1">
        <div>
          <p className="text-lg font-bold tabular-nums text-sky-300/95">
            {narrative.velocity.toFixed(1)}
            <span className="text-[9px] font-normal text-zinc-600 ml-0.5">vel</span>
          </p>
          <MomentumIndicator direction={dir} label={narrative.momentum_label} />
        </div>
        <MiniSparkline seed={narrative.id + narrative.title} tone="sky" width={48} height={16} />
      </div>
      <NarrativeStrengthBar strength={narrative.strength} accelerating={narrative.is_live} />
      <div className="relative flex items-center justify-between text-[9px] text-zinc-600">
        <span>
          <span className="text-zinc-500 tabular-nums">{narrative.driver_agents.length}</span> agents
        </span>
        <span>
          <span className="text-zinc-500 tabular-nums">{narrative.cluster_markets.length}</span> markets
        </span>
        <span className="text-violet-300/80 tabular-nums">{narrative.alignment}%</span>
      </div>
    </div>
  );
}

export function LiveNarrativeStrip({
  narratives,
  loading,
}: {
  narratives: EnrichedNarrative[];
  loading: boolean;
}) {
  const strip = [...narratives].sort((a, b) => b.velocity - a.velocity).slice(0, 14);

  return (
    <div className="mb-3">
      <div className="flex items-center justify-between gap-2 mb-1.5 px-0.5">
        <div className="flex items-center gap-2">
          <HeatPill tone="sky" pulse>
            Live
          </HeatPill>
          <span className="text-[11px] font-medium text-zinc-400">Narrative strip</span>
          <span className="text-[10px] text-zinc-600 hidden sm:inline">
            Collective conviction in motion
          </span>
        </div>
        <Link href="/markets" className="text-[10px] text-sky-400/90 hover:text-sky-300 shrink-0">
          Repricing clusters →
        </Link>
      </div>
      <div className="relative -mx-0.5">
        <div className="flex gap-2 overflow-x-auto pb-0.5 px-0.5 feed-scroll-x scrollbar-none">
          {loading &&
            Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="shrink-0 w-[228px] h-[130px] rounded-xl border border-zinc-800/60 bg-zinc-900/40 animate-pulse"
              />
            ))}
          {!loading && strip.map((n) => <StripCard key={n.id} narrative={n} />)}
        </div>
        <div
          className="pointer-events-none absolute inset-y-0 right-0 w-20 bg-gradient-to-l from-zinc-950 via-zinc-950/85 to-transparent"
          aria-hidden
        />
      </div>
    </div>
  );
}
