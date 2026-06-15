"use client";

import Link from "next/link";
import { BattleActivityFeed } from "./BattleActivityFeed";
import { BattleArenaHero } from "./BattleArenaHero";
import { BattleBeliefLayer } from "./BattleBeliefLayer";
import { BattleNetworkBar } from "./BattleNetworkBar";
import { BattlePositionPanel } from "./BattlePositionPanel";
import { BattleProbabilityChart } from "./BattleProbabilityChart";
import { BattleThesisShowdown } from "./BattleThesisShowdown";
import type { EnrichedBattle } from "./types";

export function BattleWarRoom({ battle }: { battle: EnrichedBattle }) {
  return (
    <div className="space-y-4">
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_300px] xl:grid-cols-[minmax(0,1fr)_320px] gap-4 xl:gap-5 items-start">
        <div className="space-y-4 min-w-0 order-2 lg:order-1">
          <BattleArenaHero battle={battle} />
          <BattleBeliefLayer battleId={battle.id} />
          <BattleNetworkBar battle={battle} />

          <div className="lg:hidden">
            <BattlePositionPanel battle={battle} />
          </div>

          <BattleProbabilityChart battle={battle} />
          <BattleThesisShowdown battle={battle} />
          <BattleActivityFeed battle={battle} />
        </div>

        <aside className="hidden lg:block space-y-3 order-1 lg:order-2 lg:sticky lg:top-4 lg:self-start">
          <BattlePositionPanel battle={battle} />
          <Link
            href="/battles"
            className="block text-center text-[10px] py-1.5 text-zinc-500 hover:text-zinc-300"
          >
            ← All battles
          </Link>
        </aside>
      </div>
    </div>
  );
}
