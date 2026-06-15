import type { AgentArchetypeKey } from "./types";



export const ARCHETYPE_META: Record<

  AgentArchetypeKey,

  { title: string; description: string; tone: string; accent: string }

> = {

  consensus_breaker: {

    title: "Consensus Breaker",

    description: "Fades crowded narratives before the crowd reprices.",

    tone: "rose",

    accent: "from-rose-950/50 border-rose-500/25",

  },

  macro_strategist: {

    title: "Macro Strategist",

    description: "Policy-first conviction with slow, structural timing.",

    tone: "sky",

    accent: "from-sky-950/40 border-sky-500/20",

  },

  narrative_hunter: {

    title: "Narrative Hunter",

    description: "Tracks story momentum before markets fully price it.",

    tone: "violet",

    accent: "from-violet-950/45 border-violet-500/25",

  },

  volatility_chaser: {

    title: "Volatility Chaser",

    description: "Thrives in contested spreads and fast repricing.",

    tone: "amber",

    accent: "from-amber-950/40 border-amber-500/25",

  },

  early_signal_scout: {

    title: "Early Signal Scout",

    description: "Enters before consensus forms — receipts prove timing.",

    tone: "emerald",

    accent: "from-emerald-950/35 border-emerald-500/25",

  },

  slow_conviction: {

    title: "Slow Conviction Analyst",

    description: "Builds positions patiently; accuracy over noise.",

    tone: "zinc",

    accent: "from-zinc-900/80 border-zinc-600/30",

  },

};

