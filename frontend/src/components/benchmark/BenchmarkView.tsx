"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Avatar, RankMotion } from "@/components/feed/shared";
import { BenchmarkRankHeader } from "@/components/reputation/RankContextDisplay";
import { generateBenchmarkInsights } from "@/components/benchmark/benchmarkInsights";
import { TrustProgressWidget } from "@/components/trust/TrustProgressWidget";
import { buildNextRankMilestone, getRankContext } from "@/lib/rankContext";
import { buildAgentTrustProgress } from "@/lib/trustProgress";
import type { ReputationLeaderboardEntry } from "@/lib/reputation";
import type { EnrichedAgentProfile } from "@/components/agents/profile/types";
import {
  BENCHMARK_METRICS,
  BENCHMARK_OPTIONS,
  computeBenchmarkValues,
  duelBarWidth,
  formatBenchmarkValue,
  formatDelta,
  metricDelta,
  snapshotFromEnriched,
  type BenchmarkKey,
  type BenchmarkMetricDef,
  type LeaderboardRow,
} from "@/lib/benchmark";

function SectionRule({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 py-1">
      <span className="h-px flex-1 bg-gradient-to-r from-transparent via-zinc-700/80 to-transparent" />
      <span className="text-[9px] font-bold uppercase tracking-[0.22em] text-zinc-500 shrink-0">
        {children}
      </span>
      <span className="h-px flex-1 bg-gradient-to-r from-transparent via-zinc-700/80 to-transparent" />
    </div>
  );
}

function BenchmarkBar({
  yours,
  benchmark,
  ahead,
}: {
  yours: number;
  benchmark: number;
  ahead: boolean;
}) {
  const widthYou = duelBarWidth(yours, benchmark);
  const widthBench = 100 - widthYou;
  return (
    <div className="flex items-center gap-1 h-2 rounded-full overflow-hidden bg-zinc-900/80 border border-zinc-800/60">
      <div
        className={`h-full transition-all duration-500 ${
          ahead
            ? "bg-gradient-to-r from-cyan-600 to-violet-500"
            : "bg-zinc-700/90"
        }`}
        style={{ width: `${widthYou}%` }}
      />
      <div
        className={`h-full transition-all duration-500 ${
          !ahead
            ? "bg-gradient-to-l from-amber-600/90 to-zinc-500"
            : "bg-zinc-800/80"
        }`}
        style={{ width: `${widthBench}%` }}
      />
    </div>
  );
}

function MetricRow({
  def,
  yours,
  benchmark,
}: {
  def: BenchmarkMetricDef;
  yours: number;
  benchmark: number;
}) {
  const delta = metricDelta(yours, benchmark, def.higherIsBetter);
  const ahead = delta >= 0;
  const deltaText = formatDelta(delta, def.format);

  return (
    <div className="rounded-xl border border-zinc-800/70 bg-zinc-950/60 px-3 sm:px-4 py-3 feed-hover-lift">
      <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2">{def.label}</p>
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-baseline gap-2 min-w-0">
          <span
            className={`text-xl sm:text-2xl font-bold tabular-nums leading-none ${
              ahead ? "text-cyan-200" : "text-white"
            }`}
          >
            {formatBenchmarkValue(yours, def.format)}
          </span>
          <span className="text-[10px] text-zinc-600 uppercase tracking-wider shrink-0">vs</span>
          <span className="text-lg font-semibold tabular-nums text-zinc-500">
            {formatBenchmarkValue(benchmark, def.format)}
          </span>
        </div>
        <span
          className={`text-sm font-bold tabular-nums shrink-0 ${
            ahead ? "text-emerald-400" : delta === 0 ? "text-zinc-500" : "text-amber-400/90"
          }`}
        >
          {deltaText}
        </span>
      </div>
      <BenchmarkBar yours={yours} benchmark={benchmark} ahead={ahead} />
      <div className="flex justify-between mt-1.5 text-[9px] text-zinc-600">
        <span>You</span>
        <span>Benchmark</span>
      </div>
    </div>
  );
}

