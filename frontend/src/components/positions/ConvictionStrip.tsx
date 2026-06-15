"use client";

import Link from "next/link";
import {
  HeatPill,
  LiveDot,
  MiniProbBar,
  MiniSparkline,
  MoveBadge,
} from "@/components/feed/shared";
import type { EnrichedActivePosition } from "./types";

function SidePill({ side }: { side: "YES" | "NO" }) {
  return (
    <span
      className={`text-[8px] font-bold uppercase px-1 py-0.5 rounded border ${
        side === "YES"
          ? "text-emerald-300 border-emerald-500/30 bg-emerald-500/10"
          : "text-rose-300 border-rose-500/30 bg-rose-500/10"
      }`}
    >
      {side}
    </span>
  );
}

function StripCard({ position }: { position: EnrichedActivePosition }) {
  return (
    <Link
      href={`/markets/${position.slug}`}
      className="markets-pulse-card feed-hover-lift shrink-0 w-[156px] sm:w-[172px] flex flex-col gap-1 p-2 rounded-xl border border-zinc-800/80 bg-zinc-950/90 hover:border-violet-500/35"
    >
      <div className="flex items-center justify-between gap-1">
        <SidePill side={position.side} />
        <MoveBadge delta={position.movement_since_entry} />
      </div>
      <p className="text-[10px] font-semibold text-white leading-snug line-clamp-2 min-h-[2rem]">
        {position.market_title}
      </p>
      <MiniProbBar value={position.current_probability} size="xs" />
      <div className="flex items-center justify-between text-[8px] text-zinc-600">
        <span>€{position.amount}</span>
        <span>{position.network_agreement}% align</span>
      </div>
      <MiniSparkline seed={position.market_title} tone="violet" width={40} height={12} />
    </Link>
  );
}

export function ConvictionStrip({
  positions,
  loading,
}: {
  positions: EnrichedActivePosition[];
  loading?: boolean;
}) {
  if (!loading && positions.length === 0) return null;

  return (
    <section className="mb-3">
      <div className="flex items-center justify-between gap-2 mb-1.5 px-0.5">
        <div className="flex items-center gap-2">
          <LiveDot color="violet" />
          <HeatPill tone="emerald" pulse>
            Live exposure
          </HeatPill>
          <span className="text-[11px] font-medium text-zinc-400">Exposure strip</span>
        </div>
        <span className="text-[10px] text-zinc-600">Active conviction signals</span>
      </div>
      <div className="relative -mx-0.5">
        <div className="flex gap-2 overflow-x-auto pb-0.5 px-0.5 feed-scroll-x scrollbar-none">
          {loading &&
            Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="shrink-0 w-[172px] h-[96px] rounded-xl border border-zinc-800/60 bg-zinc-900/40 animate-pulse"
              />
            ))}
          {!loading && positions.map((p) => <StripCard key={p.id} position={p} />)}
        </div>
        <div
          className="pointer-events-none absolute inset-y-0 right-0 w-14 bg-gradient-to-l from-zinc-950 via-zinc-950/80 to-transparent"
          aria-hidden
        />
      </div>
    </section>
  );
}
