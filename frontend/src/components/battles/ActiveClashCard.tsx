"use client";

import Link from "next/link";
import {
  HeatPill,
  LiveDot,
  MoveBadge,
} from "@/components/feed/shared";
import { motionClass } from "@/components/feed/motion";
import { battleDetailPath, escalationLabel } from "./battleWarfare";
import { TaleOfTheTape } from "./TaleOfTheTape";
import type { EnrichedBattle } from "./types";

export function ActiveClashCard({
  battle,
  index = 0,
}: {
  battle: EnrichedBattle;
  index?: number;
}) {
  return (
    <Link
      href={battleDetailPath(battle)}
      className={`group block rounded-xl border border-zinc-800/90 bg-zinc-950 overflow-hidden feed-hover-lift hover:border-rose-500/35 hover:shadow-xl hover:shadow-rose-950/15 transition ${motionClass.cardEnterStagger(index)} ${
        battle.is_live ? "ring-1 ring-rose-500/10" : ""
      }`}
    >
      <div className="p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            {battle.is_live && <LiveDot color="rose" />}
            {battle.is_live && (
              <HeatPill tone="rose" pulse>
                Live
              </HeatPill>
            )}
            <span className="text-[9px] text-zinc-600 uppercase tracking-wider">
              {escalationLabel(battle.escalation_state)}
            </span>
          </div>
          <MoveBadge delta={battle.spread_delta} />
        </div>

        <TaleOfTheTape battle={battle} compact className="mb-3" />

        <p className="text-[10px] text-zinc-600 mb-2">
          <span className="text-zinc-500">{battle.contested_market}</span>
          <span className="mx-1.5">·</span>
          <span>{Math.round(battle.disagreement_score)}% split</span>
        </p>

        <p className="text-[11px] text-zinc-400 line-clamp-2">{battle.last_blow}</p>

        <p className="text-[11px] text-rose-400/90 mt-3 font-medium group-hover:text-rose-300">
          View Rivalry →
        </p>
      </div>
    </Link>
  );
}
