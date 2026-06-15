"use client";

import type { RankContext } from "@/lib/rankContext";

const RANK_GLOW =
  "text-violet-200/95 font-semibold tabular-nums tracking-tight";

export function RankDeltaPill({
  rankDelta,
  isNew,
  className = "",
}: {
  rankDelta: number | null;
  isNew?: boolean;
  className?: string;
}) {
  if (isNew) {
    return (
      <span
        className={`inline-flex items-center text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border border-cyan-500/35 bg-cyan-500/10 text-cyan-200 ${className}`}
      >
        New
      </span>
    );
  }
  if (rankDelta == null || rankDelta === 0) return null;
  const up = rankDelta > 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-[9px] font-bold tabular-nums px-1.5 py-0.5 rounded border ${
        up
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300 feed-momentum-up"
          : "border-rose-500/30 bg-rose-500/10 text-rose-300/90 feed-momentum-down"
      } ${className}`}
    >
      <span aria-hidden>{up ? "↑" : "↓"}</span>
      {Math.abs(rankDelta)}
    </span>
  );
}

export function RankContextLines({
  rank,
  showDelta = true,
  align = "center",
  className = "",
}: {
  rank: RankContext;
  showDelta?: boolean;
  align?: "left" | "center" | "right";
  className?: string;
}) {
  const alignClass =
    align === "left"
      ? "text-left items-start"
      : align === "right"
        ? "text-right items-end"
        : "text-center items-center";

  const scopeSuffix =
    rank.scope !== "global" ? ` ${rank.scopeLabel}` : "";

  return (
    <div className={`flex flex-col gap-0.5 ${alignClass} ${className}`}>
      <div className={`flex flex-wrap items-center gap-2 ${align === "center" ? "justify-center" : align === "right" ? "justify-end" : ""}`}>
        <span className={`text-sm ${RANK_GLOW}`}>
          Rank #{rank.rank}
          {scopeSuffix}
        </span>
        {showDelta && (
          <RankDeltaPill rankDelta={rank.rankDelta} isNew={rank.isNew} />
        )}
      </div>
      <span className="text-[11px] font-medium text-violet-300/85">{rank.label}</span>
    </div>
  );
}

export function RankCompactBadge({
  rank,
  className = "",
}: {
  rank: RankContext;
  className?: string;
}) {
  const label =
    rank.scope !== "global"
      ? `#${rank.rank} ${rank.scopeLabel}`
      : rank.percentile <= 5
        ? rank.label
        : `#${rank.rank}`;

  return (
    <span
      className={`inline-flex items-center gap-1 text-[8px] font-semibold tabular-nums px-1.5 py-0.5 rounded-full border border-violet-500/25 bg-violet-500/8 text-violet-200/90 shrink-0 ${className}`}
      title={`${rank.label} · Rank #${rank.rankGlobal} global`}
    >
      {label}
    </span>
  );
}

export function CompareRankStrip({
  rankA,
  rankB,
  credibilityGap,
  className = "",
}: {
  rankA: RankContext;
  rankB: RankContext;
  credibilityGap?: number;
  className?: string;
}) {
  const rankGap = Math.abs(rankA.rankGlobal - rankB.rankGlobal);

  return (
    <div
      className={`grid grid-cols-[1fr_auto_1fr] gap-3 items-center rounded-xl border border-violet-500/15 bg-violet-950/15 px-4 py-3 ${className}`}
    >
      <div className="text-center sm:text-left">
        <p className={`text-lg ${RANK_GLOW}`}>#{rankA.rankGlobal}</p>
        <p className="text-[10px] text-violet-300/80 mt-0.5">{rankA.label}</p>
      </div>
      <div className="text-center px-1">
        <p className="text-[9px] uppercase tracking-wider text-zinc-600">VS</p>
      </div>
      <div className="text-center sm:text-right">
        <p className={`text-lg ${RANK_GLOW}`}>#{rankB.rankGlobal}</p>
        <p className="text-[10px] text-violet-300/80 mt-0.5">{rankB.label}</p>
      </div>
      <div className="col-span-3 flex flex-wrap justify-center gap-x-4 gap-y-1 text-[10px] text-zinc-500 border-t border-zinc-800/50 pt-2 mt-1">
        <span>
          Rank gap:{" "}
          <span className="text-zinc-300 font-semibold tabular-nums">{rankGap} positions</span>
        </span>
        {credibilityGap != null && credibilityGap !== 0 && (
          <span>
            Credibility gap:{" "}
            <span className="text-amber-300/90 font-semibold tabular-nums">
              {credibilityGap > 0 ? "+" : ""}
              {credibilityGap}
            </span>
          </span>
        )}
      </div>
    </div>
  );
}

export function BenchmarkRankHeader({
  rank,
  milestone,
  className = "",
}: {
  rank: RankContext;
  milestone?: { targetLabel: string; credibilityNeeded: number } | null;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl border border-violet-500/20 bg-gradient-to-br from-violet-950/30 via-zinc-950/80 to-zinc-950 px-4 py-4 ${className}`}
    >
      <p className="text-[10px] uppercase tracking-[0.18em] text-violet-400/70 mb-2">
        Your standing
      </p>
      <p className="text-sm text-zinc-300">
        You are ahead of{" "}
        <span className="text-emerald-300/95 font-semibold tabular-nums">
          {rank.aheadPercent}%
        </span>{" "}
        of forecasters
      </p>
      <div className="flex flex-wrap items-center gap-3 mt-3">
        <div>
          <p className="text-[9px] uppercase tracking-wider text-zinc-600">Current rank</p>
          <p className={`text-2xl ${RANK_GLOW}`}>#{rank.rankGlobal}</p>
        </div>
        <div className="h-8 w-px bg-zinc-800/80 hidden sm:block" />
        <div>
          <p className="text-[9px] uppercase tracking-wider text-zinc-600">Percentile</p>
          <p className="text-lg font-semibold text-violet-300/90">{rank.label}</p>
        </div>
        <RankDeltaPill rankDelta={rank.rankDelta} isNew={rank.isNew} className="ml-auto" />
      </div>
      {milestone && (
        <div className="mt-4 pt-3 border-t border-zinc-800/60">
          <p className="text-[9px] uppercase tracking-wider text-zinc-600 mb-1">Next milestone</p>
          <p className="text-sm text-zinc-300">
            Reach {milestone.targetLabel}
          </p>
          <p className="text-[11px] text-amber-300/85 mt-1 tabular-nums font-medium">
            Needs: +{milestone.credibilityNeeded} credibility
          </p>
        </div>
      )}
    </div>
  );
}

export function RankedRivalryLabel({ className = "" }: { className?: string }) {
  return (
    <span
      className={`text-[8px] font-bold uppercase tracking-[0.2em] px-2 py-0.5 rounded-full border border-violet-500/30 bg-violet-500/10 text-violet-200/90 ${className}`}
    >
      Ranked rivalry
    </span>
  );
}
