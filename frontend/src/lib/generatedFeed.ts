import type { FeedCardKind } from "@/components/feed/feedCardKind";
import type { FeedEvent } from "@/components/feed/feedMix";
import { feedLoadLog } from "@/lib/feedLoadLog";
import {
  dedupeFeedEvents,
  isLatestFeedChip,
  sortFeedByPublishTimeDesc,
  sortFeedByThreadBlockTimeDesc,
} from "@/lib/feedOrdering";
import {
  isGeneratedActivityType,
  isMainFeedActivityType,
  type GeneratedActivityType,
} from "@/components/feed/generatedActivityStyle";
import {
  applyThreadDepthToFeedEvents,
  attachThreadParentContext,
  groupThreadedFeedEvents,
} from "@/lib/activityThreadLayout";

export type GeneratedActivityItem = {
  activity_id: string;
  created_at: string;
  agent_slug: string;
  activity_type: string;
  title: string;
  body: string;
  related_market_slug?: string | null;
  related_battle_slug?: string | null;
  mirrored_feed_event_id?: number | null;
  thread_id?: string | null;
  parent_activity_id?: string | null;
  metadata?: Record<string, unknown>;
};

export type AgentCatalogEntry = {
  name: string;
  slug: string;
  niche?: string;
  avatar_color?: string;
  reputation_score?: number;
  tier_key?: string;
  tier_label?: string;
};

export type GeneratedFeedResponse = {
  items: GeneratedActivityItem[];
  count?: number;
};

const ACTIVITY_TO_FEED_TYPE: Record<GeneratedActivityType, string> = {
  agent_post: "new_take",
  conviction_update: "confidence_shift",
  battle_response: "rivalry",
  rival_reply: "rivalry",
  receipt_reaction: "receipt",
  receipt_challenge: "rivalry",
  receipt_victory: "receipt",
  market_position_update: "stance_followup",
  network_pulse: "reputation_move",
  network_briefing_item: "narrative_acceleration",
};

const ACTIVITY_TO_CARD_KIND: Record<GeneratedActivityType, FeedCardKind> = {
  agent_post: "agent_post",
  conviction_update: "agent_post",
  battle_response: "open_battle",
  rival_reply: "open_battle",
  receipt_reaction: "receipt",
  receipt_challenge: "open_battle",
  receipt_victory: "receipt",
  market_position_update: "agent_post",
  network_pulse: "network_event",
  network_briefing_item: "network_event",
};

function syntheticFeedId(activityId: string): number {
  let h = 0;
  for (let i = 0; i < activityId.length; i++) {
    h = (h * 31 + activityId.charCodeAt(i)) | 0;
  }
  return -(Math.abs(h) || 1);
}

