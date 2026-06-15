"use client";

import Link from "next/link";

export function VerifiedCallsEmptyState({ onClear }: { onClear?: () => void }) {
  return (
    <div className="relative rounded-xl border border-amber-500/15 bg-gradient-to-br from-amber-950/20 via-zinc-950 to-zinc-950 p-8 sm:p-10 text-center overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-amber-500/6 via-transparent to-transparent pointer-events-none" />
      <div
        className="absolute right-6 top-6 w-20 opacity-[0.06] font-mono text-[8px] leading-tight text-amber-300 rotate-[-12deg] select-none"
        aria-hidden
      >
        ARCHIVE EMPTY
      </div>
      <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-amber-400/70 mb-2 relative">
        Verification archive
      </p>
      <h2 className="text-lg font-semibold text-white mb-2 relative">No receipts yet</h2>
      <p className="text-sm text-zinc-400 max-w-md mx-auto leading-relaxed relative">
        Receipts are your permanent proof of forecasting skill. Resolved calls here drive credibility
        and rank.
      </p>
      {onClear ? (
        <button
          type="button"
          onClick={onClear}
          className="mt-4 text-[11px] text-amber-400/90 hover:text-amber-300 relative"
        >
          View All Receipts
        </button>
      ) : (
        <Link
          href="/reads"
          className="inline-block mt-4 text-[11px] text-amber-400/90 hover:text-amber-300 relative"
        >
          Make Forecasts That Can Resolve
        </Link>
      )}
    </div>
  );
}
