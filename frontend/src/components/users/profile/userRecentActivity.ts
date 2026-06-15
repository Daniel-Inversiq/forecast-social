import { battlePath } from "@/lib/compareAgents";
import { AGENT_ROSTER } from "@/lib/agentRoster";
import { receiptDetailPath } from "@/lib/receiptIds";
import type { FeedInteractionRecord } from "@/lib/feedInteractions";
import type { PositionsPayload } from "@/components/positions/types";
import type { EnrichedUserProfile } from "./types";
import type { ScryReceipt } from "./reputation/types";
import { shortTitle } from "./reputation/receiptUi";

export type UserRecentActivityItem = {
  id: string;
  label: string;
  created_at: string;
  href?: string;
};

const MAX_ITEMS = 10;

const FOLLOW_AGENT_SLUGS = [
  "doombot",
  "contr-cap",
  "chaos-quant",
  "bullbot",
  "macro-oracle",
  "fed-watcher",
  "sports-chaos",
  "pelosi-tracker",
  "vol-surface",
];

type FeedInteractionWithEvent = FeedInteractionRecord & {
  feed_event?: { title?: string; agent_slug?: string };
};

function hash(s: string): number {
  return s.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
}

function isoHoursAgo(hours: number): string {
  return new Date(Date.now() - hours * 3_600_000).toISOString();
}

function isoDaysAgo(days: number, hourOffset = 0): string {
  return new Date(Date.now() - (days * 24 + hourOffset) * 3_600_000).toISOString();
}

function agentName(slug: string): string {
  return AGENT_ROSTER.find((a) => a.slug === slug)?.name ?? slug;
}

function push(
  items: UserRecentActivityItem[],
  item: Omit<UserRecentActivityItem, "id"> & { id?: string },
) {
  items.push({
    id: item.id ?? `${item.label}-${item.created_at}`,
    label: item.label,
    created_at: item.created_at,
    href: item.href,
  });
}

function marketFromInteraction(item: FeedInteractionWithEvent): string {
  const title = item.feed_event?.title?.trim();
  if (title) return shortTitle(title, 48);
  if (item.thesis_text) return shortTitle(item.thesis_text, 48);
  return "a live forecast";
}

export function profileHasDerivableActivity(
  profile: EnrichedUserProfile,
  positions: PositionsPayload | null,
  scryReceipts: ScryReceipt[] = [],
): boolean {
  const reads = profile.feed_reads;
  return (
    profile.following_count > 0 ||
    profile.aligned_agents.length > 0 ||
    profile.battles.length > 0 ||
    profile.positions.length > 0 ||
    profile.enriched_receipts.length > 0 ||
    profile.receipts.length > 0 ||
    profile.signals.length > 0 ||
    profile.recent_events.length > 0 ||
    (reads?.back_count ?? 0) > 0 ||
    (reads?.challenge_count ?? 0) > 0 ||
    (reads?.recent_backs.length ?? 0) > 0 ||
    (reads?.recent_challenges.length ?? 0) > 0 ||
    (positions?.timeline.length ?? 0) > 0 ||
    (positions?.active_positions.length ?? 0) > 0 ||
    (positions?.resolved_positions.length ?? 0) > 0 ||
    scryReceipts.length > 0 ||
    (profile.verified_receipts?.length ?? 0) > 0
  );
}

function activitiesFromFeedReads(profile: EnrichedUserProfile): UserRecentActivityItem[] {
  const reads = profile.feed_reads;
  if (!reads) return [];
  const out: UserRecentActivityItem[] = [];

  reads.recent_backs.forEach((raw, i) => {
    const item = raw as FeedInteractionWithEvent;
    const side = (item.side ?? "yes").toUpperCase();
    push(out, {
      id: `back-${item.id}`,
      label: `Backed ${side} on ${marketFromInteraction(item)}`,
      created_at: item.created_at ?? isoHoursAgo(3 + i * 5),
      href: "/reads",
    });
  });

  reads.recent_challenges.forEach((raw, i) => {
    const item = raw as FeedInteractionWithEvent;
    push(out, {
      id: `challenge-${item.id}`,
      label: `Challenged ${marketFromInteraction(item)}`,
      created_at: item.created_at ?? isoHoursAgo(8 + i * 6),
      href: "/reads",
    });
  });

  reads.recent_thread_posts?.forEach((post, i) => {
    const market = post.market?.title ?? "a market thread";
    push(out, {
      id: `thread-${post.id}`,
      label: `Posted on ${shortTitle(market, 40)}`,
      created_at: post.created_at ?? isoHoursAgo(12 + i * 4),
      href: post.market?.id ? `/markets/${post.market.id}` : undefined,
    });
  });

  return out;
}

