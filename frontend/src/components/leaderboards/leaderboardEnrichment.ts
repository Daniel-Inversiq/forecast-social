import { enrichAgents } from "@/components/agents/agentEnrichment";
import type { EnrichedAgent, ForecasterBase } from "@/components/agents/types";
import { betaFollowerCount } from "@/lib/betaNetworkScale";
import {
  activityMetricFooter,
  buildAgentActivityEvidence,
  formatWeeklyCredibility,
  rankMovementLine,
  weeklyCredibilityChange,
} from "@/lib/leaderboardActivity";
import { credibilityChange30d } from "@/lib/credibilityScore";
import {
  assignLeaderboardRanks,
  compareLeaderboardCredibilityLadder,
  sortByLeaderboardPrimaryScore,
  usesPrimaryScoreRanking,
} from "@/lib/leaderboardRanking";
import type { ReputationLeaderboardEntry } from "@/lib/reputation";
import type {
  CoalitionCluster,
  FallenGiant,
  LeaderboardFilterKey,
  LeaderboardSortKey,
  LeaderboardsData,
  MigrationSector,
  MomentumState,
  MovementEvent,
  NarrativeTerritory,
  PrestigeTier,
  RankedAgent,
  RankingCategoryKey,
  RankingPeriodKey,
  RankingTrustTierKey,
  RankingTypeKey,
  SeasonalLeader,
  StatusLabel,
} from "./types";

function hash(slug: string) {
  return slug.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
}

function inferMomentumState(agent: EnrichedAgent & { velocity?: number }): MomentumState {
  const vel = agent.velocity ?? Math.abs(agent.rank_delta);
  if (agent.streak >= 10 && agent.trend === "up") return "hot_streak";
  if (agent.trend === "up" && (agent.rank_delta >= 4 || vel >= 6)) return "rising";
  if (agent.trend === "down" && (agent.rank_delta <= -3 || vel >= 6)) return "cooling";
  if (agent.trend === "down" && agent.disagreement_pct < 35) return "fading";
  return "stable";
}

/** Merge /agents base rows with live reputation leaderboard entries */
export function mergeAgentsWithReputation(
  agents: ForecasterBase[],
  reputation: ReputationLeaderboardEntry[],
): ForecasterBase[] {
  const agentMap = new Map(agents.map((a) => [a.slug, a]));
  return reputation.map((rep) => {
    const base = agentMap.get(rep.slug);
    return {
      name: rep.name,
      slug: rep.slug,
      niche: rep.niche,
      conviction_style: rep.conviction_style ?? base?.conviction_style ?? "balanced",
      streak: rep.streak ?? base?.streak ?? 0,
      accuracy_score: rep.calibration_score ?? rep.accuracy_pct ?? base?.accuracy_score ?? 80,
      follower_count: base?.follower_count ?? betaFollowerCount(rep.slug),
      personality_tagline: base?.personality_tagline ?? `${rep.niche} forecaster`,
      avatar_color: rep.avatar_color ?? base?.avatar_color,
      reputation_score: rep.reputation_score,
      tier_key: rep.tier_key,
      tier_label: rep.tier_label,
      reputation_velocity: rep.velocity,
      reputation_trend: rep.trend,
      reputation_delta: rep.reputation_delta,
      battle_win_rate: rep.battle_win_rate,
      timing_quality: rep.timing_quality,
      calibration_score: rep.calibration_score,
      verified_calls: rep.verified_calls,
      consensus_breaks: rep.consensus_breaks,
      milestones_count: rep.milestones_count,
      top_milestone: rep.top_milestone,
      featured_milestones: rep.featured_milestones,
      featured_reputation_marks: rep.featured_reputation_marks,
      featured_milestone_keys: rep.featured_milestone_keys,
      api_rank: rep.rank,
    };
  });
}

export function buildRankedAgentsFromReputation(
  agents: ForecasterBase[],
  reputation: ReputationLeaderboardEntry[],
  legacyData?: LeaderboardsData,
): RankedAgent[] {
  const merged = mergeAgentsWithReputation(agents, reputation);
  let enriched = enrichAgents(merged);
  if (legacyData) {
    enriched = mergeLeaderboardOverlays(enriched, legacyData);
  }
  return enriched.map((agent) => toRankedAgent(agent, reputation));
}

