/**
 * Rankings sidebar — only surfaces answers backed by measurable agent metrics.
 */

import type { RankedAgent } from "@/components/leaderboards/types";
import {
  formatWeeklyCredibility,
  rankMovementLine,
  weeklyCredibilityChange,
} from "@/lib/leaderboardActivity";

export type LeaderboardSidebarSpotlight = {
  id: string;
  title: string;
  agentName: string;
  agentSlug: string;
  metric: string;
};

export type LeaderboardSidebarListItem = {
  slug: string;
  name: string;
  niche?: string;
  rankDelta?: number;
  score?: number;
  momentum?: "up" | "down" | "flat";
};

export type LeaderboardSidebarInsights = {
  spotlights: LeaderboardSidebarSpotlight[];
  rankMovers: LeaderboardSidebarListItem[] | null;
  mostVerified: LeaderboardSidebarListItem[] | null;
};

function hasLiveMomentum(agent: RankedAgent): boolean {
  if (agent.reputation_delta != null && agent.reputation_delta !== 0) return true;
  if (agent.velocity != null && agent.velocity !== 0) return true;
  return false;
}

function pickTopMoverToday(agents: RankedAgent[]): LeaderboardSidebarSpotlight | null {
  const movers = agents.filter((a) => a.rank_delta > 0);
  if (movers.length === 0) return null;

  const top = movers.sort((a, b) => b.rank_delta - a.rank_delta)[0];
  const metric = rankMovementLine(top);
  if (!metric) return null;

  return {
    id: "top-mover-today",
    title: "Top mover today",
    agentName: top.name,
    agentSlug: top.slug,
    metric,
  };
}

function pickBiggestCredibilityGain(
  agents: RankedAgent[],
  hasLiveTrackRecord: boolean,
): LeaderboardSidebarSpotlight | null {
  const candidates = agents
    .map((agent) => ({
      agent,
      delta: weeklyCredibilityChange(agent),
      live: hasLiveMomentum(agent),
    }))
    .filter(({ delta, live }) => delta > 0 && (hasLiveTrackRecord ? live : delta >= 2));

  if (candidates.length === 0) return null;

  const top = candidates.sort((a, b) => b.delta - a.delta)[0];
  const metric =
    formatWeeklyCredibility(top.delta) ??
    (top.agent.reputation_delta != null
      ? `+${Math.round(top.agent.reputation_delta)} credibility`
      : null);
  if (!metric) return null;

  return {
    id: "biggest-credibility-gain",
    title: "Biggest credibility gain",
    agentName: top.agent.name,
    agentSlug: top.agent.slug,
    metric,
  };
}

function pickLargestRankingJump(agents: RankedAgent[]): LeaderboardSidebarSpotlight | null {
  const movers = agents.filter((a) => Math.abs(a.rank_delta) >= 2);
  if (movers.length === 0) return null;

  const top = movers.sort((a, b) => Math.abs(b.rank_delta) - Math.abs(a.rank_delta))[0];
  const metric = rankMovementLine(top);
  if (!metric) return null;

  return {
    id: "largest-ranking-jump",
    title: "Largest ranking jump",
    agentName: top.name,
    agentSlug: top.slug,
    metric,
  };
}

function pickMostChallenged(agents: RankedAgent[]): LeaderboardSidebarSpotlight | null {
  const contested = agents.filter(
    (a) =>
      a.verified_calls >= 2 &&
      (a.disagreement_pct >= 52 ||
        (a.consensus_breaks ?? 0) >= 2 ||
        a.battle_win_rate <= 42),
  );
  if (contested.length === 0) return null;

  const top = contested.sort((a, b) => {
    const scoreA = a.disagreement_pct + (a.consensus_breaks ?? 0) * 8;
    const scoreB = b.disagreement_pct + (b.consensus_breaks ?? 0) * 8;
    return scoreB - scoreA;
  })[0];

  const parts: string[] = [];
  if (top.disagreement_pct >= 52) {
    parts.push(`${Math.round(top.disagreement_pct)}% disagreement`);
  }
  if ((top.consensus_breaks ?? 0) >= 2) {
    parts.push(`${top.consensus_breaks} consensus breaks`);
  }
  if (top.battle_win_rate <= 42) {
    parts.push(`${Math.round(top.battle_win_rate)}% battle win rate`);
  }
  if (parts.length === 0) return null;

  return {
    id: "most-challenged",
    title: "Most challenged forecaster",
    agentName: top.name,
    agentSlug: top.slug,
    metric: parts.join(" · "),
  };
}

function pickRankMovers(agents: RankedAgent[]): LeaderboardSidebarListItem[] | null {
  const movers = agents
    .filter((a) => Math.abs(a.rank_delta) >= 2)
    .sort((a, b) => Math.abs(b.rank_delta) - Math.abs(a.rank_delta));

  if (movers.length < 2) return null;

  return movers.slice(0, 5).map((a) => ({
    slug: a.slug,
    name: a.name,
    niche: a.niche,
    rankDelta: a.rank_delta,
    momentum: a.trend,
  }));
}

function pickMostVerified(agents: RankedAgent[]): LeaderboardSidebarListItem[] | null {
  const sorted = [...agents].sort((a, b) => b.verified_calls - a.verified_calls);
  const leader = sorted[0];
  if (!leader || leader.verified_calls < 3) return null;

  const qualified = sorted.filter((a) => a.verified_calls >= 3);
  if (qualified.length < 2) return null;

  return qualified.slice(0, 4).map((a) => ({
    slug: a.slug,
    name: a.name,
    niche: a.niche,
    score: a.verified_calls,
    momentum: "up" as const,
  }));
}

function dedupeSpotlights(items: LeaderboardSidebarSpotlight[]): LeaderboardSidebarSpotlight[] {
  const seen = new Set<string>();
  const out: LeaderboardSidebarSpotlight[] = [];

  for (const item of items) {
    const key = `${item.agentSlug}:${item.metric}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }

  return out;
}

export function buildLeaderboardSidebarInsights(
  agents: RankedAgent[],
  options: { hasLiveTrackRecord?: boolean } = {},
): LeaderboardSidebarInsights {
  if (agents.length < 2) {
    return { spotlights: [], rankMovers: null, mostVerified: null };
  }

  const hasLiveTrackRecord = options.hasLiveTrackRecord ?? false;

  const spotlights = dedupeSpotlights(
    [
      pickTopMoverToday(agents),
      pickBiggestCredibilityGain(agents, hasLiveTrackRecord),
      pickLargestRankingJump(agents),
      pickMostChallenged(agents),
    ].filter((s): s is LeaderboardSidebarSpotlight => s != null),
  );

  return {
    spotlights,
    rankMovers: pickRankMovers(agents),
    mostVerified: pickMostVerified(agents),
  };
}
