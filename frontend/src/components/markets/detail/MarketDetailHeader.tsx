"use client";

import Link from "next/link";
import { Avatar } from "@/components/feed/shared";
import {
  getMarketProbState,
  MARKET_PROB_STYLES,
} from "@/components/markets/marketProbability";
import type { MarketSide } from "@/components/markets/marketSide";
import { isMarketResolved } from "@/lib/resolution";
import type { AgentTake, EnrichedMarketDetail } from "./types";

function WeeklyMove({ delta }: { delta: number }) {
  const up = delta > 0;
  const flat = delta === 0;
  const arrow = flat ? "" : up ? "▲" : "▼";
  return (
    <span
      className={`text-[12px] font-semibold tabular-nums ${
        flat ? "text-zinc-500" : up ? "text-emerald-400/90" : "text-rose-400/90"
      }`}
    >
      {arrow && <span aria-hidden>{arrow} </span>}
      {Math.abs(delta)}pt this week
    </span>
  );
}

function sideLeader(takes: AgentTake[], side: "YES" | "NO"): AgentTake | undefined {
  return [...takes]
    .filter((t) => t.side === side)
    .sort(
      (a, b) => (b.reputation_score ?? b.confidence) - (a.reputation_score ?? a.confidence),
    )[0];
}

function LeaderChip({ take, side }: { take: AgentTake; side: "YES" | "NO" }) {
  const isYes = side === "YES";
  return (
    <Link
      href={`/agents/${take.slug}`}
      className={`flex items-center gap-1.5 rounded-full border px-2 py-1 transition hover:bg-zinc-900/70 min-w-0 ${
        isYes
          ? "border-emerald-500/25 bg-emerald-950/20"
          : "border-rose-500/25 bg-rose-950/20"
      }`}
    >
      <Avatar name={take.name} size="xs" />
      <span className="text-[11px] font-semibold text-zinc-100 truncate">{take.name}</span>
      <span
        className={`text-[10px] font-bold tabular-nums shrink-0 ${
          isYes ? "text-emerald-300" : "text-rose-300"
        }`}
      >
        {Math.round(take.confidence)}% {side}
      </span>
      {take.reputation_score != null && (
        <span className="text-[9px] text-zinc-500 tabular-nums shrink-0 hidden sm:inline">
          {Math.round(take.reputation_score)} rep
        </span>
      )}
    </Link>
  );
}

export function MarketDetailHeader({
  market,
  selectedSide = null,
  className = "",
}: {
  market: EnrichedMarketDetail;
  selectedSide?: MarketSide | null;
  className?: string;
}) {
  const resolved = isMarketResolved(market);
  const prob = resolved
    ? market.resolved_outcome === "YES"
      ? 100
      : 0
    : Math.round(market.current_yes_probability);
  const { tone, label } = getMarketProbState(prob);
  const colors = MARKET_PROB_STYLES[tone];
  const horizon = market.resolution_horizon;

  const yesLeader = sideLeader(market.agent_takes, "YES");
  const noLeader = sideLeader(market.agent_takes, "NO");
  const receiptsCount = market.verified_calls?.length ?? 0;
  const activityCount = market.recent_activity?.length ?? 0;

  return (
    <header className={`min-w-0 mb-1 ${className}`.trim()}>
      {/* Breadcrumb + status chips */}
      <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
        <Link href="/markets" className="text-[10px] text-zinc-600 hover:text-zinc-400 transition">
          ← Markets
        </Link>
        <span className="text-[10px] text-zinc-700">·</span>
        <span className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider">
          {market.category}
        </span>
        {resolved && market.resolved_outcome ? (
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
            ✓ Resolved {market.resolved_outcome}
          </span>
        ) : (
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded border border-emerald-500/20 bg-emerald-500/5 text-emerald-400/90">
            ● Live
          </span>
        )}
        {!resolved && horizon && horizon.bucket !== "resolved" && (
          <span
            className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${
              horizon.bucket === "tonight" || horizon.bucket === "soon"
                ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
                : "border-zinc-700/60 text-zinc-500"
            }`}
          >
            {horizon.label}
          </span>
        )}
      </div>

      <h1 className="text-lg sm:text-2xl font-bold tracking-tight text-white leading-tight">
        {market.title}
      </h1>

      {/* Probability block + activity stats */}
      <div className="mt-2 flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
            <span
              className={`text-3xl sm:text-4xl font-bold tabular-nums leading-none ${colors.text}`}
            >
              {prob}%
            </span>
            <span className={`text-sm font-semibold ${colors.label}`}>{label}</span>
            {!resolved && (
              <span className="text-sm font-semibold tabular-nums text-rose-400/80">
                {100 - prob}% NO
              </span>
            )}
          </div>
          {!resolved && (
            <div className="mt-1">
              <WeeklyMove delta={market.movement_delta} />
            </div>
          )}
        </div>

        <dl className="flex items-center gap-4 text-right shrink-0">
          <div>
            <dt className="text-[8px] uppercase tracking-[0.14em] text-zinc-600">On record</dt>
            <dd className="text-[15px] font-bold tabular-nums text-zinc-200">
              {market.agent_count}
            </dd>
          </div>
          <div>
            <dt className="text-[8px] uppercase tracking-[0.14em] text-zinc-600">Receipts</dt>
            <dd
              className={`text-[15px] font-bold tabular-nums ${
                receiptsCount > 0 ? "text-emerald-300" : "text-zinc-500"
              }`}
            >
              {receiptsCount}
            </dd>
          </div>
          <div className="hidden sm:block">
            <dt className="text-[8px] uppercase tracking-[0.14em] text-zinc-600">Moves 7d</dt>
            <dd className="text-[15px] font-bold tabular-nums text-zinc-200">{activityCount}</dd>
          </div>
        </dl>
      </div>

      {/* Leading agents on each side */}
      {(yesLeader || noLeader) && !resolved && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {yesLeader && <LeaderChip take={yesLeader} side="YES" />}
          {noLeader && <LeaderChip take={noLeader} side="NO" />}
          {selectedSide && (
            <span
              className={`text-[10px] font-medium ml-1 ${
                selectedSide === "YES" ? "text-emerald-400/90" : "text-rose-400/90"
              }`}
            >
              Viewing {selectedSide} position
            </span>
          )}
        </div>
      )}
    </header>
  );
}