function toRankedAgent(
  agent: EnrichedAgent,
  reputation: ReputationLeaderboardEntry[],
): RankedAgent {
  const rep = reputation.find((r) => r.slug === agent.slug);
  const h = hash(agent.slug);
  const battle = rep?.battle_win_rate ?? 40 + (h % 35);
  const calibration = rep?.calibration_score ?? agent.accuracy_score;

  return {
    ...agent,
    rank: rep?.rank ?? 0,
    accuracy_score: Math.round(calibration),
    momentum_state: inferMomentumState({
      ...agent,
      velocity: rep?.velocity,
    }),
    reputation_delta: rep?.reputation_delta,
    verified_calls: rep?.verified_calls ?? Math.floor(agent.receipts_count * 0.35),
    resolved_calls:
      rep?.verified_calls ?? Math.max(agent.receipts_count, Math.floor(agent.receipts_count * 0.55)),
    conviction_profile: convictionProfile(agent),
    narrative_specialization: agent.strongest_narrative,
    battle_win_rate: Math.min(99, Math.round(battle)),
    tracking_count: 800 + (h % 4200) + Math.floor(agent.follower_count / 12),
    avg_conviction: Math.round(calibration * 0.85 + (h % 12)),
    contrarian_wins: rep?.consensus_breaks ?? (agent.tags.includes("contrarian") ? 3 + (h % 14) : h % 6),
    tier_key: rep?.tier_key,
    tier_label: rep?.tier_label,
    velocity: rep?.velocity,
    timing_quality: rep?.timing_quality,
    calibration_score: rep?.calibration_score,
    milestones_count: rep?.milestones_count ?? 0,
    top_milestone: rep?.top_milestone,
    featured_milestones: rep?.featured_milestones,
    featured_reputation_marks: rep?.featured_reputation_marks,
    featured_milestone_keys: rep?.featured_milestone_keys,
    consensus_breaks: rep?.consensus_breaks ?? 0,
    early_on_pct: rep?.timing_quality != null
      ? Math.round(Math.min(99, rep.timing_quality))
      : agent.early_on_pct,
  };
}

function convictionProfile(agent: EnrichedAgent): string {
  const s = agent.conviction_style.toLowerCase();
  if (/fade|contrarian/.test(s)) return "Contrarian conviction";
  if (/slow|patient/.test(s)) return "Slow-build calibration";
  if (/momentum|volatile/.test(s)) return "Momentum positioning";
  if (/data|evidence/.test(s)) return "Evidence-led timing";
  if (/policy|macro/.test(s)) return "Policy-first structural";
  return "Balanced conviction curve";
}

export function mergeLeaderboardOverlays(
  agents: EnrichedAgent[],
  data: LeaderboardsData,
): EnrichedAgent[] {
  const accuracyMap = new Map(
    data.top_accuracy.map((r) => [r.agent.slug, { accuracy: r.accuracy_pct, streak: r.streak }]),
  );
  const risingMap = new Map(
    data.fastest_rising.map((r) => [r.agent.slug, r.rank_movement]),
  );
  const convictionMap = new Map(
    data.highest_conviction.map((r) => [r.agent.slug, r.avg_confidence]),
  );
  const battleMap = new Map(
    data.hottest_battle_agents.map((r) => [r.agent.slug, r.battle_score]),
  );

  return agents.map((a) => {
    const acc = accuracyMap.get(a.slug);
    const rise = risingMap.get(a.slug);
    const conv = convictionMap.get(a.slug);
    const battle = battleMap.get(a.slug);
    let trend = a.trend;
    let rank_delta = a.rank_delta;
    if (rise != null) {
      trend = "up";
      rank_delta = rise;
    }
    return {
      ...a,
      accuracy_score: acc?.accuracy ?? a.accuracy_score,
      streak: acc?.streak ?? a.streak,
      trend,
      rank_delta,
      receipts_count: a.receipts_count + (battle ? Math.floor(battle / 8) : 0),
      ...(conv != null ? { momentum_glow: Math.min(0.95, conv / 100) } : {}),
    };
  });
}

