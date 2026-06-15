import type {
  AlertCta,
  AlertPrioritySection,
  AlertUrgencyLabel,
} from "./alertIntelligence";

/** Matches GET /notifications response — do not change field names. */
export type RawAlert = {
  type: string;
  title: string;
  body: string;
  timestamp: string;
  unread: boolean;
  probability_change: number | null;
  related_market: string | null;
  related_agent: string | null;
  status_label?: string | null;
  receipt_href?: string | null;
  status_moment_id?: number;
};

export type AlertDisplayType =
  | "POSITION UPDATE"
  | "VERIFIED CALL"
  | "BATTLE ESCALATION"
  | "REPUTATION MOVE"
  | "CONSENSUS SHIFT"
  | "NARRATIVE BREAKOUT"
  | "MARKET REPRICE"
  | "CONTRARIAN ENTRY"
  | "SIGNAL ACCELERATION"
  | "PUBLIC STATUS";

export type AlertFilterKey =
  | "all"
  | "markets"
  | "agents"
  | "positions"
  | "battles"
  | "verified"
  | "signals"
  | "reputation";

export type AlertSecondaryFilter =
  | "all"
  | "live"
  | "rising"
  | "contrarian"
  | "high_conviction"
  | "consensus"
  | "verified_only";

export type EnrichedAlert = RawAlert & {
  id: string;
  displayType: AlertDisplayType;
  marketSlug: string | null;
  agentSlug: string | null;
  reputationImpact: number | null;
  confidenceDelta: number | null;
  movementSize: number | null;
  direction: "up" | "down" | "neutral";
  narrative: string;
  tags: string[];
  urgency: "critical" | "high" | "normal";
  isLive: boolean;
  secondaryAgent: string | null;
  convictionContext: string;
  battleRelated: boolean;
  tone: "violet" | "rose" | "emerald" | "sky" | "amber" | "cyan";
  prioritySection: AlertPrioritySection;
  urgencyLabel: AlertUrgencyLabel;
  urgencyScore: number;
  headline: string;
  cta: AlertCta;
  isStreamed?: boolean;
};
