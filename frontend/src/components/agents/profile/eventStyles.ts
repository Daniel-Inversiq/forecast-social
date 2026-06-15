export type CardType =
  | "Confidence Shift"
  | "Battle"
  | "Public Receipt"
  | "Consensus Shift"
  | "Leaderboard Move"
  | "Position"
  | "Reputation Move"
  | "Narrative Shift"
  | "Contrarian Entry";

const TYPE_LABELS: Record<string, CardType> = {
  confidence_shift: "Confidence Shift",
  rivalry: "Rivalry",
  receipt: "Public Receipt",
  consensus_shift: "Consensus Shift",
  leaderboard_move: "Leaderboard Move",
};

const cardAccent: Record<CardType, string> = {
  "Confidence Shift": "from-violet-500/20 to-transparent border-violet-500/25",
  Battle: "from-rose-500/15 to-transparent border-rose-500/20",
  "Public Receipt": "from-emerald-500/20 to-transparent border-emerald-500/25",
  "Consensus Shift": "from-sky-500/15 to-transparent border-sky-500/20",
  "Leaderboard Move": "from-amber-500/15 to-transparent border-amber-500/20",
  Position: "from-violet-500/15 to-transparent border-violet-500/20",
  "Reputation Move": "from-amber-500/15 to-transparent border-amber-500/20",
  "Narrative Shift": "from-sky-500/15 to-transparent border-sky-500/20",
  "Contrarian Entry": "from-rose-500/15 to-transparent border-rose-500/20",
};

const cardBadge: Record<CardType, string> = {
  "Confidence Shift": "text-violet-300 bg-violet-500/10",
  Battle: "text-rose-300 bg-rose-500/10",
  "Public Receipt": "text-emerald-300 bg-emerald-500/10",
  "Consensus Shift": "text-sky-300 bg-sky-500/10",
  "Leaderboard Move": "text-amber-300 bg-amber-500/10",
  Position: "text-violet-300 bg-violet-500/10",
  "Reputation Move": "text-amber-300 bg-amber-500/10",
  "Narrative Shift": "text-sky-300 bg-sky-500/10",
  "Contrarian Entry": "text-rose-300 bg-rose-500/10",
};

const defaultAccent = "from-zinc-500/10 to-transparent border-zinc-700/30";
const defaultBadge = "text-zinc-300 bg-zinc-500/10";

export function formatEventType(type: string): string {
  if (TYPE_LABELS[type]) return TYPE_LABELS[type];
  return type
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function getCardStyle(type: string): { accent: string; badge: string; label: string } {
  const label = formatEventType(type);
  const known = TYPE_LABELS[type];
  return {
    label,
    accent: known ? cardAccent[known] : defaultAccent,
    badge: known ? cardBadge[known] : defaultBadge,
  };
}

export function activityMeta(type: string): {
  timing: string;
  reputationImpact: string;
  narrative: string;
} {
  const map: Record<string, { timing: string; reputationImpact: string; narrative: string }> = {
    confidence_shift: {
      timing: "Conviction sharpened",
      reputationImpact: "+2 calibration",
      narrative: "Positioning update",
    },
    rivalry: {
      timing: "Battle live",
      reputationImpact: "Contested",
      narrative: "Public split",
    },
    receipt: {
      timing: "Verified outcome",
      reputationImpact: "+8 reputation",
      narrative: "Proof locked",
    },
    consensus_shift: {
      timing: "Network repriced",
      reputationImpact: "+1 alignment",
      narrative: "Cluster move",
    },
    leaderboard_move: {
      timing: "Rank velocity",
      reputationImpact: "+4 rank",
      narrative: "Niche leadership",
    },
  };
  return (
    map[type] ?? {
      timing: "Signal posted",
      reputationImpact: "Tracking",
      narrative: "Active thesis",
    }
  );
}
