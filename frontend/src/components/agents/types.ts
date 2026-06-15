export type ForecasterBase = {

  name: string;

  slug: string;

  niche: string;

  conviction_style: string;

  streak: number;

  accuracy_score: number;

  follower_count: number;

  personality_tagline: string;

  avatar_color?: string;

  /** Live reputation API overlays */

  reputation_score?: number;

  tier_key?: string;

  tier_label?: string;

  reputation_velocity?: number;

  reputation_trend?: string;

  reputation_delta?: number;

  timing_quality?: number;

  calibration_score?: number;

  battle_win_rate?: number;

  verified_calls?: number;

  consensus_breaks?: number;

  milestones_count?: number;

  top_milestone?: string | null;

  api_rank?: number;

  /** Season 1 lifecycle: active agents participate in feed; dormant are on season break */
  status?: "active" | "dormant";

  status_label?: string;

};



export type AgentPersonality = "contrarian" | "macro" | "chaos" | "analyst" | "hunter" | "default";



export type AgentArchetypeKey =

  | "consensus_breaker"

  | "macro_strategist"

  | "narrative_hunter"

  | "volatility_chaser"

  | "early_signal_scout"

  | "slow_conviction";



export type AgentHeatState =

  | "hot"

  | "rising"

  | "cooling"

  | "cult_forming"

  | "crowded"

  | "undervalued"

  | "consensus_enemy"

  | "breakout"

  | "dormant";



export type EnrichedAgent = ForecasterBase & {

  reputation_score: number;

  trend: "up" | "down" | "flat";

  rank_delta: number;

  personality: AgentPersonality;

  archetype: AgentArchetypeKey;

  strongest_market: string;

  strongest_narrative: string;

  recent_call: string;

  agreement_pct: number;

  disagreement_pct: number;

  receipts_count: number;

  early_on_pct: number;

  tags: string[];

  momentum_glow: number;

  /** Identity lens */

  archetype_label: string;

  core_edge: string;

  signature_thesis: string;

  tone_label: string;

  /** Creator personality (primary card surface) */

  niche_badge: string;

  personality_quote: string;

  recent_take: string;

  /** Network / heat */

  heat_state: AgentHeatState;

  heat_label: string;

  attention_score: number;

  network_status: string;

  current_arc: string;

  /** Lore */

  lore_line: string;

  last_stance_line: string;

  recurring_behavior: string;

  /** Rivalry */

  primary_rival_slug: string | null;

  primary_rival_name: string | null;

  rivalry_spread: number;

  active_clashes: number;

  battle_status: string | null;

  rival_record: string | null;

  /** Follow psychology */

  why_follow: string;

  feed_lens: string;

  follow_hover: string;

  signal_types: string[];

};



export type AgentFilterKey =

  | "all"

  | "rising"

  | "early"

  | "contrarian"

  | "macro"

  | "ai"

  | "politics"

  | "crypto"

  | "sports"

  | "consensus_breakers";



export type AgentSortKey =

  | "reputation"

  | "rising"

  | "accuracy"

  | "streak"

  | "receipts"

  | "early";



export type RivalryHeatEntry = {

  agent_slug: string;

  agent_name: string;

  rival_slug: string;

  rival_name: string;

  spread: number;

  status: string;

  heat: number;

};

