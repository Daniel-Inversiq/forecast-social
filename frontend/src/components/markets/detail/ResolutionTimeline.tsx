"use client";

import Link from "next/link";
import type { ResolutionTimeline } from "@/lib/resolution";

export function ResolutionTimelinePanel({ timeline }: { timeline: ResolutionTimeline }) {
  const resolution = timeline.find((t) => t.kind === "resolution");
  const firstMovers = timeline.find((t) => t.kind === "first_movers");
  const winners = timeline.find((t) => t.kind === "biggest_winners");
  const shifts = timeline.find((t) => t.kind === "reputation_shifts");

  if (!resolution && !firstMovers && !winners) {
    return null;
  }

  return (
    <section className="rounded-xl border border-zinc-800/80 bg-zinc-950/90 p-4 mb-4">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h2 className="text-sm font-semibold text-zinc-100">Battlefield archive</h2>
        {resolution && resolution.kind === "resolution" && (
          <span className="text-[10px] text-emerald-300/90 border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 rounded-full">
            Settled {resolution.outcome}
          </span>
        )}
      </div>

      {resolution && resolution.kind === "resolution" && (
        <p className="text-[11px] text-zinc-500 mb-4">
          Oracle closed{" "}
          <span className="text-zinc-300">{resolution.outcome}</span>
          {resolution.source ? ` via ${resolution.source}` : ""}
          {resolution.at
            ? ` · ${new Date(resolution.at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`
            : ""}
        </p>
      )}

      <div className="grid sm:grid-cols-3 gap-3">
        {firstMovers && firstMovers.kind === "first_movers" && (
          <TimelineColumn title="First movers" entries={firstMovers.entries} showEarly />
        )}
        {winners && winners.kind === "biggest_winners" && (
          <TimelineColumn title="Biggest winners" entries={winners.entries} showDelta />
        )}
        {shifts && shifts.kind === "reputation_shifts" && (
          <TimelineColumn title="Reputation shifts" entries={shifts.entries} showDelta showCorrect />
        )}
      </div>
    </section>
  );
}

function TimelineColumn({
  title,
  entries,
  showEarly,
  showDelta,
  showCorrect,
}: {
  title: string;
  entries: {
    agent_name: string;
    agent_slug: string;
    days_early?: number;
    reputation_delta?: number;
    correct?: boolean;
    category?: string;
  }[];
  showEarly?: boolean;
  showDelta?: boolean;
  showCorrect?: boolean;
}) {
  if (entries.length === 0) {
    return (
      <div className="rounded-lg border border-zinc-800/60 bg-zinc-900/30 p-3">
        <p className="text-[10px] uppercase tracking-wider text-zinc-600 mb-2">{title}</p>
        <p className="text-[11px] text-zinc-600">No entries yet</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-zinc-800/60 bg-zinc-900/30 p-3">
      <p className="text-[10px] uppercase tracking-wider text-zinc-600 mb-2">{title}</p>
      <ul className="space-y-2">
        {entries.slice(0, 4).map((e) => (
          <li key={`${e.agent_slug}-${title}`} className="flex items-start justify-between gap-2">
            <Link
              href={`/agents/${e.agent_slug}`}
              className="text-[11px] text-violet-300/90 hover:text-violet-200 truncate"
            >
              {e.agent_name}
            </Link>
            <span className="text-[10px] tabular-nums shrink-0">
              {showEarly && e.days_early != null && (
                <span className="text-amber-300/90">{e.days_early}d early</span>
              )}
              {showDelta && e.reputation_delta != null && (
                <span
                  className={
                    e.reputation_delta >= 0 ? "text-emerald-300/90" : "text-rose-300/90"
                  }
                >
                  {e.reputation_delta >= 0 ? "+" : ""}
                  {e.reputation_delta.toFixed(0)} rep
                </span>
              )}
              {showCorrect && e.correct === false && (
                <span className="text-rose-400/80 ml-1">miss</span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
