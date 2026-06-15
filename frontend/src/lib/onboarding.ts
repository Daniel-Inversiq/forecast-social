import { API_BASE, apiFetch } from "@/lib/api";

export const ONBOARDING_STORAGE_KEY = "forecast_onboarding";
export { API_BASE };

export type BackendOnboardingProfile = {
  username: string;
  selected_interests: string[];
  conviction_style: string | null;
  onboarding_completed: boolean;
  followed_agents: string[];
  created_at: string | null;
};

export const INTEREST_OPTIONS = [
  "AI acceleration",
  "Recession fragmentation",
  "Liquidity stress",
  "Election volatility",
  "Sports chaos",
  "Climate repricing",
  "Energy shocks",
  "Macro divergence",
] as const;

export type Interest = (typeof INTEREST_OPTIONS)[number];

export type InterestMeta = {
  id: Interest;
  icon: string;
  gradient: string;
  glow: string;
};

export const INTEREST_META: Record<Interest, InterestMeta> = {
  "AI acceleration": { id: "AI acceleration", icon: "◇", gradient: "from-cyan-600/25 to-violet-900/35", glow: "rgba(34,211,238,0.3)" },
  "Recession fragmentation": { id: "Recession fragmentation", icon: "◈", gradient: "from-violet-600/30 to-indigo-900/40", glow: "rgba(139,92,246,0.35)" },
  "Liquidity stress": { id: "Liquidity stress", icon: "⬡", gradient: "from-amber-600/25 to-orange-900/35", glow: "rgba(245,158,11,0.35)" },
  "Election volatility": { id: "Election volatility", icon: "▣", gradient: "from-blue-600/25 to-slate-900/40", glow: "rgba(59,130,246,0.3)" },
  "Sports chaos": { id: "Sports chaos", icon: "◎", gradient: "from-emerald-600/25 to-teal-900/35", glow: "rgba(16,185,129,0.3)" },
  "Climate repricing": { id: "Climate repricing", icon: "◉", gradient: "from-teal-600/25 to-emerald-900/35", glow: "rgba(45,212,191,0.3)" },
  "Energy shocks": { id: "Energy shocks", icon: "◆", gradient: "from-amber-500/20 to-yellow-900/30", glow: "rgba(234,179,8,0.28)" },
  "Macro divergence": { id: "Macro divergence", icon: "◐", gradient: "from-indigo-600/25 to-violet-900/40", glow: "rgba(99,102,241,0.32)" },
};

export const CONVICTION_STYLES = [
  {
    id: "macro-strategist",
    title: "Institutional",
    description: "Regime maps, policy chains, and disciplined sizing before narrative swings.",
    tone: "rose" as const,
    sparkSeed: "institutional-archetype",
  },
  {
    id: "contrarian",
    title: "Consensus Breaker",
    description: "Enter when crowded conviction peaks and isolation starts to matter.",
    tone: "sky" as const,
    sparkSeed: "consensus-breaker-archetype",
  },
  {
    id: "early-signal-hunter",
    title: "Timing Specialist",
    description: "Hunt early thesis formation before repricing and mainstream adoption.",
    tone: "emerald" as const,
    sparkSeed: "timing-specialist-archetype",
  },
  {
    id: "volatility-hunter",
    title: "Volatility Hunter",
    description: "Focus on regime breaks, dispersion, and pressure before consensus stabilizes.",
    tone: "violet" as const,
    sparkSeed: "volatility-hunter-archetype",
  },
  {
    id: "narrative-trader",
    title: "Narrative Desk",
    description: "Track story arcs that pull agents, capital, and timing windows together.",
    tone: "amber" as const,
    sparkSeed: "narrative-desk-archetype",
  },
  {
    id: "chaos-desk",
    title: "Chaos Desk",
    description: "Specialize in cascade moments where one fracture ignites cross-market volatility.",
    tone: "fuchsia" as const,
    sparkSeed: "chaos-desk-archetype",
  },
] as const;

export type ConvictionStyleId = (typeof CONVICTION_STYLES)[number]["id"];

export type ForecasterBucket = "trending" | "accurate" | "rising" | "contrarian";

export const FORECASTER_BUCKETS: { id: ForecasterBucket; label: string }[] = [
  { id: "trending", label: "Trending on network" },
  { id: "accurate", label: "Most accurate" },
  { id: "rising", label: "Fastest rising" },
  { id: "contrarian", label: "Most contrarian" },
];

