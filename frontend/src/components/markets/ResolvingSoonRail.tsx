"use client";

import Link from "next/link";
import { useMemo } from "react";
import { marketDetailHref } from "@/components/markets/marketSide";
import {
  getMarketProbState,
  MARKET_PROB_STYLES,
} from "@/components/markets/marketProbability";
import type { EnrichedMarket } from "./types";

const SOON_BUCKETS = new Set(["tonight", "soon"]);

/** Open markets about to resolve, nearest verdict first. */
export function pickResolvingSoon(
  markets: EnrichedMarket[],
  limit = 6,
): EnrichedMarket[] {
  return markets
    .filter(
      (m) =>
        m.status === "open" &&
        m.resolution_horizon != null &&
        SOON_BUCKETS.has(m.resolution_horizon.bucket),
    )
    .sort(
      (a, b) =>
        (a.resolution_horizon?.hours_remaining ?? Infinity) -
        (b.resolution_horizon?.hours_remaining ?? Infinity),
    )
    .slice(0, limit);
}

/**
 * Verdicts ahead — the markets where the network is about to be proven right
 * or wrong. The anticipation rail: a reason to come back tonight.
 */
export function ResolvingSoonRail({ markets }: { markets: EnrichedMarket[] }) {
  const soon = useMemo(() => pickResolvingSoon(markets), [markets]);
  if (soon.length === 0) return null;

  return (
    <section className="mb-3" aria-label="Verdicts ahead">
      <div className="flex items-baseline justify-between gap-2 mb-1.5 px-0.5">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.14em] text-amber-300/90">
          ⚡ Verdicts ahead
        </h2>
        <span className="text-[10px] text-zinc-600">
          {soon.length} market{soon.length === 1 ? "" : "s"} about to resolve — someone&apos;s
          getting a receipt
        </span>
      </div>
      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {soon.map((m) => {
          const prob = Math.round(m.current_yes_probability);
          const { tone } = getMarketProbState(prob);
          const colors = MARKET_PROB_STYLES[tone];
          const lead = m.leading_agents[0];
          return (
            <Link
              key={m.slug}
              href={marketDetailHref(m.slug)}
              className="shrink-0 w-[210px] rounded-lg border border-amber-500/20 bg-gradient-to-b from-amber-950/15 to-zinc-950/80 p-2.5 hover:border-amber-400/40 transition feed-hover-lift"
            >
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-[9px] font-bold text-amber-300/95 uppercase tracking-wider">
                  {m.resolution_horizon?.short_label}
                </span>
                <span className={`text-[13px] font-bold tabular-nums ${colors.text}`}>
                  {prob}%
                </span>
              </div>
              <p className="text-[11px] font-medium text-zinc-200 leading-snug line-clamp-2">
                {m.title}
              </p>
              <p className="text-[9px] text-zinc-500 mt-1 truncate">
                {lead
                  ? `${lead.name} leads ${lead.side?.toUpperCase() === "NO" ? "NO" : "YES"} · on the line`
                  : `${m.agent_count} agents on the line`}
              </p>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
