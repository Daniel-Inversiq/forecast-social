"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { formatTimeAgo } from "@/components/feed/shared";
import { receiptDetailPath } from "@/lib/receiptIds";
import { credibilityLabel } from "@/components/users/profile/reputation/receiptUi";
import { receiptDisplayLabel, receiptScrLabel } from "./receiptDetailData";
import {
  buildCredibilityDistribution,
  credibilityImpactLabel,
  deriveReceiptVerdict,
  outcomeLabelForRelated,
  participantCounts,
} from "./receiptVerdict";
import type { ReceiptDetail } from "./types";

function VerdictStat({
  label,
  value,
  valueClassName = "text-zinc-100",
}: {
  label: string;
  value: ReactNode;
  valueClassName?: string;
}) {
  return (
    <div className="rounded-lg border border-zinc-800/70 bg-zinc-900/45 px-3 py-2.5 min-w-[7rem] flex-1">
      <p className="text-[8px] uppercase tracking-wider text-zinc-600 mb-1">{label}</p>
      <p className={`text-sm font-semibold tabular-nums ${valueClassName}`}>{value}</p>
    </div>
  );
}

export function ReceiptVerdictHero({ detail }: { detail: ReceiptDetail }) {
  const verdict = deriveReceiptVerdict(detail);
  const { backers, challengers } = participantCounts(detail);
  const net = detail.networkImpact;
  const credTone =
    detail.credibilityDelta > 0
      ? "text-emerald-300"
      : detail.credibilityDelta < 0
        ? "text-rose-300"
        : "text-zinc-400";

  return (
    <header
      className={`receipt-verdict-hero relative px-4 sm:px-5 py-5 sm:py-6 border-b border-zinc-800/80 bg-gradient-to-b ${verdict.glowClass} to-zinc-950`}
    >
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-600 mb-3">Public verdict</p>

      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl font-semibold text-zinc-200 tracking-tight line-clamp-2">
            {detail.forecastTitle}
          </h1>
          <p className="text-[10px] font-mono text-zinc-600 mt-1">
            {receiptDisplayLabel(detail)} · {receiptScrLabel(detail)}
          </p>
        </div>
        <span
          className={`shrink-0 text-[9px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md border ${verdict.borderClass} bg-zinc-950/60 ${verdict.toneClass}`}
        >
          {verdict.label}
        </span>
      </div>

      <div className="mb-4">
        <p className={`text-3xl sm:text-4xl font-bold flex items-center gap-2 ${verdict.toneClass}`}>
          <span aria-hidden>{verdict.icon}</span>
          {verdict.label}
        </p>
        <p className={`mt-1 text-xl sm:text-2xl font-bold tabular-nums ${credTone}`}>
          {credibilityImpactLabel(detail.credibilityDelta)}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <VerdictStat
          label="Consensus"
          value={
            <>
              {net.consensusAtCall}% → {net.consensusAtResolution}%
            </>
          }
        />
        <VerdictStat label="Backers" value={String(backers)} />
        <VerdictStat label="Challengers" value={String(challengers)} />
      </div>

      {detail.resolvedAt && (
        <p className="text-[10px] text-zinc-600 mt-3">
          Resolved {formatTimeAgo(detail.resolvedAt)}
        </p>
      )}
    </header>
  );
}

export function ReceiptConvictionNetworkSection({ detail }: { detail: ReceiptDetail }) {
  const net = detail.networkImpact;
  const shift = net.consensusShift;
  const shiftLabel = shift > 0 ? `+${shift}%` : `${shift}%`;
  const shiftTone =
    shift > 0 ? "text-emerald-300/90" : shift < 0 ? "text-rose-300/90" : "text-zinc-400";
  const distributedTone =
    net.credibilityDistributed > 0
      ? "text-emerald-300/90"
      : net.credibilityDistributed < 0
        ? "text-rose-300/90"
        : "text-zinc-400";
  const followersTone = net.followersGained > 0 ? "text-emerald-300/90" : "text-zinc-400";
  const { backers, challengers } = participantCounts(detail);

  const rows = [
    { label: "Backers", value: String(backers) },
    { label: "Challengers", value: String(challengers) },
    { label: "Consensus Shift", value: shiftLabel, valueClassName: shiftTone },
    {
      label: "Followers Gained",
      value: net.followersGained > 0 ? `+${net.followersGained}` : String(net.followersGained),
      valueClassName: followersTone,
    },
    {
      label: "Credibility Distributed",
      value:
        net.credibilityDistributed > 0
          ? `+${net.credibilityDistributed}`
          : String(net.credibilityDistributed),
      valueClassName: distributedTone,
    },
  ];

  return (
    <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
      {rows.map((row) => (
        <div
          key={row.label}
          className="flex items-baseline justify-between gap-3 rounded-lg border border-zinc-800/60 bg-zinc-900/35 px-3 py-2"
        >
          <span className="text-[11px] text-zinc-500">{row.label}</span>
          <span
            className={`text-[13px] font-semibold tabular-nums ${row.valueClassName ?? "text-zinc-100"}`}
          >
            {row.value}
          </span>
        </div>
      ))}
    </div>
  );
}

function DistributionList({
  title,
  entries,
  tone,
}: {
  title: string;
  entries: { name: string; delta: number }[];
  tone: "win" | "loss";
}) {
  if (entries.length === 0) return null;

  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-zinc-600 mb-2">{title}</p>
      <ul className="space-y-1.5">
        {entries.map((entry) => (
          <li
            key={`${title}-${entry.name}`}
            className="flex items-center justify-between gap-3 rounded-lg border border-zinc-800/50 bg-zinc-900/30 px-3 py-2"
          >
            <span className="text-[13px] font-medium text-zinc-200">{entry.name}</span>
            <span
              className={`text-[13px] font-bold tabular-nums ${
                tone === "win" ? "text-emerald-300/95" : "text-rose-300/95"
              }`}
            >
              {credibilityLabel(entry.delta)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ReceiptCredibilityDistributionSection({
  detail,
}: {
  detail: ReceiptDetail;
}) {
  const { winners, losers } = buildCredibilityDistribution(detail);

  return (
    <div className="mt-2 grid sm:grid-cols-2 gap-4">
      <DistributionList title="Winners" entries={winners} tone="win" />
      <DistributionList title="Losers" entries={losers} tone="loss" />
    </div>
  );
}

export function ReceiptForecasterMoreSection({ detail }: { detail: ReceiptDetail }) {
  const related = detail.related.filter((r) => r.id !== detail.id);

  if (related.length === 0) return null;

  return (
    <ul className="mt-2 space-y-1">
      {related.map((r) => (
        <li key={r.id}>
          <Link
            href={receiptDetailPath(r.id)}
            className="flex items-center gap-3 rounded-lg border border-transparent hover:border-zinc-800/80 hover:bg-zinc-900/50 px-2 py-2.5 -mx-2 transition group"
          >
            <div className="min-w-0 flex-1">
              <p className="text-[12px] text-zinc-300 font-medium truncate group-hover:text-white">
                {r.forecastTitle}
              </p>
              <p className="text-[10px] text-zinc-600 mt-0.5">{outcomeLabelForRelated(r.outcome)}</p>
            </div>
            <span
              className={`text-[12px] font-bold tabular-nums shrink-0 ${
                r.credibilityDelta >= 0 ? "text-emerald-400/90" : "text-rose-400/90"
              }`}
            >
              {credibilityLabel(r.credibilityDelta)}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