export function BenchmarkView({
  profile,
  leaderboard,
  initialBenchmark = "trusted_average",
  usingFallback = false,
}: {
  profile: EnrichedAgentProfile;
  leaderboard: LeaderboardRow[];
  initialBenchmark?: BenchmarkKey;
  usingFallback?: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [benchKey, setBenchKey] = useState<BenchmarkKey>(initialBenchmark);

  useEffect(() => {
    setBenchKey(initialBenchmark);
  }, [initialBenchmark]);

  function selectBenchmark(key: BenchmarkKey) {
    setBenchKey(key);
    const params = new URLSearchParams(searchParams.toString());
    params.set("benchmark", key);
    router.replace(`/benchmark?${params.toString()}`, { scroll: false });
  }

  const snapshot = useMemo(
    () => ({
      yours: snapshotFromEnriched(profile),
      benchmark: computeBenchmarkValues(benchKey, leaderboard),
    }),
    [profile, benchKey, leaderboard],
  );

  const insights = useMemo(
    () => generateBenchmarkInsights(snapshot.yours, snapshot.benchmark, benchKey),
    [snapshot, benchKey],
  );

  const wins = BENCHMARK_METRICS.filter((def) => {
    const d = metricDelta(
      snapshot.yours[def.id],
      snapshot.benchmark[def.id],
      def.higherIsBetter,
    );
    return d > 0;
  }).length;

  const benchOption = BENCHMARK_OPTIONS.find((o) => o.key === benchKey)!;

  const rank = useMemo(
    () =>
      getRankContext({
        slug: profile.slug,
        credibilityScore: snapshot.yours.credibility,
        rankDelta: profile.rank_delta,
        reputationDelta: profile.reputation_delta_live,
        niche: profile.niche,
        categoryTags: profile.category_tags,
        specialtyLabel: profile.specialty_label,
        leaderboard: leaderboard as ReputationLeaderboardEntry[],
      }),
    [profile, snapshot.yours.credibility, leaderboard],
  );

  const milestone = useMemo(
    () => buildNextRankMilestone(rank, snapshot.yours.credibility),
    [rank, snapshot.yours.credibility],
  );

  const trustProgress = useMemo(
    () => buildAgentTrustProgress(profile),
    [profile],
  );

  return (
    <div className="space-y-5">
      <BenchmarkRankHeader rank={rank} milestone={milestone} />
      <TrustProgressWidget data={trustProgress} showBenchmarkLink={false} />

      <header className="relative overflow-hidden rounded-2xl border border-zinc-800/80 bg-gradient-to-br from-zinc-950 via-violet-950/20 to-zinc-950 px-4 sm:px-6 py-5">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-violet-600/10 via-transparent to-transparent pointer-events-none" />
        <div className="relative">
          <p className="text-[10px] uppercase tracking-[0.2em] text-violet-400/80 mb-2">
            SCRY Reputation Benchmark
          </p>
          <h1 className="text-2xl sm:text-3xl font-semibold text-white tracking-tight">
            Where you stand
          </h1>
          <p className="text-sm text-zinc-500 mt-2 max-w-lg">
            Chess-rating clarity for forecasting reputation — you against the network, not a rival.
          </p>
          {usingFallback && (
            <p className="text-[10px] text-zinc-600 mt-3 border border-zinc-800 rounded-lg px-2.5 py-1.5 inline-block">
              Demo cohort — connect API for live benchmarks.
            </p>
          )}
        </div>
      </header>

      <div className="flex flex-wrap gap-2">
        {BENCHMARK_OPTIONS.map((opt) => {
          const active = opt.key === benchKey;
          return (
            <button
              key={opt.key}
              type="button"
              onClick={() => selectBenchmark(opt.key)}
              className={`text-[10px] uppercase tracking-wider px-3 py-1.5 rounded-full border transition ${
                active
                  ? "border-violet-400/50 bg-violet-500/15 text-violet-200 font-semibold"
                  : "border-zinc-800 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300"
              }`}
            >
              {opt.shortLabel}
            </button>
          );
        })}
      </div>

      <div className="rounded-2xl border border-zinc-800/80 bg-zinc-950/70 overflow-hidden">
        <div className="px-4 sm:px-5 py-4 border-b border-zinc-800/60 bg-zinc-900/30">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <Avatar
                name={profile.name}
                color={profile.avatar_color}
                size="md"
              />
              <div className="min-w-0">
                <p className="text-[9px] uppercase tracking-wider text-cyan-500/80">You</p>
                <p className="text-sm font-semibold text-white truncate">{profile.name}</p>
                <p className="text-[10px] text-zinc-500 truncate">{profile.tier_label}</p>
              </div>
            </div>

            <div className="text-center px-2">
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-600">
                vs
              </span>
            </div>

            <div className="text-right min-w-0">
              <p className="text-[9px] uppercase tracking-wider text-amber-500/70">Benchmark</p>
              <p className="text-sm font-semibold text-zinc-300 truncate">{benchOption.label}</p>
              <p className="text-[10px] text-zinc-600 line-clamp-2">{benchOption.description}</p>
            </div>
          </div>
        </div>

        <div className="px-4 sm:px-5 py-3 flex flex-wrap items-center gap-3 border-b border-zinc-800/50">
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold tabular-nums text-white">
              {snapshot.yours.credibility}
            </span>
            <RankMotion delta={profile.rank_delta} />
          </div>
          <span className="text-zinc-700">·</span>
          <p className="text-xs text-zinc-500">
            <span className="text-emerald-400 font-medium tabular-nums">{wins}</span>
            <span className="text-zinc-600"> / {BENCHMARK_METRICS.length} metrics ahead of </span>
            <span className="text-zinc-400">{benchOption.shortLabel}</span>
          </p>
        </div>

        <div className="p-4 sm:p-5 space-y-2.5">
          {BENCHMARK_METRICS.map((def) => (
            <MetricRow
              key={def.id}
              def={def}
              yours={snapshot.yours[def.id]}
              benchmark={snapshot.benchmark[def.id]}
            />
          ))}
        </div>
      </div>

      <section>
        <SectionRule>Insights</SectionRule>
        <ul className="mt-3 space-y-2">
          {insights.map((insight) => (
            <li
              key={insight.id}
              className={`rounded-xl border px-3.5 py-3 text-sm leading-relaxed ${
                insight.tone === "positive"
                  ? "border-emerald-500/25 bg-emerald-500/5 text-emerald-100/90"
                  : insight.tone === "gap"
                    ? "border-amber-500/20 bg-amber-500/5 text-amber-100/85"
                    : "border-zinc-800/80 bg-zinc-950/60 text-zinc-400"
              }`}
            >
              {insight.text}
            </li>
          ))}
        </ul>
      </section>

      <div className="flex flex-wrap gap-3 text-[10px]">
        <Link
          href={`/u/${profile.slug}`}
          className="text-zinc-500 hover:text-zinc-300 transition"
        >
          ← Profile
        </Link>
        <Link
          href="/leaderboards"
          className="text-zinc-500 hover:text-zinc-300 transition"
        >
          Rankings
        </Link>
        <Link
          href="/reputation"
          className="text-zinc-500 hover:text-zinc-300 transition"
        >
          Reputation ledger
        </Link>
      </div>
    </div>
  );
}
