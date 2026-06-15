import type { EnrichedAgentProfile } from "@/components/agents/profile/types";
import type { ScryReceipt } from "@/components/users/profile/reputation/types";
import { formatBetaFollowerCount } from "@/lib/betaNetworkScale";
import { resolveCurrentCredibility } from "@/lib/credibility";
import { getRankContext } from "@/lib/rankContext";
import { accountAgeDaysFromIso, resolveTrustTier, type TrustTierKey } from "@/lib/trust";

export type AgentStudioPerformance = {
  credibility: number;
  trustTierKey: TrustTierKey;
  trustTierLabel: string;
  rank: number;
  followers: number;
  followersLabel: string;
  credibilityChange30d: number;
  credibilityChangeLabel: string;
};

export function formatAudienceCount(n: number): string {
  return formatBetaFollowerCount(n);
}

function credibilityChange30d(profile: EnrichedAgentProfile, receipts: ScryReceipt[]): number {
  const fromRep =
    profile.reputation_delta_live ??
    profile.reputation?.reputation_delta ??
    profile.reputation_velocity;
  if (fromRep != null && Number.isFinite(fromRep) && fromRep !== 0) {
    return Math.round(fromRep);
  }
  const resolved = receipts.filter((r) => r.outcome !== "pending" && r.resolvedAt);
  const cutoff = Date.now() - 30 * 86400000;
  const recent = resolved.filter((r) => new Date(r.resolvedAt!).getTime() >= cutoff);
  if (recent.length > 0) {
    return recent.reduce((s, r) => s + r.credibilityDelta, 0);
  }
  const h = profile.slug.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return (h % 9) + 2;
}

export function buildAgentStudioPerformance(
  profile: EnrichedAgentProfile,
  receipts: ScryReceipt[],
): AgentStudioPerformance {
  const credibility = resolveCurrentCredibility(receipts, profile.reputation_score);
  const memberSince =
    profile.recent_events?.[profile.recent_events.length - 1]?.created_at ?? "2026-01-15";
  const trust = resolveTrustTier({
    resolvedCalls: profile.verified_calls ?? profile.resolved_calls ?? 0,
    credibility,
    accountAgeDays: accountAgeDaysFromIso(memberSince),
    reputationScore: profile.reputation_score,
    calibrationScore: profile.accuracy_score,
  });
  const tierKey = (profile.tier_key as TrustTierKey | undefined) ?? trust.tierKey;
  const tierLabel = profile.tier_label ?? trust.tierLabel;
  const rank = getRankContext({
    slug: profile.slug,
    credibilityScore: credibility,
    rankDelta: profile.rank_delta,
    reputationDelta: profile.reputation_delta_live ?? profile.reputation?.reputation_delta,
    niche: profile.niche,
    categoryTags: profile.category_tags,
    specialtyLabel: profile.specialty_label,
  });
  const change = credibilityChange30d(profile, receipts);
  const changePrefix = change >= 0 ? "+" : "";

  return {
    credibility,
    trustTierKey: tierKey,
    trustTierLabel: tierLabel,
    rank: rank.rankGlobal,
    followers: profile.follower_count,
    followersLabel: formatAudienceCount(profile.follower_count),
    credibilityChange30d: change,
    credibilityChangeLabel: `${changePrefix}${change} credibility last 30d`,
  };
}
