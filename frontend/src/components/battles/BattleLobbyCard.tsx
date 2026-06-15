"use client";

import Link from "next/link";
import {
  Avatar,
  HeatPill,
  LiveDot,
  MoveBadge,
} from "@/components/feed/shared";
import { motionClass } from "@/components/feed/motion";
import { battleDetailPath, escalationLabel } from "./battleWarfare";
import type { EnrichedBattle } from "./types";

export function BattleLobbyCard({
  battle,
  index = 0,
}: {
  battle: EnrichedBattle;
  index?: number;
}) {
  const winningA = battle.winning_slug === battle.agent_a.slug;

  return (
    <Link
      href={battleDetailPath(battle)}
      className={`group block rounded-xl border border-zinc-800/80 bg-zinc-950/90 overflow-hidden feed-hover-lift hover:border-rose-500/30 hover:shadow-lg hover:shadow-rose-950/10 transition ${motionClass.cardEnterStagger(index)}`}
    >
      <div className="p-3.5 sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-1.5 flex-wrap min-w-0">
            {battle.is_live && <LiveDot color="rose" />}
            {battle.is_live && (
              <HeatPill tone="rose" pulse>
                Live
              </HeatPill>
            )}
            <span className="text-[9px] px-1.5 py-0.5 rounded-full border border-zinc-700/80 text-zinc-400 bg-zinc-900/60">
              {escalationLabel(battle.escalation_state)}
            </span>
          </div>
          <MoveBadge delta={battle.spread_delta} />
        </div>

        <p className="text-sm font-semibold text-white group-hover:text-rose-100 transition line-clamp-2">
          {battle.contested_market}
        </p>
        <p className="text-[10px] text-zinc-500 mt-0.5 line-clamp-1">{battle.faction_conflict}</p>

        <div className="flex items-center gap-2 mt-3">
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <Avatar name={battle.agent_a.name} color={battle.agent_a.avatar_color} size="xs" />
            <span
              className={`text-[11px] font-medium truncate ${
                winningA ? "text-rose-200" : "text-zinc-400"
              }`}
            >
              {battle.agent_a.name}
            </span>
          </div>
          <span className="text-[9px] font-bold text-zinc-600 uppercase">vs</span>
          <div className="flex items-center gap-1.5 min-w-0 flex-1 justify-end">
            <span
              className={`text-[11px] font-medium truncate ${
                !winningA ? "text-violet-200" : "text-zinc-400"
              }`}
            >
              {battle.agent_b.name}
            </span>
            <Avatar name={battle.agent_b.name} color={battle.agent_b.avatar_color} size="xs" />
          </div>
        </div>

        <p className="text-[10px] text-zinc-400 mt-2.5 line-clamp-2">{battle.last_blow}</p>

        <p className="text-[10px] text-rose-400/80 mt-2 font-medium group-hover:text-rose-300">
          View Rivalry →
        </p>
      </div>
    </Link>
  );
}
