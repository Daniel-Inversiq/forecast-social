"use client";

import type { AgentHeatState } from "./types";

const HEAT_STYLES: Record<
  AgentHeatState,
  { ring: string; text: string; dot: string; pulse?: boolean }
> = {
  hot: {
    ring: "border-rose-500/35 bg-rose-500/10",
    text: "text-rose-300",
    dot: "bg-rose-400",
    pulse: true,
  },
  rising: {
    ring: "border-emerald-500/30 bg-emerald-500/10",
    text: "text-emerald-300",
    dot: "bg-emerald-400",
  },
  cooling: {
    ring: "border-zinc-600/40 bg-zinc-800/60",
    text: "text-zinc-400",
    dot: "bg-zinc-500",
  },
  cult_forming: {
    ring: "border-violet-500/35 bg-violet-500/10",
    text: "text-violet-300",
    dot: "bg-violet-400",
    pulse: true,
  },
  crowded: {
    ring: "border-amber-500/30 bg-amber-500/10",
    text: "text-amber-300",
    dot: "bg-amber-400",
  },
  undervalued: {
    ring: "border-sky-500/30 bg-sky-500/10",
    text: "text-sky-300",
    dot: "bg-sky-400",
  },
  consensus_enemy: {
    ring: "border-rose-500/25 bg-rose-950/30",
    text: "text-rose-200",
    dot: "bg-rose-400",
  },
  breakout: {
    ring: "border-emerald-500/40 bg-emerald-500/15",
    text: "text-emerald-200",
    dot: "bg-emerald-300",
    pulse: true,
  },
  dormant: {
    ring: "border-zinc-700/50 bg-zinc-900/80",
    text: "text-zinc-500",
    dot: "bg-zinc-600",
  },
};

export function AgentHeatBadge({
  state,
  label,
  attention,
  compact = false,
}: {
  state: AgentHeatState;
  label: string;
  attention?: number;
  compact?: boolean;
}) {
  const style = HEAT_STYLES[state];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border font-medium ${style.ring} ${style.text} ${
        compact ? "text-[8px] px-1 py-0.5" : "text-[9px] px-1.5 py-0.5"
      } ${style.pulse ? "agent-heat-pulse" : ""}`}
    >
      <span className={`h-1 w-1 rounded-full shrink-0 ${style.dot}`} />
      {label}
      {attention != null && !compact && (
        <span className="text-zinc-600 tabular-nums font-normal">· {attention}</span>
      )}
    </span>
  );
}

export function AttentionMeter({ score, className = "" }: { score: number; className?: string }) {
  const pct = Math.min(100, Math.max(8, score));
  return (
    <div className={`flex items-center gap-1.5 ${className}`} title={`Attention ${score}`}>
      <div className="flex-1 h-0.5 rounded-full bg-zinc-800/90 overflow-hidden min-w-[40px]">
        <div
          className="h-full rounded-full bg-gradient-to-r from-violet-600/80 to-rose-500/70 transition-all duration-700"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[8px] text-zinc-600 tabular-nums shrink-0">{score}</span>
    </div>
  );
}
