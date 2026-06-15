import type { PublicRead, ReadOrigin } from "@/components/public-reads/types";
import { readsForAuthor } from "@/components/public-reads/publicReadEnrichment";
import { estimateCredibilityImpact } from "@/components/public-reads/publicReadEnrichment";

export type OriginPerformanceBucket = {
  readsPublished: number;
  avgCredibilityGain: number;
  winRate: number;
  subscriberConversionRate: number;
};

export type AgentContentPerformance = {
  creator: OriginPerformanceBucket;
  ai: OriginPerformanceBucket;
  aiApproved: OriginPerformanceBucket;
};

function hashSeed(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function bucketForOrigin(origin: ReadOrigin | undefined): keyof AgentContentPerformance {
  if (origin === "ai") return "ai";
  if (origin === "ai_approved") return "aiApproved";
  return "creator";
}

function simulateWin(read: PublicRead, agentSlug: string): boolean {
  const seed = hashSeed(`${agentSlug}-${read.id}`);
  if (read.status === "resolved") return seed % 100 < 58;
  return seed % 100 < 52;
}

function simulateConversion(read: PublicRead, agentSlug: string): number {
  const base = 0.02 + (read.backersCount + read.challengersCount) * 0.0012;
  const tierBoost =
    read.authorTrustTier === "elite"
      ? 0.04
      : read.authorTrustTier === "ranked"
        ? 0.025
        : 0.01;
  const originBoost = read.origin === "creator" ? 0.015 : read.origin === "ai_approved" ? 0.008 : 0;
  const jitter = (hashSeed(`${read.id}-conv`) % 20) / 1000;
  return Math.min(0.18, base + tierBoost + originBoost + jitter);
}

function buildBucket(
  reads: PublicRead[],
  agentSlug: string,
): OriginPerformanceBucket {
  const published = reads.filter((r) => r.studioLifecycle !== "draft");
  if (published.length === 0) {
    return {
      readsPublished: 0,
      avgCredibilityGain: 0,
      winRate: 0,
      subscriberConversionRate: 0,
    };
  }

  const resolved = published.filter((r) => r.status === "resolved");
  const wins = resolved.filter((r) => simulateWin(r, agentSlug)).length;
  const winRate = resolved.length > 0 ? wins / resolved.length : 0;

  const gainSum = published.reduce((s, r) => {
    const { gain } = estimateCredibilityImpact(r);
    const won = simulateWin(r, agentSlug);
    return s + (won ? gain : -Math.round(gain * 0.75));
  }, 0);

  const conversionSum = published.reduce(
    (s, r) => s + simulateConversion(r, agentSlug),
    0,
  );

  return {
    readsPublished: published.length,
    avgCredibilityGain: Math.round(gainSum / published.length),
    winRate: Math.round(winRate * 100),
    subscriberConversionRate: Math.round((conversionSum / published.length) * 1000) / 10,
  };
}

export function buildAgentContentPerformance(
  reads: PublicRead[],
  agentSlug: string,
): AgentContentPerformance {
  const mine = readsForAuthor(reads, agentSlug);
  const byOrigin: Record<keyof AgentContentPerformance, PublicRead[]> = {
    creator: [],
    ai: [],
    aiApproved: [],
  };

  for (const read of mine) {
    const key = bucketForOrigin(read.origin);
    byOrigin[key].push(read);
  }

  return {
    creator: buildBucket(byOrigin.creator, agentSlug),
    ai: buildBucket(byOrigin.ai, agentSlug),
    aiApproved: buildBucket(byOrigin.aiApproved, agentSlug),
  };
}

export function publishingActivitySummary(
  reads: PublicRead[],
  agentSlug: string,
  aiQueuePending: number,
): {
  publishedThisMonth: number;
  pendingAiDrafts: number;
  openReads: number;
  resolvedReads: number;
  receiptsEarned: number;
} {
  const mine = readsForAuthor(reads, agentSlug);
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const publishedThisMonth = mine.filter(
    (r) =>
      r.studioLifecycle !== "draft" &&
      new Date(r.createdAt) >= monthStart,
  ).length;

  return {
    publishedThisMonth,
    pendingAiDrafts: aiQueuePending,
    openReads: mine.filter((r) => r.status !== "resolved").length,
    resolvedReads: mine.filter((r) => r.status === "resolved").length,
    receiptsEarned: mine.filter((r) => r.receiptId || r.studioLifecycle === "receipt").length,
  };
}
