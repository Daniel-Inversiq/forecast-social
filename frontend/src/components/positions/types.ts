import type { NarrativeStateKey } from "@/components/markets/types";
import type { ResolutionHorizon } from "@/lib/resolutionHorizon";

export type ActivePosition = {
  id: number;
  market_title: string;
  market_slug?: string;
  side: "YES" | "NO";
  amount: number;
  current_probability: number;
  created_at: string;
  status: "active" | "moving up" | "contested";
  expected_resolution_at?: string | null;
  resolved_at?: string | null;
  resolved_outcome?: string | null;
  resolution_horizon?: ResolutionHorizon | null;
};

export type ResolvedPosition = {
  id: number;
  market_title: string;
  side: "YES" | "NO";
  amount: number;
  result: "correct" | "incorrect";
  probability_at_entry: number;
  created_at: string;
  resolved_at: string;
};

export type TimelineEntry = {
  id: number;
  kind: string;
  market_title: string;
  side: string;
  amount: number;
  created_at: string;
  note: string;
  status?: string;
  result?: string;
};

export type Stats = {
  active_count: number;
  resolved_count: number;
  accuracy: number;
  total_conviction_volume: number;
};

export type PositionsPayload = {
  active_positions: ActivePosition[];
  resolved_positions: ResolvedPosition[];
  stats: Stats;
  timeline: TimelineEntry[];
};

export type PositionChip =
  | "ISOLATED"
  | "EARLY"
  | "FRAGMENTING"
  | "CONSENSUS BUILDING"
  | "CONTRARIAN"
  | "UNDER PRESSURE"
  | "RECEIPT FORMING"
  | "HIGH CONVICTION";

export type LifecycleStage =
  | "OPENED"
  | "DOUBLED DOWN"
  | "CONSENSUS SHIFT"
  | "BATTLE ESCALATION"
  | "VERIFIED"
  | "FAILED"
  | "AFTERMATH";

export type LifecycleEvent = {
  stage: LifecycleStage;
  label: string;
  detail: string;
  at: string;
  active?: boolean;
};

export type RightIfRight = {
  reputation_gain: number;
  verification_probability: number;
  network_shift: string;
  invalidated_agents: string[];
  narratives_collapse: string[];
  exposed_agents: string[];
  summary_lines: string[];
};

export type EnrichedActivePosition = ActivePosition & {
  slug: string;
  resolution_horizon: ResolutionHorizon | null;
  entry_probability: number;
  movement_since_entry: number;
  time_held_label: string;
  network_agreement: number;
  opposing_agent: string;
  why_it_matters: string;
  contested: boolean;
  narrative_cluster: string;
  narrative_state: NarrativeStateKey;
  pressure_score: number;
  conviction_strength: number;
  consensus_current: number;
  consensus_drift: number;
  rep_exposure: number;
  verification_odds: number;
  timing_edge: number;
  chips: PositionChip[];
  supporting_agents: string[];
  opposing_agents: string[];
  network_direction: "toward" | "away" | "stable";
  lifecycle: LifecycleEvent[];
  right_if_right: RightIfRight;
  isolation_line?: string;
};

export type EnrichedResolvedPosition = ResolvedPosition & {
  slug: string;
  reputation_delta: number;
  days_early: number;
  outcome_label: string;
  narrative_cluster: string;
  timing_quality: "excellent" | "good" | "late";
  was_early: boolean;
  consensus_at_entry: number;
  verification_outcome: string;
  linked_battle?: string;
  linked_season?: string;
  archival_note: string;
};

export type IdentityInsight = {
  id: string;
  label: string;
  value: string;
  tone: "violet" | "sky" | "rose" | "emerald" | "amber" | "teal";
};

export type CommandMetric = {
  id: string;
  label: string;
  value: string;
  sub: string;
  tone: "violet" | "amber" | "teal" | "rose" | "emerald" | "sky";
};

export type IntelligenceLine = {
  id: string;
  text: string;
  tone: "amber" | "violet" | "teal" | "rose" | "sky";
};

export type ConvictionSignal = {
  id: string;
  kind:
    | "strongest"
    | "contrarian"
    | "verification"
    | "pressure"
    | "disagreement"
    | "moving";
  label: string;
  position_id: number;
  slug: string;
  market_title: string;
  side: "YES" | "NO";
  narrative_state: NarrativeStateKey;
  rep_exposure: number;
  network_direction: "toward" | "away" | "stable";
  signal_value: string;
  signal_sub: string;
};

export type NarrativeExposureRow = {
  cluster: string;
  exposure_pct: number;
  alignment: "aligned" | "isolated" | "mixed";
  volatility: "stable" | "volatile";
  tone: "violet" | "amber" | "rose" | "sky" | "emerald" | "teal";
};

export type PressureFeedItem = {
  id: string;
  position_id: number;
  slug: string;
  text: string;
  tone: "amber" | "violet" | "rose" | "sky" | "emerald";
  at: string;
};

export type NetworkAgent = {
  name: string;
  slug: string;
  relation: "aligned" | "opposing" | "cluster" | "follower";
  detail: string;
};

export type ConvictionCommandCenter = {
  net_exposure: number;
  reputation_at_risk: number;
  active_narratives: number;
  markets_under_pressure: number;
  verification_proximity: number;
  consensus_alignment: number;
  metrics: CommandMetric[];
  intelligence: IntelligenceLine[];
};
