"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Avatar } from "@/components/feed/shared";
import { motionClass } from "@/components/feed/motion";
import { enrichVerifiedCall } from "@/components/verified-calls/verifiedCallEnrichment";
import type { VerifiedCallBase } from "@/components/verified-calls/types";
import { receiptDetailPath } from "@/lib/receiptIds";
import { receiptTimingLine } from "@/lib/receiptMomentCopy";
import { ReceiptMomentCard } from "./ReceiptMomentCard";

function pickBestReceipt(receipts: VerifiedCallBase[]): VerifiedCallBase | null {
  if (!receipts.length) return null;
  return [...receipts].sort((a, b) => {
    const strength = { legendary: 0, early: 1, contested: 2, strong: 3 };
    const sa = strength[a.receipt_strength] ?? 4;
    const sb = strength[b.receipt_strength] ?? 4;
    if (sa !== sb) return sa - sb;
    return (b.reputation_delta ?? 0) - (a.reputation_delta ?? 0);
  })[0];
}

function pickMostIsolated(receipts: VerifiedCallBase[]): VerifiedCallBase | null {
  if (!receipts.length) return null;
  return [...receipts].sort(
    (a, b) =>
      (100 - b.original_probability) - (100 - a.original_probability) ||
      b.days_early - a.days_early,
  )[0];
}

function pickBiggestRep(receipts: VerifiedCallBase[]): VerifiedCallBase | null {
  if (!receipts.length) return null;
  return [...receipts].sort(
    (a, b) => (b.reputation_delta ?? 0) - (a.reputation_delta ?? 0),
  )[0];
}

function CompactReceiptTile({
  call,
  label,
  index,
}: {
  call: VerifiedCallBase;
  label: string;
  index: number;
}) {
  const enriched = useMemo(() => enrichVerifiedCall(call), [call]);
  return (
    <Link
      href={receiptDetailPath(call.id)}
      className={`block rounded-lg border border-zinc-800/80 bg-zinc-950/80 p-2.5 transition hover:border-amber-500/25 hover:bg-zinc-900/60 ${motionClass.cardEnterStagger(index)}`}
    >
      <p className="text-[8px] uppercase tracking-wider text-amber-500/70 mb-1">{label}</p>
      <div className="flex items-center gap-2 mb-1.5">
        <Avatar name={call.agent_name} color={call.avatar_color} size="xs" />
        <p className="text-[11px] font-medium text-zinc-200 truncate">{call.market_title}</p>
      </div>
      <p className="text-[10px] text-zinc-500 line-clamp-1">{receiptTimingLine(call.days_early)}</p>
      {enriched.reputation_delta > 0 && (
        <p className="text-[10px] text-amber-300/80 tabular-nums mt-0.5">
          +{enriched.reputation_delta} reputation
        </p>
      )}
    </Link>
  );
}

export function UserReceiptArchiveSection({
  receipts,
  username,
}: {
  receipts: VerifiedCallBase[];
  username: string;
}) {
  const verified = useMemo(
    () => receipts.filter((r) => r.final_outcome === r.side),
    [receipts],
  );
  const best = pickBestReceipt(verified);
  const isolated = pickMostIsolated(verified);
  const biggestRep = pickBiggestRep(verified);
  const recent = verified.slice(0, 3);

  if (!verified.length) return null;

  const hero = best ? enrichVerifiedCall(best) : null;

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2 px-0.5">
        <div>
          <p className="text-[9px] uppercase tracking-wider text-zinc-600">Conviction archive</p>
          <h2 className="text-sm font-semibold text-zinc-100">Verified receipts</h2>
        </div>
        <Link
          href={`/u/${username}?tab=positions`}
          className="text-[10px] text-zinc-500 hover:text-zinc-300 transition"
        >
          Full archive →
        </Link>
      </div>

      {hero && (
        <ReceiptMomentCard call={hero} variant="compact" showActions={false} />
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {best && best.id !== isolated?.id && (
          <CompactReceiptTile call={best} label="Best receipt" index={1} />
        )}
        {isolated && (
          <CompactReceiptTile call={isolated} label="Most isolated" index={2} />
        )}
        {biggestRep && (
          <CompactReceiptTile call={biggestRep} label="Biggest rep gain" index={3} />
        )}
      </div>

      {recent.length > 1 && (
        <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/70 p-3">
          <p className="text-[9px] uppercase tracking-wider text-zinc-600 mb-2">Recent receipts</p>
          <ul className="space-y-1.5">
            {recent.map((r) => (
              <li key={r.id}>
                <Link
                  href={receiptDetailPath(r.id)}
                  className="flex items-center justify-between gap-2 text-[11px] text-zinc-400 hover:text-zinc-200 transition"
                >
                  <span className="truncate">{r.market_title}</span>
                  <span className="shrink-0 font-mono text-[9px] text-amber-500/60">
                    {r.receipt_strength}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