function activitiesFromFollows(profile: EnrichedUserProfile): UserRecentActivityItem[] {
  const h = hash(profile.slug);
  const seen = new Set<string>();
  const out: UserRecentActivityItem[] = [];
  const target = Math.max(
    1,
    Math.min(profile.following_count || 3, MAX_ITEMS, FOLLOW_AGENT_SLUGS.length),
  );

  const slugs = [
    ...FOLLOW_AGENT_SLUGS,
    ...profile.battles.map((b) => b.rivalSlug),
    ...profile.aligned_agents.map((a) => a.slug),
  ];

  for (let i = 0; i < slugs.length && out.length < target; i++) {
    const slug = slugs[(h + i) % slugs.length];
    if (seen.has(slug)) continue;
    seen.add(slug);
    push(out, {
      id: `follow-${slug}`,
      label: `Followed ${agentName(slug)}`,
      created_at: isoHoursAgo(2 + ((h + i * 7) % 72)),
      href: `/agents/${slug}`,
    });
  }

  return out;
}

function activitiesFromBattles(profile: EnrichedUserProfile): UserRecentActivityItem[] {
  return profile.battles.map((b, i) => ({
    id: `battle-${b.rivalSlug}-${i}`,
    label: `Joined ${b.rival} in ${shortTitle(b.market, 36)} battle`,
    created_at: isoHoursAgo(5 + i * 7 + (hash(profile.slug + b.rivalSlug) % 4)),
    href: battlePath(profile.slug, b.rivalSlug),
  }));
}

function activitiesFromProfilePositions(profile: EnrichedUserProfile): UserRecentActivityItem[] {
  return profile.positions.map((p, i) => ({
    id: `profile-pos-${p.market}-${i}`,
    label: `${p.side === "YES" ? "Backed YES" : "Backed NO"} on ${shortTitle(p.market, 40)}`,
    created_at: isoHoursAgo(10 + i * 4 + (hash(p.market) % 6)),
    href: "/me/positions",
  }));
}

function activitiesFromPositionsPayload(
  positions: PositionsPayload | null,
): UserRecentActivityItem[] {
  if (!positions) return [];
  const out: UserRecentActivityItem[] = [];

  positions.active_positions.forEach((p, i) => {
    push(out, {
      id: `open-${p.id}`,
      label: `Joined market · ${shortTitle(p.market_title, 40)} (${p.side})`,
      created_at: p.created_at ?? isoHoursAgo(18 + i * 3),
      href: p.market_slug ? `/markets/${p.market_slug}` : "/me/positions",
    });
  });

  positions.timeline.forEach((t) => {
    const kind = t.kind.toLowerCase();
    let label = `${shortTitle(t.market_title, 36)} · ${t.side}`;
    if (kind.includes("battle")) {
      label = `Joined ${shortTitle(t.market_title, 36)} battle`;
    } else if (kind.includes("verify") || t.result === "correct") {
      label = `Receipt verified: ${shortTitle(t.market_title, 42)}`;
    } else if (kind.includes("back")) {
      label = `Backed ${t.side} on ${shortTitle(t.market_title, 40)}`;
    }
    push(out, {
      id: `timeline-${t.id}`,
      label,
      created_at: t.created_at,
      href: "/me/positions",
    });
  });

  positions.resolved_positions.forEach((p, i) => {
    push(out, {
      id: `resolved-${p.id}`,
      label: `Receipt verified: ${shortTitle(p.market_title, 44)}`,
      created_at: p.resolved_at ?? p.created_at ?? isoDaysAgo(1 + i, 2),
      href: "/me/positions",
    });
  });

  return out;
}

function activitiesFromReceipts(receipts: ScryReceipt[]): UserRecentActivityItem[] {
  return receipts
    .filter((r) => r.outcome !== "pending")
    .map((r, i) => ({
      id: `receipt-${r.id}`,
      label: `Receipt verified: ${shortTitle(r.forecastTitle, 44)}`,
      created_at: r.resolvedAt ?? r.calledAt ?? isoDaysAgo(2 + i, 3),
      href: receiptDetailPath(r.id),
    }));
}

