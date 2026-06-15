"use client";

import { useMemo } from "react";
import { HeatPill } from "@/components/feed/shared";
import type { TimelineEntry } from "./types";

function formatTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 60) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

const KIND_LABEL: Record<string, { label: string; tone: "violet" | "emerald" | "rose" | "sky" | "amber" | "teal" }> = {
  opened: { label: "Opened", tone: "violet" },
  resolved: { label: "Receipt closed", tone: "emerald" },
  "market moved": { label: "Market moved", tone: "sky" },
  "consensus shift": { label: "Consensus shift", tone: "sky" },
  "agent disagreed": { label: "Agent disagreed", tone: "rose" },
  "battle escalation": { label: "Battle escalation", tone: "amber" },
  "receipt verified": { label: "Receipt verified", tone: "emerald" },
  "reputation changed": { label: "Reputation changed", tone: "amber" },
  aftermath: { label: "Aftermath", tone: "teal" },
};

function ContributionHeatmap({ timeline }: { timeline: TimelineEntry[] }) {
  const cells = useMemo(() => {
    const buckets = new Map<string, number>();
    for (const entry of timeline) {
      const day = entry.created_at.slice(0, 10);
      buckets.set(day, (buckets.get(day) ?? 0) + 1);
    }
    const days: { date: string; count: number }[] = [];
    const today = new Date();
    for (let i = 27; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      days.push({ date: key, count: buckets.get(key) ?? 0 });
    }
    return days;
  }, [timeline]);

  const max = Math.max(1, ...cells.map((c) => c.count));

  return (
    <div className="flex flex-wrap gap-1">
      {cells.map(({ date, count }) => {
        const intensity =
          count === 0
            ? "bg-zinc-900 border-zinc-800/80"
            : count / max >= 0.66
              ? "bg-violet-500/70 border-violet-400/40"
              : count / max >= 0.33
                ? "bg-violet-500/35 border-violet-500/25"
                : "bg-violet-500/15 border-violet-500/20";
        return (
          <div
            key={date}
            title={`${date}: ${count} event${count === 1 ? "" : "s"}`}
            className={`h-3 w-3 rounded-sm border ${intensity}`}
          />
        );
      })}
    </div>
  );
}

function TimelineRow({ entry, isLast }: { entry: TimelineEntry; isLast: boolean }) {
  const meta = KIND_LABEL[entry.kind] ?? { label: entry.kind, tone: "violet" as const };
  const sideClass =
    entry.side === "YES"
      ? "text-emerald-300 border-emerald-500/25 bg-emerald-500/10"
      : "text-rose-300 border-rose-500/25 bg-rose-500/10";

  return (
    <li className="flex gap-3">
      <div className="flex flex-col items-center shrink-0 pt-1">
        <div className="h-2 w-2 rounded-full bg-violet-500/80 ring-4 ring-violet-500/20 feed-live-pill" />
        {!isLast && <div className="w-px flex-1 bg-zinc-800/80 min-h-[2.5rem] mt-1" />}
      </div>
      <div className={`min-w-0 flex-1 ${isLast ? "pb-0" : "pb-4"}`}>
        <div className="flex flex-wrap items-center gap-1.5 mb-1">
          <HeatPill tone={meta.tone}>{meta.label}</HeatPill>
          <span className="text-[9px] text-zinc-600">{formatTimeAgo(entry.created_at)}</span>
        </div>
        <p className="text-[11px] font-medium text-white mb-0.5">{entry.market_title}</p>
        <p className="text-[10px] text-zinc-500 leading-relaxed">{entry.note}</p>
        <div className="flex items-center gap-2 mt-1.5">
          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${sideClass}`}>
            {entry.side}
          </span>
          <span className="text-[9px] text-zinc-600 tabular-nums">€{entry.amount}</span>
        </div>
      </div>
    </li>
  );
}

export function ConvictionTimeline({ timeline }: { timeline: TimelineEntry[] }) {
  return (
    <section className="rounded-xl border border-zinc-800/90 bg-zinc-950/80 overflow-hidden">
      <div className="px-3 py-2.5 border-b border-zinc-800/70 bg-gradient-to-r from-violet-950/30 to-zinc-950 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h2 className="text-[11px] font-semibold text-white">Thesis timeline</h2>
          <p className="text-[10px] text-zinc-600 mt-0.5 max-w-md">
            Lifecycle archive — opened, consensus shifts, battles, verification, aftermath.
          </p>
        </div>
        <div className="shrink-0">
          <p className="text-[8px] uppercase tracking-wider text-zinc-600 mb-1.5">Last 28 days</p>
          <ContributionHeatmap timeline={timeline} />
        </div>
      </div>
      <ul className="p-3">
        {timeline.length === 0 ? (
          <li className="text-[11px] text-zinc-600 py-4 text-center">
            Your ledger will populate as convictions enter the public record.
          </li>
        ) : (
          timeline.map((entry, i) => (
            <TimelineRow key={`${entry.id}-${entry.kind}-${i}`} entry={entry} isLast={i === timeline.length - 1} />
          ))
        )}
      </ul>
    </section>
  );
}
