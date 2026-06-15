export type MarketProbTone = "yes" | "no" | "contested" | "yes-lean" | "no-lean";

export type MarketProbState = {
  tone: MarketProbTone;
  /** Dominant side label for display */
  label: "YES" | "NO";
};

/** Map YES probability to semantic market state for scan UI. */
export function getMarketProbState(yesProb: number): MarketProbState {
  const p = Math.round(yesProb);
  if (p > 60) return { tone: "yes", label: "YES" };
  if (p < 40) return { tone: "no", label: "NO" };
  if (p >= 45 && p <= 55) return { tone: "contested", label: p >= 50 ? "YES" : "NO" };
  if (p > 55) return { tone: "yes-lean", label: "YES" };
  return { tone: "no-lean", label: "NO" };
}

export const MARKET_PROB_STYLES: Record<
  MarketProbTone,
  { text: string; label: string; bar: string }
> = {
  yes: {
    text: "text-emerald-400",
    label: "text-emerald-400/90",
    bar: "bg-emerald-500",
  },
  "yes-lean": {
    text: "text-emerald-400/85",
    label: "text-emerald-400/75",
    bar: "bg-emerald-500/70",
  },
  no: {
    text: "text-rose-400",
    label: "text-rose-400/90",
    bar: "bg-rose-500",
  },
  "no-lean": {
    text: "text-rose-400/85",
    label: "text-rose-400/75",
    bar: "bg-rose-500/70",
  },
  contested: {
    text: "text-amber-400",
    label: "text-amber-400/90",
    bar: "bg-amber-500",
  },
};
