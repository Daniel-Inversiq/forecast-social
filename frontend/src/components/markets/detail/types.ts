import type { EnrichedMarket } from "../types";
import type { VerifiedCallBase } from "@/components/verified-calls/types";

export type AgentTake = {
  name: string;
  slug: string;
  side: "YES" | "NO";
  confidence: number;
  reasoning: string;
  reputation_score?: number;
  tier_key?: string;
  tier_label?: string;
  timing_quality?: number;
  calibration_score?: number;
  verified_calls_count?: number;
  reputation_live?: boolean;
};

export type CredibilitySideStats = {
  total_reputation: number;
  agent_count: number;
  avg_timing_quality: number;
  avg_calibration: number;
  strongest_agent: {
    name: string;
    slug: string;
    reputation_score: number;
    tier_label: string;
  } | null;
};

export type CredibilitySplit = {
  yes: CredibilitySideStats;
  no: CredibilitySideStats;
  consensus_breaking: boolean;
  consensus_break_count: number;
  movement_type: "consensus_led" | "contrarian_led" | "mixed";
};

export type WhyMarketMoving = {
  headline: string;
  summary: string;
  movement_type: string;
  reputation_yes_share: number;
  first_movers: {
    name: string;
    slug: string;
    reputation_score: number;
    tier_label: string;
    event_type: string;
  }[];
};

export type ActivityItem = {
  type: string;
  agent_name: string;
  agent_slug: string;
  title: string;
  body: string;
  probability: number | null;
  confidence: number | null;
  created_at: string;
};

export type MarketDetail = {
  slug: string;
  title: string;
  category: string;
  status: string;
  current_yes_probability: number;
  resolved_at?: string | null;
  resolved_outcome?: "YES" | "NO" | null;
  resolution_source?: string | null;
  resolution_confidence?: number | null;
  outcome_yes?: boolean | null;
  agent_count: number;
  narrative: string;
  urgency: string;
  why_moved: string;
  public_exposure?: number;
  crowd_imbalance?: number;
  conviction_pressure?: string;
  narrative_pressure_label?: string;
  agent_takes: AgentTake[];
  recent_activity: ActivityItem[];
  credibility_split?: CredibilitySplit;
  why_moving?: WhyMarketMoving;
  verified_calls?: VerifiedCallBase[];
};

export type MarketTake = {
  id: number;
  author_name: string;
  author_slug: string;
  side: "YES" | "NO";
  confidence: number;
  body: string;
  created_at: string;
  avatar_color?: string | null;
  is_agent_author?: boolean;
};

export type ConvictionStripEvent = {
  id: string;
  agent_name: string;
  agent_slug: string;
  tag: string;
  delta?: number;
  side?: "YES" | "NO";
  at: string;
};

export type IntelligenceWidget = {
  id: string;
  label: string;
  value: string;
  sub: string;
  tone: "violet" | "rose" | "emerald" | "amber" | "sky";
  href?: string;
};

export type FactionBloc = {
  side: "YES" | "NO";
  name: string;
  narrative: string;
  momentum: "surging" | "holding" | "weakening" | "isolated";
  rep_concentration: number;
  agents: AgentTake[];
  holdout_note?: string;
};

export type PressureInsight = {
  label: string;
  value: string;
  tone: "violet" | "rose" | "amber" | "emerald" | "zinc";
};

export type ResolutionScenario = {
  outcome: "YES" | "NO";
  headline: string;
  winners: string[];
  losers: string[];
  faction_fate: string;
  narrative: string;
  season_note: string;
};

export type NetworkPulseItem = {
  id: string;
  kind:
    | "take"
    | "faction"
    | "rep"
    | "coalition"
    | "narrative"
    | "battle"
    | "timing";
  text: string;
  at: string;
};

export type EnrichedMarketDetail = MarketDetail & {
  enriched: EnrichedMarket;
  resolution_horizon: EnrichedMarket["resolution_horizon"];
  movement_delta: number;
  momentum: "up" | "down" | "flat";
  volatility: "high" | "medium" | "low";
  contested_level: "extreme" | "high" | "moderate" | "low";
  conviction_velocity: number;
  narrative_velocity: number;
  battle_intensity: number;
  reputation_exposure: number;
  consensus_fragmentation: number;
  intelligence: IntelligenceWidget[];
  strip_events: ConvictionStripEvent[];
  prob_history: number[];
  yes_count: number;
  no_count: number;
  largest_position: { agent: string; slug: string; side: "YES" | "NO"; amount: number };
  bullish_agent: AgentTake | null;
  contrarian_agent: AgentTake | null;
  fastest_rise: AgentTake | null;
  credibility: CredibilitySplit;
  why_moving: WhyMarketMoving;
  war_room_line: string;
  timing_pressure: string;
  market_heat: number;
  dominant_faction: "YES" | "NO" | "split";
  faction_blocs: FactionBloc[];
  pressure_insights: PressureInsight[];
  resolution_scenarios: ResolutionScenario[];
  network_pulse: NetworkPulseItem[];
};
