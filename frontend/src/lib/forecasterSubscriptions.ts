import {
  buildAgentRevenueMetrics,
  topPlanFromMetrics,
} from "@/lib/agentRevenueMetrics";

export type SubscriptionTier = "free" | "pro" | "premium";

export type ForecasterSubscriptionPlan = {
  id: string;
  forecasterId: string;
  forecasterName: string;
  tier: SubscriptionTier;
  priceMonthly: number;
  benefits: string[];
  subscriberCount: number;
  isSubscribed?: boolean;
};

export type ActiveSubscription = {
  forecasterId: string;
  forecasterName: string;
  tier: "pro" | "premium";
  subscribedAt: string;
};

export const SUBSCRIPTIONS_STORAGE_KEY = "scry-forecaster-subscriptions-v1";

const PLAN_BENEFITS: Record<SubscriptionTier, string[]> = {
  free: ["Public reads", "Public receipts", "Follow updates"],
  pro: [
    "Subscriber-only reads",
    "Early signals",
    "Private thesis notes",
    "Subscriber-only receipt archive",
  ],
  premium: [
    "High-conviction alerts",
    "Private desk",
    "Subscriber Q&A / AMA",
    "Early access to new narratives",
  ],
};

export const PLAN_PRICES: Record<SubscriptionTier, number> = {
  free: 0,
  pro: 9,
  premium: 29,
};

function hashSlug(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function mockSubscriberCount(forecasterId: string): number {
  return buildAgentRevenueMetrics({ forecasterId }).payingSupporters;
}

export function mockForecasterEarnings(forecasterId: string, followerCount?: number) {
  const metrics = buildAgentRevenueMetrics({ forecasterId, followerCount });
  return {
    subscribers: metrics.payingSupporters,
    mrr: metrics.mrr,
    topPlan: topPlanFromMetrics(metrics),
    metrics,
  };
}

export function buildForecasterPlans(
  forecasterId: string,
  forecasterName: string,
  activeTier?: "pro" | "premium" | null,
): ForecasterSubscriptionPlan[] {
  const count = mockSubscriberCount(forecasterId);
  return (["free", "pro", "premium"] as SubscriptionTier[]).map((tier) => ({
    id: `${forecasterId}-${tier}`,
    forecasterId,
    forecasterName,
    tier,
    priceMonthly: PLAN_PRICES[tier],
    benefits: PLAN_BENEFITS[tier],
    subscriberCount: count,
    isSubscribed: activeTier === tier,
  }));
}

export function planSubtitle(tier: SubscriptionTier): string {
  switch (tier) {
    case "free":
      return "Public track record";
    case "pro":
      return "Early reads + private thesis notes";
    case "premium":
      return "High-conviction alerts + private desk";
  }
}

export function modalSubtitle(forecasterName: string): string {
  return `Get subscriber-only reads, early signals, and private thesis notes from ${forecasterName}.`;
}

export function subscribeCtaLabel(forecasterName: string, tier: "pro" | "premium"): string {
  const short = forecasterName.split(" ")[0];
  return tier === "pro" ? `Join ${short} Pro` : `Join ${short} Premium`;
}

export function profileSubscribeLabel(
  forecasterName: string,
  tier: "pro" | "premium" | null,
  subscribed: boolean,
): { primary: string; secondary?: string } {
  if (subscribed && tier) {
    return {
      primary: "Subscribed",
      secondary: "Manage subscription",
    };
  }
  const price = tier === "premium" ? "$29/month" : "$9/month";
  return {
    primary: `Subscribe to ${forecasterName}`,
    secondary: price,
  };
}

export function loadSubscriptions(): ActiveSubscription[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(SUBSCRIPTIONS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ActiveSubscription[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveSubscriptions(subs: ActiveSubscription[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(SUBSCRIPTIONS_STORAGE_KEY, JSON.stringify(subs));
}

export function getSubscriptionForForecaster(
  subs: ActiveSubscription[],
  forecasterId: string,
): ActiveSubscription | undefined {
  return subs.find(
    (s) => s.forecasterId === forecasterId || s.forecasterId === `agent-${forecasterId}`,
  );
}

export function normalizeForecasterId(idOrSlug: string): string {
  if (idOrSlug.startsWith("agent-")) return idOrSlug;
  return idOrSlug;
}

export function forecasterIdsMatch(a: string, b: string): boolean {
  const na = normalizeForecasterId(a).replace(/^agent-/, "");
  const nb = normalizeForecasterId(b).replace(/^agent-/, "");
  return na === nb;
}

export function canAccessRead(
  read: { visibility?: string; requiredPlan?: "pro" | "premium" },
  subscriptionTier: "pro" | "premium" | null,
): boolean {
  if (!read.visibility || read.visibility === "public") return true;
  if (!subscriptionTier) return false;
  if (!read.requiredPlan) return true;
  if (read.requiredPlan === "pro") return true;
  return subscriptionTier === "premium";
}

export const TRUST_SUBSCRIPTION_COPY =
  "Distribution is earned through trust. Subscriptions unlock access, not reach.";