export function buildRankedAgents(
  rawAgents: ForecasterBase[],
  leaderboardData: LeaderboardsData,
  reputation?: ReputationLeaderboardEntry[],
): RankedAgent[] {
  if (reputation && reputation.length > 0) {
    const ranked = buildRankedAgentsFromReputation(rawAgents, reputation, leaderboardData);
    return assignLeaderboardRanks(ranked);
  }

  const enriched = mergeLeaderboardOverlays(enrichAgents(rawAgents), leaderboardData);
  const verifiedSlugs = new Set(
    leaderboardData.best_recent_calls
      .filter((c) => c.result === "verified")
      .map((c) => c.agent.slug),
  );
  const battleScores = new Map(
    leaderboardData.hottest_battle_agents.map((b) => [b.agent.slug, b.battle_score]),
  );

  const sorted = sortByLeaderboardPrimaryScore(enriched);

  return sorted.map((agent, i) => {
    const h = hash(agent.slug);
    const battle = battleScores.get(agent.slug) ?? 40 + (h % 35);
    return {
      ...agent,
      rank: i + 1,
      momentum_state: inferMomentumState(agent),
      reputation_delta: agent.reputation_delta,
      verified_calls: verifiedSlugs.has(agent.slug)
        ? agent.receipts_count + 8
        : Math.floor(agent.receipts_count * 0.35),
      resolved_calls: verifiedSlugs.has(agent.slug)
        ? agent.receipts_count + 8
        : Math.max(agent.receipts_count, Math.floor(agent.receipts_count * 0.55)),
      conviction_profile: convictionProfile(agent),
      narrative_specialization: agent.strongest_narrative,
      battle_win_rate: Math.min(92, 48 + battle * 0.55 + (h % 12)),
      tracking_count: 800 + (h % 4200) + Math.floor(agent.follower_count / 12),
      avg_conviction: 62 + (h % 32),
      contrarian_wins: agent.tags.includes("contrarian") ? 3 + (h % 14) : h % 6,
    };
  });
}

export type HeroStat = {
  label: string;
  value: string;
  sub?: string;
  highlight?: boolean;
  pulse?: boolean;
};

export function buildHeroStats(agents: RankedAgent[], pulse: number): HeroStat[] {
  const topRise = [...agents]
    .filter((a) => a.trend === "up")
    .sort(
      (a, b) =>
        (b.velocity ?? Math.abs(b.rank_delta)) - (a.velocity ?? Math.abs(a.rank_delta)),
    )[0] ?? [...agents].sort((a, b) => b.rank_delta - a.rank_delta)[0];
  const collapse = [...agents]
    .filter((a) => a.trend === "down")
    .sort((a, b) => a.rank_delta - b.rank_delta)[0];
  const timing = [...agents].sort(
    (a, b) => (b.timing_quality ?? b.early_on_pct) - (a.timing_quality ?? a.early_on_pct),
  )[0];
  const narrative = [...agents].sort((a, b) => b.reputation_score - a.reputation_score)[0];
  const breaker = [...agents].sort((a, b) => b.contrarian_wins - a.contrarian_wins)[0];
  const coalitionRise = [...agents]
    .filter((a) => a.agreement_pct >= 55 && a.trend === "up")
    .sort((a, b) => b.rank_delta - a.rank_delta)[0];
  const verified = [...agents].sort((a, b) => b.verified_calls - a.verified_calls)[0];
  const dangerous = agents.find((a) => a.tags.includes("contrarian") && a.trend === "up")
    ?? breaker;

  return [
    {
      label: "#1 credibility",
      value: narrative?.name ?? "—",
      sub: narrative ? `${narrative.reputation_score} pts · public track record` : "",
      highlight: true,
      pulse: true,
    },
    {
      label: "Fastest rising",
      value: topRise?.name ?? "—",
      sub: topRise
        ? formatWeeklyCredibility(weeklyCredibilityChange(topRise)) ??
          rankMovementLine(topRise) ??
          ""
        : "",
      highlight: true,
    },
    {
      label: "Best early signals",
      value: timing?.name ?? "—",
      sub: timing
        ? `${Math.round(timing.timing_quality ?? timing.early_on_pct)}% before reprice`
        : "",
    },
    {
      label: "Best calibration",
      value: [...agents].sort(
        (a, b) =>
          (b.calibration_score ?? b.accuracy_score) - (a.calibration_score ?? a.accuracy_score),
      )[0]?.name ?? "—",
      sub: (() => {
        const a = [...agents].sort(
          (x, y) =>
            (y.calibration_score ?? y.accuracy_score) - (x.calibration_score ?? x.accuracy_score),
        )[0];
        return a
          ? `${Math.round(a.calibration_score ?? a.accuracy_score)}% on ${a.resolved_calls} resolved`
          : "";
      })(),
    },
    {
      label: "Best battle record",
      value: [...agents].sort((a, b) => b.battle_win_rate - a.battle_win_rate)[0]?.name ?? "—",
      sub: (() => {
        const a = [...agents].sort((a, b) => b.battle_win_rate - a.battle_win_rate)[0];
        return a ? `${Math.round(a.battle_win_rate)}% battle win rate` : "";
      })(),
    },
    {
      label: "Largest credibility drop",
      value: collapse?.name ?? "—",
      sub: collapse
        ? formatWeeklyCredibility(weeklyCredibilityChange(collapse)) ??
          rankMovementLine(collapse) ??
          "No major drops"
        : "No major drops",
    },
    {
      label: "Most resolved calls",
      value: verified?.name ?? "—",
      sub: verified ? `${verified.resolved_calls} on ledger` : "",
    },
    {
      label: "Contrarian to watch",
      value: dangerous?.name ?? "—",
      sub: dangerous ? `${dangerous.battle_win_rate}% battle win rate` : "",
      highlight: true,
    },
  ];
}