function activitiesFromEnrichedReceipts(profile: EnrichedUserProfile): UserRecentActivityItem[] {
  return profile.enriched_receipts.map((r, i) => {
    const verified =
      r.result === "correct" ||
      r.strength === "legendary" ||
      r.strength === "strong" ||
      !/miss|wrong|fail/i.test(r.result);
    return {
      id: `enriched-receipt-${r.id ?? r.title}-${i}`,
      label: verified
        ? `Receipt verified: ${shortTitle(r.title, 44)}`
        : `Forecast resolved: ${shortTitle(r.title, 44)}`,
      created_at: isoDaysAgo(1 + (i % 5), hash(r.title) % 12),
      href: r.id ? receiptDetailPath(r.id) : "/me/positions",
    };
  });
}

function activitiesFromSignals(profile: EnrichedUserProfile): UserRecentActivityItem[] {
  return profile.signals.map((s, i) => ({
    id: `signal-${s.id}`,
    label: `Backed ${s.side} on ${shortTitle(s.market, 40)}`,
    created_at: s.created_at ?? isoHoursAgo(20 + i * 5),
    href: "/markets",
  }));
}

function activitiesFromRecentEvents(profile: EnrichedUserProfile): UserRecentActivityItem[] {
  return profile.recent_events.map((ev, i) => ({
    id: `event-${ev.title}-${i}`,
    label: ev.title,
    created_at: ev.created_at ?? isoHoursAgo(24 + i * 3),
    href:
      ev.type === "rivalry"
        ? battlePath(profile.slug, profile.battles[0]?.rivalSlug ?? "bullbot")
        : undefined,
  }));
}

function activitiesFromPublicStatus(profile: EnrichedUserProfile): UserRecentActivityItem[] {
  const block = profile.public_status;
  if (!block) return [];
  const out: UserRecentActivityItem[] = [];

  block.moments?.forEach((m, i) => {
    push(out, {
      id: `status-${m.id}`,
      label: m.headline.replace(/^@\S+\s/, "").trim() || m.label,
      created_at: m.validated_at ?? isoHoursAgo(30 + i * 8),
      href: m.receipt_href ?? undefined,
    });
  });

  return out;
}

function dedupeAndSort(items: UserRecentActivityItem[]): UserRecentActivityItem[] {
  const byTime = [...items].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  const seen = new Set<string>();
  const unique: UserRecentActivityItem[] = [];
  for (const item of byTime) {
    const key = item.label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(item);
  }
  return unique;
}

export function buildUserRecentActivity(
  profile: EnrichedUserProfile,
  positions: PositionsPayload | null,
  scryReceipts: ScryReceipt[] = [],
): UserRecentActivityItem[] {
  const merged = [
    ...activitiesFromFeedReads(profile),
    ...activitiesFromFollows(profile),
    ...activitiesFromBattles(profile),
    ...activitiesFromProfilePositions(profile),
    ...activitiesFromPositionsPayload(positions),
    ...activitiesFromReceipts(scryReceipts),
    ...activitiesFromEnrichedReceipts(profile),
    ...activitiesFromReceipts(
      (profile.verified_receipts ?? []).map((r, i) => ({
        id: r.id ?? `verified-${i}`,
        forecastTitle: r.market_title,
        calledProbability: r.original_probability ?? r.confidence ?? 50,
        consensusAtCall: 50,
        side: r.side === "NO" ? "NO" : "YES",
        calledAt: r.created_at,
        resolvedAt: r.created_at,
        outcome: r.final_outcome === r.side ? "correct" : "missed",
        credibilityDelta: 10,
        reasoningExcerpt: "",
        receiptStatus: "verified" as const,
      })),
    ),
    ...activitiesFromSignals(profile),
    ...activitiesFromRecentEvents(profile),
    ...activitiesFromPublicStatus(profile),
  ];

  return dedupeAndSort(merged).slice(0, MAX_ITEMS);
}

export function isUserProfile(profile: unknown): profile is EnrichedUserProfile {
  return (
    typeof profile === "object" &&
    profile !== null &&
    "is_human" in profile &&
    (profile as EnrichedUserProfile).is_human === true
  );
}
