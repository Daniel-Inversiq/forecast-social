"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { FeedShell } from "@/components/feed/FeedShell";
import { useNotifications } from "@/context/NotificationsProvider";
import { CONVICTION_EVENT_META, type ConvictionCategory, type ConvictionEvent } from "@/lib/convictionEvents";

function dayBucket(timestamp: string): "Today" | "Yesterday" | "Earlier" {
  const now = new Date();
  const date = new Date(timestamp);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const diffDays = Math.floor((today - target) / 86_400_000);
  if (diffDays <= 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return "Earlier";
}

function formatTimestamp(timestamp: string): string {
  return new Date(timestamp).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const CATEGORY_ORDER: ConvictionCategory[] = [
  "positions",
  "receipts",
  "reads",
  "markets",
  "battles",
  "reputation",
  "network",
];

const CATEGORY_LABEL: Record<ConvictionCategory, string> = {
  positions: "Positions",
  receipts: "Receipts",
  reads: "Reads",
  markets: "Markets",
  battles: "Battles",
  reputation: "Reputation",
  network: "Network",
};

function groupEvents(events: ConvictionEvent[]) {
  const groups: Record<"Today" | "Yesterday" | "Earlier", Record<ConvictionCategory, ConvictionEvent[]>> = {
    Today: {
      positions: [],
      receipts: [],
      reads: [],
      markets: [],
      battles: [],
      reputation: [],
      network: [],
    },
    Yesterday: {
      positions: [],
      receipts: [],
      reads: [],
      markets: [],
      battles: [],
      reputation: [],
      network: [],
    },
    Earlier: {
      positions: [],
      receipts: [],
      reads: [],
      markets: [],
      battles: [],
      reputation: [],
      network: [],
    },
  };
  for (const event of events) {
    groups[dayBucket(event.timestamp)][event.category].push(event);
  }
  return groups;
}

export default function ActivityPage() {
  const { events, loading, markAllNotificationsSeen, markNotificationRead } = useNotifications();
  const [titleMode, setTitleMode] = useState<"activity" | "intelligence">("activity");

  const grouped = useMemo(() => groupEvents(events), [events]);
  const hasAnyEvents = events.length > 0;

  // Mark inbox as seen once when data finishes loading — not on every events refresh.
  useEffect(() => {
    if (loading) return;
    markAllNotificationsSeen(events.map((event) => event.id));
  }, [loading, markAllNotificationsSeen]);

  return (
    <FeedShell activeNav="Activity" hideCategoryNav>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg sm:text-xl font-semibold text-zinc-100">
            {titleMode === "activity" ? "Activity" : "Intelligence Log"}
          </h1>
          <p className="text-[11px] text-zinc-500">Reputation network reactions in real time.</p>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setTitleMode("activity")}
            className={`px-2 py-1 text-[10px] rounded-full border ${
              titleMode === "activity"
                ? "text-violet-200 border-violet-500/35 bg-violet-500/10"
                : "text-zinc-400 border-zinc-700/70"
            }`}
          >
            Activity
          </button>
          <button
            type="button"
            onClick={() => setTitleMode("intelligence")}
            className={`px-2 py-1 text-[10px] rounded-full border ${
              titleMode === "intelligence"
                ? "text-violet-200 border-violet-500/35 bg-violet-500/10"
                : "text-zinc-400 border-zinc-700/70"
            }`}
          >
            Intelligence Log
          </button>
          <Link
            href="/"
            className="text-[10px] text-violet-400/90 hover:text-violet-300 border border-violet-500/25 px-2 py-1 rounded-full bg-violet-500/5 transition"
          >
            Conviction feed →
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-24 rounded-xl border border-zinc-800/70 bg-zinc-900/50 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {!hasAnyEvents && (
            <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-8 text-center">
              <p className="text-zinc-200 text-sm font-medium mb-1">No notifications yet</p>
              <p className="text-zinc-500 text-[11px] mb-3">
                Notifications track conviction moves that impact your positions, reads, and reputation.
                Staying current protects your edge.
              </p>
              <Link
                href="/following"
                className="inline-flex text-[11px] font-medium text-violet-300 px-3 py-1.5 rounded-lg border border-violet-500/30 hover:bg-violet-500/10 transition"
              >
                Build Following Network
              </Link>
            </div>
          )}
          {(["Today", "Yesterday", "Earlier"] as const).map((bucket) => {
            const bucketEvents = grouped[bucket];
            const count = Object.values(bucketEvents).reduce((total, list) => total + list.length, 0);
            if (count === 0) return null;
            return (
              <section key={bucket}>
                <h2 className="text-xs uppercase tracking-wider text-zinc-400 mb-3">{bucket}</h2>
                <div className="space-y-4">
                  {CATEGORY_ORDER.map((category) => {
                    const items = bucketEvents[category];
                    if (items.length === 0) return null;
                    return (
                      <div key={category}>
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 mb-2">
                          {CATEGORY_LABEL[category]}
                        </p>
                        <ul className="space-y-2">
                          {items.map((event) => {
                            const meta = CONVICTION_EVENT_META[event.type];
                            const color = meta?.colorClass ?? "border-zinc-600/80 text-zinc-300";
                            const priorityClass =
                              event.priority === "critical"
                                ? "border-rose-500/35 text-rose-200 bg-rose-950/35"
                                : event.priority === "important"
                                  ? "border-violet-500/30 text-violet-200 bg-violet-950/35"
                                  : "border-zinc-700/70 text-zinc-300 bg-zinc-900/70";
                            return (
                              <li key={event.id}>
                                <article
                                  className={`rounded-xl border bg-zinc-950/80 p-3 ${event.read ? "border-zinc-800/80" : "border-violet-500/30"} transition`}
                                >
                                  <div className="flex items-center gap-2">
                                    <span className={`text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-full border ${color}`}>
                                      {meta?.label ?? "Event"}
                                    </span>
                                    <span
                                      className={`text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-full border ${priorityClass}`}
                                    >
                                      {event.priority}
                                    </span>
                                    <span className="text-[10px] text-zinc-500 ml-auto">{formatTimestamp(event.timestamp)}</span>
                                  </div>
                                  <p className="mt-2 text-sm font-semibold text-zinc-100">{event.title}</p>
                                  <p className="mt-1 text-[11px] text-zinc-400">{event.body}</p>
                                  {event.impact && (
                                    <p className="mt-2 text-[11px] text-violet-300/90 font-medium tabular-nums">
                                      {event.impact}
                                    </p>
                                  )}
                                  {event.href && (
                                    <div className="mt-2">
                                      <Link
                                        href={event.href}
                                        onClick={() => markNotificationRead(event.id)}
                                        className="text-[11px] text-violet-300 hover:text-violet-200"
                                      >
                                        Open context →
                                      </Link>
                                    </div>
                                  )}
                                </article>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </FeedShell>
  );
}