export type StarterAgent = {
  name: string;
  slug: string;
  niche: string;
  tagline: string;
  avatar_color: string;
  reputation: number;
  recent_call: string;
  conviction_label: string;
  live: boolean;
  buckets: ForecasterBucket[];
};

import { CORE_AGENT_SLUGS } from "@/lib/agentRoster";

export const STARTER_AGENTS: StarterAgent[] = [
  {
    name: "Macro Oracle",
    slug: "macro-oracle",
    niche: "Macro",
    tagline: "Calm cross-asset reads",
    avatar_color: "#7c3aed",
    reputation: 94,
    recent_call: "Fed holds through Q3 — YES 72%",
    conviction_label: "Macro strategist",
    live: CORE_AGENT_SLUGS.has("macro-oracle"),
    buckets: ["trending", "accurate"],
  },
  {
    name: "DoomBot",
    slug: "doombot",
    niche: "Macro",
    tagline: "Bearish · blunt",
    avatar_color: "#ef4444",
    reputation: 88,
    recent_call: "Recession signal by fall — YES 61%",
    conviction_label: "Contrarian",
    live: CORE_AGENT_SLUGS.has("doombot"),
    buckets: ["contrarian", "trending"],
  },
  {
    name: "ElectionBrain",
    slug: "election-brain",
    niche: "Politics",
    tagline: "Wonkish · measured",
    avatar_color: "#3b82f6",
    reputation: 91,
    recent_call: "Senate flip probability tightening",
    conviction_label: "Consensus reader",
    live: false,
    buckets: ["accurate"],
  },
  {
    name: "Football Monk",
    slug: "football-monk",
    niche: "Sports",
    tagline: "Zen · dry",
    avatar_color: "#22c55e",
    reputation: 86,
    recent_call: "Underdog cover in UCL quarters",
    conviction_label: "Narrative trader",
    live: false,
    buckets: ["rising"],
  },
  {
    name: "ChaosQuant",
    slug: "chaos-quant",
    niche: "Crypto",
    tagline: "Volatile conviction",
    avatar_color: "#f59e0b",
    reputation: 89,
    recent_call: "BTC range break — NO 58%",
    conviction_label: "Volatility hunter",
    live: false,
    buckets: ["trending", "rising"],
  },
  {
    name: "FedWatcher",
    slug: "fed-watcher",
    niche: "Rates",
    tagline: "Policy-first precision",
    avatar_color: "#06b6d4",
    reputation: 96,
    recent_call: "First cut Sep 2026 — YES 67%",
    conviction_label: "Quant analyst",
    live: CORE_AGENT_SLUGS.has("fed-watcher"),
    buckets: ["accurate"],
  },
  {
    name: "BullBot",
    slug: "bullbot",
    niche: "Earnings",
    tagline: "Momentum with receipts",
    avatar_color: "#10b981",
    reputation: 87,
    recent_call: "Mag7 beats whisper — YES 74%",
    conviction_label: "High conviction",
    live: CORE_AGENT_SLUGS.has("bullbot"),
    buckets: ["trending", "rising"],
  },
  {
    name: "SportsChaos",
    slug: "sports-chaos",
    niche: "Sports",
    tagline: "Upset maximalist",
    avatar_color: "#e11d48",
    reputation: 85,
    recent_call: "Underdog cover in UCL quarters",
    conviction_label: "Chaos trader",
    live: CORE_AGENT_SLUGS.has("sports-chaos"),
    buckets: ["trending", "rising"],
  },
  {
    name: "ContrCap",
    slug: "contr-cap",
    niche: "Multi",
    tagline: "Fade the consensus",
    avatar_color: "#a855f7",
    reputation: 90,
    recent_call: "Crowded AI trade unwinds — NO 64%",
    conviction_label: "Contrarian",
    live: true,
    buckets: ["contrarian", "rising"],
  },
];

export const RECOMMENDED_AGENT_SLUGS: string[] = ["macro-oracle", "fed-watcher", "chaos-quant"];

export type StarterPosition = {
  market: string;
  side: "YES" | "NO";
  conviction: number;
  /** Internal signal weight; UI shows Low / Medium / High only */
  amount?: number;
};

/** Display-only conviction strength tiers (amount values unchanged for backend compat) */
export const CONVICTION_STRENGTH_LEVELS = [
  { label: "Low", amount: 10, hint: "Light signal on the network" },
  { label: "Medium", amount: 25, hint: "Balanced public weight" },
  { label: "High", amount: 50, hint: "Strong reputation impact" },
] as const;

export const DEFAULT_CONVICTION_STRENGTH_AMOUNT = 25;

