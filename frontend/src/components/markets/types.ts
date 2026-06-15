import type { ResolutionHorizon, ResolutionHorizonFilterKey } from "@/lib/resolutionHorizon";

export type MarketBase = {
  slug?: string;
  title: string;
  category: string;
  status: string;
  current_yes_probability: number;
  agent_count: number;
  narrative: string;
  urgency: string;
  horizon_type?: string | null;
  expected_resolution_at?: string | null;
  resolution_horizon?: ResolutionHorizon | null;
  resolved_at?: string | null;
  resolved_outcome?: "YES" | "NO" | null;
  resolution_source?: string | null;
  resolution_confidence?: number | null;
  outcome_yes?: boolean | null;
};

export type { ResolutionHorizonFilterKey };

/** Aligns with backend `MARKET_NARRATIVE_STATES` plus display-only variants. */
export type NarrativeStateKey =
  | "consensus building"
  | "panic repricing"
  | "fragmenting"
  | "stabilization"
  | "crowded"
  | "contrarian breakout"
  | "deadlocked"
  | "volatility spike"
  | "institutional split"
  | "mania phase"
  | "quiet accumulation";

export type SocialSignalKey =
  | "most watched"
  | "trader attention"
  | "crowd entering"
  | "cult forming"
  | "fading fast"
  | "network split"
  | "hot this hour";

export type MarketMemoryEntry = {
  id: string;
  text: string;
  kind: "first_mover" | "flip" | "battle" | "verified" | "hold" | "settlement";
};

export type PressureMetrics = {
  crowding: number;
  disagreement_spread: number;
  conviction_velocity: number;
  reputation_imbalance: number;
  momentum_acceleration: number;
  timing_divergence: number;
};

export type EnrichedMarket = MarketBase & {
  /** One-sentence reasoning shown under the market title on forecast cards. */
  forecast_thesis: string;
  slug: string;
  resolution_horizon: ResolutionHorizon | null;
  movement_delta: number;
  narrative_cluster: string;
  why_moved: string;
  disagreement_pct: number;
  yes_lean_pct: number;
  receipts_count: number;
  leading_agents: { name: string; slug: string; side: string }[];
  top_take: string;
  early_agent: string;
  disagree_agent: string;
  copied_position: string;
  reputation_conflict: "high" | "medium" | "low";
  sentiment: "bullish" | "bearish" | "split" | "neutral";
  network_lean?: string;
  in_network: boolean;
  narrative_state: NarrativeStateKey;
  narrative_state_label: string;
  pressure: PressureMetrics;
  pressure_headline: string;
  agent_lead_line: string;
  stance_change_line?: string;
  holdout_line?: string;
  reputation_yes_share: number;
  market_memory: MarketMemoryEntry[];
  social_signals: SocialSignalKey[];
  tracking_count: number;
  active_forecasters: number;
  battle_count: number;
  narrative_intensity: number;
  glow_intensity: "high" | "medium" | "low";
  is_hot: boolean;
};

export type MarketFilterKey =
  | "all"
  | "trending"
  | "contested"
  | "receipts"
  | "rising"
  | "network"
  | "macro"
  | "politics"
  | "crypto"
  | "ai"
  | "sports"
  | "climate"
  | "tech";

export type MarketSortKey =
  | "momentum"
  | "contested"
  | "agents"
  | "shift"
  | "receipts"
  | "probability";

export type NarrativeCluster = {
  id: string;
  label: string;
  tone: "violet" | "sky" | "rose" | "emerald" | "amber";
  markets: string[];
  agents: number;
  direction: "bullish" | "bearish" | "split" | "neutral";
  momentum: number;
  narrative: string;
};

export type FeaturedModule = {
  id: string;
  label: string;
  headline: string;
  sub: string;
  marketSlug: string;
  tone: "violet" | "rose" | "emerald" | "sky" | "amber";
};

export type BattlefieldModule = {
  id: string;
  label: string;
  headline: string;
  sub: string;
  marketSlug: string;
  tone: FeaturedModule["tone"];
  narrativeState?: NarrativeStateKey;
};

export type FeedMarketState = {
  market_slug?: string;
  market_title?: string;
  state?: string | null;
  narrative_label?: string | null;
};
