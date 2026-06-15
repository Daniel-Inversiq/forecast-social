import type { EnrichedActivePosition } from "@/components/positions/types";
import type { AnchorAgentPayload } from "@/lib/anchorAgent";
import type { GlobalDailyBrief, UserDailyBrief } from "@/lib/dailyBrief";
import { buildDeepBriefIntel } from "@/lib/intelligencePremium";
import type { OngoingStory, ResolvedStory } from "@/lib/ongoingStories";
import { stakePriorityScore } from "@/lib/personalStake";
import type { AwayBrief } from "@/lib/whileYouWereAway";
import { buildNetworkBriefing } from "@/lib/networkBriefingCopy";
import { formatTimeAgo } from "@/components/feed/shared";

type FollowingAgent = { name: string; slug: string; niche?: string };

function hourBucket(): "morning" | "afternoon" | "evening" | "late" {
  const h = new Date().getHours();
  if (h >= 22 || h < 5) return "late";
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}

export function hourGreeting(): string {
  const bucket = hourBucket();
  if (bucket === "morning") return "Good morning.";
  if (bucket === "afternoon") return "Good afternoon.";
  if (bucket === "evening") return "Good evening.";
  return "Good evening.";
}

function networkTimePrefix(): string {
  const bucket = hourBucket();
  if (bucket === "morning") return "While you slept, ";
  if (bucket === "afternoon") return "Since this morning, ";
  if (bucket === "evening") return "Before the close, ";
  return "The network is thin, but ";
}

function shortMarketTitle(title: string, max = 36): string {
  if (title.length <= max) return title;
  return `${title.slice(0, max - 1).trim()}…`;
}

function shortTopic(title: string): string {
  const t = title.trim();
  const cut = t.split(/\s+by\s+/i)[0]?.split(/\s+before\s+/i)[0]?.trim();
  return shortMarketTitle(cut || t, 28);
}

export function formatResolveIn(hours: number | null | undefined): string {
  if (hours == null || hours <= 0) return "tonight";
  if (hours <= 6) return "in 6h";
  if (hours < 24) return "tonight";
  const days = Math.max(1, Math.round(hours / 24));
  return `in ${days}d`;
}

function joinClauses(parts: string[]): string {
  const clean = parts.map((p) => p.trim().replace(/\.$/, "")).filter(Boolean);
  if (clean.length === 0) return "";
  if (clean.length === 1) return `${clean[0]}.`;
  if (clean.length === 2) return `${clean[0]}, and ${clean[1]}.`;
  return `${clean.slice(0, -1).join(", ")}, and ${clean[clean.length - 1]}.`;
}

export function buildStakeLine(positions: EnrichedActivePosition[]): string | null {
  if (!positions.length) return null;

  const ranked = [...positions].sort((a, b) => stakePriorityScore(b) - stakePriorityScore(a));
  const top = ranked[0]!;

  const resolving = [...ranked]
    .filter((p) => p.resolution_horizon?.hours_remaining != null)
    .sort(
      (a, b) =>
        (a.resolution_horizon?.hours_remaining ?? 999) -
        (b.resolution_horizon?.hours_remaining ?? 999),
    )[0];

  if (resolving?.resolution_horizon) {
    const when = formatResolveIn(resolving.resolution_horizon.hours_remaining);
    return `Your ${shortTopic(resolving.market_title)} position resolves ${when}.`;
  }

  const consensusAgainst =
    (top.side === "YES" && top.consensus_drift < -2) ||
    (top.side === "NO" && top.consensus_drift > 2) ||
    top.network_direction === "away";

  if (consensusAgainst) {
    return `Consensus moved against your ${shortTopic(top.market_title)} position.`;
  }

  const challenged = ranked.find((p) => p.contested || p.chips.includes("UNDER PRESSURE"));
  if (challenged) {
    return `Your ${shortTopic(challenged.market_title)} read is now the most challenged.`;
  }

  if (ranked.length === 1) {
    return `Your ${shortTopic(top.market_title)} position is still open.`;
  }

  return `You have ${ranked.length} open positions — ${shortTopic(top.market_title)} leads the book.`;
}

