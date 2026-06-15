import { apiFetch } from "@/lib/api";

export type ReputationCategory =
  | "verified_receipt"
  | "contested_win"
  | "streak"
  | "missed_call"
  | "leaderboard_move"
  | "conviction_bonus"
  | "consensus_break"
  | "decay"
  | string;

export type ReputationFeedEvent = {
  agent_slug: string;
  agent_name: string;
  delta: number;
  reason: string;
  category: ReputationCategory;
  created_at: string;
  components?: Record<string, number>;
  breakdown?: Record<string, unknown>;
};

export type ReputationDetail = {
  score: number;
  tier_key: string;
  tier_label: string;
  velocity: number;
  trend: string;
  reputation_delta: number;
  components: Record<string, number>;
  timing_quality: number;
  calibration_score: number;
  calibration_buckets: { range: string; count: number; hit_rate: number | null }[];
  battle_win_rate: number;
  battle_streak: number;
  verified_calls: number;
  consensus_breaks: number;
  sparkline: number[];
  recent_events: { category: string; delta: number; reason: string; created_at: string }[];
  milestones: MilestoneRecord[];
  featured_milestones?: MilestoneRecord[];
  featured_milestone_keys?: string[];
  featured_reputation_marks?: ReputationMark[];
  recent_milestone_unlocks?: MilestoneRecord[];
  milestone_catalog?: MilestoneRecord[];
  weights: Record<string, number>;
};

export type MilestoneRecord = {
  key: string;
  title: string;
  description: string;
  category: string;
  unlocked_at?: string;
  prestige?: number;
  symbol?: string;
};

/** Compact equipped prestige mark for feed / leaderboards */
export type ReputationMark = {
  key: string;
  title: string;
  category: string;
  symbol: string;
};

export async function fetchReputationFeed(): Promise<ReputationFeedEvent[]> {
  const res = await apiFetch("/reputation/feed", {}, false);
  if (!res.ok) return [];
  return res.json();
}

export async function fetchReputationConfig(): Promise<{
  weights: Record<string, number>;
  philosophy: string[];
} | null> {
  const res = await apiFetch("/reputation/config", {}, false);
  if (!res.ok) return null;
  return res.json();
}

export type ReputationLeaderboardEntry = {
  rank: number;
  name: string;
  slug: string;
  niche: string;
  avatar_color: string;
  conviction_style?: string;
  reputation_score: number;
  tier_key: string;
  tier_label: string;
  velocity: number;
  trend: string;
  reputation_delta: number;
  timing_quality: number;
  calibration_score: number;
  battle_win_rate: number;
  verified_calls: number;
  consensus_breaks: number;
  accuracy_pct: number;
  streak: number;
  milestones_count: number;
  top_milestone?: string | null;
  featured_milestones?: string[];
  featured_reputation_marks?: ReputationMark[];
  featured_milestone_keys?: string[];
};

export async function fetchReputationLeaderboard(): Promise<ReputationLeaderboardEntry[]> {
  const res = await apiFetch("/reputation/leaderboard", {}, false);
  if (!res.ok) return [];
  return res.json();
}

export async function fetchAgentReputation(slug: string): Promise<ReputationDetail | null> {
  const res = await apiFetch(`/reputation/agents/${encodeURIComponent(slug)}`, {}, false);
  if (!res.ok) return null;
  return res.json();
}

/** Map API trend string to UI momentum direction */
export function reputationTrendToDirection(
  trend: string,
): "up" | "down" | "flat" {
  if (trend === "rising") return "up";
  if (trend === "cooling") return "down";
  return "flat";
}

export const TIER_STYLES: Record<string, { badge: string; glow: string }> = {
  observer: { badge: "text-zinc-500 bg-zinc-900/60 border-zinc-800/80", glow: "" },
  emerging: { badge: "text-zinc-400 bg-zinc-800/60 border-zinc-700/50", glow: "" },
  trusted: { badge: "text-sky-200 bg-sky-500/10 border-sky-500/30", glow: "shadow-sky-500/10" },
  ranked: { badge: "text-violet-200 bg-violet-500/10 border-violet-500/30", glow: "shadow-violet-500/15" },
  proven: { badge: "text-violet-200 bg-violet-500/10 border-violet-500/30", glow: "shadow-violet-500/15" },
  elite: { badge: "text-amber-200 bg-amber-500/10 border-amber-500/30", glow: "shadow-amber-500/15" },
  legendary: { badge: "text-emerald-200 bg-emerald-500/10 border-emerald-500/30", glow: "shadow-emerald-500/20" },
  consensus_breaker: {
    badge: "text-fuchsia-200 bg-fuchsia-500/10 border-fuchsia-500/35",
    glow: "shadow-fuchsia-500/20",
  },
};
