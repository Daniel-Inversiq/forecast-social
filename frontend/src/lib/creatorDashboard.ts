import {
  buildAgentRevenueMetrics,
  conversionPctFromMetrics,
  computeAgentMrr,
  type AgentRevenueMetrics,
} from "@/lib/agentRevenueMetrics";

function hashSlug(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export type CreatorReadConversion = {
  title: string;
  views: number;
  subscriberConversions: number;
  conversionPct: number;
};

export type CreatorDashboardStats = {
  audience: {
    followers: number;
    subscribers: number;
    conversionPct: number;
  };
  revenue: {
    mrr: number;
    proCount: number;
    premiumCount: number;
  };
  growth: {
    last7: { subscribers: number; mrrDelta: number };
    last30: { subscribers: number; mrrDelta: number };
  };
  topConvertingReads: CreatorReadConversion[];
  funnel: {
    credibility: number;
    followers: number;
    subscribers: number;
  };
};

const FALLBACK_READ_TITLES = [
  "Fed cut before September",
  "Labor stickiness breaks the soft-landing narrative",
  "ETF flow pushes BTC through year-end targets",
  "FOMC holds until credibility window closes",
];

function mockReadConversion(
  title: string,
  forecasterId: string,
  index: number,
): CreatorReadConversion {
  const h = hashSlug(`${forecasterId}:${title}:${index}`);
  const views = 180 + (h % 520);
  const subscriberConversions = 1 + (h % 11);
  const conversionPct = Math.round((subscriberConversions / views) * 1000) / 10;
  return { title, views, subscriberConversions, conversionPct };
}

export function buildCreatorDashboardStats(params: {
  forecasterId: string;
  credibility: number;
  followerCount: number;
  readTitles?: string[];
  /** When provided, revenue/audience counts come from the Studio financial model. */
  revenueMetrics?: AgentRevenueMetrics;
}): CreatorDashboardStats {
  const { forecasterId, credibility, followerCount, readTitles, revenueMetrics } = params;
  const h = hashSlug(forecasterId);

  const revenue =
    revenueMetrics ??
    buildAgentRevenueMetrics({ forecasterId, followerCount });

  const followers = revenue.followers;
  const subscribers = revenue.payingSupporters;
  const conversionPct = conversionPctFromMetrics(revenue);
  const proCount = revenue.proSupporters;
  const premiumCount = revenue.premiumSupporters;
  const mrr = revenue.mrr;

  const growth7Subs = 1 + (h % 6);
  const growth30Subs = growth7Subs + 2 + (h % 9);
  const avgRevenuePerSub =
    subscribers > 0 ? mrr / subscribers : computeAgentMrr(1, 0);

  const titles =
    readTitles && readTitles.length > 0
      ? readTitles.slice(0, 6)
      : FALLBACK_READ_TITLES;

  const topConvertingReads = titles
    .map((title, i) => mockReadConversion(title, forecasterId, i))
    .sort((a, b) => b.subscriberConversions - a.subscriberConversions)
    .slice(0, 5);

  return {
    audience: { followers, subscribers, conversionPct },
    revenue: { mrr, proCount, premiumCount },
    growth: {
      last7: {
        subscribers: growth7Subs,
        mrrDelta: Math.round(growth7Subs * avgRevenuePerSub),
      },
      last30: {
        subscribers: growth30Subs,
        mrrDelta: Math.round(growth30Subs * avgRevenuePerSub),
      },
    },
    topConvertingReads,
    funnel: {
      credibility: Math.round(credibility),
      followers,
      subscribers,
    },
  };
}

export function formatCreatorMrr(amount: number): string {
  return `$${amount.toLocaleString()}`;
}