export function buildStakeSoftCta(global: GlobalDailyBrief): string {
  const narratives = global.dominant_narratives ?? [];
  const label = narratives[0]?.label;
  if (label) return `No open conviction yet. ${label} awaits a verdict tonight.`;
  return "No open conviction yet. One narrative awaits a verdict tonight.";
}

export type InsiderBriefingInput = {
  global: GlobalDailyBrief;
  awayBrief?: AwayBrief | null;
  followingAgents?: FollowingAgent[];
  anchor?: AnchorAgentPayload | null;
  ongoingStories?: OngoingStory[];
};

/** Insider-style network briefing for the home feed — answers "what changed since I was gone?" */
export function buildInsiderNetworkBriefing(input: InsiderBriefingInput): string {
  return buildNetworkBriefing(input);
}

/** @deprecated Use buildInsiderNetworkBriefing */
export function buildNetworkBriefingOpening(global: GlobalDailyBrief): string {
  return buildInsiderNetworkBriefing({ global });
}

export function buildAnchorLine(anchor: AnchorAgentPayload | null | undefined): string | null {
  if (!anchor?.has_anchor || !anchor.agent) return null;
  const name = anchor.agent.name;

  if (anchor.mood === "quiet") {
    return `${name} is unusually quiet.`;
  }
  if (anchor.mood === "isolated") {
    const isolated = anchor.lines.find((l) => /isolated/i.test(l));
    return isolated ?? `${name} is isolated again.`;
  }
  if (anchor.mood === "aggressive" || anchor.mood === "under_pressure") {
    const rival = anchor.lines.find((l) => /rival|battle|pressing|vs/i.test(l));
    if (rival) return rival.endsWith(".") ? rival : `${rival}.`;
    return anchor.headline.endsWith(".") ? anchor.headline : `${anchor.headline}.`;
  }
  if (anchor.mood === "loud") {
    const activity = anchor.lines.find((l) => /posted|take|twice|shifted/i.test(l));
    if (activity) return activity.endsWith(".") ? activity : `${activity}.`;
    return `${name} has been active since your last check.`;
  }

  const headline = anchor.headline?.trim();
  if (headline && headline.length < 90) {
    return headline.endsWith(".") ? headline : `${headline}.`;
  }
  return null;
}

function buildReceiptLine(
  away: AwayBrief | null | undefined,
  resolved: ResolvedStory[] | undefined,
  userBrief: UserDailyBrief | null | undefined,
): string | null {
  const resolution = away?.changes.find((c) => c.kind === "resolution");
  if (resolution?.line && /resolved|verified|favor/i.test(resolution.line)) {
    const market = resolution.line.split(" resolved")[0]?.replace(/^.*—\s*/, "").trim();
    if (market) return `Receipt verified: your ${shortTopic(market)} call resolved.`;
  }

  const receipt = away?.changes.find((c) => c.kind === "receipt_resurface");
  if (receipt?.line) {
    return receipt.line.replace(/^A receipt resurfaced/i, "Receipt resurfaced");
  }

  const freshResolved = resolved?.[0];
  if (freshResolved?.receipt_line) {
    return freshResolved.receipt_line.endsWith(".")
      ? freshResolved.receipt_line
      : `${freshResolved.receipt_line}.`;
  }

  const milestone = userBrief?.milestone_unlocks?.[0];
  if (milestone && typeof milestone.title === "string") {
    return `Your ${milestone.title.toLowerCase()} milestone landed overnight.`;
  }

  return null;
}

