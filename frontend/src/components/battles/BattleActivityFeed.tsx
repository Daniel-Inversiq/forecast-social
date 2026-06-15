"use client";

import Link from "next/link";
import { Avatar, formatTimeAgo } from "@/components/feed/shared";
import { buildBattleFeedEvents } from "./battleWarfare";
import type { EnrichedBattle } from "./types";

const TONE: Record<string, { border: string; text: string }> = {
  rose: { border: "border-l-rose-500/60", text: "text-rose-100/90" },
  amber: { border: "border-l-amber-500/60", text: "text-amber-100/90" },
  violet: { border: "border-l-violet-500/60", text: "text-violet-100/90" },
  emerald: { border: "border-l-emerald-500/60", text: "text-emerald-100/90" },
  sky: { border: "border-l-sky-500/60", text: "text-sky-100/90" },
};

export function BattleActivityFeed({ battle }: { battle: EnrichedBattle }) {
  const events = buildBattleFeedEvents([battle])
    .filter((e) => e.battle_id === battle.id)
    .slice(0, 8);

  if (events.length === 0) return null;

  return (
    <section className="rounded-xl border border-zinc-800/70 bg-zinc-950/60 overflow-hidden">
      <div className="px-3 py-2 border-b border-zinc-800/60 flex items-center gap-2">
        <span className="h-1.5 w-1.5 rounded-full bg-rose-400/80 battle-feed-pulse" />
        <h2 className="text-[11px] font-semibold text-zinc-300">Activity</h2>
        <span className="text-[9px] text-zinc-600 ml-auto">Battle updates</span>
      </div>
      <ul className="divide-y divide-zinc-800/40 max-h-[240px] overflow-y-auto scrollbar-none">
        {events.map((ev) => {
          const tone = TONE[ev.tone] ?? TONE.violet;
          const row = (
            <div className="flex items-start gap-2 py-2 px-3">
              {ev.agent_name && ev.agent_color ? (
                <Avatar name={ev.agent_name} color={ev.agent_color} size="sm" />
              ) : (
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-500" />
              )}
              <div className="min-w-0 flex-1">
                <p className={`text-[11px] leading-snug ${tone.text}`}>{ev.line}</p>
                <p className="text-[9px] text-zinc-600 mt-0.5 tabular-nums">
                  {formatTimeAgo(ev.at, true)}
                </p>
              </div>
            </div>
          );
          return (
            <li key={ev.id} className={`border-l-2 ${tone.border}`}>
              {ev.href ? (
                <Link href={ev.href} className="block hover:bg-zinc-900/40 transition">
                  {row}
                </Link>
              ) : (
                row
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
