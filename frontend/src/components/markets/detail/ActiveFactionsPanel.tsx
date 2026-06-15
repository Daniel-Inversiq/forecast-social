"use client";

import Link from "next/link";
import { SocialSignalPills } from "@/components/markets/SocialSignalPills";
import type { EnrichedMarketDetail, FactionBloc } from "./types";

const MOMENTUM_LABEL: Record<FactionBloc["momentum"], string> = {
  surging: "Momentum surging",
  holding: "Holding ground",
  weakening: "Weakening",
  isolated: "Isolated holdout",
};

const MOMENTUM_TONE: Record<FactionBloc["momentum"], string> = {
  surging: "text-emerald-400",
  holding: "text-zinc-400",
  weakening: "text-amber-400",
  isolated: "text-rose-400",
};

export function ActiveFactionsPanel({ market }: { market: EnrichedMarketDetail }) {
  const e = market.enriched;

  return (
    <section className="rounded-xl border border-zinc-800/70 bg-zinc-950/90 p-4 sm:p-5 mb-4">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
        <div>
          <p className="text-[9px] uppercase tracking-[0.18em] text-zinc-600">Social battlefield</p>
          <h2 className="text-base font-semibold text-zinc-100 mt-0.5">Active factions</h2>
        </div>
        <SocialSignalPills signals={e.social_signals} />
      </div>
      <p className="text-[10px] text-zinc-600 mb-4">
        Who controls each side — coalitions, reputation concentration, and dominant narratives.
      </p>

      <div className="grid sm:grid-cols-2 gap-3">
        {market.faction_blocs.map((bloc) => (
          <FactionCard key={bloc.side} bloc={bloc} battleIntensity={market.battle_intensity} />
        ))}
      </div>

      {(e.stance_change_line || e.holdout_line) && (
        <div className="mt-4 rounded-lg border border-amber-500/15 bg-amber-950/15 px-3 py-2.5 text-[10px] text-amber-200/85 leading-relaxed">
          {e.stance_change_line}
          {e.stance_change_line && e.holdout_line ? " · " : ""}
          {e.holdout_line}
        </div>
      )}
    </section>
  );
}

function FactionCard({
  bloc,
  battleIntensity,
}: {
  bloc: FactionBloc;
  battleIntensity: number;
}) {
  const isYes = bloc.side === "YES";
  const border = isYes ? "border-violet-500/30" : "border-zinc-700/50";
  const headerBg = isYes ? "from-violet-950/40" : "from-zinc-900/60";

  return (
    <article className={`rounded-lg border ${border} bg-zinc-900/30 overflow-hidden`}>
      <div className={`px-3 py-2.5 bg-gradient-to-r ${headerBg} to-transparent border-b border-zinc-800/50`}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[8px] font-bold uppercase tracking-wider text-zinc-600">{bloc.side}</p>
            <p className="text-sm font-semibold text-zinc-100 truncate">{bloc.name}</p>
          </div>
          <span
            className={`text-[9px] font-medium shrink-0 ${MOMENTUM_TONE[bloc.momentum]}`}
          >
            {MOMENTUM_LABEL[bloc.momentum]}
          </span>
        </div>
        <p className="text-[10px] text-zinc-500 mt-1 leading-snug">{bloc.narrative}</p>
      </div>

      <div className="px-3 py-2.5">
        <div className="flex items-center justify-between text-[9px] mb-2">
          <span className="text-zinc-600">Reputation concentration</span>
          <span className="text-zinc-400 tabular-nums font-semibold">{bloc.rep_concentration}%</span>
        </div>
        <div className="h-1 rounded-full bg-zinc-800 overflow-hidden mb-3">
          <div
            className={`h-full rounded-full ${isYes ? "bg-violet-500/70" : "bg-zinc-500/70"}`}
            style={{ width: `${bloc.rep_concentration}%` }}
          />
        </div>

        {bloc.agents.length === 0 ? (
          <p className="text-[10px] text-zinc-600">No agents surfaced on this flank</p>
        ) : (
          <ul className="space-y-2">
            {bloc.agents.map((a, i) => (
              <li key={a.slug} className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <Link
                    href={`/agents/${a.slug}`}
                    className="text-[11px] font-medium text-zinc-300 hover:text-violet-300 truncate block"
                  >
                    {i === 0 ? "▸ " : ""}
                    {a.name}
                  </Link>
                  <p className="text-[9px] text-zinc-600 truncate">{a.reasoning.slice(0, 48)}…</p>
                </div>
                <span className="text-[9px] text-zinc-500 tabular-nums shrink-0">
                  {Math.round(a.confidence)}%
                </span>
              </li>
            ))}
          </ul>
        )}

        {bloc.holdout_note && (
          <p className="text-[9px] text-rose-400/80 mt-2 italic">{bloc.holdout_note}</p>
        )}
      </div>

      {battleIntensity >= 60 && (
        <p className="px-3 pb-2 text-[8px] text-zinc-600">
          Battle threads active · {battleIntensity}% intensity on this flank
        </p>
      )}
    </article>
  );
}
