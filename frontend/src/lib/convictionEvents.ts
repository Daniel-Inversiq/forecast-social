"use client";

import { receiptDetailPath } from "@/lib/receiptIds";

export type ConvictionEventType =
  | "receipt_resolved"
  | "receipt_verified"
  | "position_under_pressure"
  | "rivalry_escalated"
  | "battle_escalated"
  | "battle_lost"
  | "credibility_earned"
  | "credibility_lost"
  | "rank_improved"
  | "premium_subscriber_joined"
  | "subscriber_joined"
  | "read_backed"
  | "read_challenged"
  | "consensus_shifted"
  | "new_follower"
  | "agent_read_posted"
  | "market_updated"
  | "new_public_read"
  | "minor_network_activity";

export type ConvictionPriority = "critical" | "important" | "informational";

export type ConvictionCategory =
  | "receipts"
  | "reads"
  | "battles"
  | "reputation"
  | "network"
  | "positions"
  | "markets";

export type ConvictionEvent = {
  id: string;
  type: ConvictionEventType;
  title: string;
  body: string;
  impact: string;
  priority: ConvictionPriority;
  timestamp: string;
  read: boolean;
  toastShown: boolean;
  category: ConvictionCategory;
  href: string;
};

export type ConvictionEventMeta = {
  label: string;
  category: ConvictionCategory;
  defaultPriority: ConvictionPriority;
  colorClass: string;
  defaultHref: string;
  toastEligible: boolean;
};

export const CONVICTION_EVENTS_STORAGE_KEY = "scry-conviction-events-v2";
export const CONVICTION_EVENTS_CHANGED_EVENT = "scry-conviction-events-changed";

export const TOAST_DURATION_MS: Record<"critical" | "important", number> = {
  critical: 5000,
  important: 3000,
};

const MAX_EVENTS = 200;

export const CONVICTION_EVENT_META: Record<ConvictionEventType, ConvictionEventMeta> = {
  receipt_resolved: {
    label: "Receipt Resolved",
    category: "receipts",
    defaultPriority: "critical",
    colorClass: "border-emerald-500/50 text-emerald-200",
    defaultHref: receiptDetailPath("demo-fed-cut-receipt"),
    toastEligible: true,
  },
  receipt_verified: {
    label: "Receipt Verified",
    category: "receipts",
    defaultPriority: "important",
    colorClass: "border-emerald-500/40 text-emerald-200",
    defaultHref: receiptDetailPath("demo-verified-call"),
    toastEligible: true,
  },
  position_under_pressure: {
    label: "Position Under Pressure",
    category: "positions",
    defaultPriority: "critical",
    colorClass: "border-red-500/50 text-red-200",
    defaultHref: "/markets/nvda-q2-beat",
    toastEligible: true,
  },
  rivalry_escalated: {
    label: "Rivalry Escalated",
    category: "battles",
    defaultPriority: "critical",
    colorClass: "border-rose-500/50 text-rose-200",
    defaultHref: "/battles/fed-watcher-vs-doombot",
    toastEligible: true,
  },
  battle_escalated: {
    label: "Battle Escalated",
    category: "battles",
    defaultPriority: "critical",
    colorClass: "border-rose-500/50 text-rose-200",
    defaultHref: "/battles",
    toastEligible: true,
  },
  battle_lost: {
    label: "Battle Lost",
    category: "battles",
    defaultPriority: "critical",
    colorClass: "border-rose-500/50 text-rose-200",
    defaultHref: "/battles",
    toastEligible: true,
  },
  credibility_earned: {
    label: "Credibility Earned",
    category: "reputation",
    defaultPriority: "critical",
    colorClass: "border-violet-500/50 text-violet-200",
    defaultHref: "/reputation",
    toastEligible: true,
  },
  credibility_lost: {
    label: "Credibility Lost",
    category: "reputation",
    defaultPriority: "critical",
    colorClass: "border-amber-500/50 text-amber-200",
    defaultHref: "/reputation",
    toastEligible: true,
  },
  rank_improved: {
    label: "Rank Improved",
    category: "reputation",
    defaultPriority: "critical",
    colorClass: "border-sky-500/50 text-sky-200",
    defaultHref: "/reputation",
    toastEligible: true,
  },
  premium_subscriber_joined: {
    label: "Premium Subscriber",
    category: "network",
    defaultPriority: "critical",
    colorClass: "border-indigo-500/50 text-indigo-200",
    defaultHref: "/intelligence-access",
    toastEligible: true,
  },
  subscriber_joined: {
    label: "Subscriber Joined",
    category: "network",
    defaultPriority: "important",
    colorClass: "border-indigo-500/40 text-indigo-200",
    defaultHref: "/intelligence-access",
    toastEligible: true,
  },
  read_backed: {
    label: "Read Backed",
    category: "reads",
    defaultPriority: "important",
    colorClass: "border-cyan-500/40 text-cyan-200",
    defaultHref: "/reads",
    toastEligible: true,
  },
  read_challenged: {
    label: "Read Challenged",
    category: "reads",
    defaultPriority: "important",
    colorClass: "border-amber-500/40 text-amber-200",
    defaultHref: "/reads",
    toastEligible: true,
  },
  consensus_shifted: {
    label: "Consensus Shifted",
    category: "markets",
    defaultPriority: "important",
    colorClass: "border-cyan-500/40 text-cyan-200",
    defaultHref: "/markets/us-recession-by-q4",
    toastEligible: true,
  },
  new_follower: {
    label: "New Follower",
    category: "network",
    defaultPriority: "important",
    colorClass: "border-zinc-500/50 text-zinc-200",
    defaultHref: "/following",
    toastEligible: true,
  },
  agent_read_posted: {
    label: "Agent Read",
    category: "reads",
    defaultPriority: "informational",
    colorClass: "border-zinc-600/70 text-zinc-300",
    defaultHref: "/reads",
    toastEligible: false,
  },
  market_updated: {
    label: "Market Updated",
    category: "markets",
    defaultPriority: "informational",
    colorClass: "border-zinc-600/70 text-zinc-300",
    defaultHref: "/markets",
    toastEligible: false,
  },
  new_public_read: {
    label: "Public Read",
    category: "reads",
    defaultPriority: "informational",
    colorClass: "border-zinc-600/70 text-zinc-300",
    defaultHref: "/reads",
    toastEligible: false,
  },
  minor_network_activity: {
    label: "Network Activity",
    category: "network",
    defaultPriority: "informational",
    colorClass: "border-zinc-600/70 text-zinc-300",
    defaultHref: "/following",
    toastEligible: false,
  },
};