function buildNetworkClause(away: AwayBrief | null | undefined, global: GlobalDailyBrief): string | null {
  const prefix = networkTimePrefix();

  if (!away || away.state === "public") {
    const count = Math.min(3, global.dominant_narratives?.length ?? 0);
    if (count >= 2) {
      return `${prefix}${count} narratives started to matter.`;
    }
    const shift =
      (global.sections.strongest_shifts as { headline?: string } | null)?.headline ??
      (global.biggest_consensus_shift as { headline?: string } | null)?.headline;
    if (shift && typeof shift === "string") {
      const core = shift.replace(/\.$/, "").slice(0, 72);
      return `${prefix}${core.charAt(0).toLowerCase()}${core.slice(1)}.`;
    }
    return null;
  }

  if (away.state === "first_visit") return null;
  if (away.state === "quiet") return `${prefix}your book held steady.`;

  const n = away.changes.length;
  if (n >= 3) return `${prefix}${n} things started to matter.`;
  if (n === 2) return `${prefix}two threads moved on your desk.`;
  if (n === 1) {
    const line = away.changes[0]!.line.replace(/\.$/, "");
    return `${prefix}${line.charAt(0).toLowerCase()}${line.slice(1)}.`;
  }

  const headline = away.headline.replace(/^While you were away,?\s*/i, "");
  if (headline) {
    return `${prefix}${headline.charAt(0).toLowerCase()}${headline.slice(1)}.`;
  }
  return null;
}

function buildDeskLine(
  following: FollowingAgent[],
  positions: EnrichedActivePosition[],
  anchor: AnchorAgentPayload | null | undefined,
): string | null {
  const topics: string[] = [];
  if (anchor?.agent) topics.push(anchor.agent.name);
  for (const agent of following.slice(0, 2)) {
    if (!topics.includes(agent.name)) topics.push(agent.name);
  }
  for (const p of positions.slice(0, 2)) {
    const topic = shortTopic(p.market_title);
    if (!topics.some((t) => t.toLowerCase() === topic.toLowerCase())) topics.push(topic);
  }
  if (topics.length < 2) return null;
  const slice = topics.slice(0, 3);
  const last = slice.pop()!;
  const lead = slice.join(", ");
  return `Your desk is watching ${lead ? `${lead}, and ${last}` : last}.`;
}

function collectBriefTopics(
  opening: string,
  global: GlobalDailyBrief,
  positions: EnrichedActivePosition[],
): Set<string> {
  const topics = new Set<string>();
  for (const position of positions) {
    topics.add(shortTopic(position.market_title).toLowerCase());
  }
  for (const narrative of [
    ...global.dominant_narratives,
    ...global.sections.rising_narratives,
    ...global.sections.consensus_fractures,
  ]) {
    if (narrative?.label) topics.add(narrative.label.toLowerCase());
  }
  for (const match of opening.matchAll(/\bon\s+([^.,]+)/gi)) {
    topics.add(shortTopic(match[1] ?? "").toLowerCase());
  }
  return topics;
}

function watchItemRepeatsTopic(item: string, topics: Set<string>): boolean {
  const lower = item.toLowerCase();
  for (const topic of topics) {
    if (topic.length >= 4 && lower.includes(topic)) return true;
  }
  return false;
}

