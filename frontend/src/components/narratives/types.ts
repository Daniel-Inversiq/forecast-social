export type NarrativeType =

  | "momentum_up"

  | "momentum_down"

  | "consensus_shift"

  | "disagreement"

  | "narrative_breakout";



export type SignalStage =

  | "FORMING"

  | "CLUSTERING"

  | "CONTESTED"

  | "BREAKOUT"

  | "MAINSTREAM"

  | "COLLAPSING";



export type LifecyclePhase =

  | "WEAK_SIGNAL"

  | "CLUSTERING"

  | "PRESSURE_BUILDING"

  | "CONSENSUS_BREAK"

  | "REPRICING"

  | "DOMINANT_NARRATIVE"

  | "COLLAPSE";



export type PressureDirection =

  | "accelerating"

  | "collapsing"

  | "aligning"

  | "fragmenting"

  | "repricing"

  | "tightening"

  | "migrating"

  | "concentrating";



export type NarrativeItem = {

  title: string;

  description: string;

  type: NarrativeType;

  direction: string;

  strength: number;

  change: number;

  agents_involved: string[];

  markets_involved: string[];

  created_at: string;

};



export type MomentumRow = {

  category: string;

  direction: string;

  strength: number;

  change: number;

  agent_count: number;

  markets_involved: string[];

};



export type NarrativesPayload = {

  trending_narratives: NarrativeItem[];

  consensus_shifts: NarrativeItem[];

  expanding_disagreements: NarrativeItem[];

  momentum_markets: MomentumRow[];

};



export type NarrativeFilterKey =

  | "all"

  | "macro"

  | "politics"

  | "crypto"

  | "ai"

  | "sports"

  | "climate"

  | "tech"

  | "markets"

  | "forming"

  | "contrarian"

  | "high_rep"

  | "accelerating"

  | "fragmenting"

  | "consensus_building"

  | "before_consensus"

  | "verification_forming";



export type NarrativeSortKey =

  | "pressure"

  | "acceleration"

  | "coordination"

  | "rep_weight"

  | "earliest"

  | "lifecycle";



export type EnrichedNarrative = NarrativeItem & {

  id: string;

  category: string;

  velocity: number;

  alignment: number;

  momentum_label: string;

  whats_changing: string;

  why_matters: string;

  driver_agents: string[];

  market_slugs: string[];

  linked_battles: { label: string; href: string }[];

  linked_verified: { label: string; href: string }[];

  cluster_markets: string[];

  is_live: boolean;

  is_contrarian: boolean;

  is_emerging: boolean;

  is_breaking: boolean;

  verified_score: number;

  discuss_score: number;

  source: "trending" | "shift" | "disagreement";

  signal_stage: SignalStage;

  lifecycle_phase: LifecyclePhase;

  confidence_density: number;

  rep_weight: number;

  spread_velocity: number;

  narrative_acceleration: number;

  coordination_score: number;

  cluster_size: number;

  early_signal_copy: string;

  pressure_direction: PressureDirection;

};



export type RadarCard = {

  id: string;

  narrative: string;

  pressure_direction: PressureDirection;

  acceleration_score: number;

  rep_density: number;

  sectors: string[];

  signal_stage: SignalStage;

  seed: string;

};



export type HiddenAlignment = {

  id: string;

  copy: string;

  agents: string[];

  sectors: string[];

  coordination_score: number;

  rep_weight: number;

  detected_at: string;

};



export type Coalition = {

  id: string;

  name: string;

  members: string[];

  shared_narratives: string[];

  pressure_direction: PressureDirection;

  influence_score: number;

  internal_agreement: number;

  growth_rate: number;

};



export type HeatmapCell = {

  sector: string;

  pressure: number;

  fragmentation: number;

  consensus: number;

  volatility_migration: number;

};



export type BeforeConsensusRecord = {

  id: string;

  signal_copy: string;

  lead_days: number;

  first_agents: string[];

  consensus_at_birth: number;

  eventual_outcome: string;

  rep_impact: number;

  sector: string;

};



export type PulseItem = {

  id: string;

  copy: string;

  tone: "amber" | "violet" | "teal" | "rose" | "emerald";

  time_ago: string;

};



export type SignalInsight = {

  id: string;

  label: string;

  value: string;

  sub: string;

  tone: "sky" | "violet" | "amber" | "emerald" | "rose" | "cyan" | "teal";

  href?: string;

};



export const LIFECYCLE_PHASES: LifecyclePhase[] = [

  "WEAK_SIGNAL",

  "CLUSTERING",

  "PRESSURE_BUILDING",

  "CONSENSUS_BREAK",

  "REPRICING",

  "DOMINANT_NARRATIVE",

  "COLLAPSE",

];



export const LIFECYCLE_LABELS: Record<LifecyclePhase, string> = {

  WEAK_SIGNAL: "Weak signal",

  CLUSTERING: "Clustering",

  PRESSURE_BUILDING: "Pressure building",

  CONSENSUS_BREAK: "Consensus break",

  REPRICING: "Repricing",

  DOMINANT_NARRATIVE: "Dominant narrative",

  COLLAPSE: "Collapse",

};



export const PRESSURE_LABELS: Record<PressureDirection, string> = {

  accelerating: "Accelerating",

  collapsing: "Collapsing consensus",

  aligning: "Unusual alignment",

  fragmenting: "Fragmentation",

  repricing: "Silent repricing",

  tightening: "Cluster tightening",

  migrating: "Volatility migration",

  concentrating: "Pressure concentration",

};

