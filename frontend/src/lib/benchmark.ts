import type { EnrichedAgentProfile } from "@/components/agents/profile/types";
import { toUserProfileShape } from "@/components/compare/compareStats";
import { getProfileScryReceipts } from "@/components/users/profile/reputation/receiptData";
import { resolveCurrentCredibility } from "@/lib/credibility";
import type { ReputationLeaderboardEntry } from "@/lib/reputation";

export type BenchmarkKey =
  | "trusted_average"
  | "top_10_pct"
  | "top_macro"
  | "top_emerging";

export type BenchmarkOption = {
  key: BenchmarkKey;
  label: string;
  shortLabel: string;
  description: string;
};

export const BENCHMARK_OPTIONS: BenchmarkOption[] = [
  {
    key: "trusted_average",
    label: "Trusted Average",
    shortLabel: "Trusted",
    description: "Forecasters who meet Trusted requirements on the network.",
  },
  {
    key: "top_10_pct",
    label: "Top 10% Forecasters",
    shortLabel: "Top 10%",
    description: "The highest reputation decile in the public ledger.",
  },
  {
    key: "top_macro",
    label: "Top Macro Forecasters",
    shortLabel: "Macro elite",
    description: "Leading voices in macro, rates, and policy niches.",
  },
  {
    key: "top_emerging",
    label: "Top Emerging Forecasters",
    shortLabel: "Emerging",
    description: "Rising forecasters still building toward Trusted.",
  },
];

export type BenchmarkMetricId =
  | "credibility"
  | "accuracy"
  | "early_calls"
  | "resolved_calls"
  | "battle_wins"
  | "narrative_leadership"
  | "consensus_divergence"
  | "reputation_velocity";

export type BenchmarkMetricDef = {
  id: BenchmarkMetricId;
  label: string;
  format: "percent" | "count" | "score";
  higherIsBetter: boolean;
  insightKey: string;
};

export const BENCHMARK_METRICS: BenchmarkMetricDef[] = [
  {
    id: "credibility",
    label: "Credibility",
    format: "score",
    higherIsBetter: true,
    insightKey: "credibility",
  },
  {
    id: "accuracy",
    label: "Accuracy",
    format: "percent",
    higherIsBetter: true,
    insightKey: "accuracy",
  },
  {
    id: "early_calls",
    label: "Early Calls %",
    format: "percent",
    higherIsBetter: true,
    insightKey: "timing",
  },
  {
    id: "resolved_calls",
    label: "Resolved Calls",
    format: "count",
    higherIsBetter: true,
    insightKey: "resolved",
  },
  {
    id: "battle_wins",
    label: "Battle Wins",
    format: "count",
    higherIsBetter: true,
    insightKey: "battles",
  },
  {
    id: "narrative_leadership",
    label: "Narrative Leadership",
    format: "percent",
    higherIsBetter: true,
    insightKey: "narrative",
  },
  {
    id: "consensus_divergence",
    label: "Consensus Divergence",
    format: "percent",
    higherIsBetter: true,
    insightKey: "divergence",
  },
  {
    id: "reputation_velocity",
    label: "Reputation Velocity",
    format: "score",
    higherIsBetter: true,
    insightKey: "velocity",
  },
];

export type BenchmarkSnapshot = Record<BenchmarkMetricId, number>;

export type LeaderboardRow = ReputationLeaderboardEntry & {
  trust_tier_key?: string;
};

export function snapshotFromEnriched(profile: EnrichedAgentProfile): BenchmarkSnapshot {
  const receipts = getProfileScryReceipts(toUserProfileShape(profile), null);
  const credibility = resolveCurrentCredibility(receipts, profile.reputation_score);
  return {
    credibility,
    accuracy: Math.round(
      profile.reputation?.calibration_score ?? profile.accuracy_score,
    ),
    early_calls: profile.early_call_pct,
    resolved_calls: Math.max(
      profile.resolved_calls,
      profile.reputation?.verified_calls ?? profile.verified_calls ?? 0,
    ),
    battle_wins: profile.battles_won,
    narrative_leadership: profile.narrative_leadership,
    consensus_divergence: profile.consensus_divergence,
    reputation_velocity: Math.round(profile.reputation_velocity * 10) / 10,
  };
}

function hash(slug: string): number {
  return slug.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
}

/** Leaderboard-only snapshot when full agent enrichment is unavailable. */
export function snapshotFromLeaderboard(row: LeaderboardRow): BenchmarkSnapshot {
  const h = hash(row.slug);
  const battleWins = Math.max(
    1,
    Math.round((row.battle_win_rate / 100) * Math.max(row.verified_calls, 4)),
  );
  return {
    credibility: row.reputation_score,
    accuracy: Math.round(row.calibration_score ?? row.accuracy_pct),
    early_calls: Math.round(row.timing_quality),
    resolved_calls: row.verified_calls,
    battle_wins: battleWins,
    narrative_leadership: 48 + (h % 42),
    consensus_divergence: Math.min(90, 20 + row.consensus_breaks * 8),
    reputation_velocity: Math.round(row.velocity * 10) / 10,
  };
}

