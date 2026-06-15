export type ReceiptStrength = "strong" | "legendary" | "contested" | "early";

/** Live reputation engine fields (optional — present when API enriches receipts). */
export type VerifiedCallReputation = {
  reputation_delta: number;
  reputation_category?: string;
  reputation_reason?: string | null;
  tier_key?: string;
  tier_label?: string;
  tier_impact?: string | null;
  timing_multiplier?: number | null;
  timing_quality?: number | null;
  calibration_impact?: number | null;
  conviction_multiplier?: number | null;
  consensus_breaking?: boolean;
  reputation_live?: boolean;
  reputation_event_id?: number | null;
};

export type VerifiedCallBase = {
  id: string;
  agent_name: string;
  agent_slug: string;
  avatar_color: string;
  market_title: string;
  market_slug: string;
  side: string;
  confidence: number;
  original_take: string;
  original_probability: number;
  final_outcome: string;
  days_early: number;
  created_at: string;
  receipt_strength: ReceiptStrength;
  /** agent (default) or user conviction receipt */
  subject_type?: "agent" | "user";
  conviction_payout?: number | null;
} & Partial<VerifiedCallReputation>;

export type VerifiedCallFilterKey =
  | "all"
  | "today"
  | "legendary"
  | "contrarian"
  | "high_conviction"
  | "most_isolated"
  | "fastest_repricing"
  | "before_consensus"
  | "seasonal"
  | "coalition"
  | "narrative_defining"
  | "early"
  | "contested"
  | "macro"
  | "politics"
  | "crypto"
  | "ai"
  | "sports"
  | "climate";

export type VerifiedCallSortKey =
  | "recent"
  | "reputation"
  | "days_early"
  | "conviction"
  | "contested"
  | "isolation"
  | "timing_edge";

export type TimelinePhase =
  | "thesis_opened"
  | "early_signal"
  | "mocked_ignored"
  | "pressure_builds"
  | "consensus_shifts"
  | "market_reprices"
  | "verified"
  | "reputation_migrates";

export type EnrichedVerifiedCall = VerifiedCallBase & {
  category: string;
  is_verified: boolean;
  reputation_delta: number;
  consensus_at_time: number;
  final_consensus: number;
  final_probability: number;
  what_changed: string;
  why_mattered: string;
  who_disagreed: string;
  reputation_impact: string;
  reputation_impact_summary: string;
  contested_score: number;
  reputation_from_engine: boolean;
  /** Archive layer — derived for verification archive UI */
  receipt_id: string;
  isolation_score: number;
  rep_density_at_entry: number;
  narrative_resistance: number;
  verification_velocity: number;
  verification_delay_days: number;
  pressure_shift: number;
  season_slug: string;
  season_title: string;
  season_role?: string;
  first_signal_at: string;
  amplifiers: { name: string; slug: string }[];
  timeline_phases: TimelinePhase[];
  ignored_at_first: boolean;
  mock_label?: string;
  linked_narratives: string[];
  linked_rivalries: string[];
  coalition_agents: string[];
  downstream_battles: number;
  chain_id?: string;
};

export type VerifiedCallInsight = {
  id: string;
  label: string;
  value: string;
  sub: string;
  tone: "emerald" | "amber" | "violet" | "sky" | "rose" | "zinc";
  href?: string;
};

export type VerificationSurfaceModule = {
  id: string;
  label: string;
  headline: string;
  detail: string;
  tone: "amber" | "zinc" | "emerald" | "violet";
  href?: string;
};

export type VerificationChain = {
  id: string;
  narrative: string;
  agents: { name: string; slug: string; role: string }[];
  summary: string;
  final_verification: string;
  market_slug?: string;
};

export type VerificationStreak = {
  id: string;
  agent_name: string;
  agent_slug: string;
  label: string;
  count: number;
  category: string;
  fragile?: boolean;
  legendary?: boolean;
};

export type AgentProofRank = {
  slug: string;
  name: string;
  avatar_color: string;
  verified_count: number;
  reputation_total: number;
};
