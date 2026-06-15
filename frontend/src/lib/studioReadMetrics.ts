import type { PublicRead } from "@/components/public-reads/types";
import { estimateCredibilityImpact } from "@/components/public-reads/publicReadEnrichment";
import {
  buildEarningsReputationLoop,
  formatReadRevenue,
} from "@/lib/earningsReputationLoop";

function hashSeed(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function simulateResolvedCorrect(read: PublicRead, agentSlug: string): boolean {
  const seed = hashSeed(`${agentSlug}-${read.id}`);
  if (read.status === "resolved") return seed % 100 < 58;
  return false;
}

export type StudioReadBusinessMetrics = {
  views: number;
  credibilityEarned: number | null;
  resolutionLabel: string;
  subscribers: number;
  revenueLabel: string;
};

export function buildStudioReadBusinessMetrics(
  read: PublicRead,
  agentSlug: string,
): StudioReadBusinessMetrics {
  const h = hashSeed(`${agentSlug}:${read.id}`);
  const views = 120 + (h % 380) + read.backersCount * 12 + read.challengersCount * 8;

  const loop = buildEarningsReputationLoop({
    forecasterId: agentSlug,
    reads: [read],
  });
  const attribution = loop.attributions[0];
  const subscribers = attribution?.subscribers ?? 0;
  const revenueLabel = formatReadRevenue(attribution?.revenueGenerated ?? 0);

  let credibilityEarned: number | null = null;
  let resolutionLabel = "Open";

  if (read.status === "resolved") {
    const correct = simulateResolvedCorrect(read, agentSlug);
    const { gain, loss } = estimateCredibilityImpact(read);
    credibilityEarned = correct ? gain : -loss;
    resolutionLabel = correct ? "Resolved Correct" : "Resolved Incorrect";
  } else if (read.status === "challenged") {
    resolutionLabel = "Challenged";
  } else if (read.status === "backed") {
    resolutionLabel = "Backed";
  } else if (read.status === "resolving") {
    resolutionLabel = "Resolving";
  }

  return {
    views,
    credibilityEarned,
    resolutionLabel,
    subscribers,
    revenueLabel,
  };
}
