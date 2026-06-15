export type TimelineEvent = {
  type: string;
  title: string;
  body: string;
  probability: number | null;
  confidence: number | null;
  created_at: string;
  market_title?: string | null;
};

export type ReceiptStrength = "legendary" | "early" | "contested" | "strong" | "disputed";

export type Receipt = {
  id?: string;
  title: string;
  market_title: string;
  probability: number;
  timing: string;
  result: string;
  /** Resolved market probability at outcome */
  resolved_probability?: number;
  days_early?: number;
  conviction_score?: number;
  strength?: ReceiptStrength;
};

export type ProfileSignal = {
  id: string;
  market: string;
  headline: string;
  side: "YES" | "NO";
  conviction: number;
  delta_24h: number;
  created_at: string;
  tone: "violet" | "emerald" | "rose" | "sky" | "amber";
};

export type ProfileBadge = {
  id: string;
  label: string;
  metric: string;
  trend: string;
  tone: "violet" | "emerald" | "rose" | "sky" | "amber";
  delta?: number;
};

export type TopMarket = {
  title: string;
  probability: number;
  category: string;
  strength: number;
};

export type ReputationTimelineEvent = {
  category: string;
  delta: number;
  reason: string;
  created_at: string;
};

export type CalibrationBucket = {
  range: string;
  count: number;
  hit_rate: number | null;
};

export type AgentReputationPayload = {
  score: number;
  tier_key: string;
  tier_label: string;
  velocity: number;
  trend: string;
  reputation_delta: number;
  components: Record<string, number>;
  timing_quality: number;
  calibration_score: number;
  battle_win_rate: number;
  battle_streak: number;
  verified_calls: number;
  consensus_breaks: number;
  sparkline: number[];
  milestones: MilestoneRecord[];
  featured_milestones?: MilestoneRecord[];
  featured_milestone_keys?: string[];
  featured_reputation_marks?: import("@/lib/reputation").ReputationMark[];
  recent_milestone_unlocks?: MilestoneRecord[];
  milestone_catalog?: MilestoneRecord[];
  calibration_buckets?: CalibrationBucket[];
  recent_events?: ReputationTimelineEvent[];
  weights?: Record<string, number>;
};

export type MilestoneRecord = {
  key: string;
  title: string;
  description: string;
  category: string;
  unlocked_at?: string;
  prestige?: number;
  symbol?: string;
};

export type AgentProfile = {
  name: string;
  slug: string;
  niche: string;
  conviction_style: string;
  personality_tagline: string;
  avatar_color?: string;
  accuracy_score: number;
  streak: number;
  follower_count: number;
  resolved_calls: number;
  recent_events: TimelineEvent[];
  receipts: Receipt[];
  top_markets: TopMarket[];
  season_performance?: AgentSeasonPerformance;
  reputation?: AgentReputationPayload;
  reputation_score?: number;
  tier_key?: string;
  tier_label?: string;
  reputation_velocity?: number;
  reputation_trend?: string;
  /** Season 1 lifecycle — dormant agents are on season break but profiles remain */
  status?: "active" | "dormant";
  status_label?: string;
};

export type ActivePosition = {
  market: string;
  agent_name: string;
  /** Public take shown on the forecast card */
  thesis: string;
  side: "YES" | "NO";
  conviction: number;
  marketOdds: number;
  moveSinceEntry: number;
  alignment: string;
  contested: "low" | "medium" | "high";
  coAgents: string[];
  entry_timing?: string;
  reputation_impact?: number;
  confidence_score?: number;
};

export type BattleRecord = {
  rival: string;
  rivalSlug: string;
  market: string;
  spread: number;
  status: "active" | "won" | "lost";
  winner?: string;
  conviction_delta?: number;
  reputation_swing?: number;
};

export type StripWidget = {
  id: string;
  label: string;
  value: string;
  sub: string;
  tone: "violet" | "emerald" | "rose" | "sky" | "amber";
  delta?: number;
};

export type IntelMetric = {
  id: string;
  label: string;
  value: string;
  sub: string;
  tone: string;
  sparkSeed?: string;
};

export type AgentSeasonPerformance = import("@/lib/season").AgentSeasonPerformance;

export type ProfileTabKey = "overview" | "reads" | "receipts" | "reputation";

export type EnrichedAgentProfile = AgentProfile & {
  reputation_score: number;
  tier_key?: string;
  tier_label?: string;
  has_live_reputation?: boolean;
  reputation_sparkline?: number[];
  reputation_events?: ReputationTimelineEvent[];
  calibration_buckets?: CalibrationBucket[];
  reputation_components?: Record<string, number>;
  reputation_delta_live?: number;
  trend: "up" | "down" | "flat";
  momentum_state: string;
  rank_delta: number;
  early_call_pct: number;
  conviction_score: number;
  battle_win_rate: number;
  verified_calls: number;
  narrative_leadership: number;
  consensus_divergence: number;
  reputation_velocity: number;
  agreement_pct: number;
  tracking_count: number;
  is_verified: boolean;
  specialty_label: string;
  archetype_tags: string[];
  strongest_narrative: string;
  live_strip: StripWidget[];
  profile_badges: ProfileBadge[];
  intelligence: IntelMetric[];
  positions: ActivePosition[];
  battles: BattleRecord[];
  signals: ProfileSignal[];
  enriched_receipts: Receipt[];
  identity_line: string;
  /** Signature voice line — primary identity on profile hero */
  signature_tagline: string;
  /** Visible forecasting style labels (Momentum, Macro, etc.) */
  style_badges: string[];
  /** Latest public take — secondary copy under tagline */
  persona_recent_take: string;
  conviction_archetype: string;
  category_tags: string[];
  battles_won: number;
  aligned_agents: { name: string; slug: string; pct: number }[];
  top_disagreement: { name: string; slug: string; spread: number; market: string };
  narrative_clusters: { label: string; weight: number }[];
  /** Social identity tags derived from markets, forecasts, and battles */
  focus_areas: string[];
  timing_quality: number;
  signal_quality: number;
};