export type InsightCard = {
  id: string;
  label: string;
  value: string;
  sub: string;
  tone: string;
  href?: string;
};

export function buildReputationInsights(agents: RankedAgent[]): InsightCard[] {
  const rising = [...agents].sort((a, b) => b.rank_delta - a.rank_delta)[0];
  const accurate = [...agents].sort((a, b) => b.accuracy_score - a.accuracy_score)[0];
  const early = [...agents].sort(
    (a, b) => (b.timing_quality ?? b.early_on_pct) - (a.timing_quality ?? a.early_on_pct),
  )[0];
  const conviction = [...agents].sort((a, b) => b.avg_conviction - a.avg_conviction)[0];
  const receipts = [...agents].sort((a, b) => b.verified_calls - a.verified_calls)[0];
  const contrarian = [...agents].sort((a, b) => b.contrarian_wins - a.contrarian_wins)[0];
  const aligned = [...agents].sort((a, b) => b.agreement_pct - a.agreement_pct)[0];
  const collapse = [...agents]
    .filter((a) => a.trend === "down")
    .sort((a, b) => a.rank_delta - b.rank_delta)[0];
  const narrative = [...agents].sort((a, b) => b.reputation_score - a.reputation_score)[0];

  return [
    {
      id: "rising",
      label: "Fastest rising",
      value: rising?.name ?? "—",
      sub: rising ? formatWeeklyCredibility(weeklyCredibilityChange(rising)) ?? "" : "",
      tone: "emerald",
      href: rising ? `/agents/${rising.slug}` : undefined,
    },
    {
      id: "accurate",
      label: "Most accurate",
      value: accurate?.name ?? "—",
      sub: accurate
        ? `${Math.round(accurate.calibration_score ?? accurate.accuracy_score)}% calibration`
        : "",
      tone: "violet",
      href: accurate ? `/agents/${accurate.slug}` : undefined,
    },
    {
      id: "early",
      label: "Best early calls",
      value: early?.name ?? "—",
      sub: early
        ? `${Math.round(early.timing_quality ?? early.early_on_pct)}% timing quality`
        : "",
      tone: "sky",
      href: early ? `/agents/${early.slug}` : undefined,
    },
    {
      id: "conviction",
      label: "Highest conviction",
      value: conviction?.name ?? "—",
      sub: conviction?.conviction_profile ?? "",
      tone: "amber",
      href: conviction ? `/agents/${conviction.slug}` : undefined,
    },
    {
      id: "receipts",
      label: "Strongest receipts",
      value: receipts?.name ?? "—",
      sub: receipts ? `${receipts.verified_calls} verified` : "",
      tone: "emerald",
      href: receipts ? `/agents/${receipts.slug}` : undefined,
    },
    {
      id: "contrarian",
      label: "Contrarian winner",
      value: contrarian?.name ?? "—",
      sub: contrarian ? `${contrarian.contrarian_wins} wins vs crowd` : "",
      tone: "rose",
      href: contrarian ? `/agents/${contrarian.slug}` : undefined,
    },
    {
      id: "aligned",
      label: "Most aligned",
      value: aligned?.name ?? "—",
      sub: aligned ? `${aligned.agreement_pct}% network align` : "",
      tone: "sky",
      href: aligned ? `/agents/${aligned.slug}` : undefined,
    },
    {
      id: "collapse",
      label: "Largest reputation collapse",
      value: collapse?.name ?? "—",
      sub: collapse
        ? formatWeeklyCredibility(weeklyCredibilityChange(collapse)) ??
          rankMovementLine(collapse) ??
          "No major collapses"
        : "No major collapses",
      tone: "rose",
      href: collapse ? `/agents/${collapse.slug}` : undefined,
    },
    {
      id: "narrative",
      label: "Narrative leader",
      value: narrative?.name ?? "—",
      sub: narrative?.narrative_specialization ?? "",
      tone: "violet",
      href: narrative ? `/agents/${narrative.slug}` : undefined,
    },
  ];
}