function buildWatchToday(
  positions: EnrichedActivePosition[],
  stories: OngoingStory[],
  away: AwayBrief | null | undefined,
  global: GlobalDailyBrief,
  following: FollowingAgent[],
  opts?: { maxItems?: number; skipStoryAndAwayDup?: boolean; avoidTopics?: Set<string> },
): string[] {
  const maxItems = opts?.maxItems ?? 3;
  const skipDup = opts?.skipStoryAndAwayDup ?? false;
  const avoidTopics = opts?.avoidTopics ?? new Set<string>();
  const items: string[] = [];

  const stakeSorted = [...positions].sort((a, b) => stakePriorityScore(b) - stakePriorityScore(a));
  const resolving = stakeSorted.find((p) => p.resolution_horizon?.hours_remaining != null);
  if (resolving?.resolution_horizon) {
    items.push(`${shortTopic(resolving.market_title)} resolution window`);
  } else if (stakeSorted[0]) {
    items.push(`${shortTopic(stakeSorted[0].market_title)} — your open loop`);
  }

  if (!skipDup) {
    const story = stories[0];
    if (story) {
      const rivalry =
        story.unresolved_line ??
        story.why_today ??
        story.recent_change ??
        story.headline;
      if (rivalry) {
        const agents = story.agents.map((a) => a.name);
        if (agents.length >= 2) {
          items.push(`${agents[0]} vs ${agents[1]}, still unresolved`);
        } else {
          items.push(shortMarketTitle(rivalry.replace(/\.$/, ""), 56));
        }
      }
    } else {
      const battle = away?.changes.find((c) => c.kind === "battle_escalation");
      if (battle) items.push(shortMarketTitle(battle.line.replace(/\.$/, ""), 56));
    }
  }

  if (!skipDup) {
    const receipt = away?.changes.find((c) => c.kind === "receipt_resurface");
    if (receipt) {
      items.push(shortMarketTitle(receipt.line.replace(/\.$/, ""), 56));
    }
  }

  if (items.length < maxItems) {
    const rising = global.sections.rising_narratives[0] ?? global.dominant_narratives[0];
    if (rising?.label) {
      items.push(`${rising.label} — gaining credibility`);
    } else if (following[0]) {
      items.push(`${following[0].name} — next move on your watchlist`);
    }
  }

  return [...new Set(items.map((s) => s.trim()).filter(Boolean))]
    .filter((item) => !watchItemRepeatsTopic(item, avoidTopics))
    .slice(0, maxItems);
}

function buildDeepRead(brief: GlobalDailyBrief): string {
  const fractures = brief.sections.consensus_fractures;
  if (fractures.length > 0) {
    const label = fractures[0]!.label.toLowerCase();
    return `Hidden alignment is forming around ${label}, but the public feed hasn't priced it yet.`;
  }
  const deep = buildDeepBriefIntel(brief);
  const sentence = deep.hiddenPressure.split(/[.—]/)[0]?.trim();
  return sentence ? `${sentence}.` : deep.deepParagraph.split(".")[0]?.trim() + ".";
}

function buildFreeTeaser(brief: GlobalDailyBrief): string | null {
  const summary = brief.summary?.trim();
  if (!summary || summary.length < 24) return null;
  const clipped = summary.length > 100 ? `${summary.slice(0, 97).trim()}…` : summary;
  return clipped.endsWith(".") ? clipped : `${clipped}.`;
}

export type MorningRitualInput = {
  global: GlobalDailyBrief;
  userBrief?: UserDailyBrief | null;
  positions?: EnrichedActivePosition[];
  followingAgents?: FollowingAgent[];
  awayBrief?: AwayBrief | null;
  anchor?: AnchorAgentPayload | null;
  ongoingStories?: OngoingStory[];
  resolvedStories?: ResolvedStory[];
  hasIntelligenceAccess?: boolean;
  /** Home feed: one opening line, max 2 watch items, no WYWA/story duplication. */
  homeFeedCompact?: boolean;
};

export type MorningRitualCopy = {
  greeting: string;
  opening: string;
  receiptLine?: string;
  watchToday: string[];
  deepRead?: string;
  teaser?: string;
  seasonNote?: string;
};

