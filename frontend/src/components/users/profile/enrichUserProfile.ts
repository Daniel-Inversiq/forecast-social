import type { AgentProfile, AgentReputationPayload } from "@/components/agents/profile/types";
import { enrichAgentProfile } from "@/components/agents/profile/profileEnrichment";
import { mergeAgentProfileWithReputation } from "@/components/agents/profile/mergeReputation";
import type { AuthUser } from "@/lib/auth";
import type { UserSettings } from "@/lib/settings/types";
import type { PositionsPayload } from "@/components/positions/types";
import type { ReputationDetail } from "@/lib/reputation";
import type { EnrichedUserProfile, UserPublicProfile } from "./types";

function hash(s: string) {
  return s.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
}

function publicProfileToReputation(pub: UserPublicProfile): AgentReputationPayload {
  return {
    score: pub.reputation_score,
    tier_key: pub.tier_key,
    tier_label: pub.tier_label,
    velocity: 2 + (hash(pub.username) % 7),
    trend: "stable",
    reputation_delta: 0,
    components: {},
    timing_quality: 58 + (hash(pub.username) % 28),
    calibration_score: pub.reputation_score * 0.85,
    battle_win_rate: 50 + (hash(pub.username) % 35),
    battle_streak: 0,
    verified_calls: pub.milestones?.length ?? 0,
    consensus_breaks: 2 + (hash(pub.username) % 6),
    sparkline: [],
    milestones: pub.milestones ?? [],
    featured_milestones: pub.featured_milestones,
    featured_milestone_keys: pub.featured_milestone_keys,
    featured_reputation_marks: pub.featured_reputation_marks,
    recent_milestone_unlocks: pub.recent_milestone_unlocks,
    milestone_catalog: pub.milestone_catalog,
    calibration_buckets: [],
    recent_events: [],
    weights: {},
  };
}

function positionsToTopMarkets(positions: PositionsPayload | null) {
  if (!positions?.active_positions.length) return [];
  return positions.active_positions.slice(0, 4).map((p, i) => ({
    title: p.market_title,
    probability: Math.round(p.current_probability),
    category: i % 2 === 0 ? "Macro" : "Markets",
    strength: 72 + (hash(p.market_title) % 22),
  }));
}

function positionsToReceipts(positions: PositionsPayload | null) {
  if (!positions?.resolved_positions.length) return [];
  return positions.resolved_positions.slice(0, 6).map((p) => ({
    title: p.market_title,
    market_title: p.market_title,
    probability: Math.round(p.probability_at_entry),
    timing: "Resolved",
    result: p.result === "correct" ? "Verified" : "Miss",
    resolved_probability: p.result === "correct" ? 100 : 0,
    conviction_score: Math.round(p.amount),
    strength: p.result === "correct" ? ("strong" as const) : ("disputed" as const),
  }));
}

function userVerifiedReceiptsFromPositions(
  positions: PositionsPayload | null,
  username: string,
  avatarColor: string,
) {
  if (!positions?.resolved_positions.length) return [];
  return positions.resolved_positions
    .filter((p) => p.result === "correct")
    .slice(0, 8)
    .map((p) => ({
      id: `receipt-position-${p.id}`,
      agent_name: username,
      agent_slug: username,
      avatar_color: avatarColor,
      market_title: p.market_title,
      market_slug: p.market_title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
      side: p.side,
      confidence: Math.min(95, 68 + p.amount / 5),
      original_take: `Conviction ${p.side} — $${Math.round(p.amount)} allocated before resolution.`,
      original_probability: p.probability_at_entry,
      final_outcome: p.side,
      days_early: Math.max(1, 3 + (hash(p.market_title) % 14)),
      created_at: p.created_at,
      receipt_strength: p.amount >= 50 ? ("legendary" as const) : ("strong" as const),
      subject_type: "user" as const,
      conviction_payout: p.amount * 2,
    }));
}