const NICHE_FILTER: Partial<Record<LeaderboardFilterKey, string[]>> = {
  macro: ["Macro", "Rates", "Equities", "Multi"],
  politics: ["Politics"],
  crypto: ["Crypto"],
  ai: ["Tech"],
  sports: ["Sports"],
  climate: ["Climate"],
};

const MOMENTUM_LABEL: Record<MomentumState, string> = {
  rising: "▲ Up",
  cooling: "▼ Down",
  stable: "Stable",
  hot_streak: "Streak",
  fading: "▼ Down",
};

export function momentumLabel(state: MomentumState, agent?: RankedAgent): string {
  if (agent) {
    const cred = formatWeeklyCredibility(weeklyCredibilityChange(agent));
    if (cred) return cred;
    const rank = rankMovementLine(agent);
    if (rank) return rank;
  }
  return MOMENTUM_LABEL[state];
}

export function filterRankedAgents(
  agents: RankedAgent[],
  filter: LeaderboardFilterKey,
  query: string,
): RankedAgent[] {
  let list = agents;
  if (filter !== "overall") {
    if (filter in NICHE_FILTER) {
      const niches = NICHE_FILTER[filter as keyof typeof NICHE_FILTER] ?? [];
      list = list.filter((a) => niches.includes(a.niche));
    } else if (filter === "contrarian") {
      list = list.filter((a) => a.tags.includes("contrarian"));
    } else if (filter === "early") {
      list = list.filter((a) => a.early_on_pct >= 68 || a.tags.includes("early"));
    } else if (filter === "verified") {
      list = list.filter((a) => a.verified_calls >= 12);
    }
  }
  const q = query.trim().toLowerCase();
  if (q) {
    list = list.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.slug.includes(q) ||
        a.niche.toLowerCase().includes(q) ||
        a.narrative_specialization.toLowerCase().includes(q),
    );
  }
  return list;
}

export function sortRankedAgents(agents: RankedAgent[], sort: LeaderboardSortKey): RankedAgent[] {
  const copy = [...agents];
  switch (sort) {
    case "accuracy":
      return copy.sort(
        (a, b) =>
          (b.calibration_score ?? b.accuracy_score) - (a.calibration_score ?? a.accuracy_score),
      );
    case "early":
      return copy.sort(
        (a, b) =>
          (b.timing_quality ?? b.early_on_pct) - (a.timing_quality ?? a.early_on_pct),
      );
    case "verified":
      return copy.sort((a, b) => b.verified_calls - a.verified_calls);
    case "momentum":
      return copy.sort(
        (a, b) =>
          (b.velocity ?? Math.abs(b.rank_delta)) - (a.velocity ?? Math.abs(a.rank_delta)),
      );
    case "conviction":
      return copy.sort((a, b) => b.avg_conviction - a.avg_conviction);
    case "contrarian":
      return copy.sort((a, b) => b.contrarian_wins - a.contrarian_wins);
    default:
      return copy.sort(compareLeaderboardCredibilityLadder);
  }
}

export function reassignRanks(agents: RankedAgent[]): RankedAgent[] {
  return assignLeaderboardRanks(agents);
}

const PRESTIGE_MAP: Record<string, PrestigeTier> = {
  emerging: "Emerging",
  trusted: "Trusted",
  proven: "Established",
  established: "Established",
  high_signal: "High Signal",
  network_mover: "Network Mover",
  elite: "Elite",
  legendary: "Legendary",
  consensus_breaker: "High Signal",
};

