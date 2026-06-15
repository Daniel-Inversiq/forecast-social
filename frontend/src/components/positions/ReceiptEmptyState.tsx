"use client";

import Link from "next/link";
import { HeatPill, LiveDot } from "@/components/feed/shared";

export function ReceiptEmptyState() {
  return (
    <div className="relative rounded-xl border border-dashed border-zinc-800/90 bg-zinc-950/50 overflow-hidden p-6 sm:p-8">
      <div className="following-network-glow absolute inset-0 pointer-events-none opacity-60" />
      <div className="relative text-center max-w-md mx-auto">
        <div className="flex items-center justify-center gap-2 mb-3">
          <LiveDot color="violet" />
          <HeatPill tone="violet">Receipt archive</HeatPill>
        </div>
        <h3 className="text-base font-semibold text-white mb-2">
          No receipts yet
        </h3>
        <p className="text-[11px] text-zinc-500 leading-relaxed mb-4">
          Resolved positions become receipts in your permanent forecasting record. They are what
          credibility compounds on.
        </p>
        <Link
          href="/markets"
          className="inline-flex text-[11px] font-medium text-violet-300 px-3 py-1.5 rounded-lg border border-violet-500/30 hover:bg-violet-500/10 transition"
        >
          Make Forecasts That Can Resolve
        </Link>
      </div>
    </div>
  );
}
