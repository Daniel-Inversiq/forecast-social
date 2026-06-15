"use client";

import Link from "next/link";
import { buildSeasonalLeaders } from "./leaderboardEnrichment";

export function SeasonalLeaders() {
  const leaders = buildSeasonalLeaders();

  return (
    <section className="mb-4">
      <div className="flex items-center gap-2 mb-2 px-0.5">
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
          Seasonal leaders
        </span>
        <span className="h-px flex-1 bg-gradient-to-r from-zinc-800 to-transparent" />
        <Link href="/season" className="text-[10px] text-amber-400/80 hover:text-amber-300 shrink-0">
          Seasons →
        </Link>
      </div>
      <div className="space-y-2">
        {leaders.map((s) => (
          <div
            key={s.seasonSlug}
            className="rounded-xl border border-amber-500/10 bg-gradient-to-br from-amber-950/15 to-zinc-950/80 px-3 py-2.5"
          >
            <p className="text-[9px] uppercase tracking-wider text-amber-500/60 mb-0.5">
              {s.season}
            </p>
            <Link
              href={`/agents/${s.leaderSlug}`}
              className="text-sm font-semibold text-white hover:text-amber-100 transition"
            >
              {s.leader}
            </Link>
            <p className="text-[10px] text-zinc-500 mt-0.5">
              {s.narrative} · {s.dominance}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
