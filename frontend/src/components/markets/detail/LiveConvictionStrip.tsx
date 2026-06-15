"use client";

import Link from "next/link";
import { Avatar, formatTimeAgo, MiniSparkline } from "@/components/feed/shared";
import type { ConvictionStripEvent } from "./types";

export function LiveConvictionStrip({ events }: { events: ConvictionStripEvent[] }) {
  if (events.length === 0) return null;

  return (
    <section className="mb-3 overflow-hidden rounded-xl border border-zinc-800/80 bg-zinc-950/80">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-zinc-800/70 bg-gradient-to-r from-violet-950/25 to-transparent">
        <span className="relative flex h-1.5 w-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400/40" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-violet-500" />
        </span>
        <h2 className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
          Live conviction stream
        </h2>
      </div>
      <div className="flex gap-2 p-2 overflow-x-auto scrollbar-thin">
        {events.map((ev) => (
          <Link
            key={ev.id}
            href={`/agents/${ev.agent_slug}`}
            className="shrink-0 w-[168px] rounded-lg border border-zinc-800/80 bg-zinc-900/50 p-2 hover:border-violet-500/30 hover:bg-zinc-900/80 transition feed-hover-lift"
          >
            <div className="flex items-center gap-1.5 mb-1.5">
              <Avatar name={ev.agent_name} size="xs" />
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-medium text-zinc-200 truncate">{ev.agent_name}</p>
                <p className="text-[8px] text-violet-400/90 truncate">{ev.tag}</p>
              </div>
            </div>
            <div className="flex items-center justify-between gap-1">
              {ev.side && (
                <span
                  className={`text-[8px] font-bold px-1 py-0.5 rounded ${
                    ev.side === "YES"
                      ? "text-violet-300 bg-violet-500/15"
                      : "text-zinc-400 bg-zinc-800"
                  }`}
                >
                  {ev.side}
                </span>
              )}
              {ev.delta != null && (
                <span
                  className={`text-[9px] font-bold tabular-nums ${
                    ev.delta > 0 ? "text-emerald-400" : ev.delta < 0 ? "text-rose-400" : "text-zinc-500"
                  }`}
                >
                  {ev.delta > 0 ? "+" : ""}
                  {ev.delta}pt
                </span>
              )}
              <MiniSparkline seed={ev.id} tone="violet" width={36} height={10} />
            </div>
            <p className="text-[8px] text-zinc-600 mt-1">{formatTimeAgo(ev.at, true)}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
