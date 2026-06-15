/** Scry milestone visual language — archival prestige, not gamification */

export type MilestoneCategory =
  | "timing"
  | "accuracy"
  | "contrarian"
  | "battle"
  | "reputation"
  | "specialization"
  | string;

export const MILESTONE_CATEGORY_STYLES: Record<
  string,
  { border: string; text: string; glow: string; icon: string }
> = {
  timing: {
    border: "border-sky-400/20",
    text: "text-sky-100/90",
    glow: "shadow-[0_0_24px_-8px_rgba(56,189,248,0.25)]",
    icon: "◈",
  },
  accuracy: {
    border: "border-emerald-400/20",
    text: "text-emerald-100/90",
    glow: "shadow-[0_0_24px_-8px_rgba(52,211,153,0.22)]",
    icon: "◇",
  },
  contrarian: {
    border: "border-fuchsia-400/20",
    text: "text-fuchsia-100/90",
    glow: "shadow-[0_0_24px_-8px_rgba(232,121,249,0.22)]",
    icon: "◆",
  },
  battle: {
    border: "border-rose-400/20",
    text: "text-rose-100/90",
    glow: "shadow-[0_0_24px_-8px_rgba(251,113,133,0.22)]",
    icon: "▣",
  },
  reputation: {
    border: "border-amber-400/25",
    text: "text-amber-100/95",
    glow: "shadow-[0_0_28px_-6px_rgba(251,191,36,0.28)]",
    icon: "◎",
  },
  specialization: {
    border: "border-violet-400/20",
    text: "text-violet-100/90",
    glow: "shadow-[0_0_24px_-8px_rgba(167,139,250,0.22)]",
    icon: "◉",
  },
};

export function milestoneStyle(category: string) {
  return (
    MILESTONE_CATEGORY_STYLES[category] ?? {
      border: "border-zinc-500/25",
      text: "text-zinc-200/90",
      glow: "shadow-[0_0_20px_-10px_rgba(161,161,170,0.2)]",
      icon: "○",
    }
  );
}

export const CABINET_METAL =
  "bg-gradient-to-br from-zinc-900/95 via-zinc-950/98 to-zinc-900/90 border border-zinc-700/40";

/** Key-specific cryptic symbols (user-facing prestige marks) */
export const MILESTONE_KEY_SYMBOLS: Record<string, string> = {
  early_signal: "◈",
  ahead_of_consensus: "◇",
  timing_edge: "◎",
  first_mover: "◉",
  verified_forecaster: "✦",
  calibration_locked: "◆",
  five_call_streak: "✧",
  precision_desk: "✶",
  consensus_breaker: "◈",
  crowd_fade: "◌",
  lone_wolf: "◍",
  narrative_divergence: "◎",
  battle_winner: "▣",
  beat_a_legendary: "✪",
  split_dominator: "◫",
  macro_slayer: "⟁",
  trusted: "○",
  proven: "◐",
  elite: "◑",
  legendary: "⬡",
  crypto_specialist: "◇",
  macro_desk: "⟁",
  sports_edge: "◆",
  ai_forecaster: "✦",
};

export function milestoneSymbol(key: string, category: string): string {
  return MILESTONE_KEY_SYMBOLS[key] ?? MILESTONE_CATEGORY_STYLES[category]?.icon ?? "○";
}
