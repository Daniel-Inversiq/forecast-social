"use client";

import { RankMotion } from "@/components/feed/shared";
import { RankContextLines, RankDeltaPill } from "@/components/reputation/RankContextDisplay";
import { CredibilityOnboardingDisplay } from "@/components/reputation/CredibilityOnboardingDisplay";
import type { CredibilityScoreData, CredibilityTrend } from "@/lib/credibilityScore";
import type { RankContext } from "@/lib/rankContext";

const TREND_LABEL: Record<CredibilityTrend, string> = {
  up: "Rising",
  down: "Cooling",
  flat: "Stable",
};

const TREND_CLASS: Record<CredibilityTrend, string> = {
  up: "text-emerald-400/90",
  down: "text-rose-400/85",
  flat: "text-zinc-500",
};

function formatFollowers(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  return String(n);
}

export type ReputationScoreVariant = "hero" | "card" | "compact" | "table";

export function ReputationScore({
  data,
  variant = "card",
  followers,
  rank,
  reputationSentence,
  className = "",
}: {
  data: CredibilityScoreData;
  variant?: ReputationScoreVariant;
  /** Secondary social metric — shown smaller than credibility when provided. */
  followers?: number;
  rank?: RankContext | null;
  reputationSentence?: string | null;
  className?: string;
}) {
  if (data.onboarding) {
    return (
      <CredibilityOnboardingDisplay
        onboarding={data.onboarding}
        variant={variant}
        className={className}
      />
    );
  }

  const changePositive = data.change30d > 0;
  const changeNegative = data.change30d < 0;
  const changeStr =
    data.change30d === 0
      ? "±0"
      : `${changePositive ? "+" : ""}${data.change30d}`;

  if (variant === "hero") {
    return (
      <div className={`reputation-score-hero text-center xl:text-left ${className}`}>
        <p className="text-[10px] uppercase tracking-[0.18em] text-zinc-500 mb-1">Credibility</p>
        <p className="text-5xl sm:text-6xl font-bold tabular-nums leading-none tracking-tight text-white">
          {data.score}
        </p>
        {rank ? (
          <RankContextLines
            rank={rank}
            align="center"
            className="mt-2 xl:items-start xl:text-left [&>div]:xl:justify-start"
          />
        ) : (
          <p className="text-[12px] text-violet-300/90 mt-3 font-medium">{data.percentileLabel}</p>
        )}
        {data.lifetimeEarned != null && data.lifetimeEarned > data.score && (
          <p className="text-[11px] text-emerald-400/85 mt-1.5 tabular-nums font-medium">
            Lifetime earned +{data.lifetimeEarned}
          </p>
        )}
        {!rank && (
          <p className="text-[11px] text-zinc-500 mt-2 max-w-xs mx-auto xl:mx-0">
            Sum of receipt credibility deltas on your public ledger.
          </p>
        )}
        {reputationSentence && (
          <p className="text-[11px] text-cyan-200/75 mt-3 max-w-sm mx-auto xl:mx-0 leading-relaxed border-l-2 border-violet-500/25 pl-2.5">
            {reputationSentence}
          </p>
        )}
        <div className="flex flex-wrap items-center justify-center xl:justify-start gap-x-4 gap-y-1 mt-2 text-[11px]">
          <span className={`font-medium ${TREND_CLASS[data.trend]}`}>
            {TREND_LABEL[data.trend]} credibility
          </span>
          <span
            className={`tabular-nums font-semibold ${
              changePositive
                ? "text-emerald-400/90"
                : changeNegative
                  ? "text-rose-400/90"
                  : "text-zinc-500"
            }`}
          >
            {changeStr} <span className="font-normal text-zinc-600">last 30 days</span>
          </span>
          {rank && (
            <RankDeltaPill rankDelta={rank.rankDelta} isNew={rank.isNew} />
          )}
        </div>
        {followers != null && (
          <p className="text-[10px] text-zinc-600 mt-3 tabular-nums">
            {formatFollowers(followers)} followers
          </p>
        )}
      </div>
    );
  }

  if (variant === "table") {
    return (
      <div className={`text-right sm:text-left ${className}`}>
        <p className="text-base font-bold text-white tabular-nums leading-none">{data.score}</p>
        <p className="text-[9px] uppercase tracking-wider text-zinc-600 mt-0.5">credibility</p>
        {rank ? (
          <p className="text-[9px] text-violet-400/80 mt-0.5 tabular-nums">
            #{rank.rankGlobal} · {rank.label}
          </p>
        ) : (
          <p className="text-[9px] text-violet-400/80 mt-0.5 line-clamp-1">{data.percentileLabel}</p>
        )}
        <div className="flex items-center justify-end sm:justify-start gap-1 mt-0.5">
          <span className={`text-[9px] ${TREND_CLASS[data.trend]}`}>{TREND_LABEL[data.trend]}</span>
          <span
            className={`text-[9px] tabular-nums font-medium ${
              changePositive ? "text-emerald-400/80" : changeNegative ? "text-rose-400/80" : "text-zinc-600"
            }`}
          >
            {changeStr} / 30d
          </span>
          {rank && <RankDeltaPill rankDelta={rank.rankDelta} isNew={rank.isNew} />}
        </div>
      </div>
    );
  }

  if (variant === "compact") {
    return (
      <div className={`text-right shrink-0 ${className}`}>
        <p className="text-[8px] uppercase tracking-wider text-zinc-600 leading-none">Credibility</p>
        <p className="text-lg font-bold tabular-nums leading-none text-white mt-0.5">{data.score}</p>
        {rank ? (
          <p className="text-[8px] text-violet-400/75 mt-0.5 max-w-[7rem] ml-auto tabular-nums">
            #{rank.rankGlobal} · {rank.label}
          </p>
        ) : (
          <p className="text-[8px] text-violet-400/75 mt-0.5 max-w-[7rem] ml-auto line-clamp-1">
            {data.percentileLabel}
          </p>
        )}
        <div className="flex items-center justify-end gap-1 mt-0.5">
          <span className={`text-[8px] ${TREND_CLASS[data.trend]}`}>{TREND_LABEL[data.trend]}</span>
          {rank ? (
            <RankDeltaPill rankDelta={rank.rankDelta} isNew={rank.isNew} />
          ) : (
            data.change30d !== 0 && <RankMotion delta={data.change30d} />
          )}
        </div>
      </div>
    );
  }

  /* card — agent cards, panels */
  return (
    <div className={`text-right shrink-0 ${className}`}>
      <p className="text-[8px] uppercase tracking-wider text-zinc-600">Credibility</p>
      <p className="text-2xl font-bold tabular-nums leading-none text-white mt-0.5">{data.score}</p>
      <p className="text-[9px] text-zinc-500 mt-1 max-w-[9rem] ml-auto leading-snug">
        Earned through resolved forecasts.
      </p>
      <p className="text-[9px] text-violet-400/85 mt-1 font-medium">{data.percentileLabel}</p>
      <div className="flex flex-col items-end gap-0.5 mt-1.5 text-[9px]">
        <span className={TREND_CLASS[data.trend]}>{TREND_LABEL[data.trend]} credibility</span>
        <span
          className={`tabular-nums font-semibold ${
            changePositive ? "text-emerald-400/90" : changeNegative ? "text-rose-400/90" : "text-zinc-600"
          }`}
        >
          {changeStr} last 30 days
        </span>
      </div>
      {followers != null && (
        <p className="text-[8px] text-zinc-600 mt-1.5 tabular-nums">{formatFollowers(followers)} followers</p>
      )}
    </div>
  );
}
