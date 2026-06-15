"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { computeForecastRecord } from "@/lib/credibility";
import { receiptDetailPath } from "@/lib/receiptIds";
import type { ScryReceipt } from "./types";
import { formatReceiptTiming, outcomeIcon, outcomeTone } from "./receiptUi";

const COLLAPSED_LIMIT = 3;

function receiptSortKey(receipt: ScryReceipt): number {
  const iso = receipt.resolvedAt ?? receipt.calledAt;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : 0;
}

function sortResolvedNewestFirst(receipts: ScryReceipt[]): ScryReceipt[] {
  return receipts
    .filter((r) => r.outcome !== "pending")
    .sort((a, b) => receiptSortKey(b) - receiptSortKey(a));
}

function TrackRecordSummary({ record }: { record: ReturnType<typeof computeForecastRecord> }) {
  const accuracyLabel =
    record.winRate != null ? `${record.winRate}% accuracy` : "Accuracy building";

  return (
    <div className="px-3 sm:px-4 py-3 border-b border-violet-500/15 bg-zinc-950/50">
      <h2 className="text-sm font-semibold text-white tracking-tight">Track Record</h2>
      <ul className="mt-3 space-y-1 text-[13px] font-medium tabular-nums">
        <li className="text-zinc-200">
          {record.resolved} {record.resolved === 1 ? "call" : "calls"}
        </li>
        <li className="text-emerald-300/90">{record.correct} correct</li>
        <li className="text-rose-300/85">{record.missed} missed</li>
        <li className="text-violet-200/95">{accuracyLabel}</li>
      </ul>
    </div>
  );
}

function TrackRecordCard({ receipt }: { receipt: ScryReceipt }) {
  const tone = outcomeTone(receipt.outcome);
  const resolved =
    receipt.outcome === "correct"
      ? "Correct"
      : receipt.outcome === "missed"
        ? "Missed"
        : "Pending";

  return (
    <Link
      href={receiptDetailPath(receipt.id)}
      className={`block rounded-xl border bg-zinc-950/70 bg-gradient-to-br from-zinc-900/40 to-zinc-950/90 px-3 py-3 sm:px-4 sm:py-3.5 feed-hover-lift transition ${tone.border}`}
    >
      <div className="flex gap-3">
        <span
          className={`shrink-0 w-7 h-7 rounded-lg border border-zinc-800/80 bg-zinc-900/80 flex items-center justify-center text-sm font-semibold ${tone.icon}`}
          aria-hidden
        >
          {outcomeIcon(receipt.outcome)}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-white leading-snug line-clamp-2">
            {receipt.forecastTitle}
          </h3>
          <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-x-3 gap-y-1 text-[10px]">
            <p className="text-zinc-500">
              Called:{" "}
              <span className="text-violet-200/90 tabular-nums font-medium">
                {receipt.calledProbability}%
              </span>
            </p>
            <p className="text-zinc-500">
              Consensus:{" "}
              <span className="text-zinc-300 tabular-nums font-medium">
                {receipt.consensusAtCall}%
              </span>
            </p>
            <p className="text-zinc-500 sm:col-span-2">
              Resolved:{" "}
              <span className={`font-medium ${tone.text}`}>{resolved}</span>
            </p>
          </div>
          <p className="text-[9px] text-zinc-600 mt-2">
            {formatReceiptTiming(receipt.calledAt, receipt.resolvedAt)}
          </p>
          <p className="text-[10px] text-violet-300/90 mt-2 font-medium">View Receipt →</p>
        </div>
      </div>
    </Link>
  );
}

export function TrackRecordSection({ receipts }: { receipts: ScryReceipt[] }) {
  const [expanded, setExpanded] = useState(false);
  const record = useMemo(() => computeForecastRecord(receipts), [receipts]);
  const resolvedSorted = useMemo(() => sortResolvedNewestFirst(receipts), [receipts]);
  const visible = expanded
    ? resolvedSorted
    : resolvedSorted.slice(0, COLLAPSED_LIMIT);
  const hasMore = resolvedSorted.length > COLLAPSED_LIMIT;

  return (
    <section className="mb-3 rounded-xl border border-violet-500/20 bg-gradient-to-br from-violet-950/30 via-zinc-950/50 to-cyan-950/15 overflow-hidden">
      <TrackRecordSummary record={record} />

      <div className="p-2 sm:p-3 space-y-2">
        {resolvedSorted.length === 0 ? (
          <p className="text-sm text-zinc-500 px-2 py-4 text-center">
            No resolved calls on record yet. Credibility is earned when forecasts resolve.
          </p>
        ) : (
          <>
            {visible.map((r) => (
              <TrackRecordCard key={r.id} receipt={r} />
            ))}
            {hasMore && (
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="w-full text-[11px] font-medium py-2.5 rounded-lg border border-violet-500/25 text-violet-200/90 bg-violet-500/5 hover:bg-violet-500/15 transition"
              >
                {expanded ? "Show fewer receipts" : "Show all receipts"}
              </button>
            )}
          </>
        )}
      </div>
    </section>
  );
}
