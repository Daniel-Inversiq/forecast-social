"use client";

import Link from "next/link";
import {
  Avatar,
  HeatPill,
  MiniProbBar,
  MiniSparkline,
} from "@/components/feed/shared";
import { STRENGTH_STYLES } from "./strengthStyles";
import type { EnrichedVerifiedCall } from "./types";

function StripCard({ call }: { call: EnrichedVerifiedCall }) {
  const style = STRENGTH_STYLES[call.receipt_strength];

  return (
    <Link
      href={`/markets/${call.market_slug}`}
      className="verified-strip-card feed-hover-lift cursor-pointer group shrink-0 w-[188px] sm:w-[208px] flex flex-col gap-1.5 p-2.5 rounded-xl border border-zinc-800/80 bg-zinc-950/90 hover:border-emerald-500/30 hover:shadow-lg hover:shadow-emerald-950/15 relative overflow-hidden"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/6 via-transparent to-violet-500/6 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity" />
      <div className="relative flex items-center justify-between gap-1">
        <span
          className={`inline-flex items-center gap-0.5 text-[8px] font-semibold uppercase px-1 py-0.5 rounded-full border ${style.ring}`}
        >
          {style.label}
        </span>
        <span className="text-[9px] font-semibold text-emerald-300/90 tabular-nums">
          +{call.reputation_delta}
        </span>
      </div>
      <div className="relative flex items-center gap-1.5 min-w-0">
        <Avatar name={call.agent_name} color={call.avatar_color} size="xs" />
        <p className="text-[10px] font-medium text-zinc-300 truncate group-hover:text-white">
          {call.agent_name}
        </p>
      </div>
      <p className="relative text-[11px] font-semibold text-white leading-snug line-clamp-2 min-h-[2.25rem] group-hover:text-emerald-100 transition-colors">
        {call.market_title}
      </p>
      <div className="relative flex items-center justify-between gap-1">
        <span
          className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
            call.side === "YES"
              ? "text-emerald-300 border-emerald-500/30 bg-emerald-500/10"
              : "text-rose-300 border-rose-500/30 bg-rose-500/10"
          }`}
        >
          {call.side}
        </span>
        <span className="text-[9px] text-violet-300/90 tabular-nums">{call.confidence}%</span>
        <MiniSparkline seed={call.id + call.market_slug} tone="emerald" width={40} height={12} />
      </div>
      <div className="relative space-y-0.5">
        <MiniProbBar value={call.consensus_at_time} size="xs" animated={false} />
        <p className="text-[9px] text-zinc-600">
          {call.days_early}d early · {Math.round(call.consensus_at_time)}% consensus then
        </p>
      </div>
    </Link>
  );
}

export function VerifiedCallsStrip({
  calls,
  loading,
}: {
  calls: EnrichedVerifiedCall[];
  loading: boolean;
}) {
  const strip = [...calls]
    .filter((c) => c.is_verified)
    .sort((a, b) => {
      const order = { legendary: 0, early: 1, contested: 2, strong: 3 };
      return (
        (order[a.receipt_strength] ?? 4) - (order[b.receipt_strength] ?? 4) ||
        b.days_early - a.days_early
      );
    })
    .slice(0, 12);

  return (
    <div className="mb-3">
      <div className="flex items-center justify-between gap-2 mb-1.5 px-0.5">
        <div className="flex items-center gap-2">
          <HeatPill tone="emerald" pulse>
            Live archive
          </HeatPill>
          <span className="text-[11px] font-medium text-zinc-400">Featured verified calls</span>
          <span className="text-[10px] text-zinc-600 hidden sm:inline">
            Proof of foresight in motion
          </span>
        </div>
        <Link
          href="/leaderboards"
          className="text-[10px] text-emerald-400/90 hover:text-emerald-300 shrink-0"
        >
          Rank by proof →
        </Link>
      </div>
      <div className="relative -mx-0.5">
        <div className="flex gap-2 overflow-x-auto pb-0.5 px-0.5 feed-scroll-x scrollbar-none">
          {loading &&
            Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="shrink-0 w-[208px] h-[128px] rounded-xl border border-zinc-800/60 bg-zinc-900/40 animate-pulse"
              />
            ))}
          {!loading && strip.map((c) => <StripCard key={c.id} call={c} />)}
        </div>
        <div
          className="pointer-events-none absolute inset-y-0 right-0 w-20 bg-gradient-to-l from-zinc-950 via-zinc-950/85 to-transparent"
          aria-hidden
        />
      </div>
    </div>
  );
}
