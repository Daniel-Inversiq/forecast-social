import type { TrustTierKey } from "@/lib/trust";

export type PublicReadCategory =
  | "Macro"
  | "AI"
  | "Crypto"
  | "Politics"
  | "Sports"
  | "Markets"
  | "Climate"
  | "Culture";

export type PublicReadSide = "YES" | "NO";

export type PublicReadStatus =
  | "open"
  | "challenged"
  | "backed"
  | "resolving"
  | "resolved";

/** Internal analytics only — never shown on public read surfaces. */
export type ReadOrigin = "creator" | "ai" | "ai_approved";

/** Internal analytics — how the thesis was produced. Never shown publicly. */
export type ReasoningSource = "creator_written" | "ai_generated" | "ai_creator_edited";

export type StudioReadsPerformanceFilter =
  | "all"
  | "creator_written"
  | "ai_generated"
  | "ai_approved";

export type AgentReadPosition = {
  side: PublicReadSide;
  convictionPercent: number;
  sizeLabel?: string;
  marketLabel?: string;
  position_size_usd?: number;
  position_size?: number;
  currency?: string;
  market_id?: string;
  mode?: "paper" | "live";
};

export type StudioReadLifecycleStage =
  | "draft"
  | "published"
  | "backing"
  | "resolution"
  | "receipt"
  | "archived";

export type PublicRead = {
  id: string;
  authorId: string;
  authorName: string;
  authorHandle: string;
  authorAvatar?: string;
  authorTrustTier: TrustTierKey | string;
  authorCredibility: number;
  authorRankLabel?: string;

  title: string;
  marketOrNarrative: string;
  side: PublicReadSide;
  probability: number;

  thesis: string;
  category: PublicReadCategory;

  status: PublicReadStatus;

  createdAt: string;
  resolvesAt?: string;

  consensusAtPost: number;
  currentConsensus: number;

  backersCount: number;
  challengersCount: number;
  publicReadsCount: number;

  credibilityAtStake?: number;
  potentialCredibilityDelta?: number;

  tags: string[];

  /** When resolved, link to receipt proof */
  receiptId?: string;
  /** Demo: user has backed this read */
  userBacked?: boolean;
  /** Demo: user has challenged this read */
  userChallenged?: boolean;

  /** Gated content — subscribers see full read */
  visibility?: "public" | "subscriber_only";
  requiredPlan?: "pro" | "premium";
  /** Shown when read is locked */
  subscriberTeaser?: string;

  /** Studio-only provenance for content performance analytics */
  origin?: ReadOrigin;
  /** Studio-only — thesis provenance for analytics filters */
  reasoningSource?: ReasoningSource;
  /** Conviction position placed on behalf of the agent */
  agentPosition?: AgentReadPosition;
  /** Published under agent identity (no creator attribution in UI) */
  publishedByAgent?: boolean;
  /** Studio receipt pipeline stage */
  studioLifecycle?: StudioReadLifecycleStage;

  /** Linked belief thesis — builds the idea network */
  beliefSlug?: string;
  beliefTitle?: string;
};

export type StudioReadDraft = {
  id: string;
  agentSlug: string;
  title: string;
  category: PublicReadCategory;
  side: PublicReadSide;
  probability: number;
  thesis: string;
  resolvesAt?: string;
  tags: string[];
  marketOrNarrative?: string;
  reasoningSource?: ReasoningSource;
  position?: AgentReadPosition;
  updatedAt: string;
  createdAt: string;
};

export type StudioAiQueueItem = {
  id: string;
  agentSlug: string;
  title: string;
  category: PublicReadCategory;
  side: PublicReadSide;
  probability: number;
  thesis: string;
  resolvesAt?: string;
  tags: string[];
  marketOrNarrative?: string;
  reasoningSource?: ReasoningSource;
  position?: AgentReadPosition;
  generatedAt: string;
  status: "pending" | "rejected";
};

export type PostAsAgentPayload = {
  title: string;
  category: PublicReadCategory;
  side: PublicReadSide;
  probability: number;
  thesis: string;
  resolvesAt?: string;
  tags: string[];
  marketOrNarrative: string;
  reasoningSource?: ReasoningSource;
  position?: AgentReadPosition;
  author: PublicReadAuthorDefaults;
  beliefSlug?: string;
  beliefTitle?: string;
};

export type StudioReadsTabKey =
  | "published"
  | "drafts"
  | "ai_queue"
  | "resolved"
  | "receipts";

export type PublicReadTabKey =
  | "for_you"
  | "following"
  | "rising"
  | "challenged"
  | "near_resolution"
  | "new";

export type PublicReadCategoryFilter = "all" | PublicReadCategory;

export type PublicReadTrustFilter =
  | "all"
  | "observer"
  | "emerging"
  | "trusted"
  | "ranked"
  | "elite";

export type PublicReadResolutionFilter =
  | "all"
  | "7d"
  | "30d"
  | "90d";

export type PublicReadConsensusFilter =
  | "all"
  | "moving_up"
  | "moving_down"
  | "large_move";

export type BackPublicReadPayload = {
  readId: string;
  probability: number;
  thesis?: string;
};

export type ChallengePublicReadPayload = {
  readId: string;
  probability: number;
  counterThesis: string;
  side: PublicReadSide;
};

export type PublicReadAuthorDefaults = {
  authorId: string;
  authorName: string;
  authorHandle: string;
  authorAvatar?: string;
  authorTrustTier?: string;
  authorCredibility?: number;
  authorRankLabel?: string;
};

export type CreatePublicReadPayload = {
  title: string;
  category: PublicReadCategory;
  side: PublicReadSide;
  probability: number;
  thesis: string;
  resolvesAt?: string;
  tags: string[];
  marketOrNarrative?: string;
  author?: PublicReadAuthorDefaults;
  beliefSlug?: string;
  beliefTitle?: string;
};

export type ProfilePublicReadMetrics = {
  posted: number;
  backed: number;
  challenges: number;
  resolved: number;
};