export function prestigeTier(agent: RankedAgent): PrestigeTier {
  if (agent.tier_key && PRESTIGE_MAP[agent.tier_key]) return PRESTIGE_MAP[agent.tier_key];
  if (agent.rank === 1) return "Legendary";
  if (agent.rank <= 3) return "Elite";
  if (agent.rank <= 6) return "Network Mover";
  if (agent.reputation_score >= 85) return "High Signal";
  if (agent.reputation_score >= 72) return "Established";
  if (agent.reputation_score >= 58) return "Trusted";
  return "Emerging";
}

export function inferStatusLabel(agent: RankedAgent): StatusLabel {
  if (agent.verified_calls >= 14 && agent.trend === "up") return "VERIFIED";
  if (agent.tags.includes("contrarian")) return "CONTRARIAN";
  if (agent.rank <= 2 && agent.trend === "up") return "DOMINANT";
  if (agent.agreement_pct >= 72) return "CONSENSUS LED";
  if (agent.rank_delta >= 5 || (agent.velocity ?? 0) >= 7) return "RISING";
  if (agent.trend === "down" && agent.rank_delta <= -4) return "COOLING";
  if (agent.agreement_pct < 38) return "ISOLATED";
  if (agent.momentum_state === "fading") return "FRAGMENTING";
  if (agent.rank_delta >= 3) return "NETWORK MOVER";
  return "RISING";
}

export function whyRising(agent: RankedAgent): string {
  const { lines } = buildAgentActivityEvidence(agent);
  return lines.join(" · ");
}

function hasMeasurableMovement(agent: RankedAgent): boolean {
  if (rankMovementLine(agent)) return true;
  if (formatWeeklyCredibility(weeklyCredibilityChange(agent))) return true;
  if (Math.abs(agent.rank_delta) >= 2) return true;
  if (agent.reputation_delta != null && agent.reputation_delta !== 0) return true;
  if (agent.velocity != null && agent.velocity !== 0) return true;
  return false;
}

export function buildMovementEvents(agents: RankedAgent[]): MovementEvent[] {
  const picks = [...agents]
    .filter(hasMeasurableMovement)
    .sort((a, b) => {
      const scoreA =
        Math.abs(weeklyCredibilityChange(a)) + Math.abs(a.rank_delta) * 2;
      const scoreB =
        Math.abs(weeklyCredibilityChange(b)) + Math.abs(b.rank_delta) * 2;
      return scoreB - scoreA;
    })
    .slice(0, 8);

  return picks
    .map((a, i) => {
      const evidence = buildAgentActivityEvidence(a);
      const headline = evidence.lines[0];
      if (!headline || /^#\d+ · \d+ credibility/.test(headline)) {
        return null;
      }
      return {
        id: `${a.slug}-${i}`,
        agentName: a.name,
        agentSlug: a.slug,
        avatarColor: a.avatar_color ?? "#7c3aed",
        headline,
        why: evidence.lines[1] ?? "",
        metric: activityMetricFooter(a),
        direction: evidence.direction,
      };
    })
    .filter((ev): ev is MovementEvent => ev != null);
}

export function buildNarrativeTerritories(agents: RankedAgent[]): NarrativeTerritory[] {
  const narratives = [
    { narrative: "recession fragmentation", owner: "Macro Oracle", slug: "macro-oracle", tone: "violet" as const },
    { narrative: "injury volatility", owner: "Football Monk", slug: "football-monk", tone: "emerald" as const },
    { narrative: "AI acceleration", owner: "BullBot", slug: "bullbot", tone: "amber" as const },
    { narrative: "recession panic cluster", owner: "DoomBot", slug: "doombot", tone: "rose" as const },
    { narrative: "rates repricing", owner: "FedWatcher", slug: "fed-watcher", tone: "sky" as const },
  ];
  return narratives.map((n, i) => {
    const owner = agents.find((a) => a.slug === n.slug) ?? agents[i % agents.length];
    const challengers = agents
      .filter((a) => a.slug !== owner?.slug && a.strongest_narrative.toLowerCase().includes(n.narrative.split(" ")[0]))
      .slice(0, 2)
      .map((a) => a.name);
    return {
      id: n.narrative,
      narrative: n.narrative,
      owner: owner?.name ?? n.owner,
      ownerSlug: owner?.slug ?? n.slug,
      dominance: 62 + (hash(n.narrative) % 28),
      challengers: challengers.length ? challengers : ["ContrCap", "ChaosQuant"].slice(0, 1 + (i % 2)),
      tone: n.tone,
    };
  });
}

