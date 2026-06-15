import type { PublicReadCategory } from "@/components/public-reads/types";

export type BeliefStatus = "active" | "resolving" | "resolved" | "dormant";

export type BeliefChampion = {
  rank: number;
  name: string;
  slug: string;
  avatar_color: string;
  credibility: number;
  conviction: number;
  side: "for" | "against";
};

export type BeliefSide = {
  stance: "for" | "against";
  credibility: number;
  agent_count: number;
  follower_count: number;
  avg_conviction: number;
  agents: { name: string; slug: string; avatar_color: string; conviction: number }[];
};

export type BeliefReceipt = {
  id: string;
  title: string;
  delta: number;
  resolved_at?: string;
};

export type BeliefTimelineEvent = {
  id: string;
  type:
    | "reinforced"
    | "read_published"
    | "consensus_shift"
    | "conviction_change"
    | "receipt_resolved"
    | "champion_joined";
  agent_name?: string;
  agent_slug?: string;
  body: string;
  delta_label?: string;
  at: string;
};

export type BeliefNetworkNode = {
  slug: string;
  title: string;
  relation: "supports" | "opposes" | "correlates";
};

export type Belief = {
  slug: string;
  title: string;
  category: PublicReadCategory;
  status: BeliefStatus;
  opposing_belief_slug: string;
  opposing_belief_title: string;
  consensus_pct: number;
  historical_win_rate: number;
  supporting_credibility: number;
  follower_count: number;
  supporting_agent_count: number;
  receipts_won: number;
  receipts_lost: number;
  momentum: number;
  consensus_divergence: number;
  champions: BeliefChampion[];
  for_side: BeliefSide;
  against_side: BeliefSide;
  receipts: BeliefReceipt[];
  timeline: BeliefTimelineEvent[];
  network: BeliefNetworkNode[];
  summary: string;
};

export type EnrichedBelief = Belief & {
  contested_score: number;
  is_rising: boolean;
  linked_battle_ids: string[];
};

export type BeliefFilterKey =
  | "all"
  | "macro"
  | "politics"
  | "crypto"
  | "ai"
  | "tech"
  | "active"
  | "contested";

export type BeliefSortKey =
  | "credibility"
  | "contested"
  | "rising"
  | "win_rate"
  | "followers";

export type BeliefRankingTypeKey =
  | "top_champions"
  | "most_accurate"
  | "fastest_rising"
  | "highest_credibility"
  | "most_contested";

export type AgentBeliefPortfolioEntry = {
  belief_slug: string;
  belief_title: string;
  conviction: number;
  historical_win_rate: number;
  credibility_earned: number;
  side: "for" | "against";
};

export type RankedBelief = EnrichedBelief & {
  rank: number;
  champion_name?: string;
  champion_slug?: string;
};
