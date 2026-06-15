"use client";

import Link from "next/link";
import { Avatar, formatTimeAgo } from "@/components/feed/shared";
import { buildBattleFeedEvents } from "./battleWarfare";
import type { EnrichedBattle } from "./types";

const TONE: Record<
  string,
  { border: string; bg: string; text: string; dot: string }
> = {
  rose: {
    border: "border-l-rose-500/70",
    bg: "bg-rose-950/25 hover:bg-rose-950/35",
    text: "text-rose-100",
    dot: "bg-rose-400",
  },
  amber: {
    border: "border-l-amber-500/70",
    bg: "bg-amber-950/20 hover:bg-amber-950/30",
    text: "text-amber-100",
    dot: "bg-amber-400",
  },
  violet: {
    border: "border-l-violet-500/70",
    bg: "bg-violet-950/25 hover:bg-violet-950/35",
    text: "text-violet-100",
    dot: "bg-violet-400",
  },
  emerald: {
    border: "border-l-emerald-500/70",
    bg: "bg-emerald-950/20 hover:bg-emerald-950/30",
    text: "text-emerald-100",
    dot: "bg-emerald-400",
  },
  sky: {
    border: "border-l-sky-500/70",
    bg: "bg-sky-950/20 hover:bg-sky-950/30",
    text: "text-sky-100",
    dot: "bg-sky-400",
  },
};

function feedTimeLabel(iso: string): string {
  const rel = formatTimeAgo(iso, false);
  if (rel === "just now") return "Just now";
  return rel;
}

export function BattleWarFeed({ battles }: { battles: EnrichedBattle[] }) {
  const events = buildBattleFeedEvents(battles).slice(0, 12);

  if (events.length === 0) return null;

  return (
    <section className="mb-3 rounded-xl border border-zinc-800/80 bg-zinc-950/90 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-zinc-800/70 bg-zinc-900/30">
        <span className="h-1.5 w-1.5 rounded-full bg-rose-400 battle-feed-pulse" />
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-300">
          Live battle feed
        </h2>
        <span className="text-[9px] text-zinc-600 ml-auto">Network pulse</span>
      </div>
      <ul className="divide-y divide-zinc-800/40 max-h-[320px] overflow-y-auto scrollbar-none">
        {events.map((ev) => {
          const tone = TONE[ev.tone] ?? TONE.violet;
          const inner = (
            <div className="flex items-start gap-2.5">
              {ev.agent_name && ev.agent_color ? (
                <Avatar name={ev.agent_name} color={ev.agent_color} size="sm" />
              ) : (
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${tone.dot}`} />
              )}
              <div className="min-w-0 flex-1">
                <p className={`text-[12px] font-medium leading-snug ${tone.text}`}>{ev.line}</p>
                <p className="text-[10px] text-zinc-500 mt-0.5 tabular-nums">{feedTimeLabel(ev.at)}</p>
              </div>
            </div>
          );
          const cls = `border-l-[3px] px-3 py-3 transition ${tone.border} ${tone.bg}`;
          return (
            <li key={ev.id}>
              {ev.href ? (
                <Link href={ev.href} className={`block ${cls}`}>
                  {inner}
                </Link>
              ) : (
                <div className={cls}>{inner}</div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
