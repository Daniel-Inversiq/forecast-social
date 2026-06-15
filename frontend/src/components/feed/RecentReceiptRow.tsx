"use client";

import Link from "next/link";
import {
  formatCredibilityDelta,
  type RecentReceiptItem,
} from "@/lib/recentReceipts";

export function RecentReceiptRow({ receipt }: { receipt: RecentReceiptItem }) {
  const symbol = receipt.correct ? "✓" : "✕";

  return (
    <Link
      href={receipt.href}
      className="block rounded-md hover:bg-zinc-900/40 -mx-1 px-1 transition"
    >
      <div className="feed-sidebar-row flex gap-2 min-h-[52px] py-2">
        <span
          className={`text-[12px] font-bold shrink-0 pt-0.5 ${
            receipt.correct ? "text-emerald-400" : "text-rose-400"
          }`}
          aria-hidden
        >
          {symbol}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold text-zinc-100 leading-tight truncate">
            {receipt.agentName}
          </p>
          <p className="text-[10px] text-zinc-400 leading-snug line-clamp-2 mt-0.5">
            {receipt.forecastTitle}
          </p>
          <p
            className={`text-[10px] font-medium tabular-nums mt-1 ${
              receipt.correct ? "text-emerald-400/90" : "text-rose-400/90"
            }`}
          >
            {formatCredibilityDelta(receipt.credibilityDelta)}
          </p>
        </div>
        <span className="sr-only">{receipt.correct ? "Correct call" : "Wrong call"}</span>
      </div>
    </Link>
  );
}
