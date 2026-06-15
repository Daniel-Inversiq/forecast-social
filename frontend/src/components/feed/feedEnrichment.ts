import { feedLoadLog } from "@/lib/feedLoadLog";
import { resolveFeedEventThesis } from "@/lib/forecastThesis";
import type { FeedEvent } from "./feedMix";

function feedItemRef(event: FeedEvent, index: number): string | number {
  if (event.generated_activity_id) return event.generated_activity_id;
  if (event.id != null) return event.id;
  return `row-${index}`;
}

export type CredibilitySideStats = {
  total_reputation: number;
  agent_count: number;
  avg_timing_quality: number;
  avg_calibration: number;
  strongest_agent: {
    name: string;
    slug: string;
    reputation_score: number;
    tier_label: string;
  } | null;
};

export type FeedCredibilitySplit = {
  yes: CredibilitySideStats;
  no: CredibilitySideStats;
  consensus_breaking: boolean;
  consensus_break_count: number;
  movement_type: "consensus_led" | "contrarian_led" | "mixed";
};

export type FeedIntelligenceModules = {
  highest_credibility_shift?: {
    title: string;
    summary: string;
    market_slug?: string;
    delta?: number | null;
    credibility_label?: string;
    movement_type?: string;
    href?: string | null;
  };
  top_reputation_mover?: {
    title: string;
    summary: string;
    reputation_delta?: number;
    tier_label?: string;
    href?: string | null;
  };
  strongest_contrarian?: {
    title: string;
    summary: string;
    agent_name?: string;
    market_slug?: string;
    href?: string | null;
  };
  verified_proof?: {
    title: string;
    summary: string;
    agent_name?: string;
    market_slug?: string;
    verified_calls_count?: number;
    reputation_impact?: string;
    href?: string | null;
  };
  credibility_market_move?: {
    title: string;
    summary: string;
    probability?: number | null;
    movement_type?: string;
    reputation_yes_share?: number;
    market_slug?: string;
    href?: string | null;
  };
};

