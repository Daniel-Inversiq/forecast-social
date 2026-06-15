import type { EnrichedAgent, ForecasterBase } from "@/components/agents/types";

export type AgentBrief = {
  name: string;
  slug: string;
  niche: string;
  avatar_color: string;
};

export type LeaderboardsData = {
  top_accuracy: {
    rank: number;
    agent: AgentBrief;
    accuracy_pct: number;
    streak: number;
  }[];
  fastest_rising: {
    rank: number;
    rank_movement: number;
    agent: AgentBrief;
    recent_momentum: string;
    conviction_trend: string;
  }[];
  most_followed: {
    rank: number;
    agent: AgentBrief;
    follower_count: number;
    niche: string;
  }[];
  highest_conviction: {
    rank: number;
    agent: AgentBrief;
    avg_confidence: number;
  }[];
  best_recent_calls: {
    agent: AgentBrief;
    market_title: string;
    market_slug: string;
    title: string;
    body: string;
    probability: number;
    confidence: number | null;
    timing: string;
    result: string;
  }[];
  hottest_battle_agents: {
    agent: AgentBrief;
    battle_score: number;
    contested_markets: string[];
    conflict_level: string;
  }[];
};

export type MomentumState =
  | "rising"
  | "cooling"
  | "stable"
  | "hot_streak"
  | "fading";

export type RankedAgent = EnrichedAgent & {
  rank: number;
  momentum_state: MomentumState;
  reputation_delta?: number;
  resolved_calls: number;
  verified_calls: number;
  conviction_profile: string;
  narrative_specialization: string;
  battle_win_rate: number;
  tracking_count: number;
  avg_conviction: number;
  contrarian_wins: number;
  tier_key?: string;
  tier_label?: string;
  velocity?: number;
  timing_quality?: number;
  calibration_score?: number;
  milestones_count?: number;
  top_milestone?: string | null;
  featured_milestones?: string[];
  featured_reputation_marks?: import("@/lib/reputation").ReputationMark[];
  featured_milestone_keys?: string[];
  consensus_breaks?: number;
};

export type LeaderboardFilterKey =
  | "overall"
  | "macro"
  | "politics"
  | "crypto"
  | "ai"
  | "sports"
  | "climate"
  | "contrarian"
  | "early"
  | "verified";

export type LeaderboardSortKey =
  | "reputation"
  | "accuracy"
  | "early"
  | "verified"
  | "momentum"
  | "conviction"
  | "contrarian";

/** Public scoreboard ranking surfaces — each tab re-sorts the forecaster ladder. */
export type RankingTypeKey =
  | "top_credibility"
  | "fastest_rising"
  | "best_early_signals"
  | "best_calibration"
  | "best_battle_record"
  | "top_macro"
  | "top_ai"
  | "top_politics";

/** @deprecated Use RankingTypeKey */
export type LeaderboardDimensionKey = RankingTypeKey;

/** Public scoreboard time scope — calendar-friendly labels, not rolling day counts. */
export type RankingPeriodKey = "all" | "month" | "week" | "24h";

export const RANKING_PERIODS: { key: RankingPeriodKey; label: string }[] = [
  { key: "all", label: "All Time" },
  { key: "month", label: "This Month" },
  { key: "week", label: "This Week" },
  { key: "24h", label: "24 Hours" },
];

export function rankingPeriodScopeLabel(period: RankingPeriodKey): string {
  switch (period) {
    case "24h":
      return "Last 24 hours";
    case "week":
      return "This week";
    case "month":
      return "This month";
    default:
      return "All time";
  }
}

export type RankingCategoryKey =
  | "all"
  | "macro"
  | "politics"
  | "crypto"
  | "ai"
  | "tech"
  | "sports"
  | "climate";

export type RankingTrustTierKey =
  | "all"
  | "observer"
  | "emerging"
  | "trusted"
  | "ranked"
  | "elite"
  | "verified";

export type StatusLabel =
  | "RISING"
  | "COOLING"
  | "DOMINANT"
  | "FRAGMENTING"
  | "VERIFIED"
  | "CONTRARIAN"
  | "CONSENSUS LED"
  | "NETWORK MOVER"
  | "ISOLATED";

export type PrestigeTier =
  | "Emerging"
  | "Trusted"
  | "Established"
  | "High Signal"
  | "Network Mover"
  | "Elite"
  | "Legendary";

export type MovementEvent = {
  id: string;
  agentName: string;
  agentSlug: string;
  avatarColor: string;
  headline: string;
  why: string;
  metric: string;
  direction: "up" | "down" | "volatile";
};

export type NarrativeTerritory = {
  id: string;
  narrative: string;
  owner: string;
  ownerSlug: string;
  dominance: number;
  challengers: string[];
  tone: "violet" | "amber" | "emerald" | "rose" | "sky";
};

export type CoalitionCluster = {
  id: string;
  name: string;
  narrative: string;
  direction: "rising" | "fragmenting" | "cooling";
  alignment: number;
  members: string[];
  insight: string;
};

export type FallenGiant = {
  agentName: string;
  agentSlug: string;
  avatarColor: string;
  drawdown: string;
  cause: string;
  lostNarrative?: string;
};

export type MigrationSector = {
  id: string;
  label: string;
  flow: "inflow" | "outflow" | "volatile";
  magnitude: number;
  narrative: string;
};

export type SeasonalLeader = {
  season: string;
  seasonSlug: string;
  leader: string;
  leaderSlug: string;
  narrative: string;
  dominance: string;
};

export type { ForecasterBase };
