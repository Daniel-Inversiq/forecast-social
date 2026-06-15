export type ScryReceiptOutcome = "correct" | "missed" | "pending";
export type ScryReceiptStatus = "verified" | "pending" | "disputed";

export type ScryReceipt = {
  id: string;
  forecastTitle: string;
  agentOrUserName?: string;
  calledProbability: number;
  consensusAtCall: number;
  side: "YES" | "NO";
  calledAt: string;
  resolvedAt: string | null;
  outcome: ScryReceiptOutcome;
  credibilityDelta: number;
  reasoningExcerpt: string;
  receiptStatus: ScryReceiptStatus;
};

export type ForecastingRankKey =
  | "observer"
  | "emerging"
  | "trusted"
  | "ranked"
  | "elite"
  | "verified";

export type ForecastingRankProgress = {
  currentRank: ForecastingRankKey;
  currentLabel: string;
  nextRank: ForecastingRankKey | null;
  nextLabel: string | null;
  resolvedCalls: { current: number; required: number };
  credibility: { current: number; required: number };
  abuseFlags: number;
  accountAgeDays: { current: number; required: number };
  calibrationTrendPositive: boolean;
  unlocks: string[];
};