function isMacroNiche(niche: string): boolean {
  return /macro|rates|policy|fed|inflation|credit|bond|equities/i.test(niche);
}

function filterCohort(
  key: BenchmarkKey,
  rows: LeaderboardRow[],
): LeaderboardRow[] {
  if (rows.length === 0) return rows;

  switch (key) {
    case "trusted_average": {
      const trusted = rows.filter(
        (r) =>
          r.trust_tier_key === "trusted" ||
          r.trust_tier_key === "ranked" ||
          r.trust_tier_key === "elite" ||
          r.tier_key === "trusted" ||
          r.tier_key === "proven" ||
          r.tier_key === "elite",
      );
      return trusted.length >= 3 ? trusted : rows.filter((r) => r.verified_calls >= 20);
    }
    case "top_10_pct": {
      const sorted = [...rows].sort(
        (a, b) => b.reputation_score - a.reputation_score,
      );
      const n = Math.max(1, Math.ceil(sorted.length * 0.1));
      return sorted.slice(0, n);
    }
    case "top_macro": {
      const macro = rows.filter((r) => isMacroNiche(r.niche));
      const pool = macro.length >= 3 ? macro : rows;
      return [...pool]
        .sort((a, b) => b.reputation_score - a.reputation_score)
        .slice(0, Math.max(3, Math.ceil(pool.length * 0.25)));
    }
    case "top_emerging": {
      const emerging = rows.filter(
        (r) =>
          r.trust_tier_key === "emerging" ||
          r.trust_tier_key === "observer" ||
          r.tier_key === "emerging" ||
          r.tier_key === "observer",
      );
      const pool = emerging.length >= 3 ? emerging : rows.slice(-Math.ceil(rows.length * 0.4));
      return [...pool]
        .sort((a, b) => b.reputation_score - a.reputation_score)
        .slice(0, Math.max(3, Math.ceil(pool.length * 0.3)));
    }
    default:
      return rows;
  }
}

function averageMetric(
  cohort: LeaderboardRow[],
  pick: (s: BenchmarkSnapshot) => number,
): number {
  if (cohort.length === 0) return 0;
  const sum = cohort.reduce((acc, row) => acc + pick(snapshotFromLeaderboard(row)), 0);
  return sum / cohort.length;
}

export function computeBenchmarkValues(
  key: BenchmarkKey,
  rows: LeaderboardRow[],
  enrichedBySlug?: Map<string, BenchmarkSnapshot>,
): BenchmarkSnapshot {
  const cohort = filterCohort(key, rows);
  const snap = (row: LeaderboardRow) =>
    enrichedBySlug?.get(row.slug) ?? snapshotFromLeaderboard(row);

  const avg = (id: BenchmarkMetricId) => {
    if (cohort.length === 0) return 0;
    const sum = cohort.reduce((acc, row) => acc + snap(row)[id], 0);
    return sum / cohort.length;
  };

  return {
    credibility: Math.round(avg("credibility")),
    accuracy: Math.round(avg("accuracy")),
    early_calls: Math.round(avg("early_calls")),
    resolved_calls: Math.round(avg("resolved_calls")),
    battle_wins: Math.round(avg("battle_wins")),
    narrative_leadership: Math.round(avg("narrative_leadership")),
    consensus_divergence: Math.round(avg("consensus_divergence")),
    reputation_velocity: Math.round(avg("reputation_velocity") * 10) / 10,
  };
}

export function metricDelta(
  yours: number,
  benchmark: number,
  higherIsBetter: boolean,
): number {
  const raw = yours - benchmark;
  return higherIsBetter ? raw : -raw;
}

export function formatBenchmarkValue(
  value: number,
  format: BenchmarkMetricDef["format"],
): string {
  if (format === "percent") return `${Math.round(value)}%`;
  if (format === "score" && value < 200) return String(Math.round(value));
  return String(Math.round(value * 10) / 10);
}

export function formatDelta(
  delta: number,
  format: BenchmarkMetricDef["format"],
): string {
  const sign = delta > 0 ? "+" : "";
  if (format === "percent") return `${sign}${Math.round(delta)}%`;
  if (format === "count") return `${sign}${Math.round(delta)}`;
  return `${sign}${Math.round(delta * 10) / 10}`;
}

export function duelBarWidth(yours: number, benchmark: number): number {
  const total = yours + benchmark;
  if (total <= 0) return 50;
  return Math.round((yours / total) * 100);
}

export function benchmarkLabel(key: BenchmarkKey): string {
  return BENCHMARK_OPTIONS.find((o) => o.key === key)?.label ?? key;
}

export function parseBenchmarkKey(raw: string | null): BenchmarkKey {
  const valid = BENCHMARK_OPTIONS.map((o) => o.key);
  if (raw && valid.includes(raw as BenchmarkKey)) return raw as BenchmarkKey;
  return "trusted_average";
}
