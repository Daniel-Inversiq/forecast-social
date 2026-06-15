/** Subtle atmosphere shifts per era category — not full themes. */
export type EraAtmosphere = {
  categoryKey: string;
  label: string;
  heroBorder: string;
  heroGradient: string;
  accentText: string;
  accentMuted: string;
  statHighlight: string;
  glowShadow: string;
  phaseMarker: string;
  railTint: string;
};

const ERA_MAP: Record<string, EraAtmosphere> = {
  macro: {
    categoryKey: "macro",
    label: "Macro regime",
    heroBorder: "border-amber-500/15",
    heroGradient: "from-amber-950/30 via-zinc-950/50 to-zinc-950/40",
    accentText: "text-amber-400/85",
    accentMuted: "text-amber-500/50",
    statHighlight: "border-amber-500/25 bg-gradient-to-br from-amber-950/35 to-zinc-900/40",
    glowShadow: "0 0 56px -18px rgba(245, 158, 11, 0.14)",
    phaseMarker: "bg-amber-500/60 ring-amber-500/20",
    railTint: "border-amber-900/40",
  },
  ai: {
    categoryKey: "ai",
    label: "AI regime",
    heroBorder: "border-cyan-500/15",
    heroGradient: "from-cyan-950/25 via-zinc-950/50 to-violet-950/15",
    accentText: "text-cyan-400/85",
    accentMuted: "text-cyan-500/45",
    statHighlight: "border-cyan-500/25 bg-gradient-to-br from-cyan-950/30 to-zinc-900/40",
    glowShadow: "0 0 56px -18px rgba(34, 211, 238, 0.1)",
    phaseMarker: "bg-cyan-500/55 ring-cyan-500/20",
    railTint: "border-cyan-900/35",
  },
  tech: {
    categoryKey: "ai",
    label: "AI regime",
    heroBorder: "border-cyan-500/15",
    heroGradient: "from-cyan-950/25 via-zinc-950/50 to-violet-950/15",
    accentText: "text-cyan-400/85",
    accentMuted: "text-cyan-500/45",
    statHighlight: "border-cyan-500/25 bg-gradient-to-br from-cyan-950/30 to-zinc-900/40",
    glowShadow: "0 0 56px -18px rgba(34, 211, 238, 0.1)",
    phaseMarker: "bg-cyan-500/55 ring-cyan-500/20",
    railTint: "border-cyan-900/35",
  },
  crypto: {
    categoryKey: "crypto",
    label: "Crypto regime",
    heroBorder: "border-violet-500/15",
    heroGradient: "from-violet-950/28 via-zinc-950/50 to-fuchsia-950/12",
    accentText: "text-violet-400/85",
    accentMuted: "text-violet-500/45",
    statHighlight: "border-violet-500/25 bg-gradient-to-br from-violet-950/30 to-zinc-900/40",
    glowShadow: "0 0 56px -18px rgba(139, 92, 246, 0.12)",
    phaseMarker: "bg-violet-500/55 ring-violet-500/20",
    railTint: "border-violet-900/35",
  },
  politics: {
    categoryKey: "politics",
    label: "Political arc",
    heroBorder: "border-rose-500/15",
    heroGradient: "from-rose-950/25 via-zinc-950/50 to-zinc-950/40",
    accentText: "text-rose-400/85",
    accentMuted: "text-rose-500/45",
    statHighlight: "border-rose-500/25 bg-gradient-to-br from-rose-950/28 to-zinc-900/40",
    glowShadow: "0 0 56px -18px rgba(244, 63, 94, 0.1)",
    phaseMarker: "bg-rose-500/55 ring-rose-500/20",
    railTint: "border-rose-900/35",
  },
  climate: {
    categoryKey: "climate",
    label: "Climate regime",
    heroBorder: "border-emerald-500/15",
    heroGradient: "from-emerald-950/22 via-zinc-950/50 to-zinc-950/40",
    accentText: "text-emerald-400/85",
    accentMuted: "text-emerald-500/45",
    statHighlight: "border-emerald-500/25 bg-gradient-to-br from-emerald-950/25 to-zinc-900/40",
    glowShadow: "0 0 56px -18px rgba(52, 211, 153, 0.1)",
    phaseMarker: "bg-emerald-500/55 ring-emerald-500/20",
    railTint: "border-emerald-900/35",
  },
  sports: {
    categoryKey: "sports",
    label: "Sports cascade",
    heroBorder: "border-orange-500/15",
    heroGradient: "from-orange-950/25 via-zinc-950/50 to-red-950/12",
    accentText: "text-orange-400/85",
    accentMuted: "text-orange-500/45",
    statHighlight: "border-orange-500/25 bg-gradient-to-br from-orange-950/28 to-zinc-900/40",
    glowShadow: "0 0 56px -18px rgba(249, 115, 22, 0.1)",
    phaseMarker: "bg-orange-500/55 ring-orange-500/20",
    railTint: "border-orange-900/35",
  },
};

const DEFAULT_ERA = ERA_MAP.macro;

export function getEraAtmosphere(category: string): EraAtmosphere {
  const key = category.toLowerCase().replace(/\s+/g, "-");
  if (ERA_MAP[key]) return ERA_MAP[key];
  if (/ai|tech|semiconductor/i.test(key)) return ERA_MAP.ai;
  if (/crypto|btc|eth/i.test(key)) return ERA_MAP.crypto;
  if (/politic|election/i.test(key)) return ERA_MAP.politics;
  if (/climate|carbon|energy/i.test(key)) return ERA_MAP.climate;
  if (/sport|league|injury/i.test(key)) return ERA_MAP.sports;
  return DEFAULT_ERA;
}

export const CONSENSUS_LABELS: Record<string, string> = {
  unified: "Unified consensus",
  fragmenting: "Fragmenting",
  polarized: "Polarized",
  collapsing: "Regime collapse",
};

export const REGIME_PHASE_LABELS = [
  "Narrative formation",
  "Consensus build",
  "Fragmentation",
  "Repricing",
  "Collapse",
  "Aftermath",
] as const;
