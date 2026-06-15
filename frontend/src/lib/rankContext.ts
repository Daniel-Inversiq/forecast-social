/**
 * Global SCRY rank model — reusable rank + percentile across profiles, feed, battles, etc.
 */

import { betaEstimateRankFromScore, betaRankPoolSize } from "@/lib/betaNetworkScale";
import type { ReputationLeaderboardEntry } from "@/lib/reputation";

/** Default forecaster pool when leaderboard length is unknown (invite-only beta) */
export const DEFAULT_RANK_POOL = betaRankPoolSize();

export type RankScope = "global" | "macro" | "ai" | "politics" | "crypto" | "category";

export type RankContext = {
  rank: number;
  percentile: number;
  label: string;
  rankGlobal: number;
  rankPercentile: number;
  scope: RankScope;
  scopeLabel: string;
  /** Positions improved (positive) or lost (negative) since last period */
  rankDelta: number | null;
  isNew: boolean;
  poolSize: number;
  aheadPercent: number;
};

export type RankContextInput = {
  slug: string;
  credibilityScore: number;
  /** Explicit global rank from API / leaderboard */
  rank?: number | null;
  rankDelta?: number | null;
  reputationDelta?: number | null;
  niche?: string;
  categoryTags?: string[];
  specialtyLabel?: string;
  leaderboard?: ReputationLeaderboardEntry[] | null;
  scope?: RankScope;
  isNewForecaster?: boolean;
};

function hash(s: string): number {
  return s.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
}

/** Estimate global rank from credibility when leaderboard row is missing */
export function estimateRankFromScore(score: number): number {
  return betaEstimateRankFromScore(score);
}

export function resolveRankPoolSize(leaderboard?: ReputationLeaderboardEntry[] | null): number {
  if (leaderboard && leaderboard.length > 0) {
    return betaRankPoolSize(leaderboard.length);
  }
  return DEFAULT_RANK_POOL;
}

export function percentileFromRank(rank: number, poolSize: number): number {
  const r = Math.max(1, Math.min(rank, poolSize));
  const pct = (r / poolSize) * 100;
  if (pct < 0.15) return 0.1;
  if (pct < 1) return Math.round(pct * 10) / 10;
  return Math.round(pct);
}

export function aheadPercentFromRank(rank: number, poolSize: number): number {
  const r = Math.max(1, Math.min(rank, poolSize));
  return Math.round(((poolSize - r) / poolSize) * 100);
}

export function topPercentLabel(percentile: number): string {
  if (percentile <= 0.1) return "Top 0.1%";
  if (percentile < 1) return `Top ${percentile}%`;
  return `Top ${percentile}%`;
}

export function lookupLeaderboardRank(
  slug: string,
  leaderboard?: ReputationLeaderboardEntry[] | null,
): number | null {
  if (!leaderboard?.length) return null;
  const row = leaderboard.find((e) => e.slug === slug);
  return row?.rank ?? null;
}

function inferCategoryScope(input: RankContextInput): { scope: RankScope; scopeLabel: string } {
  const niche =
    input.niche?.toLowerCase() ??
    input.specialtyLabel?.toLowerCase() ??
    "";
  const tags = (input.categoryTags ?? []).join(" ").toLowerCase();
  if (/macro|fed|rates|policy|inflation/i.test(niche) || /macro|fed/i.test(tags)) {
    return { scope: "macro", scopeLabel: "Macro" };
  }
  if (/crypto|btc|eth/i.test(niche) || /crypto/i.test(tags)) {
    return { scope: "crypto", scopeLabel: "Crypto" };
  }
  if (/politic|election/i.test(niche) || /politic/i.test(tags)) {
    return { scope: "politics", scopeLabel: "Politics" };
  }
  if (/ai|model|agent/i.test(niche) || /\bai\b/i.test(tags)) {
    return { scope: "ai", scopeLabel: "AI" };
  }
  return { scope: "global", scopeLabel: "Global" };
}

/** Category-scoped rank — tighter ladder for niche leaders */
export function estimateCategoryRank(globalRank: number, scope: RankScope, slug: string): number {
  if (scope === "global") return globalRank;
  const h = hash(slug);
  const factor = scope === "macro" ? 0.04 : scope === "ai" ? 0.06 : 0.05;
  return Math.max(1, Math.round(globalRank * factor) + (h % 5));
}