const DEMO_EVENTS: Omit<ConvictionEvent, "id" | "timestamp" | "read" | "toastShown">[] = [
  {
    type: "receipt_resolved",
    title: "Receipt resolved in your favor",
    body: "Fed cut timing call locked with verified proof.",
    impact: "+18 Credibility",
    priority: "critical",
    category: "receipts",
    href: receiptDetailPath("demo-fed-cut-receipt"),
  },
  {
    type: "position_under_pressure",
    title: "Position under pressure on NVDA Q2 beat",
    body: "Consensus moved against your open stance.",
    impact: "Consensus moved 11pts against you",
    priority: "critical",
    category: "positions",
    href: "/markets/nvda-q2-beat",
  },
  {
    type: "read_backed",
    title: "Macro Oracle backed your read",
    body: "High-rep alignment on recession timing thesis.",
    impact: "+12 credibility aligned",
    priority: "important",
    category: "reads",
    href: "/reads",
  },
  {
    type: "premium_subscriber_joined",
    title: "Premium subscriber joined",
    body: "Paid conviction access unlocked on your feed.",
    impact: "+$9 MRR",
    priority: "critical",
    category: "network",
    href: "/intelligence-access",
  },
  {
    type: "consensus_shifted",
    title: "Consensus shifted on US recession by Q4",
    body: "Macro cluster repriced after labor print.",
    impact: "+6pt crowd move",
    priority: "important",
    category: "markets",
    href: "/markets/us-recession-by-q4",
  },
  {
    type: "agent_read_posted",
    title: "FedWatcher posted a new read",
    body: "Policy-first conviction on Sep cut window.",
    impact: "New signal in your follow graph",
    priority: "informational",
    category: "reads",
    href: "/reads",
  },
  {
    type: "market_updated",
    title: "BTC above 150k repriced",
    body: "Liquidity narrative accelerated overnight.",
    impact: "+4pt market move",
    priority: "informational",
    category: "markets",
    href: "/markets/btc-above-150k-by-year-end",
  },
  {
    type: "new_follower",
    title: "SignalPilot started following you",
    body: "Network reach expanded on macro lane.",
    impact: "+1 forecaster in network",
    priority: "important",
    category: "network",
    href: "/following",
  },
];

function emitChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(CONVICTION_EVENTS_CHANGED_EVENT));
  }
}

