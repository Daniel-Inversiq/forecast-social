"use client";

import Link from "next/link";
import { HeatPill, MiniProbBar } from "@/components/feed/shared";
import { motionClass } from "@/components/feed/motion";
import { receiptDetailPath } from "@/lib/receiptIds";
import type { EnrichedResolvedPosition } from "./types";

const TIMING_STYLE: Record<EnrichedResolvedPosition["timing_quality"], string> = {
  excellent: "text-emerald-400",
  good: "text-teal-400",
  late: "text-zinc-500",
};

export function ReceiptCard({
  position,
  index = 0,
}: {
  position: EnrichedResolvedPosition;
  index?: number;
}) {
  const correct = position.result === "correct";

  return (
    <article
      className={`relative rounded-xl border overflow-hidden feed-hover-lift feed-card-glow cursor-pointer ${motionClass.cardEnterStagger(index)} ${
        correct
          ? "border-emerald-500/20 bg-gradient-to-br from-emerald-950/25 to-zinc-950/95"
          : "border-zinc-800/85 bg-zinc-950/90"
      }`}
    >
      <div
        className="absolute right-3 top-3 w-24 opacity-[0.06] pointer-events-none font-mono text-[7px] leading-tight text-zinc-300 select-none"
        aria-hidden
      >
        {`ARCHIVE\n${position.linked_season}\n${position.timing_quality.toUpperCase()}\n${correct ? "VERIFIED" : "INVALIDATED"}`}
      </div>

      <Link
        href={
          correct
            ? receiptDetailPath(`receipt-position-${position.id}`)
            : `/markets/${position.slug}`
        }
        className="absolute inset-0 z-0 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40"
        aria-label={`View market: ${position.market_title}`}
      />

      <div className="relative z-[1] p-3.5 pointer-events-none">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="min-w-0">
            <p className="text-[8px] uppercase tracking-wider text-zinc-600 mb-0.5">Forecasting receipt</p>
            <h3 className="text-sm font-semibold text-white leading-snug">{position.market_title}</h3>
            <p className="text-[9px] text-zinc-600 mt-0.5">{position.archival_note}</p>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            {position.was_early && (
              <HeatPill tone="teal">Early</HeatPill>
            )}
            <span
              className={`text-[8px] font-semibold uppercase px-1.5 py-0.5 rounded-full border ${
                correct
                  ? "text-emerald-300 bg-emerald-500/10 border-emerald-500/25"
                  : "text-zinc-400 bg-zinc-800/80 border-zinc-700/60"
              }`}
            >
              {correct ? "Verified" : "Invalidated"}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 mb-2">
          <span
            className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
              position.side === "YES"
                ? "text-emerald-300 border-emerald-500/30 bg-emerald-500/10"
                : "text-rose-300 border-rose-500/30 bg-rose-500/10"
            }`}
          >
            {position.side}
          </span>
          <span
            className={`text-[10px] font-semibold tabular-nums ${
              position.reputation_delta >= 0 ? "text-emerald-400" : "text-rose-400"
            }`}
          >
            {position.reputation_delta >= 0 ? "+" : ""}
            {position.reputation_delta} reputation
          </span>
          <span className={`text-[9px] font-medium ${TIMING_STYLE[position.timing_quality]}`}>
            {position.timing_quality} timing
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-2">
          <div className="rounded-lg border border-zinc-800/70 bg-zinc-900/50 px-2 py-1.5">
            <p className="text-[8px] text-zinc-600 mb-1">Consensus at entry</p>
            <MiniProbBar value={position.consensus_at_entry} size="xs" animated={false} />
          </div>
          <div className="rounded-lg border border-zinc-800/70 bg-zinc-900/50 px-2 py-1.5">
            <p className="text-[8px] text-zinc-600">Verification</p>
            <p className="text-[10px] text-zinc-300">{position.verification_outcome}</p>
            <p className="text-[8px] text-zinc-600 mt-0.5">{position.narrative_cluster}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 text-[9px] text-zinc-600">
          <span>{position.days_early}d vs consensus</span>
          {position.linked_battle && <span>{position.linked_battle}</span>}
          {position.linked_season && <span>{position.linked_season}</span>}
          <span>
            Resolved{" "}
            {new Date(position.resolved_at).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </span>
        </div>
      </div>
    </article>
  );
}
