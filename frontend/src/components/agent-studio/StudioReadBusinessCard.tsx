"use client";

import Link from "next/link";
import { ForecastThesisLine } from "@/components/forecast/ForecastThesisLine";
import {
  formatConvictionLine,
  formatPublicReadThesis,
  getConvictionLevel,
} from "@/components/public-reads/publicReadEnrichment";
import type { PublicRead } from "@/components/public-reads/types";
import { buildStudioReadBusinessMetrics } from "@/lib/studioReadMetrics";
import { receiptDetailPath } from "@/lib/receiptIds";

export function StudioReadBusinessCard({
  read,
  agentSlug,
  onPlacePosition,
}: {
  read: PublicRead;
  agentSlug: string;
  onPlacePosition?: () => void;
}) {
  const metrics = buildStudioReadBusinessMetrics(read, agentSlug);
  const conviction = getConvictionLevel(read.probability);
  const sideTone = read.side === "YES" ? "text-emerald-300" : "text-rose-300";
  const headline = read.marketOrNarrative || read.title;

  return (
    <article className="rounded-xl border border-zinc-800/90 bg-gradient-to-br from-zinc-950 via-zinc-900/40 to-violet-950/15 p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-zinc-100 leading-snug">{headline}</h3>
          <ForecastThesisLine thesis={formatPublicReadThesis(read)} className="mt-1" />
          {read.title !== headline && (
            <p className="text-[10px] text-zinc-600 mt-0.5 truncate">{read.title}</p>
          )}
        </div>
        <div className="text-right shrink-0">
          <p className={`text-base font-bold tabular-nums ${sideTone}`}>
            {formatConvictionLine(read.probability, read.side)}
          </p>
          {conviction && (
            <p className={`text-[10px] font-medium mt-0.5 ${conviction.toneClass}`}>
              {conviction.label}
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] font-medium px-2 py-0.5 rounded-md border border-zinc-700/80 text-zinc-400 bg-zinc-900/50">
          {metrics.resolutionLabel}
        </span>
        {read.agentPosition && (
          <span className="text-[10px] text-cyan-400/90 font-medium">
            Skin in the game · {read.agentPosition.sizeLabel ?? "Position open"}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px]">
        <Metric label="Views" value={metrics.views.toLocaleString()} />
        {metrics.credibilityEarned != null ? (
          <Metric
            label="Credibility earned"
            value={metrics.credibilityEarned}
            signed
          />
        ) : (
          <Metric label="Cred at stake" value={read.credibilityAtStake ?? 15} />
        )}
        <Metric label="Backers" value={read.backersCount} />
        <Metric label="Challengers" value={read.challengersCount} />
        <Metric label="Subscribers" value={metrics.subscribers} />
        <Metric label="Revenue" value={metrics.revenueLabel} accent />
      </div>

      <div className="flex flex-wrap items-center gap-3 pt-0.5 border-t border-zinc-800/70">
        {read.receiptId && (
          <Link
            href={receiptDetailPath(read.receiptId)}
            className="text-[10px] font-medium text-violet-400 hover:text-violet-300"
          >
            View receipt →
          </Link>
        )}
        {!read.agentPosition && read.status !== "resolved" && onPlacePosition && (
          <button
            type="button"
            onClick={onPlacePosition}
            className="text-[10px] text-cyan-400 hover:text-cyan-300 font-medium"
          >
            Add conviction position →
          </button>
        )}
      </div>
    </article>
  );
}

function Metric({
  label,
  value,
  signed,
  accent,
}: {
  label: string;
  value: string | number;
  signed?: boolean;
  accent?: boolean;
}) {
  const num = typeof value === "number" ? value : null;
  const tone =
    signed && num != null
      ? num >= 0
        ? "text-emerald-300/95"
        : "text-rose-300/95"
      : accent
        ? "text-amber-200/90"
        : "text-zinc-100";

  return (
    <div className="rounded-lg border border-zinc-800/60 bg-zinc-950/40 px-2 py-1.5 min-w-0">
      <p className="text-[8px] uppercase tracking-wider text-zinc-600 truncate">{label}</p>
      <p className={`text-sm font-semibold tabular-nums truncate ${tone}`}>
        {signed && num != null && num > 0 ? "+" : ""}
        {value}
        {signed && num != null && label.toLowerCase().includes("credibility") ? " credibility" : ""}
      </p>
    </div>
  );
}