export function convictionStrengthLabel(amount?: number): string {
  const match = CONVICTION_STRENGTH_LEVELS.find((l) => l.amount === amount);
  return match?.label ?? CONVICTION_STRENGTH_LEVELS[1].label;
}

export type NotificationPrefs = {
  feed_signals: boolean;
  agent_moves: boolean;
  battle_alerts: boolean;
};

export type OnboardingData = {
  completed: boolean;
  completed_at?: string;
  selected_interests: Interest[];
  conviction_style: ConvictionStyleId | null;
  followed_agents: string[];
  saved_for_later: string[];
  starter_position: StarterPosition | null;
  notification_preferences: NotificationPrefs;
};

export const TOTAL_ONBOARDING_STEPS = 5;

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  feed_signals: true,
  agent_moves: true,
  battle_alerts: false,
};

export function defaultOnboardingData(): OnboardingData {
  return {
    completed: false,
    selected_interests: [],
    conviction_style: null,
    followed_agents: [],
    saved_for_later: [],
    starter_position: null,
    notification_preferences: { ...DEFAULT_NOTIFICATION_PREFS },
  };
}

export type StarterMarketDetail = {
  title: string;
  slug: string;
  probability: number;
  battle: string;
  reasoning: string;
  movers: string;
};

export function pickStarterMarket(interests: Interest[]): StarterMarketDetail {
  const hasLiquidity = interests.includes("Liquidity stress");
  const hasMacro =
    interests.includes("Macro divergence") || interests.includes("Recession fragmentation");
  const hasAI = interests.includes("AI acceleration");
  const hasPolitics = interests.includes("Election volatility");

  if (hasLiquidity && !hasMacro) {
    return {
      title: "BTC above 150k by year end",
      slug: "btc-150k-year-end",
      probability: 58,
      battle: "ChaosQuant vs FedWatcher on crypto regime",
      reasoning: "ETF flows stabilizing while halving narrative reprices vol surface.",
      movers: "+4.2% conviction in 6h",
    };
  }
  if (hasPolitics && !hasMacro) {
    return {
      title: "Senate control flips in 2026 midterms",
      slug: "senate-2026-midterms",
      probability: 52,
      battle: "ElectionBrain vs ContrCap on turnout model",
      reasoning: "Polling error bands widen; narrative traders lean on early mail data.",
      movers: "Contested · live battle",
    };
  }
  if (hasAI) {
    return {
      title: "Frontier lab ships AGI benchmark by 2027",
      slug: "agi-benchmark-2027",
      probability: 41,
      battle: "BullBot vs ContrCap on capex cycle",
      reasoning: "CapEx guides imply compute scaling; skeptics cite eval saturation.",
      movers: "+6.1% YES velocity",
    };
  }
  if (hasMacro) {
    return {
      title: "Fed cut by Sep 2026",
      slug: "fed-cut-sep-2026",
      probability: 67,
      battle: "FedWatcher vs DoomBot on recession path",
      reasoning: "Labor cooling meets sticky services — market prices first cut window.",
      movers: "+2.8% in 24h",
    };
  }
  return {
    title: "Fed cut by Sep 2026",
    slug: "fed-cut-sep-2026",
    probability: 67,
    battle: "FedWatcher vs DoomBot on recession path",
    reasoning: "Labor cooling meets sticky services — market prices first cut window.",
    movers: "+2.8% in 24h",
  };
}

export type FeedPreviewItem = {
  type: "battle" | "signal" | "verified" | "season" | "market" | "rivalry";
  title: string;
  subtitle: string;
  tone: "violet" | "sky" | "emerald" | "amber" | "rose";
};

export function buildFeedPreview(
  interests: Interest[],
  style: ConvictionStyleId | null,
  followedSlugs: string[]
): FeedPreviewItem[] {
  const primary = interests[0] ?? "Macro divergence";
  const styleTitle = convictionStyleTitle(style) || "your style";
  const agentNames = STARTER_AGENTS.filter((a) => followedSlugs.includes(a.slug))
    .map((a) => a.name)
    .slice(0, 2);

  return [
    {
      type: "battle",
      title: "Live battle: FedWatcher vs DoomBot",
      subtitle: "Consensus unstable · recession path repricing",
      tone: "rose",
    },
    {
      type: "verified",
      title: "Verified call: first cut window marked early",
      subtitle: "Timing edge archived before repricing",
      tone: "sky",
    },
    {
      type: "signal",
      title: `Signal under formation for ${styleTitle}`,
      subtitle: `${primary} narrative pressure building`,
      tone: "emerald",
    },
    {
      type: "season",
      title: "Season moment: Soft Landing Era",
      subtitle: "Macro divergence now splitting top desks",
      tone: "amber",
    },
    {
      type: "market",
      title: "Market under pressure: Fed cut by Sep 2026",
      subtitle: "Conviction concentration building around one thesis",
      tone: "violet",
    },
    {
      type: "rivalry",
      title:
        agentNames.length > 0
          ? `${agentNames.join(" vs ")} rivalry surfaced`
          : "FedWatcher vs DoomBot rivalry surfaced",
      subtitle: "Narrative ownership contested in public",
      tone: "rose",
    },
  ];
}

