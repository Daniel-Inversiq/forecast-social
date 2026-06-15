"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Avatar } from "@/components/feed/shared";
import { marketDetailHref } from "@/components/markets/marketSide";
import { isMarketResolved } from "@/lib/resolution";
import { formatPriceCents } from "./marketTradeMath";
import { buildOutcomeRows, type OutcomeRow } from "./marketOutcomes";
import type { EnrichedMarketDetail } from "./types";

function DeltaCell({ delta }: { delta: number }) {
  if (delta === 0) return <span className="text-[10px] text-zinc-600 tabular-nums">—</span>;
  const up = delta > 0;
  return (
    <span
      className={`text-[11px] font-bold tabular-nums ${
        up ? "text-emerald-400" : "text-rose-400"
      }`}
    >
      {up ? "▲" : "▼"}
      {Math.abs(delta)} <span className="text-[8px] font-semibold text-zinc-600">7d</span>
    </span>
  );
}

function OutcomeRowView({
  row,
  marketSlug,
  resolved,
}: {
  row: OutcomeRow;
  marketSlug: string;
  resolved: boolean;
}) {
  const isYes = row.side === "YES";
  const accent = isYes ? "text-emerald-300" : "text-rose-300";
  return (
    <li
      className={`grid grid-cols-[auto_1fr_auto] sm:grid-cols-[64px_auto_minmax(0,1fr)_auto_auto] items-center gap-x-3 gap-y-1 px-3 py-2.5 ${
        row.won === false ? "opacity-50" : ""
      }`}
    >
      <span className={`text-[13px] font-black tracking-wide ${accent}`}>
        {row.label}
        {row.won && <span className="ml-1 text-emerald-300" aria-label="winning outcome">✓</span>}
      </span>

      <span className="flex items-baseline gap-2">
        <span className={`text-[17px] font-bold tabular-nums ${accent}`}>
          {row.probability}%
        </span>
        <DeltaCell delta={resolved ? 0 : row.deltaWeek} />
      </span>

      <span className="hidden sm:flex items-center gap-1.5 min-w-0 text-[10px] text-zinc-500">
        <span className="tabular-nums text-zinc-400 shrink-0">
          {row.agentCount} agent{row.agentCount === 1 ? "" : "s"}
        </span>
        {row.topAgent && (
          <>
            <span className="text-zinc-700 shrink-0">·</span>
            <Link
              href={`/agents/${row.topAgent.slug}`}
              className="flex items-center gap-1 min-w-0 hover:text-zinc-300 transition"
            >
              <Avatar name={row.topAgent.name} size="xs" />
              <span className="truncate">{row.topAgent.name}</span>
              {row.topAgent.reputation_score != null && (
                <span className="tabular-nums text-zinc-600 shrink-0">
                  {Math.round(row.topAgent.reputation_score)} rep
                </span>
              )}
            </Link>
          </>
        )}
      </span>

      <span className="hidden sm:block text-[11px] text-zinc-500 tabular-nums text-right">
        {formatPriceCents(row.priceCents)}
      </span>

      {!resolved ? (
        <Link
          href={marketDetailHref(marketSlug, row.side === "YES" ? "yes" : "no")}
          className={`justify-self-end text-[11px] font-bold px-3 py-1.5 rounded-md border transition ${
            isYes
              ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/35 hover:bg-emerald-500/25"
              : "bg-rose-500/15 text-rose-300 border-rose-500/35 hover:bg-rose-500/25"
          }`}
        >
          Buy {row.label} {formatPriceCents(row.priceCents)}
        </Link>
      ) : (
        <span
          className={`justify-self-end text-[10px] font-bold uppercase tracking-wider ${
            row.won ? "text-emerald-300" : "text-zinc-600"
          }`}
        >
          {row.won ? "Won" : "Lost"}
        </span>
      )}
    </li>
  );
}

/** Polymarket-style outcome rows — SCRY-native: top credible agent per side. */
export function MarketOutcomesTable({ market }: { market: EnrichedMarketDetail }) {
  const rows = useMemo(() => buildOutcomeRows(market), [market]);
  const resolved = isMarketResolved(market);

  return (
    <section
      className="rounded-xl border border-zinc-800/70 bg-zinc-950/70 overflow-hidden"
      aria-label="Market outcomes"
    >
      <div className="hidden sm:grid grid-cols-[64px_auto_minmax(0,1fr)_auto_auto] gap-x-3 px-3 py-1.5 border-b border-zinc-800/60 bg-zinc-950/90">
        <span className="text-[8px] uppercase tracking-[0.16em] text-zinc-600">Outcome</span>
        <span className="text-[8px] uppercase tracking-[0.16em] text-zinc-600">Probability</span>
        <span className="text-[8px] uppercase tracking-[0.16em] text-zinc-600">
          Agents on record
        </span>
        <span className="text-[8px] uppercase tracking-[0.16em] text-zinc-600 text-right">
          Price
        </span>
        <span className="text-[8px] uppercase tracking-[0.16em] text-zinc-600 text-right">
          {resolved ? "Result" : "Trade"}
        </span>
      </div>
      <ul className="divide-y divide-zinc-800/50">
        {rows.map((row) => (
          <OutcomeRowView
            key={row.side}
            row={row}
            marketSlug={market.slug}
            resolved={resolved}
          />
        ))}
      </ul>
    </section>
  );
}
