import { PLAN_PRICES } from "@/lib/forecasterSubscriptions";
import type { PublicRead } from "@/components/public-reads/types";

function hashSlug(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export type ReadPlanAttribution = {
  plan: "pro" | "premium";
  label: string;
  subscribers: number;
  revenue: number;
};

export type ReadSignalKind = "early_signal" | "consensus" | "contrarian";

export type ReadRevenueAttribution = {
  id: string;
  title: string;
  category: string;
  signalKind: ReadSignalKind;
  subscribers: number;
  revenueGenerated: number;
  plans: ReadPlanAttribution[];
  conversionPct: number;
  growth7d: number;
};

export type EarningsLeaderboardEntry = {
  rank: number;
  title: string;
  value: string;
  detail: string;
};

export type IntelligenceInsight = {
  id: string;
  text: string;
  accent: "violet" | "amber" | "cyan";
};

export type EarningsReputationLoopData = {
  attributions: ReadRevenueAttribution[];
  leaderboards: {
    topConverting: EarningsLeaderboardEntry[];
    topSubscriberGrowth: EarningsLeaderboardEntry[];
    highestRevenue: EarningsLeaderboardEntry[];
  };
  insights: IntelligenceInsight[];
};

const PINNED_ATTRIBUTIONS: Array<{
  titleMatch: string;
  subscribers: number;
  revenue: number;
  pro: number;
  premium: number;
}> = [
  {
    titleMatch: "fed cut before september",
    subscribers: 7,
    revenue: 63,
    pro: 7,
    premium: 0,
  },
  {
    titleMatch: "oil reversal after opec",
    subscribers: 3,
    revenue: 27,
    pro: 3,
    premium: 0,
  },
];

const FALLBACK_READS: Array<{ title: string; category: string }> = [
  { title: "Fed cut before September", category: "Macro" },
  { title: "Oil reversal after OPEC", category: "Macro" },
  { title: "Labor stickiness breaks the soft-landing narrative", category: "Macro" },
  { title: "ETF flow pushes BTC through year-end targets", category: "Crypto" },
  { title: "FOMC holds until credibility window closes", category: "Macro" },
];

function normalizeTitle(t: string): string {
  return t.trim().toLowerCase();
}

function classifySignal(
  read: Pick<PublicRead, "probability" | "consensusAtPost" | "side" | "tags">,
): ReadSignalKind {
  const divergence = Math.abs(read.probability - read.consensusAtPost);
  if (divergence >= 22) return "early_signal";
  if (read.tags?.includes("contrarian") || divergence >= 14) return "contrarian";
  return "consensus";
}

function splitSubsIntoPlans(
  total: number,
  seed: number,
): { pro: number; premium: number } {
  if (total <= 0) return { pro: 0, premium: 0 };
  const premium = Math.min(total, Math.max(0, Math.round(total * (0.1 + (seed % 5) / 20))));
  return { pro: total - premium, premium };
}

function buildAttributionFromRead(
  read: Pick<PublicRead, "id" | "title" | "category" | "probability" | "consensusAtPost" | "side" | "tags">,
  forecasterId: string,
  index: number,
): ReadRevenueAttribution {
  const norm = normalizeTitle(read.title);
  const pinned = PINNED_ATTRIBUTIONS.find((p) => norm.includes(p.titleMatch));

  const h = hashSlug(`${forecasterId}:${read.title}:${index}`);
  let subscribers: number;
  let pro: number;
  let premium: number;

  if (pinned) {
    subscribers = pinned.subscribers;
    pro = pinned.pro;
    premium = pinned.premium;
  } else {
    subscribers = 1 + (h % 9);
    const split = splitSubsIntoPlans(subscribers, h);
    pro = split.pro;
    premium = split.premium;
  }

  const plans: ReadPlanAttribution[] = [];
  if (pro > 0) {
    plans.push({
      plan: "pro",
      label: "Pro",
      subscribers: pro,
      revenue: pro * PLAN_PRICES.pro,
    });
  }
  if (premium > 0) {
    plans.push({
      plan: "premium",
      label: "Premium",
      subscribers: premium,
      revenue: premium * PLAN_PRICES.premium,
    });
  }

  const revenueGenerated = plans.reduce((sum, p) => sum + p.revenue, 0);
  const views = 200 + (h % 450);
  const conversionPct = Math.round((subscribers / views) * 1000) / 10;
  const growth7d = 1 + (h % 5);

  return {
    id: read.id ?? `${forecasterId}-attr-${index}`,
    title: read.title,
    category: read.category,
    signalKind: classifySignal(read),
    subscribers,
    revenueGenerated: pinned?.revenue ?? revenueGenerated,
    plans,
    conversionPct,
    growth7d,
  };
}

function toReadShape(
  item: PublicRead | { title: string; category: string },
  index: number,
  forecasterId: string,
): Pick<PublicRead, "id" | "title" | "category" | "probability" | "consensusAtPost" | "side" | "tags"> {
  if ("probability" in item && "consensusAtPost" in item) {
    return item;
  }
  const h = hashSlug(`${forecasterId}:${item.title}`);
  return {
    id: `${forecasterId}-read-${index}`,
    title: item.title,
    category: item.category as PublicRead["category"],
    probability: 55 + (h % 35),
    consensusAtPost: 48 + (h % 20),
    side: h % 2 === 0 ? "YES" : "NO",
    tags: h % 3 === 0 ? ["contrarian"] : [],
  };
}

function buildInsights(
  attributions: ReadRevenueAttribution[],
  forecasterId: string,
): IntelligenceInsight[] {
  const totalRevenue = attributions.reduce((s, a) => s + a.revenueGenerated, 0);
  const macroRevenue = attributions
    .filter((a) => a.category === "Macro")
    .reduce((s, a) => s + a.revenueGenerated, 0);
  const macroPct =
    totalRevenue > 0 ? Math.round((macroRevenue / totalRevenue) * 100) : 73;

  const early = attributions.filter((a) => a.signalKind === "early_signal");
  const consensus = attributions.filter((a) => a.signalKind === "consensus");
  const earlyConv =
    early.length > 0
      ? early.reduce((s, a) => s + a.conversionPct, 0) / early.length
      : 2.1;
  const consensusConv =
    consensus.length > 0
      ? consensus.reduce((s, a) => s + a.conversionPct, 0) / consensus.length
      : 0.9;
  const earlyMultiplier =
    consensusConv > 0
      ? Math.round((earlyConv / consensusConv) * 10) / 10
      : 2.4;

  const contrarian = attributions.filter((a) => a.signalKind === "contrarian");
  const contrarianPremiumShare =
    contrarian.length > 0
      ? (() => {
          const prem = contrarian.reduce(
            (s, a) => s + (a.plans.find((p) => p.plan === "premium")?.subscribers ?? 0),
            0,
          );
          const subs = contrarian.reduce((s, a) => s + a.subscribers, 0);
          return subs > 0 ? Math.round((prem / subs) * 100) : 38;
        })()
      : 38 + (hashSlug(forecasterId) % 22);

  const h = hashSlug(forecasterId);
  const macroDisplay = macroPct || 68 + (h % 12);
  const multiplierDisplay = earlyMultiplier || 2.2 + (h % 4) / 10;

  return [
    {
      id: "macro-revenue",
      text: `Your macro calls generated ${macroDisplay}% of subscriber revenue.`,
      accent: "violet",
    },
    {
      id: "early-signals",
      text: `Early signals convert ${multiplierDisplay}x better than consensus reads.`,
      accent: "cyan",
    },
    {
      id: "contrarian-premium",
      text:
        contrarianPremiumShare >= 30
          ? "Contrarian reads generate more premium subscribers."
          : "Contrarian reads pull higher-conviction supporters into Premium.",
      accent: "amber",
    },
  ];
}

function leaderboardEntries(
  attributions: ReadRevenueAttribution[],
  sortKey: "conversionPct" | "growth7d" | "revenueGenerated",
  valueFmt: (a: ReadRevenueAttribution) => string,
  detailFmt: (a: ReadRevenueAttribution) => string,
): EarningsLeaderboardEntry[] {
  return [...attributions]
    .sort((a, b) => b[sortKey] - a[sortKey])
    .slice(0, 5)
    .map((a, i) => ({
      rank: i + 1,
      title: a.title,
      value: valueFmt(a),
      detail: detailFmt(a),
    }));
}

export function buildEarningsReputationLoop(params: {
  forecasterId: string;
  reads?: PublicRead[];
  readTitles?: string[];
}): EarningsReputationLoopData {
  const { forecasterId, reads, readTitles } = params;

  const sources: Array<PublicRead | { title: string; category: string }> =
    reads && reads.length > 0
      ? reads
      : readTitles && readTitles.length > 0
        ? readTitles.map((title) => ({
            title,
            category: FALLBACK_READS.find(
              (f) => normalizeTitle(f.title) === normalizeTitle(title),
            )?.category ?? "Macro",
          }))
        : FALLBACK_READS;

  const attributions = sources
    .map((r, i) => buildAttributionFromRead(toReadShape(r, i, forecasterId), forecasterId, i))
    .sort((a, b) => b.revenueGenerated - a.revenueGenerated);

  const insights = buildInsights(attributions, forecasterId);

  return {
    attributions,
    leaderboards: {
      topConverting: leaderboardEntries(
        attributions,
        "conversionPct",
        (a) => `${a.conversionPct}%`,
        (a) => `${a.subscribers} subscribers`,
      ),
      topSubscriberGrowth: leaderboardEntries(
        attributions,
        "growth7d",
        (a) => `+${a.growth7d}`,
        (a) => `new supporters · 7d`,
      ),
      highestRevenue: leaderboardEntries(
        attributions,
        "revenueGenerated",
        (a) => `$${a.revenueGenerated}`,
        (a) => `${a.subscribers} subscribers`,
      ),
    },
    insights,
  };
}

export function formatReadRevenue(amount: number): string {
  return `$${amount.toLocaleString()} generated`;
}
