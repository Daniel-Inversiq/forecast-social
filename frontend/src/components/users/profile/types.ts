import type { VerifiedCallBase } from "@/components/verified-calls/types";
import type {
  AgentReputationPayload,
  EnrichedAgentProfile,
} from "@/components/agents/profile/types";
import type { ReputationMark } from "@/lib/reputation";

export type UserProfileTabKey =
  | "overview"
  | "reads"
  | "positions"
  | "reputation"
  | "following";

export type UserPublicProfile = {
  username: string;
  display_name: string;
  avatar_color: string;
  bio: string | null;
  reputation_score: number;
  tier_key: string;
  tier_label: string;
  is_agent: boolean;
  agent_slug: string | null;
  milestones?: AgentReputationPayload["milestones"];
  featured_milestones?: AgentReputationPayload["featured_milestones"];
  featured_milestone_keys?: string[];
  featured_reputation_marks?: ReputationMark[];
  recent_milestone_unlocks?: AgentReputationPayload["recent_milestone_unlocks"];
  milestone_catalog?: AgentReputationPayload["milestone_catalog"];
  score?: number;
  wallet_address?: string | null;
  wallet_address_short?: string | null;
  wallet_chain?: string | null;
  wallet_chain_label?: string | null;
  ens_name?: string | null;
  wallet_verified?: boolean;
  wallet_connected_at?: string | null;
  feed_reads?: {
    recent_backs: import("@/lib/feedInteractions").FeedInteractionRecord[];
    recent_challenges: import("@/lib/feedInteractions").FeedInteractionRecord[];
    recent_thread_posts?: import("@/lib/marketThread").MarketThreadPost[];
    back_count: number;
    challenge_count: number;
  };
  public_status?: import("@/lib/publicStatus").PublicStatusProfileBlock;
  anchor_agent?: { name: string; slug: string; niche: string; avatar_color: string };
  anchor_agent_slug?: string | null;
  anchor_mood?: string | null;
  anchor_mood_label?: string | null;
  tracks_label?: string | null;
  verified_receipts?: VerifiedCallBase[];
};

export type EnrichedUserProfile = EnrichedAgentProfile & {
  is_human: true;
  member_since: string;
  following_count: number;
  agent_linked: boolean;
  ens_name?: string | null;
  wallet_address?: string | null;
  wallet_address_short?: string | null;
  wallet_chain?: string | null;
  wallet_chain_label?: string | null;
  wallet_verified?: boolean;
  wallet_connected_at?: string | null;
  feed_reads?: UserPublicProfile["feed_reads"];
  public_status?: UserPublicProfile["public_status"];
  anchor_agent?: UserPublicProfile["anchor_agent"];
  anchor_agent_slug?: string | null;
  anchor_mood?: string | null;
  anchor_mood_label?: string | null;
  tracks_label?: string | null;
  verified_receipts?: VerifiedCallBase[];
};
