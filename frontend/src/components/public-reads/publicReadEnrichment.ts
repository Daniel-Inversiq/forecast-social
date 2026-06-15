import { resolveForecastThesis } from "@/lib/forecastThesis";
import { formatRelativeTime } from "@/lib/relativeTime";
import { DISTRIBUTION_TAGLINE, TRUST_TIERS } from "@/lib/trust";
import type {
  PublicRead,
  PublicReadCategoryFilter,
  PublicReadConsensusFilter,
  PublicReadResolutionFilter,
  PublicReadSide,
  PublicReadTabKey,
  PublicReadTrustFilter,
  ReasoningSource,
  StudioReadsPerformanceFilter,
} from "./types";

export { DISTRIBUTION_TAGLINE };

export type ConvictionLevel = {
  label: string;
  toneClass: string;
};

/** Probability bands for on-record conviction copy. */
export function getConvictionLevel(probability: number): ConvictionLevel | null {
  const p = Math.round(probability);
  if (p < 51) return null;
  if (p >= 90) {
    return { label: "Extreme conviction", toneClass: "text-rose-300/95" };
  }
  if (p >= 75) {
    return { label: "High conviction", toneClass: "text-amber-300/95" };
  }
  if (p >= 60) {
    return { label: "Moderate conviction", toneClass: "text-violet-300/90" };
  }
  return { label: "Low conviction", toneClass: "text-zinc-400" };
}

export function formatConvictionLine(probability: number, side: PublicReadSide): string {
  return `${Math.round(probability)}% ${side}`;
}

/** One-line thesis for forecast cards — clamped or generated from market context. */
export function formatPublicReadThesis(
  read: Pick<
    PublicRead,
    "thesis" | "title" | "marketOrNarrative" | "side" | "probability" | "category"
  >,
): string {
  return resolveForecastThesis({
    thesis: read.thesis,
    title: read.title,
    marketOrNarrative: read.marketOrNarrative,
    probability: read.probability,
    category: read.category,
    side: read.side,
    seed: read.title,
  });
}

