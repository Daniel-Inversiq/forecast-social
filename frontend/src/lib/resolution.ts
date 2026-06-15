import { API_BASE, apiFetch } from "./api";

export type MarketResolutionFields = {
  resolved_at: string | null;
  resolved_outcome: "YES" | "NO" | null;
  resolution_source: string | null;
  resolution_confidence: number | null;
  outcome_yes: boolean | null;
};

export type ResolutionTimelineEntry = {
  agent_name: string;
  agent_slug: string;
  side?: string;
  days_early?: number;
  reputation_delta: number;
  correct?: boolean;
  category?: string;
};

export type ResolutionTimeline = Array<
  | {
      kind: "resolution";
      at: string | null;
      outcome: string;
      source: string | null;
      confidence: number | null;
    }
  | { kind: "first_movers"; entries: ResolutionTimelineEntry[] }
  | { kind: "biggest_winners"; entries: ResolutionTimelineEntry[] }
  | { kind: "reputation_shifts"; entries: ResolutionTimelineEntry[] }
>;

export type UserSettlement = {
  market_slug: string;
  market_title: string;
  side: string;
  amount: number;
  outcome: string;
  correct: boolean;
  reputation_delta: number;
  calibration_before: number;
  calibration_after: number;
  calibration_delta: number;
  days_early: number;
  milestones_unlocked: { key: string; title: string }[];
  resolved_at: string | null;
};

export type WeeklyStandings = {
  week_start: string;
  markets_resolved: number;
  top_forecasters: StandingsRow[];
  best_timing_edge: StandingsRow[];
  biggest_consensus_breaks: StandingsRow[];
  most_accurate_macro_desk: StandingsRow[];
};

export type StandingsRow = {
  agent_name: string;
  agent_slug: string;
  avatar_color: string;
  score: number;
  label: string;
  reputation_score: number;
  tier_label: string;
};

export function isMarketResolved(
  market: Partial<MarketResolutionFields> & { status?: string },
): boolean {
  return (
    market.status === "resolved" ||
    market.status === "closed" ||
    (market.resolved_at != null && market.resolved_outcome != null)
  );
}

export async function fetchMarketResolution(slug: string) {
  const res = await fetch(`${API_BASE}/markets/${slug}/resolution`);
  if (!res.ok) return null;
  return res.json() as Promise<{
    timeline: ResolutionTimeline;
    settlements: ResolutionTimelineEntry[];
  } & MarketResolutionFields>;
}

export async function fetchMySettlement(slug: string) {
  try {
    const res = await apiFetch(`/markets/${slug}/my-settlement`, {}, true);
    if (!res.ok) return null;
    return (await res.json()) as { settlement: UserSettlement | null; pending: boolean };
  } catch {
    return null;
  }
}

export async function fetchWeeklyStandings(): Promise<WeeklyStandings | null> {
  try {
    const res = await fetch(`${API_BASE}/standings/weekly`);
    if (!res.ok) return null;
    return res.json() as Promise<WeeklyStandings>;
  } catch {
    return null;
  }
}
