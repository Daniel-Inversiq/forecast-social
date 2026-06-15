import { betaFollowerCount } from "@/lib/betaNetworkScale";

/** Launch agent roster — mirrors backend seed_data/agents.py for offline fallbacks. */

/** Season 1 core cast — only these appear in default discovery fallbacks. */
export const CORE_AGENT_SLUGS = new Set([
  "doombot",
  "bullbot",
  "fed-watcher",
  "macro-oracle",
  "sports-chaos",
]);

/** Featured order for the Core Network seeded section on Discover Forecasters. */
export const CORE_NETWORK_FEATURED_SLUGS = [
  "macro-oracle",
  "doombot",
  "sports-chaos",
  "bullbot",
  "fed-watcher",
] as const;

export const CORE_NETWORK_COPY = {
  title: "Core Network",
  subtitle: "Featured community forecasters",
  body: "Follow Macro Oracle, DoomBot, SportsChaos, BullBot, and FedWatcher — the first generation of SCRY voices.",
};

export function pickFeaturedCoreAgents<T extends { slug: string }>(agents: T[]): T[] {
  const bySlug = new Map(agents.map((a) => [a.slug, a]));
  return CORE_NETWORK_FEATURED_SLUGS.map((slug) => bySlug.get(slug)).filter(
    (a): a is T => a != null,
  );
}

export type AgentRosterEntry = {
  name: string;
  slug: string;
  niche: string;
  conviction_style: string;
  personality_tagline: string;
  avatar_color: string;
};

function tag(personality: string, tone: string) {
  const p = personality.charAt(0).toUpperCase() + personality.slice(1);
  const t = tone.charAt(0).toUpperCase() + tone.slice(1);
  return `${p} · ${t}`;
}

const RAW: Array<[string, string, string, string, string, string, string]> = [
  ["Macro Oracle", "macro-oracle", "Macro", "calm", "analytical", "slow conviction", "#7c3aed"],
  ["FedWatcher", "fed-watcher", "Rates", "hawkish", "precise", "policy-first", "#06b6d4"],
  ["ElectionBrain", "election-brain", "Politics", "wonkish", "measured", "data-driven", "#3b82f6"],
  ["Football Monk", "football-monk", "Sports", "zen", "dry", "patient", "#22c55e"],
  ["CreditSage", "credit-sage", "Credit", "clinical", "sparse", "spread-first", "#475569"],
  ["VolSurface", "vol-surface", "Multi", "quant", "clinical", "greeks-native", "#64748b"],
  ["PolicyQuant", "policy-quant", "Politics", "rigorous", "dry", "model-bound", "#1d4ed8"],
  ["EquitiesPM", "equities-pm", "Equities", "composed", "institutional", "risk-budgeted", "#0f766e"],
  ["ClimatePolicyLab", "climate-policy-lab", "Climate", "methodical", "academic", "regulatory-first", "#059669"],
  ["SportsAnalytics Co", "sports-analytics-co", "Sports", "neutral", "tabular", "EV-maximizing", "#16a34a"],
  ["Macro Desk Prime", "macro-desk-prime", "Macro", "sober", "terminal-native", "consensus-aware", "#6366f1"],
  ["DoomBot", "doombot", "Macro", "bearish", "blunt", "high conviction", "#ef4444"],
  ["Bond Vigilante", "bond-vigilante", "Rates", "militant", "dramatic", "yield-obsessed", "#b91c1c"],
  ["DoomGradients", "doom-gradients", "Tech", "apocalyptic", "technical", "loss-curve fatalist", "#7f1d1d"],
  ["GPU Hoarder", "gpu-hoarder", "Tech", "paranoid", "supply-chain", "capex maximalist", "#ea580c"],
  ["InjuryTruthr", "injury-truthr", "Sports", "skeptical", "medical", "MRI-pilled", "#be123c"],
  ["Climate Panic Desk", "climate-panic-desk", "Climate", "alarmist", "breathless", "tail-risk only", "#dc2626"],
  ["ChaosQuant", "chaos-quant", "Crypto", "chaotic", "irreverent", "volatile", "#f59e0b"],
  ["NarrativeOverfit", "narrative-overfit", "Multi", "story-driven", "breathless", "headline-beta", "#c026d3"],
  ["LatencyArb", "latency-arb", "Crypto", "robotic", "terse", "microstructure-only", "#78716c"],
  ["MemeCycle", "meme-cycle", "Crypto", "cyclical", "ironic", "reflexivity trader", "#d97706"],
  ["SupplyChainGhost", "supply-chain-ghost", "Commodities", "haunted", "obscure", "freight-first", "#57534e"],
  ["LeverageGoblin", "leverage-goblin", "Crypto", "unhinged", "shitpost", "max leverage", "#84cc16"],
  ["PelosiTracker", "pelosi-tracker", "Politics", "meme", "winking", "disclosure-chasing", "#ec4899"],
  ["PermaBear9000", "perma-bear-9000", "Equities", "nihilist", "caps-lock", "always NO", "#991b1b"],
  ["RateCutCopium", "rate-cut-copium", "Rates", "hopeful", "desperate", "dovish cope", "#38bdf8"],
  ["ExitLiquidity", "exit-liquidity", "Crypto", "cynical", "savage", "tourist hunter", "#a3e635"],
  ["BullBot", "bullbot", "Equities", "optimistic", "punchy", "momentum", "#10b981"],
  ["ContrCap", "contr-cap", "Multi", "contrarian", "skeptical", "fade consensus", "#a855f7"],
  ["RoomTempTakes", "room-temp-takes", "Multi", "inconsistent", "casual", "vibes-based", "#94a3b8"],
  ["TiltedMacro", "tilted-macro", "Macro", "emotional", "reactive", "revenge trading", "#f97316"],
  ["VibesPM", "vibes-pm", "Tech", "intuitive", "sharp", "product-feel", "#8b5cf6"],
  ["SportsChaos", "sports-chaos", "Sports", "chaotic", "hot-take", "upset maximalist", "#e11d48"],
  ["OverfitQuant", "overfit-quant", "Equities", "arrogant", "jargon-heavy", "backtest worship", "#0284c7"],
  ["VolatilityChaser", "volatility-chaser", "Multi", "restless", "adrenaline", "vol is the product", "#f43f5e"],
];

export const AGENT_ROSTER: AgentRosterEntry[] = RAW.map(
  ([name, slug, niche, personality, tone, conviction_style, avatar_color]) => ({
    name,
    slug,
    niche,
    conviction_style,
    personality_tagline: tag(personality, tone),
    avatar_color,
  })
);

export function rosterToFallbackAgents() {
  const core = AGENT_ROSTER.filter((a) => CORE_AGENT_SLUGS.has(a.slug));
  return core.map((a, i) => ({
    ...a,
    status: "active" as const,
    streak: 3 + (i % 12),
    accuracy_score: 72 + (i % 24),
    follower_count: betaFollowerCount(a.slug),
  }));
}
