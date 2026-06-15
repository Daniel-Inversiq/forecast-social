"use client";

import Link from "next/link";
import { HeatPill, LiveDot } from "@/components/feed/shared";

type OpenPositionsPanelProps = {
  compact?: boolean;
  /** When > 0, shows expand CTA instead of the zero-positions empty state. */
  activeCount?: number;
};

export function OpenPositionsEmptyState({
  compact = false,
  activeCount = 0,
}: OpenPositionsPanelProps) {
  const hasActive = activeCount > 0;

  const body = hasActive ? (
    <div className={compact ? "text-center" : "relative text-center max-w-md mx-auto"}>
      <h2
        className={
          compact
            ? "text-[13px] font-semibold text-zinc-200 mb-2"
            : "text-base sm:text-lg font-semibold text-white mb-2"
        }
      >
        Find new conviction opportunities
      </h2>
      <p
        className={
          compact
            ? "text-[11px] text-zinc-500 leading-relaxed mb-4 max-w-sm mx-auto"
            : "text-[11px] text-zinc-500 leading-relaxed mb-5"
        }
      >
        You currently have {activeCount} active{" "}
        {activeCount === 1 ? "position" : "positions"} across the network.
      </p>
      <div
        className={
          compact
            ? "flex flex-col sm:flex-row items-center justify-center gap-2"
            : "flex flex-col sm:flex-row items-center justify-center gap-2.5"
        }
      >
        <Link
          href="/battles"
          className="inline-flex text-[11px] font-medium text-white px-4 py-2 rounded-lg border border-rose-500/35 bg-rose-500/15 hover:bg-rose-500/25 transition w-full sm:w-auto justify-center"
        >
          Browse Battles
        </Link>
        <Link
          href="/markets"
          className="inline-flex text-[11px] font-medium text-violet-200 px-4 py-2 rounded-lg border border-violet-500/30 bg-violet-500/5 hover:bg-violet-500/15 transition w-full sm:w-auto justify-center"
        >
          Browse Markets
        </Link>
      </div>
    </div>
  ) : (
    <div className={compact ? "text-center" : "relative text-center max-w-md mx-auto"}>
      {!compact && (
        <div className="flex items-center justify-center gap-2 mb-3">
          <LiveDot color="violet" />
          <HeatPill tone="violet">Conviction ledger</HeatPill>
        </div>
      )}
      <h2
        className={
          compact
            ? "text-[13px] font-semibold text-zinc-200 mb-2"
            : "text-base sm:text-lg font-semibold text-white mb-2"
        }
      >
        You haven&apos;t taken a side yet.
      </h2>
      <p
        className={
          compact
            ? "text-[11px] text-zinc-500 leading-relaxed mb-4 max-w-sm mx-auto"
            : "text-[11px] text-zinc-500 leading-relaxed mb-5"
        }
      >
        Join a battle or back a forecast to start building your public track record.
      </p>
      <div
        className={
          compact
            ? "flex flex-col sm:flex-row items-center justify-center gap-2"
            : "flex flex-col sm:flex-row items-center justify-center gap-2.5"
        }
      >
        <Link
          href="/battles"
          className="inline-flex text-[11px] font-medium text-white px-4 py-2 rounded-lg border border-rose-500/35 bg-rose-500/15 hover:bg-rose-500/25 transition w-full sm:w-auto justify-center"
        >
          Explore Battles
        </Link>
        <Link
          href="/markets"
          className="inline-flex text-[11px] font-medium text-violet-200 px-4 py-2 rounded-lg border border-violet-500/30 bg-violet-500/5 hover:bg-violet-500/15 transition w-full sm:w-auto justify-center"
        >
          Explore Markets
        </Link>
      </div>
    </div>
  );

  const shellClass = hasActive
    ? compact
      ? "rounded-xl border border-zinc-800/70 bg-zinc-950/50 p-5"
      : "relative rounded-xl border border-zinc-800/80 bg-zinc-950/50 overflow-hidden p-6 sm:p-10 mb-4"
    : compact
      ? "rounded-xl border border-dashed border-zinc-800/80 bg-zinc-950/40 p-6"
      : "relative rounded-xl border border-dashed border-zinc-800/90 bg-zinc-950/50 overflow-hidden p-6 sm:p-10 mb-4";

  if (compact) {
    return <div className={shellClass}>{body}</div>;
  }

  return (
    <div className={shellClass}>
      {!hasActive && (
        <div
          className="following-network-glow absolute inset-0 pointer-events-none opacity-50"
          aria-hidden
        />
      )}
      {body}
    </div>
  );
}

export function PositionsLedgerEmptyState() {
  return <OpenPositionsEmptyState activeCount={0} />;
}
