import type { BattleRecord, EnrichedAgentProfile, Receipt } from "@/components/agents/profile/types";
import type { ScryReceipt } from "@/components/users/profile/reputation/types";
import { getProfileScryReceipts, getResolvedReceipts } from "@/components/users/profile/reputation/receiptData";
import type { EnrichedUserProfile } from "@/components/users/profile/types";
import { buildCredibilityFromProfile } from "@/lib/credibilityScore";
import { estimateReceiptCredibilityDelta } from "@/lib/credibility";
import { estimateRankFromScore, getRankContext, type RankContext } from "@/lib/rankContext";
import type { ReputationLeaderboardEntry } from "@/lib/reputation";

export type CompareTrackStat = {
  id: string;
  label: string;
  valueA: number;
  valueB: number;
  format: "count" | "percent";
  higherIsBetter: boolean;
};

export type CommonReceiptPair = {
  key: string;
  marketTitle: string;
  receiptA: ScryReceipt;
  receiptB: ScryReceipt;
};

function normalizeMarketKey(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function toUserProfileShape(profile: EnrichedAgentProfile): EnrichedUserProfile {
  return {
    ...profile,
    is_human: true,
    member_since: new Date(Date.now() - 180 * 86400000).toISOString(),
    following_count: Math.max(0, Math.floor(profile.follower_count / 40)),
    agent_linked: false,
  };
}

export function profileHref(slug: string): string {
  if (slug === "daniel-scry" || (slug.includes("-") && !slug.includes("bot"))) {
    return `/u/${slug}`;
  }
  return `/agents/${slug}`;
}

export function estimateRank(score: number): number {
  return estimateRankFromScore(score);
}

export function rankContextForProfile(
  profile: EnrichedAgentProfile,
  leaderboard?: ReputationLeaderboardEntry[] | null,
): RankContext {
  const cred = credibilityFor(profile);
  return getRankContext({
    slug: profile.slug,
    credibilityScore: cred.score,
    rankDelta: profile.rank_delta,
    reputationDelta: profile.reputation_delta_live ?? profile.reputation?.reputation_delta,
    niche: profile.niche,
    categoryTags: profile.category_tags,
    specialtyLabel: profile.specialty_label,
    leaderboard,
  });
}

export function buildTrackStatsPair(
  a: EnrichedAgentProfile,
  b: EnrichedAgentProfile,
  resolvedA: number,
  resolvedB: number,
): CompareTrackStat[] {
  const accuracyA = Math.round(a.reputation?.calibration_score ?? a.accuracy_score);
  const accuracyB = Math.round(b.reputation?.calibration_score ?? b.accuracy_score);

  return [
    {
      id: "resolved",
      label: "Resolved calls",
      valueA: resolvedA,
      valueB: resolvedB,
      format: "count",
      higherIsBetter: true,
    },
    {
      id: "accuracy",
      label: "Accuracy",
      valueA: accuracyA,
      valueB: accuracyB,
      format: "percent",
      higherIsBetter: true,
    },
    {
      id: "early",
      label: "Early calls",
      valueA: a.early_call_pct,
      valueB: b.early_call_pct,
      format: "percent",
      higherIsBetter: true,
    },
    {
      id: "battles",
      label: "Battle wins",
      valueA: a.battles_won,
      valueB: b.battles_won,
      format: "count",
      higherIsBetter: true,
    },
    {
      id: "narrative",
      label: "Narrative leadership",
      valueA: a.narrative_leadership,
      valueB: b.narrative_leadership,
      format: "percent",
      higherIsBetter: true,
    },
    {
      id: "divergence",
      label: "Consensus divergence",
      valueA: a.consensus_divergence,
      valueB: b.consensus_divergence,
      format: "percent",
      higherIsBetter: true,
    },
  ];
}

export function getCommonBattles(
  a: EnrichedAgentProfile,
  b: EnrichedAgentProfile,
): BattleRecord[] {
  const direct = a.battles.filter((bt) => bt.rivalSlug === b.slug);
  const reverse = b.battles.filter((bt) => bt.rivalSlug === a.slug);
  const byMarket = new Map<string, BattleRecord>();
  for (const bt of [...direct, ...reverse]) {
    const key = normalizeMarketKey(bt.market);
    if (!byMarket.has(key)) byMarket.set(key, bt);
  }
  return [...byMarket.values()];
}

function receiptKeyFromAgent(r: Receipt): string {
  return normalizeMarketKey(r.market_title || r.title);
}

function receiptKeyFromScry(r: ScryReceipt): string {
  return normalizeMarketKey(r.forecastTitle);
}

export function getCommonReceiptPairs(
  a: EnrichedAgentProfile,
  b: EnrichedAgentProfile,
): CommonReceiptPair[] {
  const scryA = getProfileScryReceipts(toUserProfileShape(a), null);
  const scryB = getProfileScryReceipts(toUserProfileShape(b), null);
  const mapA = new Map<string, ScryReceipt>();
  const mapB = new Map<string, ScryReceipt>();

  for (const r of scryA) mapA.set(receiptKeyFromScry(r), r);
  for (const r of scryB) mapB.set(receiptKeyFromScry(r), r);

  const pairs: CommonReceiptPair[] = [];
  for (const [key, ra] of mapA) {
    const rb = mapB.get(key);
    if (rb) {
      pairs.push({
        key,
        marketTitle: ra.forecastTitle,
        receiptA: ra,
        receiptB: rb,
      });
    }
  }

  if (pairs.length > 0) return pairs.slice(0, 6);

  const agentMapA = new Map<string, Receipt>();
  const agentMapB = new Map<string, Receipt>();
  for (const r of a.enriched_receipts) agentMapA.set(receiptKeyFromAgent(r), r);
  for (const r of b.enriched_receipts) agentMapB.set(receiptKeyFromAgent(r), r);

  for (const [key, ra] of agentMapA) {
    const rb = agentMapB.get(key);
    if (!rb) continue;
    pairs.push({
      key,
      marketTitle: ra.market_title || ra.title,
      receiptA: {
        id: ra.id ?? `receipt-${key}-a`,
        forecastTitle: ra.market_title || ra.title,
        calledProbability: Math.round(ra.probability),
        consensusAtCall: Math.round(ra.resolved_probability ?? ra.probability),
        side: ra.probability >= 50 ? "YES" : "NO",
        calledAt: ra.timing,
        resolvedAt: ra.timing,
        outcome: ra.result === "correct" ? "correct" : ra.result === "wrong" ? "missed" : "pending",
        credibilityDelta:
          ra.result === "correct"
            ? estimateReceiptCredibilityDelta({
                correct: true,
                seed: ra.market_title || ra.title || key,
              })
            : ra.result === "wrong"
              ? estimateReceiptCredibilityDelta({
                  correct: false,
                  seed: ra.market_title || ra.title || key,
                })
              : 0,
        reasoningExcerpt: ra.title,
        receiptStatus: "verified",
      },
      receiptB: {
        id: rb.id ?? `receipt-${key}-b`,
        forecastTitle: rb.market_title || rb.title,
        calledProbability: Math.round(rb.probability),
        consensusAtCall: Math.round(rb.resolved_probability ?? rb.probability),
        side: rb.probability >= 50 ? "YES" : "NO",
        calledAt: rb.timing,
        resolvedAt: rb.timing,
        outcome: rb.result === "correct" ? "correct" : rb.result === "wrong" ? "missed" : "pending",
        credibilityDelta:
          rb.result === "correct"
            ? estimateReceiptCredibilityDelta({
                correct: true,
                seed: rb.market_title || rb.title || key,
              })
            : rb.result === "wrong"
              ? estimateReceiptCredibilityDelta({
                  correct: false,
                  seed: rb.market_title || rb.title || key,
                })
              : 0,
        reasoningExcerpt: rb.title,
        receiptStatus: "verified",
      },
    });
  }

  return pairs.slice(0, 6);
}

export function credibilityFor(profile: EnrichedAgentProfile) {
  const receipts = getProfileScryReceipts(toUserProfileShape(profile), null);
  return buildCredibilityFromProfile(profile, receipts);
}

export function resolvedCount(profile: EnrichedAgentProfile): number {
  const receipts = getProfileScryReceipts(toUserProfileShape(profile), null);
  const resolved = getResolvedReceipts(receipts);
  return Math.max(profile.resolved_calls, resolved.length);
}

export function formatStatValue(value: number, format: "count" | "percent"): string {
  if (format === "percent") return `${value}%`;
  return String(value);
}

export function statWinner(
  stat: CompareTrackStat,
): "a" | "b" | "tie" {
  if (stat.valueA === stat.valueB) return "tie";
  if (stat.higherIsBetter) return stat.valueA > stat.valueB ? "a" : "b";
  return stat.valueA < stat.valueB ? "a" : "b";
}

export function statDelta(stat: CompareTrackStat): number {
  return Math.abs(stat.valueA - stat.valueB);
}

export function duelBarWidth(value: number, other: number): number {
  const total = value + other;
  if (total <= 0) return 50;
  return Math.round((value / total) * 100);
}