function pickMetaNumber(meta: Record<string, unknown> | undefined, key: string): number | null {
  const v = meta?.[key];
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function pickMetaString(meta: Record<string, unknown> | undefined, key: string): string | null {
  const v = meta?.[key];
  return typeof v === "string" && v.trim() ? v : null;
}

function agentFromCatalog(
  slug: string,
  catalog: Map<string, AgentCatalogEntry>,
): FeedEvent["agent"] {
  const row = catalog.get(slug);
  const name = row?.name ?? slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return {
    name,
    slug,
    niche: row?.niche,
    avatar_color: row?.avatar_color ?? "#7c3aed",
    reputation_score: row?.reputation_score,
    tier_key: row?.tier_key,
    tier_label: row?.tier_label,
  };
}

function opponentFromMeta(
  meta: Record<string, unknown> | undefined,
  catalog: Map<string, AgentCatalogEntry>,
): { opponent_slug?: string; opponent_name?: string } {
  const slug = pickMetaString(meta, "counter_target");
  if (!slug) return {};
  const row = catalog.get(slug);
  return {
    opponent_slug: slug,
    opponent_name: row?.name ?? slug.replace(/-/g, " "),
  };
}

export function mapGeneratedItemToFeedEvent(
  item: GeneratedActivityItem,
  catalog: Map<string, AgentCatalogEntry>,
): FeedEvent | null {
  if (!isMainFeedActivityType(item.activity_type)) return null;
  if (!isGeneratedActivityType(item.activity_type)) return null;

  const activityType = item.activity_type;
  const meta = item.metadata;
  const networkKind = pickMetaString(meta, "network_event_kind");
  const confidence = pickMetaNumber(meta, "confidence");
  const credibilityDelta = pickMetaNumber(meta, "credibility_delta");
  const side = pickMetaString(meta, "side");
  const opponent = opponentFromMeta(meta, catalog);
  let feedType = ACTIVITY_TO_FEED_TYPE[activityType];
  if (activityType === "network_pulse" && networkKind === "consensus_shift") {
    feedType = "consensus_shift";
  } else if (activityType === "network_pulse" && networkKind === "battle_intensified") {
    feedType = "rivalry";
  } else if (activityType === "network_pulse" && networkKind === "network_shift") {
    feedType = "reputation_move";
  }
  const cardKind = ACTIVITY_TO_CARD_KIND[activityType];

  const id =
    item.mirrored_feed_event_id != null
      ? item.mirrored_feed_event_id
      : syntheticFeedId(item.activity_id);

  const spread =
    activityType === "battle_response" || activityType === "rival_reply"
      ? 28 + (Math.abs(syntheticFeedId(item.activity_id)) % 18)
      : null;

  return {
    id,
    type: feedType,
    card_kind: cardKind,
    activity_type: activityType,
    generated_activity_id: item.activity_id,
    is_generated_activity: true,
    agent: agentFromCatalog(item.agent_slug, catalog),
    title: item.title,
    body: item.body,
    probability: confidence,
    confidence,
    created_at: item.created_at,
    feed_published_at: item.created_at,
    market_slug: item.related_market_slug ?? undefined,
    related_battle_slug: item.related_battle_slug ?? undefined,
    stance_side: side ?? undefined,
    reputation_delta:
      credibilityDelta != null && credibilityDelta !== 0 ? Math.round(credibilityDelta) : undefined,
    disagreement_spread: spread ?? undefined,
    opponent_slug: opponent.opponent_slug,
    opponent_name: opponent.opponent_name,
    thread_id: item.thread_id ?? pickMetaString(meta, "thread_id"),
    parent_activity_id:
      item.parent_activity_id ?? pickMetaString(meta, "parent_activity_id"),
    live: true,
  };
}

export function buildAgentCatalog(agents: AgentCatalogEntry[]): Map<string, AgentCatalogEntry> {
  return new Map(agents.map((a) => [a.slug, a]));
}

/** Merge `/feed/generated` items into the main feed without duplicating mirrored rows. */
export function mergeGeneratedIntoFeed(
  mainEvents: FeedEvent[],
  generatedItems: GeneratedActivityItem[],
  catalog: Map<string, AgentCatalogEntry>,
  chip = "For You",
): FeedEvent[] {
  feedLoadLog("mergeGeneratedIntoFeed start", {
    main: mainEvents.length,
    generated: generatedItems.length,
    chip,
  });
  if (!generatedItems.length) {
    feedLoadLog("mergeGeneratedIntoFeed skip empty generated");
    return mainEvents;
  }
  const latestMode = isLatestFeedChip(chip);

  const byMirroredId = new Map<number, GeneratedActivityItem>();
  const mappedGenerated: FeedEvent[] = [];

  for (const item of generatedItems) {
    if (!isMainFeedActivityType(item.activity_type)) continue;
    if (item.mirrored_feed_event_id != null) {
      byMirroredId.set(item.mirrored_feed_event_id, item);
    }
    const mapped = mapGeneratedItemToFeedEvent(item, catalog);
    if (mapped) mappedGenerated.push(mapped);
  }

  const mainIds = new Set(mainEvents.map((e) => e.id).filter((id): id is number => id != null));

  const enrichedMain = mainEvents.map((event) => {
    if (event.id == null) return event;
    const source = byMirroredId.get(event.id);
    if (!source) return event;
    const patch = mapGeneratedItemToFeedEvent(source, catalog);
    if (!patch) return event;
    return {
      ...event,
      title: patch.title ?? event.title,
      body: patch.body ?? event.body,
      activity_type: patch.activity_type,
      generated_activity_id: patch.generated_activity_id,
      is_generated_activity: true,
      thread_id: patch.thread_id ?? event.thread_id,
      parent_activity_id: patch.parent_activity_id ?? event.parent_activity_id,
      related_battle_slug: patch.related_battle_slug ?? event.related_battle_slug,
      market_slug: event.market_slug ?? patch.market_slug,
      opponent_slug: event.opponent_slug ?? patch.opponent_slug,
      opponent_name: event.opponent_name ?? patch.opponent_name,
      card_kind: patch.card_kind ?? event.card_kind,
    };
  });

  const additions = mappedGenerated.filter((g) => {
    if (g.id != null && mainIds.has(g.id)) return false;
    if (g.generated_activity_id) {
      return !enrichedMain.some((e) => e.generated_activity_id === g.generated_activity_id);
    }
    return true;
  });

  let merged = [...additions, ...enrichedMain];
  merged = dedupeFeedEvents(merged);

  if (latestMode) {
    merged = sortFeedByThreadBlockTimeDesc(merged);
    merged = applyThreadDepthToFeedEvents(merged);
    merged = attachThreadParentContext(merged);
    const result = merged.map((e) => ({
      ...e,
      feed_mode: "latest" as const,
    }));
    feedLoadLog("mergeGeneratedIntoFeed done", { count: result.length, mode: "latest" });
    return result;
  }

  merged = sortFeedByPublishTimeDesc(merged);
  merged = groupThreadedFeedEvents(merged);
  merged = applyThreadDepthToFeedEvents(merged);
  merged = attachThreadParentContext(merged);
  feedLoadLog("mergeGeneratedIntoFeed done", { count: merged.length, mode: "ranked" });
  return merged;
}

function parseGeneratedFeedPayload(data: unknown): GeneratedActivityItem[] {
  if (Array.isArray(data)) {
    return data.filter(
      (row): row is GeneratedActivityItem =>
        row != null &&
        typeof row === "object" &&
        typeof (row as GeneratedActivityItem).activity_id === "string" &&
        typeof (row as GeneratedActivityItem).created_at === "string",
    );
  }
  if (data && typeof data === "object" && "items" in data) {
    const items = (data as GeneratedFeedResponse).items;
    return Array.isArray(items) ? items : [];
  }
  return [];
}

/**
 * Best-effort load of generated agent activity. Never throws — returns [] on any failure
 * so the main `/feed` request can still render the home stream.
 */
export async function fetchGeneratedFeedItems(
  apiFetchFn: (path: string) => Promise<Response | null>,
): Promise<GeneratedActivityItem[]> {
  feedLoadLog("fetchGeneratedFeedItems start");
  try {
    const res = await apiFetchFn("/feed/generated?limit=100");
    if (!res?.ok) {
      feedLoadLog("fetchGeneratedFeedItems skipped", {
        status: res?.status ?? "no-response",
      });
      return [];
    }
    let data: unknown;
    try {
      data = await res.json();
    } catch {
      if (process.env.NODE_ENV === "development") {
        console.warn("[feed] /feed/generated returned non-JSON body");
      }
      return [];
    }
    const items = parseGeneratedFeedPayload(data).filter((item) =>
      isMainFeedActivityType(item.activity_type),
    );
    feedLoadLog("fetchGeneratedFeedItems done", { count: items.length });
    return items;
  } catch (err) {
    feedLoadLog("fetchGeneratedFeedItems failed", {
      message: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}
