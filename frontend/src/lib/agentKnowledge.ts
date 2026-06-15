import { apiFetch } from "./api";

export type KnowledgeSourceRow = {
  id: number;
  source_type: string;
  filename: string;
  display_name: string;
  type_label: string;
  status: string;
  status_label: string;
  uploaded_ago: string;
  is_active: boolean;
  summary: string | null;
  key_claims: string[];
  created_at: string;
  updated_at: string;
};

export type AgentBelief = {
  belief: string;
  confidence: number;
  origin_source: string;
  origin_source_id: number | null;
};

export type WorldviewSliders = {
  consensus_following: number;
  contrarianism: number;
  risk_appetite: number;
  forecast_speed: number;
  narrative_sensitivity: number;
};

export type InfluenceRow = {
  source: string;
  pct: number;
};

export type ForecastDnaMetric = {
  label: string;
  percentile: number;
};

export type KnowledgeUpdate = {
  when: string;
  kind: string;
  title: string;
  detail: string;
};

export type AgentKnowledgeProfile = {
  agent_slug: string;
  agent_name: string;
  training_summary: string;
  sources: KnowledgeSourceRow[];
  active_source_count: number;
  beliefs: AgentBelief[];
  worldview: {
    tags: string[];
    sliders: WorldviewSliders;
    editable: boolean;
  };
  influence: InfluenceRow[];
  forecast_dna: ForecastDnaMetric[];
  updates: KnowledgeUpdate[];
  last_updated: string;
  creator_forecaster_id: number | null;
};

export type AgentKnowledgeSnapshot = {
  training_summary: string;
  core_beliefs: string[];
  active_source_count: number;
  last_updated: string;
  agent_slug: string;
};

export type CompareKnowledgeResult = {
  belief_overlap_pct: number;
  major_agreement: string | null;
  major_disagreement: string | null;
  beliefs_a: string[];
  beliefs_b: string[];
};

const SLIDER_LABELS: { key: keyof WorldviewSliders; label: string; low: string; high: string }[] = [
  { key: "consensus_following", label: "Consensus following", low: "Independent", high: "Crowd-aligned" },
  { key: "contrarianism", label: "Contrarianism", low: "Consensus-friendly", high: "Fade the crowd" },
  { key: "risk_appetite", label: "Risk appetite", low: "Defensive", high: "Aggressive" },
  { key: "forecast_speed", label: "Forecast speed", low: "Slow conviction", high: "Fast calls" },
  { key: "narrative_sensitivity", label: "Narrative sensitivity", low: "Data-first", high: "Story-driven" },
];

export function worldviewSliderMeta() {
  return SLIDER_LABELS;
}

export async function fetchAgentKnowledgeSnapshot(
  slug: string,
): Promise<AgentKnowledgeSnapshot | null> {
  try {
    const res = await apiFetch(`/agents/${encodeURIComponent(slug)}/knowledge`, {}, false);
    if (!res.ok) return null;
    return (await res.json()) as AgentKnowledgeSnapshot;
  } catch {
    return null;
  }
}

export async function fetchStudioAgentKnowledge(slug: string): Promise<AgentKnowledgeProfile> {
  const res = await apiFetch(`/studio/agents/${encodeURIComponent(slug)}/knowledge`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(typeof err.detail === "string" ? err.detail : "Failed to load knowledge");
  }
  return res.json() as Promise<AgentKnowledgeProfile>;
}

export async function fetchCompareKnowledge(
  slugA: string,
  slugB: string,
): Promise<CompareKnowledgeResult> {
  const res = await apiFetch(
    `/compare/${encodeURIComponent(slugA)}/${encodeURIComponent(slugB)}/knowledge`,
    {},
    false,
  );
  if (!res.ok) {
    return {
      belief_overlap_pct: 0,
      major_agreement: null,
      major_disagreement: null,
      beliefs_a: [],
      beliefs_b: [],
    };
  }
  return res.json() as Promise<CompareKnowledgeResult>;
}

export function studioKnowledgePath(slug: string): string {
  return `/studio/agents/${slug}?tab=knowledge`;
}
