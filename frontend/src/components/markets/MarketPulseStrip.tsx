"use client";

import Link from "next/link";
import {
  HeatPill,
  LiveDot,
  MiniProbBar,
  MiniSparkline,
  MoveBadge,
  urgencyStyle,
} from "@/components/feed/shared";
import { NarrativeStateBadge } from "./NarrativeStateBadge";
import type { EnrichedMarket } from "./types";

function PulseMarketCard({ market }: { market: EnrichedMarket }) {
  const urgency = urgencyStyle[market.urgency] ?? urgencyStyle.cooling;

  return (
    <Link
      href={`/markets/${market.slug}`}
      className="markets-pulse-card feed-hover-lift group shrink-0 w-[160px] sm:w-[176px] flex flex-col gap-1 p-2 rounded-xl border border-zinc-800/80 bg-zinc-950/90 hover:border-violet-500/35 hover:shadow-lg hover:shadow-violet-950/15"
    >
      <div className="flex items-center justify-between gap-1">
        <span
          className={`inline-flex items-center gap-0.5 text-[8px] font-semibold uppercase px-1 py-0.5 rounded-full border capitalize ${urgency.ring} ${urgency.text}`}
        >
          <span className={`h-1 w-1 rounded-full ${urgency.dot} feed-live-pill`} />
          {market.urgency}
        </span>
        <MoveBadge delta={market.movement_delta} />
      </div>
      <p className="text-[11px] font-semibold text-white leading-snug line-clamp-2 min-h-[2.25rem] group-hover:text-violet-100 transition-colors">
        {market.title}
      </p>
      <MiniProbBar value={market.current_yes_probability} size="xs" hoverBoost />
      <div className="flex items-center gap-1 min-h-[14px]">
        <NarrativeStateBadge state={market.narrative_state} compact />
      </div>
      <p className="text-[8px] text-zinc-600 truncate">{market.agent_lead_line}</p>
      <div className="flex items-center justify-between gap-1">
        <span className="text-[9px] text-zinc-600 tabular-nums">{market.agent_count} agents</span>
        <MiniSparkline
          seed={market.title}
          tone={market.sentiment === "bullish" ? "emerald" : "violet"}
          width={40}
          height={12}
        />
      </div>
      {market.reputation_conflict !== "low" && (
        <span className="text-[8px] text-rose-400/80 truncate">Rep. activity · split</span>
      )}
    </Link>
  );
}

export function MarketPulseStrip({
  markets,
  loading,
}: {
  markets: EnrichedMarket[];
  loading?: boolean;
}) {
  const strip = [...markets]
    .sort((a, b) => {
      const order: Record<string, number> = { hot: 0, contested: 1, rising: 2, cooling: 3 };
      return (order[a.urgency] ?? 4) - (order[b.urgency] ?? 4);
    })
    .slice(0, 12);

  return (
    <section className="mb-3">
      <div className="flex items-center justify-between gap-2 mb-1.5 px-0.5">
        <div className="flex items-center gap-2">
          <LiveDot color="rose" />
          <HeatPill tone="rose" pulse>
            Live
          </HeatPill>
          <span className="text-[11px] font-medium text-zinc-400">Pressure strip</span>
        </div>
        <span className="text-[10px] text-zinc-600 hidden sm:inline">Network breathing</span>
      </div>
      <div className="relative -mx-0.5">
        <div className="flex gap-2 overflow-x-auto pb-0.5 px-0.5 feed-scroll-x scrollbar-none">
          {loading &&
            Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="shrink-0 w-[176px] h-[100px] rounded-xl border border-zinc-800/60 bg-zinc-900/40 animate-pulse"
              />
            ))}
          {!loading && strip.map((m) => <PulseMarketCard key={m.slug} market={m} />)}
        </div>
        <div
          className="pointer-events-none absolute inset-y-0 right-0 w-14 bg-gradient-to-l from-zinc-950 via-zinc-950/80 to-transparent"
          aria-hidden
        />
      </div>
    </section>
  );
}
