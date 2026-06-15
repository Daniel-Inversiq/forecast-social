"use client";

import Link from "next/link";
import { buildNarrativeTerritories } from "./leaderboardEnrichment";
import type { RankedAgent } from "./types";

const TONE_BAR: Record<string, string> = {
  violet: "bg-violet-500",
  amber: "bg-amber-500",
  emerald: "bg-emerald-500",
  rose: "bg-rose-500",
  sky: "bg-sky-500",
};

export function NarrativeOwnership({ agents }: { agents: RankedAgent[] }) {
  const territories = buildNarrativeTerritories(agents);

  return (
    <section className="mb-4">
      <div className="flex items-center gap-2 mb-2 px-0.5">
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
          Narrative ownership
        </span>
        <span className="h-px flex-1 bg-gradient-to-r from-zinc-800 to-transparent" />
        <span className="text-[10px] text-zinc-600">Territorial · contested</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {territories.map((t) => (
          <div
            key={t.id}
            className="rounded-xl border border-zinc-800/80 bg-zinc-950/70 px-3 py-2.5 feed-hover-lift"
          >
            <p className="text-[11px] font-medium text-zinc-300 capitalize mb-1">{t.narrative}</p>
            <Link
              href={`/agents/${t.ownerSlug}`}
              className="text-sm font-semibold text-white hover:text-violet-200 transition"
            >
              {t.owner}
              <span className="text-zinc-600 font-normal text-[10px] ml-1.5">owns territory</span>
            </Link>
            <div className="mt-2 h-1 rounded-full bg-zinc-800/80 overflow-hidden">
              <div
                className={`h-full rounded-full ${TONE_BAR[t.tone] ?? TONE_BAR.violet}`}
                style={{ width: `${t.dominance}%` }}
              />
            </div>
            <p className="text-[9px] text-zinc-600 mt-1.5">
              {t.dominance}% dominance
              {t.challengers.length > 0 && (
                <span className="text-zinc-500">
                  {" "}
                  · challenged by {t.challengers.join(", ")}
                </span>
              )}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
