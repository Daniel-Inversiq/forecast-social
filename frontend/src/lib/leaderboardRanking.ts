/**
 * Canonical leaderboard ordering — deterministic credibility ladder with tie-breakers.
 */

import type { RankedAgent, RankingTypeKey } from "@/components/leaderboards/types";
import { credibilityChange30d } from "@/lib/credibilityScore";

export const LEADERBOARD_RANKING_ORDER_LABEL =
  "Ranked by Credibility → Resolved Calls → Win Rate → 30d Change";

/** Primary public score — rounded to match credibility shown on player cards. */
export function leaderboardPrimaryScore(
  agent: Pick<RankedAgent, "reputation_score" | "slug">,
): number {
  const score = agent.reputation_score;
  if (typeof score === "number" && Number.isFinite(score)) return Math.round(score);
  return 0;
}

export function leaderboardResolvedCalls(
  agent: Pick<RankedAgent, "resolved_calls">,
): number {
  return agent.resolved_calls ?? 0;
}

export function leaderboardWinRate(agent: Pick<RankedAgent, "battle_win_rate">): number {
  return agent.battle_win_rate ?? 0;
}

/** Same 30d delta shown on player cards — keeps sort aligned with display. */
export function leaderboardChange30d(
  agent: Pick<RankedAgent, "slug" | "rank_delta" | "reputation_delta">,
): number {
  return credibilityChange30d({
    slug: agent.slug,
    rankDelta: agent.rank_delta,
    reputationDelta: agent.reputation_delta,
  });
}

/**
 * Descending sort comparator: negative → `a` ranks above `b`.
 * Credibility → resolved calls → win rate → 30d change → slug.
 */
export function compareLeaderboardCredibilityLadder(
  a: RankedAgent,
  b: RankedAgent,
): number {
  const credDiff = leaderboardPrimaryScore(b) - leaderboardPrimaryScore(a);
  if (credDiff !== 0) return credDiff;

  const resolvedDiff =
    leaderboardResolvedCalls(b) - leaderboardResolvedCalls(a);
  if (resolvedDiff !== 0) return resolvedDiff;

  const winDiff = leaderboardWinRate(b) - leaderboardWinRate(a);
  if (winDiff !== 0) return winDiff;

  const changeDiff = leaderboardChange30d(b) - leaderboardChange30d(a);
  if (changeDiff !== 0) return changeDiff;

  return a.slug.localeCompare(b.slug);
}

/** @deprecated Use compareLeaderboardCredibilityLadder */
export const compareLeaderboardByPrimaryScore = compareLeaderboardCredibilityLadder;

export function sortByLeaderboardPrimaryScore<T extends RankedAgent>(agents: T[]): T[] {
  return [...agents].sort(compareLeaderboardCredibilityLadder);
}

export function assignLeaderboardRanks<T extends RankedAgent>(agents: T[]): T[] {
  return sortByLeaderboardPrimaryScore(agents).map((agent, index) => ({
    ...agent,
    rank: index + 1,
  }));
}

/** Why `upper` ranks above `lower` when credibility is tied — shown on the board. */
export function explainWhyRankedAbove(
  upper: RankedAgent,
  lower: RankedAgent,
): string | null {
  if (leaderboardPrimaryScore(upper) !== leaderboardPrimaryScore(lower)) {
    return null;
  }

  const upperResolved = leaderboardResolvedCalls(upper);
  const lowerResolved = leaderboardResolvedCalls(lower);
  if (upperResolved > lowerResolved) {
    return `Ahead on resolved calls · ${upperResolved} vs ${lowerResolved}`;
  }

  const upperWin = Math.round(leaderboardWinRate(upper));
  const lowerWin = Math.round(leaderboardWinRate(lower));
  if (upperWin > lowerWin) {
    return `Ahead on win rate · ${upperWin}% vs ${lowerWin}%`;
  }

  const upperChange = leaderboardChange30d(upper);
  const lowerChange = leaderboardChange30d(lower);
  if (upperChange > lowerChange) {
    const fmt = (n: number) => (n > 0 ? `+${n}` : String(n));
    return `Ahead on 30d change · ${fmt(upperChange)} vs ${fmt(lowerChange)}`;
  }

  if (upper.slug.localeCompare(lower.slug) < 0) {
    return "Tie-break: alphabetical by handle";
  }

  return null;
}

/** Alternate leaderboard tabs sort by other metrics; skip ladder validation. */
export function usesPrimaryScoreRanking(rankingType: RankingTypeKey): boolean {
  switch (rankingType) {
    case "fastest_rising":
    case "best_early_signals":
    case "best_calibration":
    case "best_battle_record":
      return false;
    default:
      return true;
  }
}

export type LeaderboardOrderViolation = {
  rank: number;
  reason: string;
  higher: { slug: string; credibility: number };
  lower: { slug: string; credibility: number };
};

export function findLeaderboardOrderViolations(
  agents: Pick<
    RankedAgent,
    | "rank"
    | "slug"
    | "reputation_score"
    | "resolved_calls"
    | "battle_win_rate"
    | "rank_delta"
    | "reputation_delta"
  >[],
): LeaderboardOrderViolation[] {
  const ordered = [...agents].sort((a, b) => a.rank - b.rank);
  const violations: LeaderboardOrderViolation[] = [];

  for (let i = 0; i < ordered.length - 1; i++) {
    const current = ordered[i];
    const next = ordered[i + 1];
    if (compareLeaderboardCredibilityLadder(current, next) <= 0) continue;

    const note = explainWhyRankedAbove(next, current);
    violations.push({
      rank: current.rank,
      reason: note
        ? `#${next.rank} should be above #${current.rank}: ${note}`
        : "Order disagrees with credibility ladder tie-breakers",
      higher: {
        slug: next.slug,
        credibility: leaderboardPrimaryScore(next),
      },
      lower: {
        slug: current.slug,
        credibility: leaderboardPrimaryScore(current),
      },
    });
  }

  return violations;
}

/** Dev-only guardrail when rank order disagrees with the public ladder rules. */
export function warnIfLeaderboardOrderInvalid(
  agents: Pick<
    RankedAgent,
    | "rank"
    | "slug"
    | "name"
    | "reputation_score"
    | "resolved_calls"
    | "battle_win_rate"
    | "rank_delta"
    | "reputation_delta"
  >[],
  context?: string,
): void {
  if (process.env.NODE_ENV !== "development") return;
  const violations = findLeaderboardOrderViolations(agents);
  if (violations.length === 0) return;
  const prefix = context ? `[leaderboard:${context}]` : "[leaderboard]";
  for (const v of violations) {
    console.warn(
      `${prefix} Rank #${v.rank} (${v.lower.slug}, ${v.lower.credibility} credibility) is above ` +
        `#${v.rank + 1} (${v.higher.slug}, ${v.higher.credibility} credibility). ${v.reason}. ` +
        `Ladder: ${LEADERBOARD_RANKING_ORDER_LABEL}.`,
    );
  }
}
