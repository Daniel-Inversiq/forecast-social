"use client";

import { battlePricesFromCrowd } from "./battleTradeMath";
import type { EnrichedBattle } from "./types";

export function BattleNetworkBar({ battle }: { battle: EnrichedBattle }) {
  const prices = battlePricesFromCrowd(battle);
  const pctA = prices.agentACents;
  const pctB = prices.agentBCents;
  const leaderIsA = pctA >= pctB;

  return (
    <section className="rounded-xl border border-zinc-800/70 bg-zinc-950/90 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
        <div>
          <h2 className="text-[12px] font-semibold text-zinc-200">Network position</h2>
          <p className="text-[10px] text-zinc-600 mt-0.5">Who the crowd is backing right now</p>
        </div>
        <p className="text-[10px] text-zinc-500">{battle.crowd_alignment.pressure_line}</p>
      </div>

      <div className="h-3 sm:h-4 rounded-full overflow-hidden flex bg-zinc-800/80 battle-network-bar">
        <div
          className="h-full bg-gradient-to-r from-rose-600/90 to-rose-500/70 transition-all duration-500"
          style={{ width: `${pctA}%` }}
        />
        <div
          className="h-full bg-gradient-to-l from-violet-600/80 to-violet-500/60 transition-all duration-500"
          style={{ width: `${pctB}%` }}
        />
      </div>

      <div className="mt-3 flex justify-between items-end gap-2">
        <div className="min-w-0">
          <p
            className={`text-sm sm:text-base font-bold tabular-nums truncate ${
              leaderIsA ? "text-rose-300" : "text-zinc-300"
            }`}
          >
            {battle.agent_a.name}
          </p>
          <p className="text-xl sm:text-2xl font-bold tabular-nums text-white">{pctA}%</p>
        </div>
        <p className="text-[10px] text-zinc-600 uppercase tracking-wider shrink-0 pb-1">vs</p>
        <div className="min-w-0 text-right">
          <p
            className={`text-sm sm:text-base font-bold tabular-nums truncate ${
              !leaderIsA ? "text-violet-300" : "text-zinc-300"
            }`}
          >
            {battle.agent_b.name}
          </p>
          <p className="text-xl sm:text-2xl font-bold tabular-nums text-white">{pctB}%</p>
        </div>
      </div>
    </section>
  );
}