function buildBaseAgentProfile(
  user: AuthUser,
  settings: UserSettings | null,
  positions: PositionsPayload | null,
  publicProfile: UserPublicProfile | null,
  agentBase: AgentProfile | null,
): AgentProfile {
  if (agentBase) return agentBase;

  const h = hash(user.username);
  const tags = settings?.profile.categoryTags ?? [];
  const niche =
    tags[0] ??
    (settings?.identity.forecastingStyle?.includes("Macro")
      ? "Macro & policy"
      : "Cross-market");

  const rep = publicProfile ? publicProfileToReputation(publicProfile) : undefined;

  return {
    name: settings?.profile.displayName ?? user.username,
    slug: user.username,
    niche,
    conviction_style:
      settings?.identity.convictionType ?? settings?.profile.archetypeLabel ?? "Measured conviction",
    personality_tagline:
      settings?.profile.identityLine ?? user.bio ?? "Public forecasting identity on Scry",
    avatar_color: user.avatar_color ?? publicProfile?.avatar_color ?? "#7c3aed",
    accuracy_score: positions?.stats.accuracy ?? 68 + (h % 18),
    streak: Math.min(12, Math.floor((positions?.stats.resolved_count ?? 0) / 3)),
    follower_count: 24 + (h % 180),
    resolved_calls: positions?.stats.resolved_count ?? 0,
    recent_events: (positions?.timeline ?? []).slice(0, 5).map((t) => ({
      type: t.kind,
      title: t.market_title,
      body: t.note || `${t.side} · €${t.amount}`,
      probability: null,
      confidence: null,
      created_at: t.created_at,
      market_title: t.market_title,
    })),
    receipts: positionsToReceipts(positions),
    top_markets: positionsToTopMarkets(positions),
    reputation: rep,
    reputation_score: publicProfile?.reputation_score ?? user.reputation_score,
    tier_key: publicProfile?.tier_key,
    tier_label: publicProfile?.tier_label,
  };
}

export function enrichUserProfile({
  user,
  settings,
  positions,
  publicProfile,
  agentProfile,
  agentReputation,
}: {
  user: AuthUser;
  settings: UserSettings | null;
  positions: PositionsPayload | null;
  publicProfile: UserPublicProfile | null;
  agentProfile: AgentProfile | null;
  agentReputation: ReputationDetail | null;
}): EnrichedUserProfile {
  let base = buildBaseAgentProfile(user, settings, positions, publicProfile, agentProfile);
  if (agentReputation) {
    base = mergeAgentProfileWithReputation(base, agentReputation);
  }

  const enriched = enrichAgentProfile(base);
  const h = hash(user.username);

  if (publicProfile) {
    const mergedRep: AgentReputationPayload = {
      ...(enriched.reputation ?? publicProfileToReputation(publicProfile)),
      milestones:
        enriched.reputation?.milestones?.length
          ? enriched.reputation.milestones
          : (publicProfile.milestones ?? []),
      milestone_catalog:
        enriched.reputation?.milestone_catalog?.length
          ? enriched.reputation.milestone_catalog
          : (publicProfile.milestone_catalog ?? []),
      featured_milestone_keys:
        publicProfile.featured_milestone_keys ??
        enriched.reputation?.featured_milestone_keys ??
        [],
      featured_reputation_marks:
        publicProfile.featured_reputation_marks ??
        enriched.reputation?.featured_reputation_marks ??
        [],
    };
    enriched.reputation = mergedRep;
    enriched.has_live_reputation = Boolean(
      mergedRep.milestones?.length || mergedRep.milestone_catalog?.length,
    );
  }

  if (settings?.profile.identityLine) {
    enriched.identity_line = settings.profile.identityLine;
  }
  if (settings?.profile.categoryTags.length) {
    enriched.category_tags = settings.profile.categoryTags.slice(0, 4);
  }
  if (settings?.profile.archetypeLabel) {
    enriched.conviction_archetype = settings.profile.archetypeLabel;
  }

  return {
    ...enriched,
    is_human: true,
    member_since: user.created_at,
    following_count: 3 + (h % 14),
    agent_linked: Boolean(publicProfile?.agent_slug ?? agentProfile),
    ens_name: publicProfile?.ens_name ?? user.ens_name,
    wallet_address: publicProfile?.wallet_address ?? user.wallet_address,
    wallet_address_short: publicProfile?.wallet_address_short ?? user.wallet_address_short,
    wallet_chain: publicProfile?.wallet_chain ?? user.wallet_chain,
    wallet_chain_label: publicProfile?.wallet_chain_label ?? user.wallet_chain_label,
    wallet_verified: publicProfile?.wallet_verified ?? user.wallet_verified,
    wallet_connected_at: publicProfile?.wallet_connected_at ?? user.wallet_connected_at,
    feed_reads: publicProfile?.feed_reads,
    public_status: publicProfile?.public_status,
    anchor_agent: publicProfile?.anchor_agent,
    anchor_agent_slug: publicProfile?.anchor_agent_slug,
    anchor_mood: publicProfile?.anchor_mood,
    anchor_mood_label: publicProfile?.anchor_mood_label,
    tracks_label: publicProfile?.tracks_label,
    verified_receipts: userVerifiedReceiptsFromPositions(
      positions,
      user.username,
      user.avatar_color ?? publicProfile?.avatar_color ?? "#7c3aed",
    ),
  };
}