export function convictionEventsEqual(a: ConvictionEvent[], b: ConvictionEvent[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  return JSON.stringify(a) === JSON.stringify(b);
}

function sortNewest(a: ConvictionEvent, b: ConvictionEvent) {
  return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
}

function priorityRank(priority: ConvictionPriority): number {
  if (priority === "critical") return 2;
  if (priority === "important") return 1;
  return 0;
}

export function isToastEligible(event: ConvictionEvent): boolean {
  if (event.priority === "informational") return false;

  const meta = CONVICTION_EVENT_META[event.type];

  if (typeof meta?.toastEligible === "boolean") {
    return meta.toastEligible;
  }

  return true;
}

/** FIFO within tier; critical before important. */
export function sortToastQueue(events: ConvictionEvent[]): ConvictionEvent[] {
  return [...events]
    .filter((event) => isToastEligible(event) && !event.toastShown)
    .sort((a, b) => {
      const priorityDiff = priorityRank(b.priority) - priorityRank(a.priority);
      if (priorityDiff !== 0) return priorityDiff;
      return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
    });
}

function normalizeEvent(
  partial: Omit<ConvictionEvent, "id" | "timestamp" | "read" | "toastShown"> &
    Partial<Pick<ConvictionEvent, "id" | "timestamp" | "read" | "toastShown">>,
): ConvictionEvent {
  const meta = CONVICTION_EVENT_META[partial.type];
  return {
    id: partial.id ?? `evt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type: partial.type,
    title: partial.title,
    body: partial.body,
    impact: partial.impact ?? "",
    priority: partial.priority ?? meta.defaultPriority,
    timestamp: partial.timestamp ?? new Date().toISOString(),
    read: partial.read ?? false,
    toastShown: partial.toastShown ?? false,
    category: partial.category ?? meta.category,
    href: partial.href ?? meta.defaultHref,
  };
}

function loadEventsInternal(): ConvictionEvent[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(CONVICTION_EVENTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is ConvictionEvent => {
        return (
          typeof item?.id === "string" &&
          typeof item?.type === "string" &&
          typeof item?.title === "string" &&
          typeof item?.body === "string" &&
          typeof item?.impact === "string" &&
          typeof item?.priority === "string" &&
          typeof item?.timestamp === "string" &&
          typeof item?.read === "boolean" &&
          typeof item?.toastShown === "boolean" &&
          typeof item?.href === "string"
        );
      })
      .sort(sortNewest);
  } catch {
    return [];
  }
}

function saveEvents(events: ConvictionEvent[]) {
  if (typeof window === "undefined") return;
  const trimmed = events.slice(0, MAX_EVENTS).sort(sortNewest);
  const current = loadEventsInternal();
  if (convictionEventsEqual(current, trimmed)) return;
  localStorage.setItem(CONVICTION_EVENTS_STORAGE_KEY, JSON.stringify(trimmed));
  emitChanged();
}

export function getConvictionEvents(): ConvictionEvent[] {
  return loadEventsInternal();
}

export function ensureConvictionEventSeeded() {
  if (typeof window === "undefined") return;
  const current = loadEventsInternal();
  if (current.length > 0) return;
  const now = Date.now();
  const seeded = DEMO_EVENTS.map((event, index) =>
    normalizeEvent({
      ...event,
      id: `seed-${index}`,
      read: index > 4,
      toastShown: true,
      timestamp: new Date(now - index * 45 * 60 * 1000).toISOString(),
    }),
  ).sort(sortNewest);
  saveEvents(seeded);
}

export function pushConvictionEvent(
  event: Omit<ConvictionEvent, "id" | "timestamp" | "read" | "toastShown"> &
    Partial<Pick<ConvictionEvent, "id" | "timestamp" | "read" | "toastShown">>,
): ConvictionEvent {
  const created = normalizeEvent({ ...event, toastShown: event.toastShown ?? false });
  const next = [created, ...loadEventsInternal()].sort(sortNewest);
  saveEvents(next);
  return created;
}

export function markConvictionEventRead(id: string) {
  const current = loadEventsInternal();
  const target = current.find((event) => event.id === id);
  if (!target || target.read) return;
  const next = current.map((event) => (event.id === id ? { ...event, read: true } : event));
  saveEvents(next);
}

export function markConvictionToastShown(id: string) {
  const current = loadEventsInternal();
  const target = current.find((event) => event.id === id);
  if (!target || target.toastShown) return;
  const next = current.map((event) =>
    event.id === id ? { ...event, toastShown: true } : event,
  );
  saveEvents(next);
}

export function markAllConvictionEventsRead(ids?: string[]) {
  const wanted = ids ? new Set(ids) : null;
  const current = loadEventsInternal();
  let changed = false;
  const next = current.map((event) => {
    if (wanted && !wanted.has(event.id)) return event;
    if (event.read) return event;
    changed = true;
    return { ...event, read: true };
  });
  if (!changed) return;
  saveEvents(next);
}

export function getUnreadConvictionCount(events: ConvictionEvent[]): number {
  return events.filter((event) => !event.read).length;
}

export function subscribeConvictionEventsChanged(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(CONVICTION_EVENTS_CHANGED_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CONVICTION_EVENTS_CHANGED_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}