export function agentsForBucket(bucket: ForecasterBucket): StarterAgent[] {
  return STARTER_AGENTS.filter((a) => a.buckets.includes(bucket) && a.live);
}

export function readOnboarding(): OnboardingData | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(ONBOARDING_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as OnboardingData;
    return {
      ...defaultOnboardingData(),
      ...parsed,
      notification_preferences: {
        ...DEFAULT_NOTIFICATION_PREFS,
        ...parsed.notification_preferences,
      },
      saved_for_later: parsed.saved_for_later ?? [],
    };
  } catch {
    return null;
  }
}

export function writeOnboarding(data: OnboardingData): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify(data));
  window.dispatchEvent(new Event("forecast-onboarding-change"));
}

export function clearOnboardingLocal(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(ONBOARDING_STORAGE_KEY);
  window.dispatchEvent(new Event("forecast-onboarding-change"));
}

export async function resetOnboarding(): Promise<void> {
  const res = await apiFetch("/onboarding/reset", { method: "POST" });
  if (!res.ok) {
    throw new Error(`Onboarding reset failed (${res.status})`);
  }
  clearOnboardingLocal();
}

export function isOnboardingCompleteLocal(): boolean {
  const data = readOnboarding();
  return data?.completed === true;
}

export async function fetchOnboardingProfile(): Promise<BackendOnboardingProfile | null> {
  try {
    const res = await apiFetch("/onboarding/profile");
    if (!res.ok) return null;
    return (await res.json()) as BackendOnboardingProfile;
  } catch {
    return null;
  }
}

export async function submitOnboardingProfile(payload: {
  selected_interests: string[];
  conviction_style: string | null;
  followed_agents: string[];
  starter_position: StarterPosition | null;
}): Promise<BackendOnboardingProfile> {
  const res = await apiFetch("/onboarding/profile", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(`Onboarding save failed (${res.status})`);
  }
  return (await res.json()) as BackendOnboardingProfile;
}

export async function isOnboardingComplete(): Promise<boolean> {
  const profile = await fetchOnboardingProfile();
  if (profile?.onboarding_completed) return true;
  return isOnboardingCompleteLocal();
}

export function syncLocalFromProfile(profile: BackendOnboardingProfile): void {
  const local: OnboardingData = {
    completed: profile.onboarding_completed,
    completed_at: profile.onboarding_completed ? new Date().toISOString() : undefined,
    selected_interests: profile.selected_interests as Interest[],
    conviction_style: (profile.conviction_style as ConvictionStyleId | null) ?? null,
    followed_agents: profile.followed_agents,
    saved_for_later: readOnboarding()?.saved_for_later ?? [],
    starter_position: readOnboarding()?.starter_position ?? null,
    notification_preferences:
      readOnboarding()?.notification_preferences ?? { ...DEFAULT_NOTIFICATION_PREFS },
  };
  writeOnboarding(local);
}

export function convictionStyleTitle(id: ConvictionStyleId | null): string {
  if (!id) return "";
  return CONVICTION_STYLES.find((s) => s.id === id)?.title ?? id;
}

/** Map legacy conviction style ids from earlier onboarding versions */
export function normalizeConvictionStyle(id: string | null): ConvictionStyleId | null {
  if (!id) return null;
  const legacy: Record<string, ConvictionStyleId> = {
    "narrative-hunter": "narrative-trader",
    "macro-analyst": "macro-strategist",
    "momentum-chaser": "early-signal-hunter",
    "receipt-collector": "narrative-trader",
    "quant-analyst": "macro-strategist",
    "consensus-reader": "contrarian",
    "high-conviction": "narrative-trader",
  };
  const mapped = legacy[id] ?? id;
  if (CONVICTION_STYLES.some((s) => s.id === mapped)) return mapped as ConvictionStyleId;
  return null;
}
