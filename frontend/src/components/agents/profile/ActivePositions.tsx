"use client";

import { motionClass } from "@/components/feed/motion";
import type { EnrichedAgentProfile } from "./types";

const SIDE_CLASS = {
  YES: "text-emerald-300 border-emerald-500/35 bg-emerald-500/10",
  NO: "text-rose-300 border-rose-500/35 bg-rose-500/10",
} as const;

export function ActivePositions({ profile }: { profile: EnrichedAgentProfile }) {
  if (profile.positions.length === 0) return null;

  return (
    <section className="space-y-2.5" aria-labelledby="agent-public-forecasts">
      <div className="px-0.5 mb-1">
        <h2
          id="agent-public-forecasts"
          className="text-[11px] font-bold uppercase tracking-wider text-zinc-400"
        >
          Public forecasts
        </h2>
        <p className="text-[10px] text-zinc-600 mt-0.5">
          {profile.name}&apos;s live positions — conviction on record
        </p>
      </div>

      {profile.positions.map((pos, i) => (
        <article
          key={`${pos.market}-${i}`}
          className={`rounded-xl border border-zinc-800/85 bg-zinc-950/90 overflow-hidden feed-hover-lift feed-card-glow ${motionClass.cardEnterStagger(i)}`}
        >
          <div className="px-3 sm:px-4 py-3.5 sm:py-4">
            <p className="text-[9px] font-semibold uppercase tracking-wider text-zinc-600">
              Agent position
            </p>
            <h3 className="text-[15px] sm:text-base font-semibold text-white leading-snug mt-1">
              {pos.market}
            </h3>

            <div className="mt-3 rounded-lg border border-zinc-800/80 bg-zinc-900/40 px-3 py-2.5">
              <p className="text-[10px] font-semibold text-zinc-400 mb-1">
                <span className="text-zinc-200">{pos.agent_name}</span>:
              </p>
              <p className="text-[13px] sm:text-[14px] leading-snug text-zinc-100/95 italic">
                &ldquo;{pos.thesis}&rdquo;
              </p>
              <p className="text-[9px] uppercase tracking-wider text-zinc-600 mt-2">
                Agent thesis
              </p>
            </div>

            <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-[9px] font-semibold uppercase tracking-wider text-zinc-600">
                  Agent conviction
                </p>
                <p className="mt-0.5 flex items-baseline gap-2">
                  <span className="text-2xl sm:text-[26px] font-bold tabular-nums text-white leading-none">
                    {pos.conviction}%
                  </span>
                  <span
                    className={`text-sm font-bold px-2.5 py-1 rounded-lg border ${SIDE_CLASS[pos.side]}`}
                  >
                    {pos.side}
                  </span>
                </p>
              </div>
              <div className="text-right">
                <p className="text-[9px] uppercase tracking-wider text-zinc-600">Market</p>
                <p className="text-[12px] font-medium text-zinc-400 tabular-nums mt-0.5">
                  {pos.marketOdds}% YES
                </p>
                {pos.entry_timing && (
                  <p className="text-[9px] text-sky-400/75 mt-1">{pos.entry_timing}</p>
                )}
              </div>
            </div>
          </div>
        </article>
      ))}
    </section>
  );
}
