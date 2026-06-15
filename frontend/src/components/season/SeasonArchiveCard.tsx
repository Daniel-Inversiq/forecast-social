"use client";

import Link from "next/link";
import { archiveCardMeta, seasonAgeDays } from "./seasonEnrichment";
import { CONSENSUS_LABELS, getEraAtmosphere } from "./seasonEraStyles";
import type { SeasonSummary } from "@/lib/season";

export function SeasonArchiveCard({
  season,
}: {
  season: SeasonSummary & { top_forecaster?: { agent_name?: string } };
}) {
  const era = getEraAtmosphere(season.category);
  const ended = season.ended_at
    ? new Date(season.ended_at).toLocaleDateString(undefined, { month: "short", year: "numeric" })
    : "—";
  const age = seasonAgeDays(season);
  const meta = archiveCardMeta(season);
  const dominant = season.dominant_narratives[0]?.label ?? "—";

  return (
    <Link
      href={`/season?slug=${season.slug}`}
      className={`block rounded-xl border ${era.heroBorder} bg-zinc-950/50 px-4 py-4 hover:bg-zinc-900/50 transition season-archive-card relative overflow-hidden group`}
      style={{ boxShadow: "none" }}
    >
      <div
        className={`absolute inset-0 bg-gradient-to-br ${era.heroGradient} opacity-40 pointer-events-none group-hover:opacity-60 transition-opacity`}
      />
      <div className="relative">
        <div className="flex items-center justify-between gap-2 mb-2">
          <p className={`text-[8px] font-semibold uppercase tracking-[0.18em] ${era.accentText}`}>
            {era.label} · archived
          </p>
          <span className="text-[9px] text-zinc-600 tabular-nums">ended {ended}</span>
        </div>
        <h3 className="text-[14px] font-semibold text-zinc-50 mb-2 leading-snug">{season.title}</h3>
        <p className="text-[10px] text-zinc-500 line-clamp-2 mb-3 leading-relaxed">{season.summary}</p>

        <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-[9px] mb-3">
          <div>
            <dt className="text-zinc-600 uppercase tracking-wider text-[7px] mb-0.5">Dominant narrative</dt>
            <dd className="text-zinc-300 truncate">{dominant}</dd>
          </div>
          <div>
            <dt className="text-zinc-600 uppercase tracking-wider text-[7px] mb-0.5">Volatility</dt>
            <dd className={`tabular-nums ${era.accentText}`}>{season.volatility_score.toFixed(0)}</dd>
          </div>
          <div>
            <dt className="text-zinc-600 uppercase tracking-wider text-[7px] mb-0.5">Defining rupture</dt>
            <dd className="text-zinc-400 line-clamp-2">{meta.rupture}</dd>
          </div>
          <div>
            <dt className="text-zinc-600 uppercase tracking-wider text-[7px] mb-0.5">Winning forecaster</dt>
            <dd className="text-amber-300/80 truncate">{meta.winner}</dd>
          </div>
          <div>
            <dt className="text-zinc-600 uppercase tracking-wider text-[7px] mb-0.5">Reputation climate</dt>
            <dd className="text-zinc-400">{meta.reputationClimate}</dd>
          </div>
          <div>
            <dt className="text-zinc-600 uppercase tracking-wider text-[7px] mb-0.5">Consensus</dt>
            <dd className="text-zinc-400">{meta.consensusLabel}</dd>
          </div>
        </dl>

        <div className="flex flex-wrap gap-2 text-[9px] text-zinc-600 pt-2 border-t border-zinc-800/50">
          {age != null && <span>{age}d era</span>}
          <span className="text-zinc-700">·</span>
          <span className={era.accentText}>Explore era →</span>
        </div>
      </div>
    </Link>
  );
}
