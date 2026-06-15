/**
 * Central invite-only beta scale for demo / fallback data.
 * Import helpers here instead of scattering magic numbers.
 */

import { CORE_AGENT_SLUGS } from "@/lib/agentRoster";
import { PLAN_PRICES } from "@/lib/forecasterSubscriptions";

export const BETA_NETWORK_SCALE = {
  activeNowMin: 25,
  activeNowMax: 150,
  activeNowBaseMin: 60,
  activeNowBaseMax: 90,
  networkForecasterCount: 73,
  networkForecasterCountMin: 42,
  networkForecasterCountMax: 150,
  maxBetaPositionUsd: 25,
  betaPositionSizesUsd: [5, 10, 25, 50] as const,
  publicReadsNetworkMin: 10,
  publicReadsNetworkMax: 30,
  storiesBattlesMin: 3,
  storiesBattlesMax: 8,
  coreAgentFollowers: {
    "macro-oracle": 112,
    doombot: 96,
    "fed-watcher": 87,
    bullbot: 64,
    "sports-chaos": 51,
  } as Record<string, number>,
  coreAgentCredibility: {
    "macro-oracle": 124,
    doombot: 101,
    "fed-watcher": 98,
    bullbot: 77,
    "sports-chaos": 66,
  } as Record<string, number>,
  danielScryCredibility: 50,
  creatorFollowerMax: 25,
  creatorCredibilityMax: 75,
  creatorSupporterMax: 3,
  creatorMrrMax: 27,
  coreSupporterMin: 5,
  coreSupporterMax: 18,
  coreMrrMin: 45,
  coreMrrMax: 162,
} as const;

export const BETA_ACTIVE_NOW_SSR_DEFAULT = 73;

function hashSlug(slug: string): number {
  return slug.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
}

export function isCoreAgentSlug(slug: string): boolean {
  return CORE_AGENT_SLUGS.has(slug);
}

/** Followers for seeded / fallback agents. New creators: pass isNewAgent. */
export function betaFollowerCount(
  slug: string,
  opts?: { dbFollows?: number; isNewAgent?: boolean; isCreator?: boolean },
): number {
  if (opts?.isNewAgent) return 0;
  const core = BETA_NETWORK_SCALE.coreAgentFollowers[slug];
  if (core != null) return core + Math.min(opts?.dbFollows ?? 0, 8);
  if (opts?.isCreator) {
    const h = hashSlug(slug);
    return h % (BETA_NETWORK_SCALE.creatorFollowerMax + 1);
  }
  const h = hashSlug(slug);
  return 8 + (h % 18);
}

export function betaCredibilityForSlug(slug: string, isNewAgent = false): number {
  if (isNewAgent) return 0;
  const core = BETA_NETWORK_SCALE.coreAgentCredibility[slug];
  if (core != null) return core;
  const h = hashSlug(slug);
  return 12 + (h % (BETA_NETWORK_SCALE.creatorCredibilityMax - 11));
}

export function betaReceiptCount(slug: string, isNewAgent = false): number {
  if (isNewAgent) return 0;
  if (isCoreAgentSlug(slug)) {
    const h = hashSlug(slug);
    return 3 + (h % 6);
  }
  const h = hashSlug(slug);
  return h % 4;
}

export function formatBetaFollowerCount(n: number): string {
  if (n < 1000) return n.toLocaleString();
  if (n >= 1_000_000) {
    const v = n / 1_000_000;
    return `${v >= 10 ? Math.round(v) : v.toFixed(1).replace(/\.0$/, "")}M`;
  }
  return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`;
}

export function clampBetaLiveCount(n: number): number {
  return Math.max(
    BETA_NETWORK_SCALE.activeNowMin,
    Math.min(BETA_NETWORK_SCALE.activeNowMax, Math.round(n)),
  );
}

export function betaRankPoolSize(leaderboardLen?: number): number {
  const pool = BETA_NETWORK_SCALE.networkForecasterCount;
  if (leaderboardLen && leaderboardLen > 0) {
    return Math.min(
      BETA_NETWORK_SCALE.networkForecasterCountMax,
      Math.max(BETA_NETWORK_SCALE.networkForecasterCountMin, leaderboardLen),
    );
  }
  return pool;
}

/** MRR = (pro × $9) + (premium × $29) */
export function betaSupporterMetrics(slug: string): {
  payingSupporters: number;
  proSupporters: number;
  premiumSupporters: number;
  mrr: number;
} {
  const h = hashSlug(slug);
  if (isCoreAgentSlug(slug)) {
    const payingSupporters =
      BETA_NETWORK_SCALE.coreSupporterMin +
      (h % (BETA_NETWORK_SCALE.coreSupporterMax - BETA_NETWORK_SCALE.coreSupporterMin + 1));
    const premiumSupporters = Math.min(
      payingSupporters,
      Math.max(0, Math.round(payingSupporters * (0.1 + (h % 5) / 50))),
    );
    const proSupporters = payingSupporters - premiumSupporters;
    const mrr =
      proSupporters * PLAN_PRICES.pro + premiumSupporters * PLAN_PRICES.premium;
    const clampedMrr = Math.max(
      BETA_NETWORK_SCALE.coreMrrMin,
      Math.min(BETA_NETWORK_SCALE.coreMrrMax, mrr),
    );
    return { payingSupporters, proSupporters, premiumSupporters, mrr: clampedMrr };
  }

  const payingSupporters = h % (BETA_NETWORK_SCALE.creatorSupporterMax + 1);
  const premiumSupporters =
    payingSupporters > 0 ? Math.min(1, payingSupporters > 1 ? 1 : payingSupporters) : 0;
  const proSupporters = payingSupporters - premiumSupporters;
  const mrr = Math.min(
    BETA_NETWORK_SCALE.creatorMrrMax,
    proSupporters * PLAN_PRICES.pro + premiumSupporters * PLAN_PRICES.premium,
  );
  return { payingSupporters, proSupporters, premiumSupporters, mrr };
}

/** Rank estimate for beta credibility scores (roughly 1–73). */
export function betaEstimateRankFromScore(score: number, pool = betaRankPoolSize()): number {
  if (score >= 115) return 1 + ((130 - score) % 5);
  if (score >= 95) return 4 + ((115 - score) % 8);
  if (score >= 70) return 12 + ((95 - score) % 14);
  if (score >= 40) return 28 + ((70 - score) % 20);
  return Math.min(pool, 48 + ((50 - score) % 25));
}
