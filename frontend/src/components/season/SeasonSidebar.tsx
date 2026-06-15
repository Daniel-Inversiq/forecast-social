"use client";

import Link from "next/link";
import { PanelShell } from "@/components/feed/shared";
import { reputationClimate, seasonAgeDays } from "./seasonEnrichment";
import { CONSENSUS_LABELS, getEraAtmosphere } from "./seasonEraStyles";
import type { SeasonDetail } from "@/lib/season";

export function SeasonSidebar({ season }: { season: SeasonDetail }) {
  const era = getEraAtmosphere(season.category);
  const age = seasonAgeDays(season);
  const climate = reputationClimate(season);

  return (
    <aside className="space-y-4 feed-intel-rail sticky top-[52px] self-start max-h-[calc(100vh-4rem)] overflow-y-auto scrollbar-none">
      <PanelShell title="Strongest active narratives" subtitle="Dominant conviction arcs">
        <ul className="p-2 space-y-1.5">
          {season.dominant_narratives.map((n) => (
            <li
              key={n.id}
              className={`text-[11px] px-2 py-1.5 rounded-lg border border-zinc-800/70 ${era.accentText} bg-zinc-900/30`}
            >
              {n.label}
            </li>
          ))}
          {season.narrative_winners.map((w) => (
            <li key={w.narrative} className="text-[10px] text-zinc-500 px-2 flex justify-between gap-2">
              <span className="truncate">{w.narrative}</span>
              {w.leader_slug ? (
                <Link href={`/agents/${w.leader_slug}`} className="text-zinc-400 hover:text-amber-200/80 shrink-0">
                  {w.leader}
                </Link>
              ) : (
                <span className="shrink-0">{w.leader ?? "—"}</span>
              )}
            </li>
          ))}
        </ul>
      </PanelShell>

      <PanelShell title="Current regime pressure" subtitle="Volatility · consensus">
        <div className="px-2 py-2 space-y-2 text-[10px]">
          <div className="flex justify-between">
            <span className="text-zinc-600">Volatility index</span>
            <span className={`font-semibold tabular-nums ${era.accentText}`}>
              {season.volatility_score.toFixed(0)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-600">Consensus</span>
            <span className="text-zinc-300">
              {CONSENSUS_LABELS[season.consensus_state] ?? season.consensus_state}
            </span>
          </div>
          {age != null && (
            <div className="flex justify-between">
              <span className="text-zinc-600">Era age</span>
              <span className="text-zinc-400 tabular-nums">{age}d</span>
            </div>
          )}
        </div>
      </PanelShell>

      <PanelShell title="Reputation climate" subtitle="Migration intensity this era">
        <p className="px-2 py-2 text-[11px] text-zinc-400">{climate}</p>
        {season.timing_leaders.length > 0 && (
          <ul className="border-t border-zinc-800/60 divide-y divide-zinc-800/60">
            {season.timing_leaders.slice(0, 3).map((t) => (
              <li key={t.agent_slug}>
                <Link
                  href={`/agents/${t.agent_slug}`}
                  className="flex justify-between px-2 py-1.5 text-[10px] hover:bg-zinc-900/50"
                >
                  <span className="text-zinc-400">{t.agent_name}</span>
                  <span className="text-emerald-400/80 tabular-nums">+{t.score}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </PanelShell>

      {season.biggest_consensus_breaks.length > 0 && (
        <PanelShell title="Archived consensus failures" subtitle="Who broke the narrative">
          <ul className="divide-y divide-zinc-800/60">
            {season.biggest_consensus_breaks.map((b) => (
              <li key={b.agent_slug}>
                <Link
                  href={`/agents/${b.agent_slug}`}
                  className="flex justify-between px-2 py-1.5 text-[11px] hover:bg-zinc-900/50"
                >
                  <span className="text-zinc-300">{b.agent_name}</span>
                  <span className="text-rose-400/70 tabular-nums">{b.count}×</span>
                </Link>
              </li>
            ))}
          </ul>
        </PanelShell>
      )}

      {season.biggest_collapses.length > 0 && (
        <PanelShell title="Major collapses" subtitle="Regime reversal casualties">
          <ul className="divide-y divide-zinc-800/60">
            {season.biggest_collapses.map((c) => (
              <li key={c.agent_slug}>
                <Link
                  href={`/agents/${c.agent_slug}`}
                  className="flex justify-between px-2 py-1.5 text-[11px] hover:bg-zinc-900/50"
                >
                  <span className="text-zinc-300">{c.agent_name}</span>
                  <span className="text-rose-400/80 tabular-nums">{c.delta}</span>
                </Link>
              </li>
            ))}
          </ul>
        </PanelShell>
      )}

      <PanelShell title="Historical comparison" subtitle="Rising era parallels">
        <ul className="p-2 space-y-1.5 text-[10px]">
          <li>
            <Link href="/season/archive" className="text-zinc-400 hover:text-amber-200/90 block">
              AI Mania Phase → acceleration cluster
            </Link>
          </li>
          <li>
            <Link href="/season/archive" className="text-zinc-400 hover:text-amber-200/90 block">
              Soft Landing Era → macro fragmentation
            </Link>
          </li>
          <li>
            <Link href="/season?slug=macro-cycle-w21" className="text-zinc-500 hover:text-amber-200/80 block">
              Current: {season.title}
            </Link>
          </li>
        </ul>
      </PanelShell>

      {season.trigger_reason && (
        <div className={`rounded-xl border ${era.heroBorder} bg-zinc-900/30 px-3 py-3`}>
          <p className="text-[8px] uppercase tracking-wider text-zinc-600 mb-1">Defining rupture</p>
          <p className="text-[11px] text-zinc-400 leading-relaxed">{season.trigger_reason}</p>
        </div>
      )}
    </aside>
  );
}
