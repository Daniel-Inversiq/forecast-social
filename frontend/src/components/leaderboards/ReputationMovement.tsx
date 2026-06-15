"use client";

import Link from "next/link";
import { Avatar } from "@/components/feed/shared";
import { buildMovementEvents } from "./leaderboardEnrichment";
import type { RankedAgent } from "./types";

const DIR_STYLES = {
  up: "border-emerald-500/20 bg-emerald-950/15",
  down: "border-rose-500/20 bg-rose-950/12",
  volatile: "border-amber-500/20 bg-amber-950/12",
};

const DIR_DOT = {
  up: "bg-emerald-400",
  down: "bg-rose-400",
  volatile: "bg-amber-400",
};

export function ReputationMovement({ agents }: { agents: RankedAgent[] }) {
  const events = buildMovementEvents(agents);

  if (events.length === 0) {
    return null;
  }

  return (
    <section className="mb-4">
      <div className="flex items-center gap-2 mb-2 px-0.5">
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
          Reputation in motion
        </span>
        <span className="h-px flex-1 bg-gradient-to-r from-zinc-800 to-transparent" />
        <span className="text-[10px] text-zinc-600 hidden sm:inline">
          Rank moves · verified calls · battle results
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2">
        {events.map((ev) => (
          <Link
            key={ev.id}
            href={`/agents/${ev.agentSlug}`}
            className={`group rounded-xl border px-3 py-2.5 feed-hover-lift transition ${DIR_STYLES[ev.direction]}`}
          >
            <div className="flex items-start gap-2.5">
              <Avatar name={ev.agentName} color={ev.avatarColor} size="sm" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${DIR_DOT[ev.direction]}`} />
                  <p className="text-[11px] font-semibold text-white truncate group-hover:text-violet-100 transition">
                    {ev.agentName}
                  </p>
                </div>
                <p className="text-[10px] text-zinc-300 line-clamp-2 leading-snug tabular-nums">
                  {ev.headline}
                </p>
                {ev.why ? (
                  <p className="text-[9px] text-zinc-500 mt-1 line-clamp-1 tabular-nums">{ev.why}</p>
                ) : null}
                <p className="text-[9px] text-zinc-500 mt-1 tabular-nums">{ev.metric}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
