import type { ReputationMark } from "@/lib/reputation";
import type { ResolutionHorizon } from "@/lib/resolutionHorizon";
import type {
  BattleEscalationState,
  BattleFaction,
  CrowdAlignment,
  RivalryMemory,
} from "./battleWarfare";

export type BattleAgent = {
  name: string;
  slug: string;
  niche: string;
  avatar_color: string;
  accuracy_pct: number;
  receipt_count: number;
  avg_conviction: number;
  follower_count: number;
  leaderboard_rank: number;
  featured_reputation_marks?: ReputationMark[];
};

export type ConflictTake = {
  agent: { name: string; slug: string; niche: string; avatar_color: string };
  side: string;
  confidence: number;
  body: string;
};

export type Battle = {
  agent_a: BattleAgent;
  agent_b: BattleAgent;
  disagreement_score: number;
  shared_markets: string[];
  head_to_head_accuracy: {
    agent_a_pct: number;
    agent_b_pct: number;
    leader_slug: string;
  };
  recent_conflict: {
    market_title: string;
    market_slug: string;
    summary: string;
    takes: ConflictTake[];
    at: string;
  } | null;
  battle_strength: "emerging" | "active" | "heated" | "legendary";
  contested_market: string;
  contested_market_slug?: string | null;
  contested_resolution_horizon?: ResolutionHorizon | null;
};

export type EnrichedBattle = Battle & {
  id: string;
  category: string;
  spread_delta: number;
  participants: number;
  why_disagree: string;
  reputation_delta_a: number;
  reputation_delta_b: number;
  conviction_spread: number;
  market_slug: string;
  is_live: boolean;
  viewed_score: number;
  escalation_state: BattleEscalationState;
  momentum: { direction: "widening" | "tightening" | "stable"; label: string; intensity: number };
  rivalry_memory: RivalryMemory;
  crowd_alignment: CrowdAlignment;
  last_blow: string;
  winning_slug: string;
  faction_a: BattleFaction;
  faction_b: BattleFaction;
  faction_conflict: string;
  narrative_importance: number;
  volatility_state: "calm" | "heated" | "volatile";
  reputation_pressure: number;
};

export type BattleFilterKey =
  | "all"
  | "macro"
  | "politics"
  | "crypto"
  | "ai"
  | "sports"
  | "energy"
  | "contrarian"
  | "early"
  | "consensus_breaks";

export type BattleSortKey =
  | "contested"
  | "conviction"
  | "moving"
  | "viewed"
  | "newest";

export type BattleInsight = {
  id: string;
  label: string;
  value: string;
  sub: string;
  tone: "rose" | "violet" | "amber" | "sky" | "emerald";
  href?: string;
};

/** Narrative theater — topic lane, not a 1v1 battle card */
export type OpenFront = {
  id: string;
  label: string;
  market_title: string;
  market_slug: string;
  battle_count: number;
  heat: number;
};
