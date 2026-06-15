import { resolveArcThreadActionPrefix } from "@/lib/feedActionStates";
import type { FeedEvent } from "./feedMix";

export type ArcThreadKind = "continuing" | "rivalry" | "market" | "aftermath";

export type ArcThreadHeaderMeta = {
  kind: ArcThreadKind;
  /** Full line: "Rivalry Active · DoomBot vs BullBot" */
  title: string;
  shortTitle: string;
  moveCount: number;
  latestStage: string | null;
  isLive: boolean;
  clusterKey: string;
  /** True when this thread is a top ongoing story on the home feed */
  isActiveStory?: boolean;
  /** Part label for serialized arcs, e.g. "Part 3 of the NVIDIA timing war" */
  serialLabel?: string | null;
};

export type FeedStreamItem =
  | { type: "arc_header"; header: ArcThreadHeaderMeta; clusterKey: string }
  | { type: "event"; event: FeedEvent; index: number };

const SYNTHETIC_TYPES = new Set([
  "milestone_unlock",
  "season_shift",
  "season_lead",
  "season_arc",
  "season_collapse",
]);

function clusterKeyFor(event: FeedEvent): string | null {
  if (SYNTHETIC_TYPES.has(event.type)) return null;
  if (event.arc_id) return `arc:${event.arc_id}`;
  if (event.market_slug) return `market:${event.market_slug}`;
  return null;
}

function shortMarketTitle(event: FeedEvent): string {
  const t = event.market_title?.trim();
  if (t) return t.length > 52 ? `${t.slice(0, 50)}…` : t;
  const fromTitle = event.title.split("—")[0]?.trim();
  if (fromTitle && fromTitle.length > 4) {
    return fromTitle.length > 52 ? `${fromTitle.slice(0, 50)}…` : fromTitle;
  }
  return "Network thread";
}

function rivalryLabel(event: FeedEvent): string | null {
  const opp = event.opponent_name?.trim();
  if (!opp) return null;
  const agent = event.agent?.name?.trim();
  if (!agent) return opp;
  return `${agent} vs ${opp}`;
}

function resolveKind(run: FeedEvent[]): ArcThreadKind {
  const latest = run[0];
  const stage = latest.arc_progression?.toLowerCase() ?? null;
  if (stage === "aftermath") return "aftermath";

  const rivalry = run.some(
    (e) =>
      e.type === "rivalry" ||
      e.type === "battle_escalation" ||
      e.continuity_label === "escalating rivalry" ||
      Boolean(e.opponent_name),
  );
  if (rivalry && run.some((e) => e.opponent_name || e.opponent_slug)) {
    return "rivalry";
  }

  if (run.some((e) => e.arc_id)) return "continuing";
  return "market";
}

function arcThreadPrefix(
  kind: ArcThreadKind,
  opts: { isActiveStory: boolean; isLive: boolean; latestStage: string | null },
): string {
  return resolveArcThreadActionPrefix(kind, {
    isActiveStory: opts.isActiveStory,
    isLive: opts.isLive,
    latestStage: opts.latestStage,
  });
}

function storyKeyForRun(run: FeedEvent[], kind: ArcThreadKind): string | null {
  const latest = run[0];
  if (kind === "rivalry") {
    const agent = latest.agent?.slug;
    const opp = latest.opponent_slug;
    if (agent && opp) {
      return `rivalry:${[agent, opp].sort().join("-")}`;
    }
  }
  if (latest.arc_id) return `arc:${latest.arc_id}`;
  if (latest.market_slug) return `market:${latest.market_slug}`;
  return null;
}

function buildHeader(
  run: FeedEvent[],
  clusterKey: string,
  activeStoryKeys?: Set<string>,
): ArcThreadHeaderMeta {
  const latest = run[0];
  const kind = resolveKind(run);

  let shortTitle = shortMarketTitle(latest);
  if (kind === "rivalry") {
    const pair = rivalryLabel(latest) ?? run.map(rivalryLabel).find(Boolean);
    if (pair) shortTitle = pair;
  }

  const latestStage =
    latest.arc_progression ??
    run.find((e) => e.arc_progression)?.arc_progression ??
    null;

  const isLive = run.some((e) => e.live || e.show_new || e.is_streamed);

  const storyKey = storyKeyForRun(run, kind);
  const isActiveStory = Boolean(storyKey && activeStoryKeys?.has(storyKey));

  const prefix = arcThreadPrefix(kind, {
    isActiveStory,
    isLive,
    latestStage,
  });

  let serialLabel: string | null = null;
  if (isActiveStory && kind === "continuing" && run.length >= 3) {
    const market = shortMarketTitle(latest);
    serialLabel = `Part ${run.length} of the ${market} war`;
  } else if (isActiveStory && kind === "rivalry" && latestStage && latestStage !== "receipt pending") {
    serialLabel = null;
  }

  return {
    kind,
    title: serialLabel ?? `${prefix} · ${shortTitle}`,
    shortTitle,
    moveCount: run.length,
    latestStage,
    isLive,
    clusterKey,
    isActiveStory,
    serialLabel,
  };
}

/**
 * Insert compact arc-thread headers before clusters of 2+ related events.
 * Groups consecutive rows sharing arc_id, else market_slug (safe fallback).
 */
export function buildFeedStreamItems(
  events: FeedEvent[],
  activeStoryKeys?: string[],
  options?: { skipArcHeaders?: boolean },
): FeedStreamItem[] {
  const skipArcHeaders = options?.skipArcHeaders ?? false;
  const activeSet = activeStoryKeys?.length ? new Set(activeStoryKeys) : undefined;
  const items: FeedStreamItem[] = [];
  let i = 0;

  while (i < events.length) {
    const key = clusterKeyFor(events[i]);
    if (!key) {
      items.push({ type: "event", event: events[i], index: i });
      i += 1;
      continue;
    }

    let j = i + 1;
    while (j < events.length && clusterKeyFor(events[j]) === key) {
      j += 1;
    }

    const run = events.slice(i, j);
    if (!skipArcHeaders && run.length >= 2) {
      items.push({
        type: "arc_header",
        header: buildHeader(run, key, activeSet),
        clusterKey: key,
      });
    }

    for (let k = 0; k < run.length; k += 1) {
      items.push({ type: "event", event: run[k], index: i + k });
    }
    i = j;
  }

  return items;
}
