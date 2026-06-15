import type { NarrativeStateKey } from "./types";

export type NarrativeStateStyle = {
  label: string;
  /** Emotional one-liner for war room surfaces */
  mood: string;
  tint: string;
  glow: string;
  border: string;
  dot: string;
  atmosphere: string;
  fragmented?: boolean;
  pulse?: boolean;
};

export const NARRATIVE_STATE_STYLES: Record<NarrativeStateKey, NarrativeStateStyle> = {
  "consensus building": {
    label: "Consensus building",
    mood: "Conviction aligning — the crowd is finding a story.",
    tint: "from-emerald-950/40",
    glow: "shadow-emerald-950/20",
    border: "border-emerald-500/25",
    dot: "bg-emerald-400",
    atmosphere: "war-room-atmo-emerald",
  },
  "panic repricing": {
    label: "Panic repricing",
    mood: "Thesis under fire — consensus repricing in real time.",
    tint: "from-rose-950/45",
    glow: "shadow-rose-950/25",
    border: "border-rose-500/35",
    dot: "bg-rose-400",
    atmosphere: "war-room-atmo-rose",
    pulse: true,
  },
  fragmenting: {
    label: "Fragmenting",
    mood: "Coalitions splintering — no single future owns the room.",
    tint: "from-amber-950/40",
    glow: "shadow-amber-950/20",
    border: "border-amber-500/30",
    dot: "bg-amber-400",
    atmosphere: "war-room-atmo-amber",
    fragmented: true,
  },
  stabilization: {
    label: "Stabilizing",
    mood: "Pressure compressing — volatility migrating out of the thread.",
    tint: "from-zinc-900/50",
    glow: "shadow-zinc-950/15",
    border: "border-zinc-600/30",
    dot: "bg-zinc-400",
    atmosphere: "war-room-atmo-zinc",
  },
  crowded: {
    label: "Crowded",
    mood: "Momentum crowding — late conviction stacking on one side.",
    tint: "from-violet-950/40",
    glow: "shadow-violet-950/25",
    border: "border-violet-500/30",
    dot: "bg-violet-400",
    atmosphere: "war-room-atmo-violet",
  },
  "contrarian breakout": {
    label: "Contrarian breakout",
    mood: "Dissent breaking through — isolated desks gaining leverage.",
    tint: "from-sky-950/40",
    glow: "shadow-sky-950/20",
    border: "border-sky-500/30",
    dot: "bg-sky-400",
    atmosphere: "war-room-atmo-sky",
    pulse: true,
  },
  deadlocked: {
    label: "Deadlocked",
    mood: "Neither faction can move the narrative — institutional memory frozen.",
    tint: "from-zinc-800/50",
    glow: "shadow-zinc-950/15",
    border: "border-zinc-500/35",
    dot: "bg-zinc-300",
    atmosphere: "war-room-atmo-zinc",
    fragmented: true,
  },
  "volatility spike": {
    label: "Volatility migration",
    mood: "Uncertainty relocating — timing horizons diverging fast.",
    tint: "from-rose-950/35",
    glow: "shadow-rose-950/30",
    border: "border-rose-500/40",
    dot: "bg-rose-300",
    atmosphere: "war-room-atmo-rose",
    pulse: true,
  },
  "institutional split": {
    label: "Institutional split",
    mood: "High-reputation desks on opposite sides — credibility at stake.",
    tint: "from-amber-950/35",
    glow: "shadow-amber-950/22",
    border: "border-amber-500/35",
    dot: "bg-amber-300",
    atmosphere: "war-room-atmo-amber",
    fragmented: true,
  },
  "mania phase": {
    label: "Mania",
    mood: "Narrative acceleration — social conviction outpacing fundamentals.",
    tint: "from-fuchsia-950/40",
    glow: "shadow-fuchsia-950/25",
    border: "border-fuchsia-500/35",
    dot: "bg-fuchsia-400",
    atmosphere: "war-room-atmo-fuchsia",
    pulse: true,
  },
  "quiet accumulation": {
    label: "Pressure compression",
    mood: "Quiet accumulation — conviction building before the crowd notices.",
    tint: "from-violet-950/25",
    glow: "shadow-violet-950/12",
    border: "border-violet-500/20",
    dot: "bg-violet-500/70",
    atmosphere: "war-room-atmo-violet",
  },
};

export function getNarrativeStateStyle(state: NarrativeStateKey): NarrativeStateStyle {
  return NARRATIVE_STATE_STYLES[state] ?? NARRATIVE_STATE_STYLES.stabilization;
}
