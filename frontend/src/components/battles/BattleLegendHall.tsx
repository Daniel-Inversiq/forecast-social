"use client";

import Link from "next/link";
import { buildLegendaryHall } from "./battleWarfare";
import type { EnrichedBattle } from "./types";

const TIER: Record<string, string> = {
  legendary: "text-amber-200 border-amber-500/30 bg-amber-500/10",
  infamous: "text-rose-200 border-rose-500/30 bg-rose-500/10",
  record: "text-violet-200 border-violet-500/30 bg-violet-500/10",
};

export function BattleLegendHall({ battles }: { battles: EnrichedBattle[] }) {
  const entries = buildLegendaryHall(battles);
  if (entries.length === 0) return null;

  return (
    <section className="mb-3 rounded-xl border border-amber-500/15 bg-zinc-950/90 overflow-hidden">
      <div className="px-3 py-2.5 border-b border-zinc-800/70 bg-gradient-to-r from-amber-950/25 to-transparent">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-amber-300/90">
          Hall of infamous battles
        </h2>
        <p className="text-[10px] text-zinc-500 mt-0.5">Legendary rivalries · records · lore</p>
      </div>
      <ul className="p-2 space-y-1">
        {entries.map((e) => {
          const tierCls = TIER[e.tier] ?? TIER.legendary;
          const inner = (
            <div className="flex items-start gap-2">
              <span
                className={`text-[8px] uppercase tracking-wider px-1.5 py-0.5 rounded border shrink-0 mt-0.5 ${tierCls}`}
              >
                {e.tier}
              </span>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-zinc-100">{e.title}</p>
                <p className="text-[10px] text-zinc-500 mt-0.5">{e.detail}</p>
              </div>
            </div>
          );
          return (
            <li key={e.id}>
              {e.href ? (
                <Link
                  href={e.href}
                  className="block rounded-lg px-2 py-2 hover:bg-zinc-900/60 transition feed-hover-lift"
                >
                  {inner}
                </Link>
              ) : (
                <div className="rounded-lg px-2 py-2">{inner}</div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
