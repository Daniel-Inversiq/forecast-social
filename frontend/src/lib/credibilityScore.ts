/** Primary public reputation metric — earned through resolved forecasts. */

import type { EnrichedAgentProfile } from "@/components/agents/profile/types";
import type { ScryReceipt } from "@/components/users/profile/reputation/types";
import { toUserProfileShape } from "@/components/compare/compareStats";
import { getProfileScryReceipts } from "@/components/users/profile/reputation/receiptData";
import { getResolvedReceipts, resolveCurrentCredibility, sumLifetimeCredibilityEarned } from "@/lib/credibility";
import {
  isInCredibilityOnboarding,
  resolveCredibilityOnboarding,
  type CredibilityOnboardingState,
} from "@/lib/credibilityOnboarding";

export type CredibilityTrend = "up" | "down" | "flat";

export type CredibilityScoreData = {
  score: number;
  percentileLabel: string;
  trend: CredibilityTrend;
  change30d: number;
  /** Sum of positive receipt deltas — shown separately from current when present */
  lifetimeEarned?: number | null;
  /** Shown instead of a bare "0" for new agents building their track record */
  onboarding?: CredibilityOnboardingState;
};

export type { CredibilityOnboardingState } from "@/lib/credibilityOnboarding";
export {
  FORECASTS_FOR_FIRST_CREDIBILITY,
  credibilityDisplayLabel,
  isInCredibilityOnboarding,
  resolveCredibilityOnboarding,
} from "@/lib/credibilityOnboarding";

function hash(s: string) {
  return s.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
}

function normalizeTrend(
  trend?: string | null,
): CredibilityTrend {
  if (trend === "up" || trend === "rising") return "up";
  if (trend === "down" || trend === "cooling") return "down";
  return "flat";
}

export function credibilityPercentileLabel(input: {
  slug: string;
  niche?: string;
  categoryTags?: string[];
  specialtyLabel?: string;
}): string {
  const h = hash(input.slug);
  const topPct = 5 + (h % 28);
  const niche =
    input.niche?.toLowerCase() ??
    input.specialtyLabel?.toLowerCase() ??
    "";
  const tags = (input.categoryTags ?? []).join(" ").toLowerCase();
  const macro =
    /macro|fed|rates|policy|inflation/i.test(niche) ||
    /macro|fed/i.test(tags);
  const crypto = /crypto|btc|eth/i.test(niche) || /crypto/i.test(tags);
  const politics = /politic|election/i.test(niche) || /politic/i.test(tags);

  if (macro && h % 4 !== 0) return `Top ${topPct}% of macro forecasters`;
  if (crypto && h % 5 === 0) return `Top ${topPct}% of crypto forecasters`;
  if (politics && h % 5 === 1) return `Top ${topPct}% of politics forecasters`;
  return `Top ${topPct}% of forecasters`;
}

export function credibilityChange30d(input: {
  slug: string;
  rankDelta?: number;
  reputationDelta?: number | null;
}): number {
  if (input.reputationDelta != null && input.reputationDelta !== 0) {
    return Math.round(input.reputationDelta * 2.2);
  }
  if (input.rankDelta != null && input.rankDelta !== 0) {
    return input.rankDelta * 3;
  }
  const h = hash(input.slug);
  return (h % 9) - 3;
}

export function buildCredibilityScore(input: {
  slug: string;
  score: number;
  niche?: string;
  categoryTags?: string[];
  specialtyLabel?: string;
  trend?: string | null;
  rankDelta?: number;
  reputationDelta?: number | null;
  lifetimeEarned?: number | null;
  resolvedCalls?: number;
  verifiedCalls?: number;
  publishedReads?: number;
  hasPublishedTake?: boolean;
}): CredibilityScoreData {
  const score = Math.round(input.score);
  const onboarding = resolveCredibilityOnboarding({
    slug: input.slug,
    score,
    resolvedCalls: input.resolvedCalls,
    verifiedCalls: input.verifiedCalls,
    publishedReads: input.publishedReads,
    hasPublishedTake: input.hasPublishedTake,
  });
  const lifetimeEarned =
    input.lifetimeEarned != null && input.lifetimeEarned > score
      ? input.lifetimeEarned
      : null;
  return {
    score,
    onboarding: onboarding ?? undefined,
    lifetimeEarned: onboarding ? null : lifetimeEarned,
    percentileLabel: onboarding
      ? onboarding.subline
      : credibilityPercentileLabel({
          slug: input.slug,
          niche: input.niche,
          categoryTags: input.categoryTags,
          specialtyLabel: input.specialtyLabel,
        }),
    trend: onboarding ? "flat" : normalizeTrend(input.trend),
    change30d: onboarding
      ? 0
      : credibilityChange30d({
          slug: input.slug,
          rankDelta: input.rankDelta,
          reputationDelta: input.reputationDelta,
        }),
  };
}

