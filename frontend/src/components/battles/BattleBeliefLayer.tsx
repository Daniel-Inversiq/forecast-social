"use client";

import Link from "next/link";
import {
  beliefPath,
  getBattleBeliefLink,
} from "@/components/beliefs/beliefEnrichment";
import { FALLBACK_BELIEFS } from "@/components/beliefs/fallbackData";
import { beliefsEnabled } from "@/lib/featureFlags";

export function BattleBeliefStrip({ battleId }: { battleId: string }) {
  if (!beliefsEnabled()) return null;
  const link = getBattleBeliefLink(battleId);
  if (!link) return null;
  const beliefFor = FALLBACK_BELIEFS.find((b) => b.slug === link.for_slug);
  const beliefAgainst = FALLBACK_BELIEFS.find((b) => b.slug === link.against_slug);
  if (!beliefFor || !beliefAgainst) return null;

  return (
    <p className="text-[10px] text-amber-400/70 mb-2 line-clamp-1">
      Idea layer:{" "}
      <Link href={beliefPath(beliefFor.slug)} className="hover:text-amber-300">
        {beliefFor.title}
      </Link>
      <span className="text-zinc-600 mx-1">vs</span>
      <Link href={beliefPath(beliefAgainst.slug)} className="hover:text-amber-300">
        {beliefAgainst.title}
      </Link>
    </p>
  );
}

export function BattleBeliefLayer({ battleId }: { battleId: string }) {
  if (!beliefsEnabled()) return null;
  const link = getBattleBeliefLink(battleId);
  if (!link) return null;

  const beliefFor = FALLBACK_BELIEFS.find((b) => b.slug === link.for_slug);
  const beliefAgainst = FALLBACK_BELIEFS.find((b) => b.slug === link.against_slug);
  if (!beliefFor || !beliefAgainst) return null;

  return (
    <section className="rounded-xl border border-amber-500/20 bg-amber-950/15 p-3 sm:p-4">
      <p className="text-[9px] uppercase tracking-wider text-amber-400/70 mb-2">
        Underlying belief battle · idea layer
      </p>
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 text-[11px]">
        <Link
          href={beliefPath(beliefFor.slug)}
          className="text-amber-200/90 hover:text-amber-100 font-medium"
        >
          {beliefFor.title}
        </Link>
        <span className="text-zinc-600 hidden sm:inline">vs</span>
        <Link
          href={beliefPath(beliefAgainst.slug)}
          className="text-rose-300/80 hover:text-rose-200 font-medium"
        >
          {beliefAgainst.title}
        </Link>
      </div>
      <p className="text-[10px] text-zinc-600 mt-2">
        Agent battle above ·{" "}
        <Link href="/beliefs" className="text-amber-400/80 hover:text-amber-300">
          explore beliefs →
        </Link>
      </p>
    </section>
  );
}