export function buildCoalitionClusters(agents: RankedAgent[]): CoalitionCluster[] {
  return [
    {
      id: "ai-meltup",
      name: "AI melt-up coalition",
      narrative: "Semiconductor & AI capex cluster",
      direction: "rising",
      alignment: 78,
      members: ["BullBot", "Neural Scout", "ContrCap"].filter((n) =>
        agents.some((a) => a.name === n),
      ),
      insight: "Coordinated conviction on acceleration thesis — rep inflow",
    },
    {
      id: "sports-panic",
      name: "Sports panic bloc",
      narrative: "Injury & upset volatility",
      direction: "fragmenting",
      alignment: 41,
      members: ["Football Monk", "ChaosQuant"].filter((n) => agents.some((a) => a.name === n)),
      insight: "Alignment strength collapsing after crowded injury calls",
    },
    {
      id: "soft-landing",
      name: "Soft landing coalition",
      narrative: "Macro disinflation path",
      direction: "cooling",
      alignment: 52,
      members: ["FedWatcher", "Macro Oracle"].filter((n) => agents.some((a) => a.name === n)),
      insight: "Losing consensus as rates repricing narrative gains",
    },
  ];
}

export function buildFallenGiants(agents: RankedAgent[]): FallenGiant[] {
  return [...agents]
    .filter((a) => a.trend === "down" || a.momentum_state === "cooling" || a.momentum_state === "fading")
    .sort((a, b) => a.rank_delta - b.rank_delta)
    .slice(0, 5)
    .map((a) => ({
      agentName: a.name,
      agentSlug: a.slug,
      avatarColor: a.avatar_color ?? "#71717a",
      drawdown:
        formatWeeklyCredibility(weeklyCredibilityChange(a)) ??
        rankMovementLine(a) ??
        `−${Math.abs(weeklyCredibilityChange(a) || a.rank_delta)} credibility`,
      cause:
        a.momentum_state === "cooling"
          ? `${Math.round(a.timing_quality ?? a.early_on_pct)}% timing · ${a.verified_calls} verified calls`
          : `${Math.round(a.calibration_score ?? a.accuracy_score)}% calibration · ${a.resolved_calls} resolved`,
      lostNarrative: a.strongest_narrative,
    }));
}

export function buildSeasonalLeaders(): SeasonalLeader[] {
  return [
    {
      season: "Macro Cycle W21",
      seasonSlug: "macro-cycle-w21",
      leader: "FedWatcher",
      leaderSlug: "fed-watcher",
      narrative: "Rates repricing",
      dominance: "Dominated macro desk · +18 rep",
    },
    {
      season: "AI Mania Phase",
      seasonSlug: "ai-mania-phase",
      leader: "Neural Scout",
      leaderSlug: "neural-scout",
      narrative: "AI acceleration",
      dominance: "Strongest cycle conviction",
    },
    {
      season: "Election Volatility Arc",
      seasonSlug: "election-volatility-arc",
      leader: "ElectionBrain",
      leaderSlug: "election-brain",
      narrative: "Political transition",
      dominance: "Historical forecasting legend",
    },
  ];
}

export function buildMigrationSectors(agents: RankedAgent[]): MigrationSector[] {
  const rising = agents.filter((a) => a.trend === "up").length;
  const falling = agents.filter((a) => a.trend === "down").length;
  return [
    {
      id: "ai",
      label: "AI / Tech",
      flow: "inflow",
      magnitude: 12 + (rising % 5),
      narrative: "Credibility concentrating on acceleration cluster",
    },
    {
      id: "macro",
      label: "Macro",
      flow: "volatile",
      magnitude: 8,
      narrative: "Rep migrating between soft landing & recession camps",
    },
    {
      id: "sports",
      label: "Sports",
      flow: falling > rising ? "outflow" : "inflow",
      magnitude: 6,
      narrative: "Injury narratives fragmenting ownership",
    },
    {
      id: "crypto",
      label: "Crypto",
      flow: "outflow",
      magnitude: 5 + (falling % 4),
      narrative: "Crowded consensus calls eroding timing edge",
    },
    {
      id: "politics",
      label: "Politics",
      flow: "volatile",
      magnitude: 4,
      narrative: "Emerging cluster · transition markets",
    },
  ];
}

