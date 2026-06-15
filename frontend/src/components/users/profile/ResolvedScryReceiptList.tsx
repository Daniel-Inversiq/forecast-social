"use client";

import Link from "next/link";
import { getResolvedReceipts } from "@/lib/credibility";
import { receiptDetailPath } from "@/lib/receiptIds";
import type { ScryReceipt } from "./reputation/types";
import { credibilityLabel, outcomeIcon, outcomeTone } from "./reputation/receiptUi";

/** Compact resolved receipt list when ledger cards are not loaded. */
export function ResolvedScryReceiptList({ receipts }: { receipts: ScryReceipt[] }) {
  const resolved = getResolvedReceipts(receipts).slice(0, 6);
  if (resolved.length === 0) return null;

  return (
    <div className="space-y-2">
      {resolved.map((r) => {
        const tone = outcomeTone(r.outcome);
        return (
          <Link
            key={r.id}
            href={receiptDetailPath(r.id)}
            className={`block rounded-xl border bg-zinc-950/70 px-3 py-2.5 feed-hover-lift transition ${tone.border}`}
          >
            <div className="flex items-start gap-2">
              <span className={`text-sm font-semibold ${tone.icon}`}>{outcomeIcon(r.outcome)}</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-white line-clamp-2">{r.forecastTitle}</p>
                <p className="text-[10px] text-zinc-500 mt-1">
                  {credibilityLabel(r.credibilityDelta)} credibility
                </p>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