export function buildCredibilityFromAgent(agent: {
  slug: string;
  niche?: string;
  reputation_score?: number;
  accuracy_score?: number;
  trend?: string;
  rank_delta?: number;
  reputation_delta?: number;
  tier_key?: string;
  verified_calls?: number;
  receipts_count?: number;
}): CredibilityScoreData {
  const score =
    agent.reputation_score != null
      ? agent.reputation_score
      : Math.round((agent.accuracy_score ?? 50) * 0.65);
  return buildCredibilityScore({
    slug: agent.slug,
    score,
    niche: agent.niche,
    trend: agent.trend,
    rankDelta: agent.rank_delta,
    reputationDelta: agent.reputation_delta,
    verifiedCalls: agent.verified_calls,
    resolvedCalls: agent.receipts_count,
  });
}

export function buildCredibilityFromProfile(
  profile: {
    slug: string;
    niche?: string;
    reputation_score: number;
    trend?: string;
    rank_delta?: number;
    reputation_delta_live?: number | null;
    specialty_label?: string;
    category_tags?: string[];
    verified_calls?: number;
    resolved_calls?: number;
  },
  receipts?: ScryReceipt[],
): CredibilityScoreData {
  const resolved = receipts ? getResolvedReceipts(receipts).length : 0;
  const score = receipts?.length
    ? resolveCurrentCredibility(receipts, profile.reputation_score)
    : profile.reputation_score;
  const lifetimeEarned =
    receipts?.length && !isInCredibilityOnboarding(score)
      ? sumLifetimeCredibilityEarned(receipts)
      : null;
  return buildCredibilityScore({
    slug: profile.slug,
    score,
    niche: profile.niche,
    categoryTags: profile.category_tags,
    specialtyLabel: profile.specialty_label,
    trend: profile.trend,
    rankDelta: profile.rank_delta,
    reputationDelta: profile.reputation_delta_live,
    lifetimeEarned,
    resolvedCalls: resolved || profile.resolved_calls,
    verifiedCalls: profile.verified_calls,
    hasPublishedTake: (receipts?.length ?? 0) > 0,
  });
}

export function buildCredibilityFromFeedEvent(event: {
  agent: { slug: string; niche?: string; reputation_score?: number };
  reputation_score?: number;
  reputation_delta?: number | null;
}): CredibilityScoreData {
  const score = event.reputation_score ?? event.agent.reputation_score ?? 48;
  return buildCredibilityScore({
    slug: event.agent.slug,
    score,
    niche: event.agent.niche,
    reputationDelta: event.reputation_delta,
  });
}

export function buildCredibilityFromRankedAgent(
  agent: {
    slug: string;
    niche: string;
    reputation_score: number;
    trend?: string;
    rank_delta?: number;
    reputation_delta?: number;
    velocity?: number;
    follower_count?: number;
  },
  enrichedProfile?: EnrichedAgentProfile | null,
): CredibilityScoreData {
  const receipts = getProfileScryReceipts(
    toUserProfileShape((enrichedProfile ?? agent) as EnrichedAgentProfile),
    null,
  );
  const hasLedger = getResolvedReceipts(receipts).length > 0;
  const score = hasLedger
    ? resolveCurrentCredibility(receipts, agent.reputation_score)
    : agent.reputation_score;
  const lifetimeEarned = hasLedger ? sumLifetimeCredibilityEarned(receipts) : null;
  return buildCredibilityScore({
    slug: agent.slug,
    score,
    niche: agent.niche,
    trend: agent.trend,
    rankDelta: agent.rank_delta,
    reputationDelta: agent.reputation_delta ?? agent.velocity,
    lifetimeEarned,
  });
}

export function buildCredibilityFromBattleAgent(agent: {
  slug: string;
  niche: string;
  accuracy_pct: number;
  receipt_count: number;
}): CredibilityScoreData {
  const score = Math.round(agent.accuracy_pct * 0.55 + agent.receipt_count * 1.8 + 12);
  return buildCredibilityScore({
    slug: agent.slug,
    score,
    niche: agent.niche,
  });
}
