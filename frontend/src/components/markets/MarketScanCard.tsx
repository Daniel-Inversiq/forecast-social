"use client";

import Link from "next/link";
import { motionClass } from "@/components/feed/motion";
import { marketDetailHref } from "@/components/markets/marketSide";
import {
  getMarketProbState,
  MARKET_PROB_STYLES,
} from "@/components/markets/marketProbability";
import type { EnrichedMarket } from "./types";

function SideActionButton({
  slug,
  side,
  label,
}: {
  slug: string;
  side: "yes" | "no";
  label: "YES" | "NO";
}) {
  const isYes = side === "yes";
  return (
    <Link
      href={marketDetailHref(slug, side)}
      onClick={(e) => e.stopPropagation()}
      className={`flex-1 py-2 rounded-md text-[12px] font-bold text-center transition ${
        isYes
          ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/35 hover:bg-emerald-500/25 hover:border-emerald-500/50"
          : "bg-rose-500/15 text-rose-300 border border-rose-500/35 hover:bg-rose-500/25 hover:border-rose-500/50"
      }`}
    >
      {label}
    </Link>
  );
}

export function MarketScanCard({
  market,
  index = 0,
}: {
  market: EnrichedMarket;
  index?: number;
}) {
  const leader = market.leading_agents[0];
  const prob = Math.round(market.current_yes_probability);
  const { tone, label } = getMarketProbState(prob);
  const colors = MARKET_PROB_STYLES[tone];
  const horizon = market.resolution_horizon;
  const resolvesSoon =
    horizon != null && (horizon.bucket === "tonight" || horizon.bucket === "soon");
  const delta = Math.round(market.movement_delta);
  const contested = market.reputation_conflict === "high";

  return (
    <article
      className={`market-scan-card group rounded-md border border-zinc-800/70 bg-zinc-950/80 p-2 hover:border-zinc-700/90 hover:bg-zinc-900/45 transition-colors ${motionClass.cardEnterStagger(index)}`}
    >
      <Link href={marketDetailHref(market.slug)} className="block min-w-0">
        <h3 className="text-[12px] font-medium text-zinc-100 leading-snug line-clamp-2 group-hover:text-white">
          {market.title}
        </h3>
      </Link>

      <div className="mt-1 flex items-baseline gap-1.5 min-w-0">
        <span className={`text-[17px] font-semibold tabular-nums leading-none ${colors.text}`}>
          {prob}%
        </span>
        {delta !== 0 && (
          <span
            className={`text-[10px] font-bold tabular-nums ${
              delta > 0 ? "text-emerald-400" : "text-rose-400"
            }`}
          >
            {delta > 0 ? "▲" : "▼"}
            {Math.abs(delta)}
          </span>
        )}
        <span className={`text-[11px] font-semibold tracking-wide ${colors.label}`}>{label}</span>
        {horizon && horizon.bucket !== "resolved" && (
          <span
            className={`ml-auto shrink-0 text-[9px] font-semibold tabular-nums ${
              resolvesSoon ? "text-amber-300" : "text-zinc-600"
            }`}
          >
            {horizon.emoji} {horizon.short_label}
          </span>
        )}
      </div>

      <div className="mt-1.5 flex gap-1.5">
        <SideActionButton slug={market.slug} side="yes" label="YES" />
        <SideActionButton slug={market.slug} side="no" label="NO" />
      </div>

      <div className="mt-1.5 flex items-baseline justify-between gap-2 text-[10px] min-w-0">
        {leader ? (
          <span className="truncate min-w-0 text-zinc-500">
            <span className="text-zinc-600">Lead </span>
            <Link
              href={`/agents/${leader.slug}`}
              onClick={(e) => e.stopPropagation()}
              className="text-zinc-400 hover:text-zinc-300"
            >
              {leader.name}
            </Link>
          </span>
        ) : (
          <span className="text-zinc-600">—</span>
        )}
        <span className="text-zinc-500 tabular-nums shrink-0">
          {contested ? (
            <span className="text-rose-300/85 font-medium">
              ⚔ {Math.round(market.disagreement_pct)}% split
            </span>
          ) : (
            `${market.agent_count} agents`
          )}
        </span>
      </div>
    </article>
  );
}
