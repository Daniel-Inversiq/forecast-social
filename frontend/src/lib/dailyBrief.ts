import { apiFetchOptional, API_BASE } from "@/lib/api";

export type BriefNarrative = {
  id: string;
  label: string;
  momentum: string;
  strength: number;
  markets?: string[];
};

export type BriefSections = {
  global_pulse: {
    volatility_state: string;
    summary: string;
    verified_calls_count: number;
  };
  strongest_shifts: Record<string, unknown> | null;
  consensus_fractures: BriefNarrative[];
  rising_narratives: BriefNarrative[];
  verified_proof: { count: number; label: string };
  reputation_movers: Record<string, unknown> | null;
  contrarian_signal: Record<string, unknown> | null;
};

export type GlobalDailyBrief = {
  date: string;
  active_season: string | null;
  season?: Record<string, unknown> | null;
  dominant_narratives: BriefNarrative[];
  biggest_consensus_shift: Record<string, unknown> | null;
  top_reputation_move: Record<string, unknown> | null;
  strongest_contrarian: Record<string, unknown> | null;
  verified_calls_count: number;
  volatility_state: string;
  summary: string;
  generated_at: string | null;
  sections: BriefSections;
  delivery?: { email: boolean; push: boolean; in_app: boolean };
  user_preview?: {
    reputation_delta: number;
    personalized_summary: string;
  };
};

export type UserDailyBrief = {
  date: string;
  reputation_delta: number;
  strongest_position: Record<string, unknown> | null;
  worst_position: Record<string, unknown> | null;
  milestone_unlocks: Array<Record<string, unknown>>;
  followed_narratives: string[];
  calibration_change: number | null;
  rank_change: number | null;
  personalized_summary: string;
  generated_at: string | null;
  global: GlobalDailyBrief;
  sections: {
    reputation_movement: { delta: number; rank_change: number | null };
    strongest_call: Record<string, unknown> | null;
    mistakes: Record<string, unknown> | null;
    milestones: Array<Record<string, unknown>>;
    timing_quality: { calibration_change: number | null; label: string };
    followed_narratives: string[];
  };
};

const BRIEF_TODAY = `${API_BASE}/brief/today`;
const BRIEF_ME = `${API_BASE}/brief/me`;

export async function fetchTodayBrief(auth = true): Promise<GlobalDailyBrief | null> {
  const res = await apiFetchOptional("/brief/today", {}, auth);
  if (!res?.ok) return null;
  try {
    return (await res.json()) as GlobalDailyBrief;
  } catch {
    return null;
  }
}

export async function fetchMyBrief(): Promise<UserDailyBrief | null> {
  const res = await apiFetchOptional("/brief/me");
  if (!res?.ok) return null;
  try {
    return (await res.json()) as UserDailyBrief;
  } catch {
    return null;
  }
}

export function volatilityLabel(state: string): string {
  const map: Record<string, string> = {
    elevated: "ELEVATED",
    active: "ACTIVE",
    stable: "STABLE",
    compressed: "COMPRESSED",
  };
  return map[state] ?? state.toUpperCase();
}

export function volatilityTone(state: string): "amber" | "rose" | "emerald" | "zinc" {
  if (state === "elevated") return "amber";
  if (state === "active") return "rose";
  if (state === "compressed") return "zinc";
  return "emerald";
}

export { BRIEF_TODAY, BRIEF_ME };
