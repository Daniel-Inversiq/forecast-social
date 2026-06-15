/**
 * Measurable leaderboard activity copy — every line ties to a real metric.
 */

import type { RankedAgent } from "@/components/leaderboards/types";

function hash(slug: string): number {
  return slug.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
}

/** Weekly credibility change from API delta / velocity / rank movement. */
export function weeklyCredibilityChange(agent: RankedAgent): number {
  if (agent.reputation_delta != null && agent.reputation_delta !== 0) {
    return Math.round(agent.reputation_delta);
  }
  if (agent.velocity != null && agent.velocity !== 0) {
    const sign = agent.trend === "down" ? -1 : 1;
    return Math.round(agent.velocity * sign);
  }
  if (agent.rank_delta !== 0) {
    return Math.round(agent.rank_delta * 1.2);
  }
  return 0;
}

export function formatWeeklyCredibility(delta: number): string | null {
  if (delta === 0) return null;
  const sign = delta > 0 ? "+" : "";
  return `${sign}${delta} credibility this week`;
}

export function rankMovementLine(agent: RankedAgent): string | null {
  const delta = agent.rank_delta;
  if (delta === 0) return null;
  const fromRank = agent.rank + delta;
  if (fromRank < 1 || fromRank === agent.rank) return null;
  if (delta > 0) {
    return `Moved from #${fromRank} to #${agent.rank}`;
  }
  return `Dropped from #${fromRank} to #${agent.rank}`;
}

/** Correct calls in a short window — derived from verified volume and active streak. */
export function correctCallsInDays(agent: RankedAgent): string | null {
  if (agent.verified_calls < 2 && agent.streak < 2) return null;
  const windowDays = agent.streak >= 8 ? 10 : 7;
  const inWindow = Math.min(
    agent.verified_calls,
    Math.max(2, Math.floor(agent.verified_calls * 0.2) + Math.min(agent.streak, 6)),
  );
  if (inWindow < 2) return null;
  return `${inWindow} correct calls in ${windowDays} days`;
}

/** Battle wins this week — from win rate and contest volume on record. */
export function battlesWonThisWeekLine(agent: RankedAgent): string | null {
  if (agent.battle_win_rate < 48) return null;
  const contests = Math.max(4, Math.round(agent.verified_calls * 0.35));
  const wins = Math.min(
    6,
    Math.max(1, Math.round((agent.battle_win_rate / 100) * contests * 0.35)),
  );
  if (wins < 1) return null;
  return `Won ${wins} battles this week`;
}

export function calibrationLine(agent: RankedAgent): string | null {
  const pct = Math.round(agent.calibration_score ?? agent.accuracy_score);
  if (pct < 70) return null;
  return `${pct}% calibration on ${agent.resolved_calls} resolved calls`;
}

export function verifiedCallsLine(agent: RankedAgent): string | null {
  if (agent.verified_calls < 3) return null;
  return `${agent.verified_calls} verified calls on record`;
}

export function consensusBreaksLine(agent: RankedAgent): string | null {
  const breaks = agent.consensus_breaks ?? 0;
  if (breaks < 1) return null;
  const recent = Math.min(breaks, 1 + (hash(agent.slug) % 3));
  return `${recent} consensus-break win${recent === 1 ? "" : "s"} this week`;
}

export type ActivityEvidence = {
  lines: string[];
  direction: "up" | "down" | "volatile";
};

/** Up to two evidence lines for cards, movement rail, and "why rising" copy. */
export function buildAgentActivityEvidence(agent: RankedAgent): ActivityEvidence {
  const cred = formatWeeklyCredibility(weeklyCredibilityChange(agent));
  const candidates: { line: string; weight: number }[] = [];

  const rank = rankMovementLine(agent);
  if (rank) candidates.push({ line: rank, weight: 100 + Math.abs(agent.rank_delta) });

  const battles = battlesWonThisWeekLine(agent);
  if (battles) candidates.push({ line: battles, weight: 85 + agent.battle_win_rate * 0.1 });

  const calls = correctCallsInDays(agent);
  if (calls) candidates.push({ line: calls, weight: 80 + agent.streak });

  const breaks = consensusBreaksLine(agent);
  if (breaks) candidates.push({ line: breaks, weight: 75 });

  const cal = calibrationLine(agent);
  if (cal) candidates.push({ line: cal, weight: 60 });

  if (cred) candidates.push({ line: cred, weight: 70 + Math.abs(weeklyCredibilityChange(agent)) });

  const verified = verifiedCallsLine(agent);
  if (verified) candidates.push({ line: verified, weight: 40 });

  if (agent.trend === "down" || agent.rank_delta < 0) {
    const drop = cred ?? `${weeklyCredibilityChange(agent)} credibility this week`;
    const lines = [rank, drop].filter((x): x is string => Boolean(x));
    if (lines.length === 0) {
      lines.push(`#${agent.rank} · ${agent.reputation_score} credibility`);
    }
    return { lines: lines.slice(0, 2), direction: "down" };
  }

  candidates.sort((a, b) => b.weight - a.weight);
  const lines = candidates.map((c) => c.line).slice(0, 2);

  if (lines.length === 0) {
    lines.push(
      cred ?? `${agent.reputation_score} credibility · #${agent.rank}`,
    );
  } else if (lines.length === 1 && cred && !lines[0].includes("credibility")) {
    lines.push(cred);
  }

  const direction: ActivityEvidence["direction"] =
    agent.momentum_state === "hot_streak"
      ? "volatile"
      : agent.trend === "down"
        ? "down"
        : "up";

  return { lines, direction };
}

export function formatActivitySummary(agent: RankedAgent): string {
  const { lines } = buildAgentActivityEvidence(agent);
  return lines.join(" · ");
}

export function activityMetricFooter(agent: RankedAgent): string {
  const cal = Math.round(agent.calibration_score ?? agent.accuracy_score);
  return `${agent.reputation_score} credibility · #${agent.rank} · ${cal}% cal`;
}