function hashSeed(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function fallbackCredibility(event: FeedEvent): FeedCredibilitySplit {
  const h = hashSeed(event.agent.slug + (event.market_slug ?? event.title));
  const yesRep = 40 + (h % 55);
  const noRep = 35 + ((h >> 3) % 50);
  const movement_type: FeedCredibilitySplit["movement_type"] =
    event.type === "receipt" || (event.disagreement_spread ?? 0) >= 30
      ? "contrarian_led"
      : event.type === "consensus_shift"
        ? "consensus_led"
        : "mixed";
  return {
    yes: {
      total_reputation: yesRep,
      agent_count: 2 + (h % 4),
      avg_timing_quality: 62 + (h % 20),
      avg_calibration: 58 + (h % 22),
      strongest_agent: {
        name: event.agent.name,
        slug: event.agent.slug,
        reputation_score: event.reputation_score ?? 55 + (h % 30),
        tier_label: event.reputation_tier_label ?? "Emerging",
      },
    },
    no: {
      total_reputation: noRep,
      agent_count: 2 + ((h >> 2) % 3),
      avg_timing_quality: 60 + ((h >> 4) % 18),
      avg_calibration: 56 + ((h >> 5) % 20),
      strongest_agent: null,
    },
    consensus_breaking: movement_type === "contrarian_led",
    consensus_break_count: movement_type === "contrarian_led" ? 1 : 0,
    movement_type,
  };
}

const CREDIBILITY_LABELS: Record<string, string> = {
  contrarian_led: "Contrarian credibility",
  consensus_led: "Consensus credibility",
  mixed: "Mixed credibility",
};

export function enrichFeedEvent(event: FeedEvent): FeedEvent {
  const h = hashSeed(event.agent.slug);
  const hasRep = event.reputation_score != null && event.reputation_live !== false;

  const reputation_score = event.reputation_score ?? 48 + (h % 32);
  const reputation_tier_key = event.reputation_tier_key ?? (h % 4 === 0 ? "trusted" : "emerging");
  const reputation_tier_label = event.reputation_tier_label ?? (h % 4 === 0 ? "Trusted" : "Emerging");
  const timing_quality = event.timing_quality ?? 62 + (h % 22);
  const calibration_score = event.calibration_score ?? 58 + (h % 24);
  const verified_calls_count = event.verified_calls_count ?? 2 + (h % 6);

  const credibility_split = event.credibility_split ?? (event.market_slug ? fallbackCredibility(event) : undefined);
  const movement_type =
    event.movement_type ??
    credibility_split?.movement_type ??
    (event.type === "receipt" ? "contrarian_led" : event.type === "consensus_shift" ? "consensus_led" : "mixed");

  const total =
    credibility_split
      ? credibility_split.yes.total_reputation + credibility_split.no.total_reputation || 1
      : 1;
  const reputation_yes_share =
    event.reputation_yes_share ??
    (credibility_split ? Math.round((100 * credibility_split.yes.total_reputation) / total) : undefined);

  const why_it_matters =
    event.why_it_matters ??
    event.reasoning?.summary ??
    `${event.agent.name} signal — ${CREDIBILITY_LABELS[movement_type] ?? "credibility-weighted"} move in network.`;

  const reputation_impact =
    event.reputation_impact ??
    (event.reputation_delta
      ? `+${event.reputation_delta} rep impact`
      : `${verified_calls_count} verified · ${reputation_tier_label}`);

  const forecast_thesis =
    event.forecast_thesis ?? resolveFeedEventThesis(event);

  return {
    ...event,
    forecast_thesis,
    reputation_score,
    reputation_tier_key,
    reputation_tier_label,
    timing_quality,
    calibration_score,
    verified_calls_count,
    credibility_split,
    movement_type,
    credibility_label: event.credibility_label ?? CREDIBILITY_LABELS[movement_type],
    why_it_matters,
    reputation_impact,
    reputation_yes_share,
    has_verified_proof: event.has_verified_proof ?? (event.type === "receipt" || verified_calls_count > 0),
    reputation_live: hasRep ? event.reputation_live : false,
    agent: {
      ...event.agent,
      reputation_score,
      tier_key: event.agent.tier_key ?? reputation_tier_key,
      tier_label: event.agent.tier_label ?? reputation_tier_label,
    },
  };
}

export function enrichFeedEvents(events: FeedEvent[]): FeedEvent[] {
  return events.map(enrichFeedEvent);
}

/** Per-item enrich — one bad row cannot break the whole feed load. */
export function safeEnrichFeedEvents(events: unknown[]): {
  events: FeedEvent[];
  skippedIds: Array<string | number>;
} {
  const enriched: FeedEvent[] = [];
  const skippedIds: Array<string | number> = [];

  for (let index = 0; index < events.length; index += 1) {
    const raw = events[index];
    if (!raw || typeof raw !== "object") {
      skippedIds.push(`row-${index}`);
      continue;
    }
    const event = raw as FeedEvent;
    const ref = feedItemRef(event, index);
    if (!event.agent?.slug) {
      skippedIds.push(ref);
      feedLoadLog("safeEnrichFeedEvents skip missing agent", { ref });
      continue;
    }
    try {
      enriched.push(enrichFeedEvent(event));
    } catch (err) {
      skippedIds.push(ref);
      feedLoadLog("safeEnrichFeedEvents skip", {
        ref,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  if (skippedIds.length > 0) {
    feedLoadLog("safeEnrichFeedEvents summary", {
      input: events.length,
      kept: enriched.length,
      skipped: skippedIds.length,
    });
  }

  return { events: enriched, skippedIds };
}

export function enrichFeedRanking(events: FeedEvent[]): FeedEvent[] {
  const enriched = enrichFeedEvents(events);
  const hasScores = enriched.some((e) => e.feed_score != null);
  if (hasScores) return enriched;

  const scored = enriched.map((e, i) => {
    let score = e.feed_score ?? 0;
    if (e.following_agent) score += 14;
    if (e.anchor_agent) score += 8;
    if ((e.reputation_score ?? 0) >= 72) score += 7;
    else if ((e.reputation_score ?? 0) >= 58) score += 4;
    if (e.movement_type === "contrarian_led") score += 6;
    if (e.has_verified_proof || e.type === "receipt") score += 8;
    if (e.reputation_delta && e.reputation_delta > 0) score += 5;
    const bucket = e.resolution_horizon_bucket;
    if (bucket === "tonight") score += 6;
    else if (bucket === "soon") score += 4;
    else if (bucket === "this_week") score += 1.5;
    score += Math.max(0, 10 - i) * 0.5;
    return { e, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.map(({ e }) => e);
}
