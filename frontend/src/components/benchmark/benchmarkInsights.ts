import type { BenchmarkKey, BenchmarkMetricDef, BenchmarkSnapshot } from "@/lib/benchmark";
import { BENCHMARK_METRICS, benchmarkLabel, metricDelta } from "@/lib/benchmark";

export type BenchmarkInsight = {
  id: string;
  tone: "positive" | "neutral" | "gap";
  text: string;
};

function resolvedGapInsight(
  yours: BenchmarkSnapshot,
  benchmark: BenchmarkSnapshot,
  benchLabel: string,
): BenchmarkInsight | null {
  const gap = Math.ceil(benchmark.resolved_calls - yours.resolved_calls);
  if (gap <= 0) return null;
  return {
    id: "resolved-gap",
    tone: "gap",
    text: `You need ${gap} more resolved call${gap === 1 ? "" : "s"} to match the average ${benchLabel} forecaster.`,
  };
}

function timingInsight(
  yours: BenchmarkSnapshot,
  benchmark: BenchmarkSnapshot,
  benchKey: BenchmarkKey,
): BenchmarkInsight | null {
  const def = BENCHMARK_METRICS.find((m) => m.id === "early_calls")!;
  const delta = metricDelta(yours.early_calls, benchmark.early_calls, def.higherIsBetter);
  if (delta < 3) return null;
  const bench = benchmarkLabel(benchKey).toLowerCase();
  return {
    id: "timing-edge",
    tone: "positive",
    text: `You outperform the ${bench} on timing.`,
  };
}

function credibilityVelocityInsight(
  yours: BenchmarkSnapshot,
  benchmark: BenchmarkSnapshot,
  benchKey: BenchmarkKey,
): BenchmarkInsight | null {
  if (benchKey !== "top_emerging") return null;
  const credDelta = yours.credibility - benchmark.credibility;
  const velDelta = yours.reputation_velocity - benchmark.reputation_velocity;
  if (credDelta >= -5 && velDelta >= 0.5) {
    return {
      id: "cred-velocity",
      tone: "positive",
      text: "Your credibility is building faster than most Emerging forecasters.",
    };
  }
  return null;
}

function accuracyInsight(
  yours: BenchmarkSnapshot,
  benchmark: BenchmarkSnapshot,
): BenchmarkInsight | null {
  const delta = yours.accuracy - benchmark.accuracy;
  if (delta >= 5) {
    return {
      id: "accuracy-lead",
      tone: "positive",
      text: "Your calibration sits above this benchmark — accuracy is a strength.",
    };
  }
  if (delta <= -6) {
    return {
      id: "accuracy-gap",
      tone: "gap",
      text: `Closing a ${Math.abs(Math.round(delta))}pt accuracy gap would move you closer to Trusted.`,
    };
  }
  return null;
}

function battleInsight(
  yours: BenchmarkSnapshot,
  benchmark: BenchmarkSnapshot,
): BenchmarkInsight | null {
  const delta = yours.battle_wins - benchmark.battle_wins;
  if (delta >= 2) {
    return {
      id: "battle-edge",
      tone: "positive",
      text: "Contested wins are lifting you above this cohort in battle record.",
    };
  }
  return null;
}

function narrativeInsight(
  yours: BenchmarkSnapshot,
  benchmark: BenchmarkSnapshot,
): BenchmarkInsight | null {
  const delta = yours.narrative_leadership - benchmark.narrative_leadership;
  if (delta >= 8) {
    return {
      id: "narrative-lead",
      tone: "positive",
      text: "You are leading narratives ahead of this benchmark group.",
    };
  }
  return null;
}

function trustedProximityInsight(
  yours: BenchmarkSnapshot,
  benchmark: BenchmarkSnapshot,
  benchKey: BenchmarkKey,
): BenchmarkInsight | null {
  if (benchKey !== "trusted_average") return null;
  const credGap = benchmark.credibility - yours.credibility;
  const resolvedGap = benchmark.resolved_calls - yours.resolved_calls;
  if (credGap <= 0 && resolvedGap <= 0) {
    return {
      id: "trusted-there",
      tone: "positive",
      text: "You are at or above the Trusted average — distribution weight should reflect it.",
    };
  }
  if (credGap > 0 && credGap <= 25) {
    return {
      id: "trusted-close",
      tone: "neutral",
      text: `About ${Math.round(credGap)} credibility points separate you from the average Trusted forecaster.`,
    };
  }
  return null;
}

export function generateBenchmarkInsights(
  yours: BenchmarkSnapshot,
  benchmark: BenchmarkSnapshot,
  benchKey: BenchmarkKey,
): BenchmarkInsight[] {
  const benchShort = benchmarkLabel(benchKey).replace(/ forecasters$/i, "");
  const insights: BenchmarkInsight[] = [];

  const push = (item: BenchmarkInsight | null) => {
    if (item) insights.push(item);
  };

  push(timingInsight(yours, benchmark, benchKey));
  push(credibilityVelocityInsight(yours, benchmark, benchKey));
  push(resolvedGapInsight(yours, benchmark, benchShort));
  push(accuracyInsight(yours, benchmark));
  push(battleInsight(yours, benchmark));
  push(narrativeInsight(yours, benchmark));
  push(trustedProximityInsight(yours, benchmark, benchKey));

  if (insights.length === 0) {
    const weakest = findWeakestMetric(yours, benchmark);
    insights.push({
      id: "default-focus",
      tone: "neutral",
      text: `Focus on ${weakest.label.toLowerCase()} — that is your largest gap vs ${benchShort}.`,
    });
  }

  return insights.slice(0, 4);
}

function findWeakestMetric(
  yours: BenchmarkSnapshot,
  benchmark: BenchmarkSnapshot,
): BenchmarkMetricDef {
  let worst: BenchmarkMetricDef = BENCHMARK_METRICS[0];
  let worstGap = -Infinity;

  for (const def of BENCHMARK_METRICS) {
    const gap = metricDelta(yours[def.id], benchmark[def.id], def.higherIsBetter);
    if (gap < worstGap) {
      worstGap = gap;
      worst = def;
    }
  }
  return worst;
}