const CATEGORY_NICHES: Partial<Record<RankingCategoryKey, string[]>> = {
  macro: ["Macro", "Rates", "Equities", "Multi"],
  politics: ["Politics"],
  crypto: ["Crypto"],
  ai: ["Tech"],
  tech: ["Tech"],
  sports: ["Sports"],
  climate: ["Climate"],
};

const RANKING_TYPE_NICHES: Partial<Record<RankingTypeKey, string[]>> = {
  top_macro: CATEGORY_NICHES.macro,
  top_ai: CATEGORY_NICHES.ai,
  top_politics: CATEGORY_NICHES.politics,
};

export function filterByCategory(
  agents: RankedAgent[],
  category: RankingCategoryKey,
): RankedAgent[] {
  if (category === "all") return agents;
  const niches = CATEGORY_NICHES[category] ?? [];
  return agents.filter((a) => niches.includes(a.niche));
}

export function filterByTrustTier(
  agents: RankedAgent[],
  tier: RankingTrustTierKey,
): RankedAgent[] {
  if (tier === "all") return agents;
  return agents.filter((a) => (a.tier_key ?? inferTrustTierKey(a)) === tier);
}

function inferTrustTierKey(agent: RankedAgent): string {
  if (agent.reputation_score >= 92) return "elite";
  if (agent.reputation_score >= 82) return "ranked";
  if (agent.reputation_score >= 72) return "trusted";
  if (agent.reputation_score >= 58) return "emerging";
  return "observer";
}

function periodMomentum(agent: RankedAgent, period: RankingPeriodKey): number {
  switch (period) {
    case "24h": {
      const velocity = agent.velocity ?? 0;
      return agent.trend === "down" ? -Math.abs(velocity) : Math.abs(velocity);
    }
    case "week":
      return weeklyCredibilityChange(agent);
    case "month":
      return credibilityChange30d({
        slug: agent.slug,
        rankDelta: agent.rank_delta,
        reputationDelta: agent.reputation_delta,
      });
    default:
      return 0;
  }
}

function compareByPeriod(a: RankedAgent, b: RankedAgent, period: RankingPeriodKey): number {
  const diff = periodMomentum(b, period) - periodMomentum(a, period);
  if (diff !== 0) return diff;
  return compareLeaderboardCredibilityLadder(a, b);
}

export function applyRankingType(
  agents: RankedAgent[],
  rankingType: RankingTypeKey,
  period: RankingPeriodKey,
): RankedAgent[] {
  let copy = [...agents];
  const nicheFilter = RANKING_TYPE_NICHES[rankingType];
  if (nicheFilter?.length) {
    copy = copy.filter((a) => nicheFilter.includes(a.niche));
  }

  if (period !== "all" && usesPrimaryScoreRanking(rankingType)) {
    copy.sort((a, b) => compareByPeriod(a, b, period));
    return copy;
  }

  switch (rankingType) {
    case "fastest_rising":
      copy.sort(
        (a, b) =>
          (b.reputation_delta ?? b.velocity ?? Math.abs(b.rank_delta)) -
          (a.reputation_delta ?? a.velocity ?? Math.abs(a.rank_delta)),
      );
      break;
    case "best_early_signals":
      copy.sort(
        (a, b) => (b.timing_quality ?? b.early_on_pct) - (a.timing_quality ?? a.early_on_pct),
      );
      break;
    case "best_calibration":
      copy.sort(
        (a, b) =>
          (b.calibration_score ?? b.accuracy_score) - (a.calibration_score ?? a.accuracy_score),
      );
      break;
    case "best_battle_record":
      copy.sort((a, b) => b.battle_win_rate - a.battle_win_rate);
      break;
    case "top_macro":
    case "top_ai":
    case "top_politics":
    case "top_credibility":
    default:
      copy.sort(compareLeaderboardCredibilityLadder);
  }

  return copy;
}

/** @deprecated Use applyRankingType */
export const applyDimension = applyRankingType;
