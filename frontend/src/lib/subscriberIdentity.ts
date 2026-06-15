import type { TrustTierKey } from "@/lib/trust";
import { TRUST_TIERS } from "@/lib/trust";

function hashSlug(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

const AVATAR_COLORS = [
  "#7c3aed",
  "#0ea5e9",
  "#10b981",
  "#f59e0b",
  "#f43f5e",
  "#8b5cf6",
  "#06b6d4",
  "#84cc16",
];

const SUPPORTER_NAMES = [
  "MacroKid",
  "RateWatcher",
  "BullBotFollower",
  "VolSurface",
  "LiquidityLens",
  "GammaGhost",
  "CurveCritic",
  "BasisTrader",
  "FedWhisper",
  "InflationHawk",
  "SoftLandingSkeptic",
  "TermPremium",
  "CrossAssetKit",
  "NarrativeScout",
  "ReceiptCollector",
  "ConvictionStack",
  "TimingEdge",
  "ConsensusFade",
  "DeskNotes",
  "SignalArchivist",
];

const RANK_PREFIXES = ["Macro", "Rates", "Crypto", "AI", "Geopolitics", "Equities", "Vol"];

export type SupporterIdentity = {
  id: string;
  name: string;
  handle: string;
  avatarColor: string;
  trustTierKey: TrustTierKey;
  trustTierLabel: string;
  rankLabel: string;
  globalRank: number;
  credibility: number;
  subscriptionTier: "pro" | "premium";
  subscribedAt: string;
  activityScore: number;
};

export type SupporterIdentityRoster = {
  recent: SupporterIdentity[];
  newest: SupporterIdentity[];
  highestCredibility: SupporterIdentity[];
  topRanked: SupporterIdentity[];
  mostActive: SupporterIdentity[];
  subscriberSince: SupporterIdentity[];
};

const TRUST_POOL: TrustTierKey[] = ["emerging", "trusted", "ranked", "elite", "trusted", "ranked"];

function daysAgoIso(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

function tierLabel(key: TrustTierKey): string {
  return TRUST_TIERS.find((t) => t.key === key)?.label ?? key;
}

function buildSupporter(forecasterId: string, index: number, total: number): SupporterIdentity {
  const h = hashSlug(`${forecasterId}:supporter:${index}`);
  const name = SUPPORTER_NAMES[index % SUPPORTER_NAMES.length];
  const trustTierKey = TRUST_POOL[h % TRUST_POOL.length];
  const globalRank = 8 + ((h + index * 17) % 420);
  const niche = RANK_PREFIXES[h % RANK_PREFIXES.length];
  const credibility = 18 + (h % 52) + index * 3;
  const subscriptionTier: "pro" | "premium" = name === "MacroKid" ? "premium" : "pro";
  const subscribedDaysAgo = 2 + ((h + index * 3) % 340);
  const activityScore = 12 + (h % 88) + (total - index) * 2;

  return {
    id: `${forecasterId}-supporter-${index}`,
    name,
    handle: name.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase(),
    avatarColor: AVATAR_COLORS[h % AVATAR_COLORS.length],
    trustTierKey,
    trustTierLabel: tierLabel(trustTierKey),
    rankLabel: `#${globalRank} ${niche}`,
    globalRank,
    credibility,
    subscriptionTier,
    subscribedAt: daysAgoIso(subscribedDaysAgo),
    activityScore,
  };
}

function uniqueById(list: SupporterIdentity[]): SupporterIdentity[] {
  const seen = new Set<string>();
  return list.filter((s) => {
    if (seen.has(s.id)) return false;
    seen.add(s.id);
    return true;
  });
}

export function buildSupporterIdentityRoster(
  forecasterId: string,
  subscriberCount: number,
): SupporterIdentityRoster {
  const count = Math.max(8, Math.min(SUPPORTER_NAMES.length, subscriberCount));
  const all = Array.from({ length: count }, (_, i) => buildSupporter(forecasterId, i, count));

  const ensureExamples = (list: SupporterIdentity[]): SupporterIdentity[] => {
    const names = new Set(list.map((s) => s.name));
    const examples = all.filter((s) =>
      ["MacroKid", "RateWatcher", "BullBotFollower"].includes(s.name),
    );
    const missing = examples.filter((s) => !names.has(s.name));
    return [...list, ...missing].slice(0, 6);
  };

  const recent = ensureExamples(
    [...all].sort(
      (a, b) => new Date(b.subscribedAt).getTime() - new Date(a.subscribedAt).getTime(),
    ),
  ).slice(0, 5);

  const newest = [...all]
    .sort((a, b) => new Date(b.subscribedAt).getTime() - new Date(a.subscribedAt).getTime())
    .slice(0, 6);

  const highestCredibility = [...all]
    .sort((a, b) => b.credibility - a.credibility)
    .slice(0, 6);

  const topRanked = [...all].sort((a, b) => a.globalRank - b.globalRank).slice(0, 6);

  const mostActive = [...all].sort((a, b) => b.activityScore - a.activityScore).slice(0, 6);

  const subscriberSince = [...all]
    .sort((a, b) => new Date(a.subscribedAt).getTime() - new Date(b.subscribedAt).getTime())
    .slice(0, 8);

  return {
    recent: uniqueById(recent),
    newest: uniqueById(newest),
    highestCredibility: uniqueById(highestCredibility),
    topRanked: uniqueById(topRanked),
    mostActive: uniqueById(mostActive),
    subscriberSince: uniqueById(subscriberSince),
  };
}

export const SUPPORTER_IDENTITY_TAGLINE = "People paying for your intelligence";
