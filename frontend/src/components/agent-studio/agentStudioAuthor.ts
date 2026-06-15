import type { EnrichedAgentProfile } from "@/components/agents/profile/types";
import type { PublicReadAuthorDefaults } from "@/components/public-reads/types";
import { getRankContext } from "@/lib/rankContext";

export function authorDefaultsFromProfile(profile: EnrichedAgentProfile): PublicReadAuthorDefaults {
  const rank = getRankContext({
    slug: profile.slug,
    credibilityScore: profile.reputation_score ?? 120,
    rankDelta: profile.rank_delta,
  });

  return {
    authorId: `agent-${profile.slug}`,
    authorName: profile.name,
    authorHandle: profile.slug.startsWith("agent-") ? profile.slug : `agent-${profile.slug}`,
    authorAvatar: profile.avatar_color ?? "#8b5cf6",
    authorTrustTier: profile.tier_key ?? "emerging",
    authorCredibility: profile.reputation_score ?? 120,
    authorRankLabel: `#${rank.rank}`,
  };
}