export function buildMorningRitualBrief(input: MorningRitualInput): MorningRitualCopy {
  const {
    global,
    userBrief = null,
    positions = [],
    followingAgents = [],
    awayBrief = null,
    anchor = null,
    ongoingStories = [],
    resolvedStories = [],
    hasIntelligenceAccess = false,
    homeFeedCompact = false,
  } = input;

  const greeting = hourGreeting();
  const stakeLine = buildStakeLine(positions);
  const anchorLine = homeFeedCompact ? null : buildAnchorLine(anchor);
  const networkLine = homeFeedCompact ? null : buildNetworkClause(awayBrief, global);
  const deskLine = homeFeedCompact ? null : buildDeskLine(followingAgents, positions, anchor);
  const receiptLine =
    homeFeedCompact ? undefined : buildReceiptLine(awayBrief, resolvedStories, userBrief) ?? undefined;

  let opening: string;
  if (homeFeedCompact) {
    opening = buildInsiderNetworkBriefing({
      global,
      awayBrief,
      followingAgents,
      anchor,
      ongoingStories,
    });
  } else {
    const openingParts: string[] = [];
    if (stakeLine) openingParts.push(stakeLine);
    else if (!positions.length) openingParts.push(buildStakeSoftCta(global));
    if (anchorLine) openingParts.push(anchorLine);
    else if (deskLine) openingParts.push(deskLine);
    else if (networkLine) openingParts.push(networkLine);

    opening = joinClauses(openingParts) || global.summary;
  }

  const briefTopics = collectBriefTopics(opening, global, positions);
  const watchToday = buildWatchToday(
    positions,
    ongoingStories,
    awayBrief,
    global,
    followingAgents,
    homeFeedCompact
      ? { maxItems: 2, skipStoryAndAwayDup: true, avoidTopics: briefTopics }
      : { avoidTopics: briefTopics },
  );

  return {
    greeting,
    opening,
    receiptLine,
    watchToday,
    deepRead: homeFeedCompact
      ? undefined
      : hasIntelligenceAccess
        ? buildDeepRead(global)
        : undefined,
    teaser: homeFeedCompact
      ? undefined
      : hasIntelligenceAccess
        ? undefined
        : (buildFreeTeaser(global) ?? undefined),
    seasonNote: homeFeedCompact ? undefined : (global.active_season ?? undefined),
  };
}

/** @deprecated Use buildMorningRitualBrief — kept for narrow imports */
export type PersonalBriefInput = {
  global: GlobalDailyBrief;
  userBrief?: UserDailyBrief | null;
  positions?: EnrichedActivePosition[];
  followingAgents?: FollowingAgent[];
  overnightMoveCount?: number;
  awayBrief?: AwayBrief | null;
  anchor?: AnchorAgentPayload | null;
  ongoingStories?: OngoingStory[];
  resolvedStories?: ResolvedStory[];
  hasIntelligenceAccess?: boolean;
};

export type PersonalBriefCopy = {
  greeting: string;
  title: string;
  lead: string;
  bullets: string[];
};

export function buildPersonalBrief(input: PersonalBriefInput): PersonalBriefCopy {
  const ritual = buildMorningRitualBrief(input);
  return {
    greeting: ritual.greeting,
    title: "",
    lead: ritual.opening,
    bullets: ritual.watchToday,
  };
}

export function formatPositionHookLine(
  kind: "count" | "resolving" | "exposure" | "consensus" | "challenge",
  payload: Record<string, string | number>,
): string {
  switch (kind) {
    case "count":
      return `You have ${payload.count} open position${payload.count === 1 ? "" : "s"}.`;
    case "resolving":
      return `${payload.title} resolves ${payload.when}.`;
    case "exposure":
      return `Largest exposure: ${payload.title} ($${payload.amount}).`;
    case "consensus":
      return `Consensus moved ${payload.delta}pt against your position.`;
    case "challenge":
      return payload.count === 1
        ? "One challenge thread is heating up."
        : `${payload.count} challenge threads are heating up.`;
    default:
      return "";
  }
}

export function relativeResolveLabel(expectedAt: string | null | undefined): string {
  if (!expectedAt) return "soon";
  const ms = Date.parse(expectedAt);
  if (!Number.isFinite(ms)) return "soon";
  const hours = (ms - Date.now()) / (60 * 60 * 1000);
  if (hours <= 6) return "in 6h";
  if (hours < 24) return "tonight";
  return formatTimeAgo(expectedAt, true);
}