export function formatAuthorTrustRankLine(read: Pick<PublicRead, "authorTrustTier" | "authorRankLabel">): string {
  const tierLabel =
    TRUST_TIERS.find((t) => t.key === read.authorTrustTier)?.label ??
    String(read.authorTrustTier);
  const rank = read.authorRankLabel?.replace(/[^#0-9]/g, "").startsWith("#")
    ? read.authorRankLabel
    : read.authorRankLabel
      ? `#${read.authorRankLabel.replace(/\D/g, "") || "—"}`
      : null;
  return rank ? `${tierLabel} • ${rank}` : tierLabel;
}

export type ForecastImpactEstimate = {
  credibilityGain: number;
  credibilityLoss: number;
  trustContribution: "Low" | "Moderate" | "Strong" | "High";
  distributionImpact: "Low" | "Medium" | "High";
  specialtyLabel: string;
};

/** Pre-publish impact estimator for studio publish flows. */
export function estimateForecastImpact(
  read: Pick<
    PublicRead,
    | "probability"
    | "side"
    | "category"
    | "authorTrustTier"
    | "consensusAtPost"
    | "currentConsensus"
    | "challengersCount"
    | "backersCount"
    | "resolvesAt"
    | "status"
  >,
): ForecastImpactEstimate {
  const { gain, loss } = estimateCredibilityImpact(read as PublicRead);
  const tier = TRUST_TIERS.find((t) => t.key === read.authorTrustTier);
  const weight = tier?.distributionWeight ?? 0.65;
  const trustContribution: ForecastImpactEstimate["trustContribution"] =
    weight >= 1.5 ? "High" : weight >= 1.2 ? "Strong" : weight >= 0.9 ? "Moderate" : "Low";

  const stub: PublicRead = {
    id: "impact-estimate",
    ...read,
    status: read.status ?? "open",
    createdAt: new Date().toISOString(),
    title: "",
    marketOrNarrative: "",
    thesis: "",
    authorId: "",
    authorName: "",
    authorHandle: "",
    authorCredibility: 0,
    publicReadsCount: 0,
    tags: [],
    consensusAtPost: read.consensusAtPost,
    currentConsensus: read.currentConsensus,
    backersCount: read.backersCount,
    challengersCount: read.challengersCount,
  };
  const score = distributionScore(stub);

  const distributionImpact: ForecastImpactEstimate["distributionImpact"] =
    score >= 120 ? "High" : score >= 75 ? "Medium" : "Low";

  return {
    credibilityGain: gain,
    credibilityLoss: loss,
    trustContribution,
    distributionImpact,
    specialtyLabel: `${read.category} Specialist`,
  };
}

export function matchesStudioPerformanceFilter(
  read: PublicRead,
  filter: StudioReadsPerformanceFilter,
): boolean {
  if (filter === "all") return true;
  if (filter === "ai_approved") return read.origin === "ai_approved";
  if (filter === "ai_generated") {
    return read.reasoningSource === "ai_generated" || read.origin === "ai";
  }
  return (
    read.reasoningSource === "creator_written" ||
    (!read.reasoningSource && read.origin !== "ai" && read.origin !== "ai_approved")
  );
}

export const REASONING_SOURCE_LABELS: Record<ReasoningSource, string> = {
  creator_written: "Creator Written",
  ai_generated: "AI Generated",
  ai_creator_edited: "AI + Creator Edited",
};

export function formatOnRecordTimestamp(createdAt: string): string {
  const relative = formatRelativeTime(createdAt);
  if (relative === "just now") return "On record just now";
  return `On record ${relative}`;
}

export function formatAuthorIdentityLine(read: PublicRead): string {
  const tierLabel =
    TRUST_TIERS.find((t) => t.key === read.authorTrustTier)?.label ??
    String(read.authorTrustTier);
  const parts = [tierLabel];
  if (read.authorRankLabel) parts.push(read.authorRankLabel);
  parts.push(`Credibility ${read.authorCredibility.toLocaleString()}`);
  return parts.join(" • ");
}

/** Estimated reputation swing if the read resolves correct vs wrong. */
export function estimateCredibilityImpact(read: PublicRead): {
  gain: number;
  loss: number;
} {
  const distance = Math.abs(read.probability - 50);
  const tier = TRUST_TIERS.find((t) => t.key === read.authorTrustTier);
  const weight = tier?.distributionWeight ?? 1;
  const gain = Math.min(24, Math.max(4, Math.round(2 + distance * 0.18 * weight)));
  const loss = Math.max(3, Math.round(gain * 0.75));
  return { gain, loss };
}

export function consensusDelta(read: PublicRead): number {
  return read.currentConsensus - read.consensusAtPost;
}

export function consensusMoveAbs(read: PublicRead): number {
  return Math.abs(consensusDelta(read));
}

export function daysUntilResolution(read: PublicRead): number | null {
  if (!read.resolvesAt) return null;
  const ms = new Date(read.resolvesAt).getTime() - Date.now();
  return Math.ceil(ms / 86_400_000);
}

export function distributionScore(read: PublicRead): number {
  const tier = TRUST_TIERS.find((t) => t.key === read.authorTrustTier);
  const weight = tier?.distributionWeight ?? 0.5;
  let score = weight * 100;
  if (read.status === "challenged") score += 25;
  score += consensusMoveAbs(read) * 0.8;
  const days = daysUntilResolution(read);
  if (days != null && days > 0 && days <= 14) score += 20;
  score += read.challengersCount * 2 + read.backersCount;
  return score;
}

export function filterByTab(reads: PublicRead[], tab: PublicReadTabKey): PublicRead[] {
  const open = reads.filter((r) => r.status !== "resolved");
  switch (tab) {
    case "for_you":
      return open.filter(
        (r) =>
          ["trusted", "ranked", "elite"].includes(String(r.authorTrustTier)) ||
          r.status === "challenged" ||
          consensusMoveAbs(r) >= 10,
      );
    case "following":
      return open.filter((r) =>
        ["macro-oracle", "neural-scout", "doombot", "election-brain"].includes(
          r.authorHandle,
        ),
      );
    case "rising":
      return open
        .filter((r) => ["emerging", "trusted"].includes(String(r.authorTrustTier)))
        .sort((a, b) => distributionScore(b) - distributionScore(a));
    case "challenged":
      return open.filter((r) => r.status === "challenged" || r.challengersCount >= 5);
    case "near_resolution": {
      return open
        .filter((r) => {
          const d = daysUntilResolution(r);
          return d != null && d > 0 && d <= 30;
        })
        .sort((a, b) => (daysUntilResolution(a) ?? 999) - (daysUntilResolution(b) ?? 999));
    }
    case "new":
      return [...open].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
    default:
      return open;
  }
}

export function filterPublicReads(
  reads: PublicRead[],
  opts: {
    tab: PublicReadTabKey;
    category: PublicReadCategoryFilter;
    trust: PublicReadTrustFilter;
    resolution: PublicReadResolutionFilter;
    consensus: PublicReadConsensusFilter;
    query: string;
  },
): PublicRead[] {
  let list = filterByTab(reads, opts.tab);

  if (opts.category !== "all") {
    list = list.filter((r) => r.category === opts.category);
  }
  if (opts.trust !== "all") {
    list = list.filter((r) => r.authorTrustTier === opts.trust);
  }
  if (opts.resolution !== "all") {
    const maxDays =
      opts.resolution === "7d" ? 7 : opts.resolution === "30d" ? 30 : 90;
    list = list.filter((r) => {
      const d = daysUntilResolution(r);
      return d != null && d > 0 && d <= maxDays;
    });
  }
  if (opts.consensus === "moving_up") {
    list = list.filter((r) => consensusDelta(r) > 3);
  } else if (opts.consensus === "moving_down") {
    list = list.filter((r) => consensusDelta(r) < -3);
  } else if (opts.consensus === "large_move") {
    list = list.filter((r) => consensusMoveAbs(r) >= 12);
  }

  const q = opts.query.trim().toLowerCase();
  if (q) {
    list = list.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        r.thesis.toLowerCase().includes(q) ||
        r.authorName.toLowerCase().includes(q) ||
        r.marketOrNarrative.toLowerCase().includes(q) ||
        r.tags.some((t) => t.includes(q)),
    );
  }

  return list.sort((a, b) => distributionScore(b) - distributionScore(a));
}

export function pickFeedReads(reads: PublicRead[], limit = 5): PublicRead[] {
  const open = reads.filter((r) => r.status !== "resolved");
  const scored = [...open].sort((a, b) => distributionScore(b) - distributionScore(a));
  return scored.slice(0, limit);
}

export function readsForAuthor(reads: PublicRead[], authorIdOrHandle: string): PublicRead[] {
  const key = authorIdOrHandle.toLowerCase();
  return reads.filter(
    (r) =>
      r.authorId.toLowerCase().includes(key) ||
      r.authorHandle.toLowerCase() === key ||
      r.authorHandle.toLowerCase().includes(key),
  );
}

export function profileMetrics(reads: PublicRead[], authorIdOrHandle: string) {
  const mine = readsForAuthor(reads, authorIdOrHandle);
  return {
    posted: mine.length,
    backed: mine.reduce((s, r) => s + r.backersCount, 0),
    challenges: mine.reduce((s, r) => s + r.challengersCount, 0),
    resolved: mine.filter((r) => r.status === "resolved").length,
  };
}

export const STATUS_LABELS: Record<PublicRead["status"], string> = {
  open: "Open",
  challenged: "Challenged",
  backed: "Backed",
  resolving: "Resolving",
  resolved: "Resolved",
};

export const STATUS_STYLES: Record<PublicRead["status"], string> = {
  open: "text-zinc-300 bg-zinc-500/10 border-zinc-500/25",
  challenged: "text-rose-200 bg-rose-500/10 border-rose-500/30",
  backed: "text-emerald-200 bg-emerald-500/10 border-emerald-500/30",
  resolving: "text-amber-200 bg-amber-500/10 border-amber-500/30",
  resolved: "text-violet-200 bg-violet-500/10 border-violet-500/30",
};
