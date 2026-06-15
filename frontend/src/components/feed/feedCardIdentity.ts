import type { FeedEvent } from "./feedMix";

/** RGB triplets for subtle tints (5–12% opacity applied in CSS). */
export type RgbTint = readonly [number, number, number];

export type AgentArchetype =
  | "macro"
  | "crypto"
  | "ai"
  | "sports"
  | "politics"
  | "meme"
  | "institutional"
  | "climate"
  | "default";

export type EventAtmosphere =
  | "default"
  | "battle"
  | "verified"
  | "move"
  | "narrative"
  | "position"
  | "reputation";

export type CardIdentityTheme = {
  tint: RgbTint;
  archetype: AgentArchetype;
  eventAtmosphere: EventAtmosphere;
  /** CSS class for event-specific atmosphere */
  eventClass: string;
  /** Agent slug override label for debugging */
  label: string;
};

const AGENT_TINTS: Record<string, RgbTint> = {
  // Macro / rates — deep burgundy & institutional
  "fed-watcher": [88, 52, 68],
  "macro-oracle": [95, 48, 62],
  "bond-vigilante": [82, 58, 72],
  "macro-desk-prime": [72, 78, 98],
  "tilted-macro": [100, 55, 65],
  "rate-cut-copium": [92, 50, 58],
  "credit-sage": [70, 82, 105],
  "room-temp-takes": [78, 80, 95],

  // Doom / bear — aggressive red
  doombot: [140, 38, 48],
  "perma-bear-9000": [135, 42, 52],
  "doom-gradients": [128, 36, 50],
  "supply-chain-ghost": [118, 48, 55],

  // High vol / meme
  "leverage-goblin": [235, 118, 42],
  "chaos-quant": [248, 108, 38],
  "exit-liquidity": [228, 145, 48],
  "volatility-chaser": [242, 125, 50],

  // Politics — gold + cobalt
  "pelosi-tracker": [198, 162, 72],
  "election-brain": [58, 92, 168],

  // Sports / medical green
  "injury-truthr": [42, 148, 102],
  "football-monk": [38, 132, 88],

  // AI / tech — electric violet
  "gpu-hoarder": [124, 82, 235],
  bullbot: [118, 78, 228],
  "latency-arb": [108, 92, 220],

  // Climate
  "contr-cap": [48, 132, 98],
  "climate-panic-desk": [52, 128, 105],
  "climate-policy-lab": [55, 125, 100],
};

const NICHE_TINTS: { pattern: RegExp; tint: RgbTint; archetype: AgentArchetype }[] = [
  { pattern: /macro|fed|rates|bond|recession|inflation/i, tint: [88, 52, 68], archetype: "macro" },
  { pattern: /crypto|btc|eth|defi|chain/i, tint: [210, 118, 48], archetype: "crypto" },
  { pattern: /ai|tech|gpu|neural|chip|nvda/i, tint: [124, 82, 235], archetype: "ai" },
  { pattern: /sport|football|nba|injury|medical/i, tint: [42, 148, 102], archetype: "sports" },
  { pattern: /politic|election|policy|congress/i, tint: [58, 92, 168], archetype: "politics" },
  { pattern: /meme|chaos|degen|goblin|copium/i, tint: [235, 118, 42], archetype: "meme" },
  { pattern: /climate|carbon|green/i, tint: [48, 132, 98], archetype: "climate" },
  { pattern: /institutional|prime|desk|oracle/i, tint: [72, 78, 98], archetype: "institutional" },
];

const DEFAULT_TINT: RgbTint = [90, 88, 110];

const EVENT_ATMOSPHERE: Record<string, EventAtmosphere> = {
  rivalry: "battle",
  battle_escalation: "battle",
  receipt: "verified",
  verified_call: "verified",
  market_move: "move",
  confidence_shift: "move",
  signal_shift: "move",
  consensus_shift: "narrative",
  narrative_acceleration: "narrative",
  position_update: "position",
  new_take: "position",
  leaderboard_move: "reputation",
  reputation_move: "reputation",
};

function tintFromNiche(niche: string | undefined): { tint: RgbTint; archetype: AgentArchetype } | null {
  if (!niche) return null;
  for (const row of NICHE_TINTS) {
    if (row.pattern.test(niche)) return { tint: row.tint, archetype: row.archetype };
  }
  return null;
}

function blendTints(a: RgbTint, b: RgbTint, weightB: number): RgbTint {
  const w = Math.max(0, Math.min(1, weightB));
  return [
    Math.round(a[0] * (1 - w) + b[0] * w),
    Math.round(a[1] * (1 - w) + b[1] * w),
    Math.round(a[2] * (1 - w) + b[2] * w),
  ] as RgbTint;
}

/** Slight directional bias for market moves */
function moveTintBias(event: FeedEvent, base: RgbTint): RgbTint {
  const delta = event.movement_delta ?? 0;
  if (delta > 2) return blendTints(base, [55, 140, 105], 0.22);
  if (delta < -2) return blendTints(base, [140, 55, 65], 0.22);
  return base;
}

export function resolveCardIdentity(event: FeedEvent): CardIdentityTheme {
  const slug = event.agent.slug?.toLowerCase() ?? "";
  const agentTint = AGENT_TINTS[slug];
  const nicheMatch = tintFromNiche(event.agent.niche);

  let tint: RgbTint = agentTint ?? nicheMatch?.tint ?? DEFAULT_TINT;
  let archetype: AgentArchetype = agentTint
    ? archetypeFromSlug(slug)
    : nicheMatch?.archetype ?? "default";

  if (!agentTint && nicheMatch) {
    archetype = nicheMatch.archetype;
  }

  const eventAtmosphere = EVENT_ATMOSPHERE[event.type] ?? "default";
  if (eventAtmosphere === "move") {
    tint = moveTintBias(event, tint);
  }

  return {
    tint,
    archetype,
    eventAtmosphere,
    eventClass: `feed-card-event-${eventAtmosphere}`,
    label: slug || archetype,
  };
}

function archetypeFromSlug(slug: string): AgentArchetype {
  if (/doom|bear|ghost/.test(slug)) return "macro";
  if (/goblin|chaos|exit|volatility|copium/.test(slug)) return "meme";
  if (/fed|macro|bond|credit|desk/.test(slug)) return "institutional";
  if (/injury|football|monk/.test(slug)) return "sports";
  if (/election|pelosi/.test(slug)) return "politics";
  if (/gpu|bull|latency/.test(slug)) return "ai";
  if (/climate|contr/.test(slug)) return "climate";
  return "default";
}

export function tintToCssVars(
  tint: RgbTint,
  streamBoost = false,
): Record<string, string | number> {
  const [r, g, b] = tint;
  const alpha = streamBoost ? 0.11 : 0.07;
  const hoverAlpha = streamBoost ? 0.16 : 0.1;
  return {
    "--card-tint-r": r,
    "--card-tint-g": g,
    "--card-tint-b": b,
    "--card-tint-a": alpha,
    "--card-tint-hover": hoverAlpha,
  };
}

export function streamPulseClass(event: FeedEvent): string {
  if (event.show_new) return "feed-card-stream-pulse";
  if (event.is_streamed && event.streamed_at) {
    const age = Date.now() - event.streamed_at;
    if (age < 12_000) return "feed-card-stream-fade";
  }
  return "";
}
