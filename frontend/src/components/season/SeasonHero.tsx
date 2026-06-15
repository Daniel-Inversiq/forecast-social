"use client";

import Link from "next/link";
import { HeatPill, LiveDot } from "@/components/feed/shared";
import {
  buildRegimeBriefing,
  regimePhaseLabel,
  reputationClimate,
  seasonAgeDays,
} from "./seasonEnrichment";
import { CONSENSUS_LABELS, getEraAtmosphere } from "./seasonEraStyles";
import type { SeasonDetail } from "@/lib/season";

export function SeasonHero({ season }: { season: SeasonDetail }) {
  const era = getEraAtmosphere(season.category);
  const started = season.started_at
    ? new Date(season.started_at).toLocaleDateString(undefined, { month: "short", year: "numeric" })
    : "—";
  const age = seasonAgeDays(season);
  const briefing = buildRegimeBriefing(season);
  const phase = regimePhaseLabel(season);
  const climate = reputationClimate(season);
  const dominant = season.dominant_narratives[0]?.label ?? "—";
  const definingEvent = season.trigger_reason ?? "Regime transition in progress";

  return (
    <section
      className={`season-hero season-memory-hero feed-top-signal mb-5 rounded-xl border ${era.heroBorder} bg-zinc-950/60 overflow-hidden relative`}
      style={{ boxShadow: era.glowShadow }}
    >
      <div className={`absolute inset-0 bg-gradient-to-r ${era.heroGradient} pointer-events-none`} />
      <div className="absolute inset-y-0 left-1/3 w-px bg-gradient-to-b from-transparent via-zinc-700/30 to-transparent pointer-events-none" />

      <div className="relative px-4 py-5 sm:px-5 sm:py-6">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
          <div className="min-w-0 max-w-2xl">
            <p className={`text-[9px] font-semibold uppercase tracking-[0.22em] ${era.accentText} mb-2`}>
              Historical regime briefing · {era.label}
            </p>
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              {season.status === "active" && <LiveDot color="amber" />}
              <HeatPill tone="amber">
                {season.status === "active" ? "Active regime" : "Archived era"}
              </HeatPill>
              <span className="text-[9px] uppercase tracking-wider text-zinc-600 border border-zinc-800/80 px-2 py-0.5 rounded">
                {phase}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-white/95 leading-tight">
              {season.title}
            </h1>
            <p className="text-[12px] sm:text-sm text-zinc-500 mt-2 leading-relaxed max-w-xl">
              {briefing}
            </p>
          </div>
          <Link
            href="/season/archive"
            className="text-[10px] uppercase tracking-wider text-zinc-500 hover:text-amber-300/90 border border-zinc-800/80 hover:border-amber-500/25 px-3 py-2 rounded-lg transition shrink-0"
          >
            Historical archive →
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 mb-5">
          <BriefStat label="Dominant narrative" value={dominant} era={era} />
          <BriefStat
            label="Consensus"
            value={CONSENSUS_LABELS[season.consensus_state] ?? season.consensus_state}
            era={era}
          />
          <BriefStat label="Volatility" value={season.volatility_score.toFixed(0)} sub="Network index" highlight era={era} />
          <BriefStat label="Defining event" value={definingEvent.slice(0, 32)} era={era} className="sm:col-span-2 lg:col-span-1" />
          <BriefStat label="Reputation climate" value={climate} era={era} />
          <BriefStat
            label="Era age"
            value={age != null ? `${age}d` : started}
            sub={season.status === "active" ? "active" : "archived"}
            era={era}
            className="hidden lg:block"
          />
        </div>

        {season.dominant_narratives.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-4 border-t border-zinc-800/50">
            {season.dominant_narratives.map((n) => (
              <span
                key={n.id}
                className="text-[9px] uppercase tracking-wider px-2.5 py-1 rounded border border-zinc-800/70 text-zinc-500 bg-zinc-900/40"
              >
                {n.label}
              </span>
            ))}
            <span className="text-[9px] text-zinc-700 self-center ml-auto hidden sm:inline">
              {season.top_forecasters[0]
                ? `Led by ${season.top_forecasters[0].agent_name}`
                : ""}
            </span>
          </div>
        )}
      </div>
    </section>
  );
}

function BriefStat({
  label,
  value,
  sub,
  highlight,
  era,
  className = "",
}: {
  label: string;
  value: string;
  sub?: string;
  highlight?: boolean;
  era: ReturnType<typeof getEraAtmosphere>;
  className?: string;
}) {
  return (
    <div
      className={`rounded-lg border px-2.5 py-2.5 ${
        highlight ? era.statHighlight : "border-zinc-800/60 bg-zinc-900/35"
      } ${className}`}
    >
      <p className="text-[8px] uppercase tracking-wider text-zinc-600 mb-0.5">{label}</p>
      <p className={`text-[11px] font-semibold truncate ${highlight ? "text-amber-100/95" : "text-zinc-100"}`}>
        {value}
      </p>
      {sub && <p className="text-[9px] text-zinc-600 truncate mt-0.5">{sub}</p>}
    </div>
  );
}
