"use client";

import Link from "next/link";
import {
  Avatar,
  HeatPill,
  MiniSparkline,
  MoveBadge,
} from "@/components/feed/shared";
import type { EnrichedAlert } from "./types";

const TONE_RING: Record<string, string> = {
  violet: "border-violet-500/30 bg-violet-500/10 text-violet-300",
  rose: "border-rose-500/30 bg-rose-500/10 text-rose-300",
  emerald: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  sky: "border-sky-500/30 bg-sky-500/10 text-sky-300",
  amber: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  cyan: "border-cyan-500/30 bg-cyan-500/10 text-cyan-300",
};

function StripCard({ alert }: { alert: EnrichedAlert }) {
  const ring = TONE_RING[alert.tone] ?? TONE_RING.violet;
  const href = alert.marketSlug
    ? `/markets/${alert.marketSlug}`
    : alert.agentSlug
      ? `/agents/${alert.agentSlug}`
      : "#";
  const delta = alert.probability_change ?? (alert.movementSize ? (alert.direction === "down" ? -alert.movementSize : alert.movementSize) : 0);
  const sparkTone =
    alert.direction === "up" ? "emerald" : alert.direction === "down" ? "amber" : "violet";

  return (
    <Link
      href={href}
      className="alert-strip-card feed-hover-lift group shrink-0 w-[200px] sm:w-[220px] flex flex-col gap-1.5 p-2.5 rounded-xl border border-zinc-800/80 bg-zinc-950/90 hover:border-sky-500/30 hover:shadow-lg hover:shadow-sky-950/15 relative overflow-hidden"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-sky-500/8 via-transparent to-violet-500/8 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity" />
      <div className="relative flex items-center justify-between gap-1">
        <span className={`inline-flex items-center gap-0.5 text-[7px] font-bold uppercase px-1 py-0.5 rounded-full border ${ring}`}>
          {alert.isLive && <span className="h-1 w-1 rounded-full bg-current feed-live-pill" />}
          {alert.displayType.split(" ")[0]}
        </span>
        {delta !== 0 && <MoveBadge delta={delta} />}
      </div>
      <p className="relative text-[11px] font-semibold text-white leading-snug line-clamp-2 min-h-[2.25rem] group-hover:text-violet-100 transition-colors">
        {alert.headline}
      </p>
      <div className="relative flex items-center gap-1 min-h-[1.25rem]">
        {alert.related_agent && (
          <Avatar name={alert.related_agent} size="xs" />
        )}
        {alert.secondaryAgent && (
          <>
            <span className="text-[7px] text-zinc-600 font-bold">vs</span>
            <Avatar name={alert.secondaryAgent} size="xs" />
          </>
        )}
        <span className="ml-auto shrink-0">
          <MiniSparkline seed={alert.id} tone={sparkTone} width={44} height={14} />
        </span>
      </div>
      <p className="relative text-[9px] text-zinc-600 line-clamp-1">
        {alert.convictionContext}
      </p>
    </Link>
  );
}

export function LiveAlertStrip({
  alerts,
  loading,
}: {
  alerts: EnrichedAlert[];
  loading: boolean;
}) {
  const strip = [...alerts]
    .sort((a, b) => {
      const ua = { critical: 3, high: 2, normal: 1 };
      return ua[b.urgency] - ua[a.urgency] || Number(b.unread) - Number(a.unread);
    })
    .slice(0, 14);

  return (
    <div className="mb-3">
      <div className="flex items-center justify-between gap-2 mb-1.5 px-0.5">
        <div className="flex items-center gap-2">
          <HeatPill tone="violet" pulse>
            Live
          </HeatPill>
          <span className="text-[11px] font-medium text-zinc-400">Priority pulse</span>
          <span className="text-[10px] text-zinc-600 hidden sm:inline">
            Urgent signals in motion
          </span>
        </div>
        <Link href="/" className="text-[10px] text-sky-400/90 hover:text-sky-300 shrink-0">
          Conviction feed →
        </Link>
      </div>
      <div className="relative -mx-0.5">
        <div className="flex gap-2 overflow-x-auto pb-0.5 px-0.5 feed-scroll-x scrollbar-none">
          {loading &&
            Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="shrink-0 w-[220px] h-[118px] rounded-xl border border-zinc-800/60 bg-zinc-900/40 animate-pulse"
              />
            ))}
          {!loading && strip.map((a) => <StripCard key={a.id} alert={a} />)}
        </div>
        <div
          className="pointer-events-none absolute inset-y-0 right-0 w-20 bg-gradient-to-l from-zinc-950 via-zinc-950/85 to-transparent"
          aria-hidden
        />
      </div>
    </div>
  );
}
