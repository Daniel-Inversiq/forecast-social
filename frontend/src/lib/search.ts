import { apiFetch } from "@/lib/api";

export type SearchResultType =
  | "agent"
  | "market"
  | "battle"
  | "signal"
  | "verified_call"
  | "season"
  | "narrative"
  | "position"
  | "ranking"
  | "feed_event"
  | "milestone";

export type SearchResult = {
  type: SearchResultType;
  title: string;
  subtitle: string;
  summary: string;
  href: string;
  score: number;
  metadata?: Record<string, unknown>;
};

export type SearchResponse = {
  results: SearchResult[];
  related_queries: string[];
  trending_discoveries: TrendingDiscovery[];
};

export type TrendingDiscovery = {
  title: string;
  type: string;
  summary: string;
  href: string;
};

export type RabbitHole = {
  id: string;
  title: string;
  hook: string;
  signal_stage: string;
  season: string;
  agents: { name: string; slug: string }[];
  markets: { title: string; slug: string }[];
  battles: { label: string; href: string }[];
  verified_calls: { label: string; href: string }[];
  href: string;
};

export type DiscoverResponse = {
  rabbit_holes: RabbitHole[];
  legendary_calls: {
    title: string;
    agent: string;
    agent_slug: string;
    summary: string;
    href: string;
  }[];
  narrative_clusters: { title: string; stage: string; href: string }[];
  consensus_failures: { title: string; summary: string; href: string }[];
  rising_agents: {
    name: string;
    slug: string;
    niche: string;
    summary: string;
    href: string;
  }[];
  hottest_battles: {
    id: string;
    title: string;
    subtitle: string;
    summary: string;
    href: string;
    type: string;
    metadata?: Record<string, unknown>;
  }[];
  season_moments: {
    title: string;
    summary?: string;
    season_slug?: string;
    season_title?: string;
    href?: string;
  }[];
  hidden_alignments: { title: string; summary: string; href: string }[];
  trending_searches: string[];
};

export type RelatedSection = {
  label: string;
  items: {
    title: string;
    summary: string;
    href: string;
    type: string;
  }[];
};

export type RelatedResponse = {
  headline: string;
  sections: RelatedSection[];
};

export async function fetchSearch(q: string, limit = 24): Promise<SearchResponse | null> {
  try {
    const params = new URLSearchParams({ q, limit: String(limit) });
    const res = await apiFetch(`/search?${params}`, {}, false);
    if (!res.ok) return null;
    return (await res.json()) as SearchResponse;
  } catch {
    return null;
  }
}

export async function fetchDiscover(): Promise<DiscoverResponse | null> {
  try {
    const res = await apiFetch("/discover", {}, false);
    if (!res.ok) return null;
    return (await res.json()) as DiscoverResponse;
  } catch {
    return null;
  }
}

export async function fetchRelated(
  entityType: "market" | "agent" | "season" | "battle",
  entityId: string,
): Promise<RelatedResponse | null> {
  try {
    const params = new URLSearchParams({ entity_type: entityType, entity_id: entityId });
    const res = await apiFetch(`/search/related?${params}`, {}, false);
    if (!res.ok) return null;
    return (await res.json()) as RelatedResponse;
  } catch {
    return null;
  }
}

/** Prefetch palette idle state without auth */
export async function fetchSearchIdle(): Promise<SearchResponse | null> {
  return fetchSearch("", 12);
}

export const SEARCH_TYPE_LABELS: Record<string, string> = {
  agent: "Agent",
  market: "Market",
  battle: "Battle",
  signal: "Signal",
  verified_call: "Verified Call",
  season: "Season",
  narrative: "Narrative",
  position: "Position",
  ranking: "Ranking",
  feed_event: "Intel",
  milestone: "Milestone",
};

export const SEARCH_TYPE_ACCENT: Record<string, string> = {
  agent: "text-violet-400 border-violet-500/30 bg-violet-500/10",
  market: "text-teal-400 border-teal-500/30 bg-teal-500/10",
  battle: "text-rose-400 border-rose-500/30 bg-rose-500/10",
  signal: "text-amber-400 border-amber-500/30 bg-amber-500/10",
  verified_call: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10",
  season: "text-amber-300 border-amber-500/25 bg-amber-500/8",
  feed_event: "text-zinc-400 border-zinc-600/40 bg-zinc-800/40",
};
