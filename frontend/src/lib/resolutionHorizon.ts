import { isMarketResolved } from "@/lib/resolution";

export type ResolutionHorizonBucket =
  | "resolved"
  | "tonight"
  | "soon"
  | "this_week"
  | "this_month"
  | "long_term";

export type ResolutionHorizonFilterKey =
  | "resolves_soon"
  | "this_week"
  | "this_month"
  | "long_term"
  | "recently_resolved";

export type ResolutionHorizon = {
  bucket: ResolutionHorizonBucket;
  filter_bucket: ResolutionHorizonFilterKey | null;
  label: string;
  emoji: string;
  short_label: string;
  open_loop: string | null;
  hours_remaining: number;
};

export type ResolutionHorizonInput = {
  expected_resolution_at?: string | null;
  resolved_at?: string | null;
  resolved_outcome?: string | null;
  status?: string;
};

const MS_HOUR = 60 * 60 * 1000;

function parseInstant(value: string | null | undefined): number | null {
  if (!value) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

export function isResolvedMarket(input: ResolutionHorizonInput): boolean {
  if (input.resolved_outcome) return true;
  if (input.resolved_at) return true;
  return isMarketResolved({
    resolved_at: input.resolved_at ?? null,
    resolved_outcome: (input.resolved_outcome as "YES" | "NO") ?? null,
    resolution_source: null,
    resolution_confidence: null,
    outcome_yes: null,
  });
}

export function resolutionHorizon(
  input: ResolutionHorizonInput,
  nowMs: number = Date.now(),
): ResolutionHorizon | null {
  if (isResolvedMarket(input)) {
    return {
      bucket: "resolved",
      filter_bucket: "recently_resolved",
      label: "✓ Resolved",
      emoji: "✓",
      short_label: "Resolved",
      open_loop: null,
      hours_remaining: 0,
    };
  }

  const expectedMs = parseInstant(input.expected_resolution_at);
  if (expectedMs == null) return null;

  const hours = (expectedMs - nowMs) / MS_HOUR;

  if (hours <= 0 || hours < 24) {
    return {
      bucket: "tonight",
      filter_bucket: "resolves_soon",
      label: "⚡ Resolves tonight",
      emoji: "⚡",
      short_label: "Tonight",
      open_loop: "Outcome expected tonight",
      hours_remaining: Math.max(0, hours),
    };
  }

  if (hours < 72) {
    const days = Math.max(1, Math.min(3, Math.round(hours / 24)));
    const openLoop = hours < 48 ? "Resolution approaching" : "Consensus about to be tested";
    return {
      bucket: "soon",
      filter_bucket: "resolves_soon",
      label: `⏳ Resolves in ${days} day${days === 1 ? "" : "s"}`,
      emoji: "⏳",
      short_label: `${days}d`,
      open_loop: openLoop,
      hours_remaining: hours,
    };
  }

  if (hours < 14 * 24) {
    return {
      bucket: "this_week",
      filter_bucket: "this_week",
      label: "📅 Resolves this week",
      emoji: "📅",
      short_label: "This week",
      open_loop: null,
      hours_remaining: hours,
    };
  }

  if (hours < 60 * 24) {
    return {
      bucket: "this_month",
      filter_bucket: "this_month",
      label: "🗓 Resolves this month",
      emoji: "🗓",
      short_label: "This month",
      open_loop: null,
      hours_remaining: hours,
    };
  }

  return {
    bucket: "long_term",
    filter_bucket: "long_term",
    label: "🔮 Long-term",
    emoji: "🔮",
    short_label: "Long-term",
    open_loop: null,
    hours_remaining: hours,
  };
}

export function matchesHorizonFilter(
  horizon: ResolutionHorizon | null | undefined,
  filter: ResolutionHorizonFilterKey,
): boolean {
  if (!horizon) return false;
  if (filter === "recently_resolved") return horizon.bucket === "resolved";
  return horizon.filter_bucket === filter;
}

export type PositionHorizonGroupKey = "resolving_soon" | "this_week" | "long_term";

export function positionHorizonGroup(
  horizon: ResolutionHorizon | null | undefined,
): PositionHorizonGroupKey {
  if (!horizon || horizon.bucket === "resolved") return "long_term";
  if (horizon.bucket === "tonight" || horizon.bucket === "soon") return "resolving_soon";
  if (horizon.bucket === "this_week") return "this_week";
  return "long_term";
}

export const POSITION_HORIZON_GROUPS: {
  key: PositionHorizonGroupKey;
  title: string;
}[] = [
  { key: "resolving_soon", title: "Resolving soon" },
  { key: "this_week", title: "This week" },
  { key: "long_term", title: "Long-term" },
];

/** Future notification thresholds (hooks only). */
export const RESOLUTION_NOTIFICATION_THRESHOLDS = ["24h", "1h", "resolved"] as const;