export function resolveRankDelta(input: {
  slug: string;
  rankDelta?: number | null;
  reputationDelta?: number | null;
  credibilityChange30d?: number;
  isNewForecaster?: boolean;
}): { rankDelta: number | null; isNew: boolean } {
  if (input.isNewForecaster) return { rankDelta: null, isNew: true };
  if (input.rankDelta != null && input.rankDelta !== 0) {
    return { rankDelta: input.rankDelta, isNew: false };
  }
  if (input.reputationDelta != null && input.reputationDelta !== 0) {
    return { rankDelta: Math.round(input.reputationDelta / 4), isNew: false };
  }
  if (input.credibilityChange30d != null && input.credibilityChange30d !== 0) {
    return { rankDelta: Math.round(input.credibilityChange30d / 3), isNew: false };
  }
  const h = hash(input.slug);
  const simulated = (h % 7) - 3;
  if (simulated === 0) return { rankDelta: null, isNew: false };
  return { rankDelta: simulated, isNew: false };
}

export function getRankContext(input: RankContextInput): RankContext {
  const poolSize = resolveRankPoolSize(input.leaderboard);
  const fromBoard = lookupLeaderboardRank(input.slug, input.leaderboard);
  const globalRank =
    input.rank ?? fromBoard ?? estimateRankFromScore(input.credibilityScore);

  const { scope, scopeLabel } = inferCategoryScope(input);
  const useScope = input.scope ?? scope;
  const displayRank =
    useScope === "global"
      ? globalRank
      : estimateCategoryRank(globalRank, useScope, input.slug);

  const percentile = percentileFromRank(displayRank, poolSize);
  const label = topPercentLabel(percentile);
  const aheadPercent = aheadPercentFromRank(displayRank, poolSize);
  const { rankDelta, isNew } = resolveRankDelta({
    slug: input.slug,
    rankDelta: input.rankDelta,
    reputationDelta: input.reputationDelta,
    isNewForecaster: input.isNewForecaster,
  });

  const finalScope = input.scope ?? useScope;
  const finalScopeLabel =
    finalScope === "global"
      ? "Global"
      : inferCategoryScope(input).scopeLabel;

  return {
    rank: displayRank,
    percentile,
    label,
    rankGlobal: globalRank,
    rankPercentile: percentileFromRank(globalRank, poolSize),
    scope: finalScope,
    scopeLabel: finalScopeLabel,
    rankDelta,
    isNew,
    poolSize,
    aheadPercent,
  };
}

export type RankMilestone = {
  targetLabel: string;
  credibilityNeeded: number;
  targetPercentile: number;
};

export function buildNextRankMilestone(
  rank: RankContext,
  credibilityScore: number,
): RankMilestone | null {
  const tiers = [20, 15, 10, 5, 1, 0.1];
  const current = rank.percentile;
  const next = tiers.find((t) => t < current);
  if (next == null) return null;
  const positionsToGain = Math.max(
    1,
    Math.round((rank.rank * (current - next)) / 100),
  );
  const credibilityNeeded = Math.max(1, Math.round(positionsToGain * 0.95));
  return {
    targetLabel: topPercentLabel(next),
    credibilityNeeded,
    targetPercentile: next,
  };
}

export function buildReputationSentence(input: {
  rank: RankContext;
  credibilityScore: number;
  name?: string;
  isAgent?: boolean;
  niche?: string;
}): string {
  const { rank, credibilityScore, isAgent, niche } = input;
  if (isAgent && rank.scope !== "global") {
    return `${rank.label} ${rank.scopeLabel.toLowerCase()} forecaster with ${credibilityScore} credibility earned from resolved calls.`;
  }
  if (isAgent) {
    return `Ranked #${rank.rankGlobal} globally · ${rank.label} · ${credibilityScore} credibility from resolved calls.`;
  }
  return `Ranked #${rank.rankGlobal} globally and ahead of ${rank.aheadPercent}% of active forecasters.`;
}

/** Attach rank fields to profile-like objects for API serialization */
export function withRankFields<T extends Record<string, unknown>>(
  obj: T,
  ctx: RankContext,
): T & { rankGlobal: number; rankPercentile: number } {
  return { ...obj, rankGlobal: ctx.rankGlobal, rankPercentile: ctx.rankPercentile };
}
