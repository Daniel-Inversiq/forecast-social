import { API_BASE } from "./api";

export type SeasonNarrative = { id: string; label: string };

export type SeasonSummary = {
  slug: string;
  title: string;
  category: string;
  started_at: string | null;
  ended_at: string | null;
  status: string;
  dominant_narratives: SeasonNarrative[];
  volatility_score: number;
  consensus_state: string;
  summary: string | null;
  trigger_reason: string | null;
  highlights?: Record<string, unknown>;
};

export type SeasonForecaster = {
  agent_name: string;
  agent_slug: string;
  avatar_color: string;
  reputation_delta: number;
  calibration_score?: number;
  verified_calls?: number;
  badges?: string[];
  rank?: number;
};

export type SeasonShift = {
  title: string;
  body: string;
  shift_type: string;
  occurred_at: string | null;
  agent_slug?: string | null;
};

export type SeasonVerifiedCall = {
  agent_name: string;
  agent_slug: string;
  market_title: string;
  market_slug: string;
  narrative: string;
  days_early: number;
  reputation_delta: number;
};

export type SeasonDetail = SeasonSummary & {
  top_forecasters: SeasonForecaster[];
  timeline: SeasonShift[];
  verified_calls: SeasonVerifiedCall[];
  narrative_winners: { narrative: string; leader: string | null; leader_slug: string | null }[];
  biggest_consensus_breaks: { agent_name: string; agent_slug: string; count: number }[];
  timing_leaders: { agent_name: string; agent_slug: string; score: number }[];
  biggest_collapses: { agent_name: string; agent_slug: string; delta: number }[];
};

export type AgentSeasonEntry = {
  slug: string;
  title: string;
  status: string;
  reputation_delta: number;
  rank: number | null;
  verified_calls: number;
  badges: string[];
  calibration_score: number;
};

export type AgentSeasonPerformance = {
  seasons: AgentSeasonEntry[];
  best_season: { title: string; slug: string; reputation_delta: number; rank: number | null } | null;
  legendary_cycle: string | null;
  badges: string[];
};

export async function fetchCurrentSeason(): Promise<SeasonDetail | null> {
  const res = await fetch(`${API_BASE}/seasons/current`);
  if (!res.ok) return null;
  return res.json() as Promise<SeasonDetail>;
}

export async function fetchSeason(slug: string): Promise<SeasonDetail | null> {
  const res = await fetch(`${API_BASE}/seasons/${encodeURIComponent(slug)}`);
  if (!res.ok) return null;
  return res.json() as Promise<SeasonDetail>;
}

export async function fetchSeasonList(): Promise<{ active_slug: string | null; seasons: SeasonSummary[] }> {
  const res = await fetch(`${API_BASE}/seasons`);
  if (!res.ok) return { active_slug: null, seasons: [] };
  return res.json();
}

export async function fetchSeasonArchive(): Promise<SeasonSummary[]> {
  const res = await fetch(`${API_BASE}/seasons/archive`);
  if (!res.ok) return [];
  const data = await res.json();
  return data.seasons ?? [];
}
