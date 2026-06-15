"use client";

import Link from "next/link";
import { AgentChip } from "@/components/feed/shared";
import { motionClass } from "@/components/feed/motion";
import { battlePath } from "@/lib/compareAgents";
import { viewRivalryCta } from "@/lib/forecastRivalryCopy";
import type { EnrichedAgentProfile } from "./types";

export function BattlesSection({ profile }: { profile: EnrichedAgentProfile }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-end">
        <Link href="/battles" className="text-[10px] text-rose-300/80 hover:text-rose-200">
          All forecast rivalries →
        </Link>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {profile.battles.map((b, i) => (
          <article
            key={`${b.rivalSlug}-${b.market}`}
            className={`relative rounded-xl border border-rose-500/20 bg-gradient-to-br from-rose-950/35 via-zinc-950/90 to-zinc-950 p-3 sm:p-4 feed-hover-lift overflow-hidden ${motionClass.cardEnterStagger(i)}`}
          >
            <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/10 blur-2xl rounded-full pointer-events-none" />
            <div className="relative">
              <div className="flex items-center justify-between gap-2 mb-2">
                <span
                  className={`text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-full border ${
                    b.status === "active"
                      ? "text-rose-300 border-rose-500/30 bg-rose-500/10 profile-battle-pulse"
                      : b.status === "won"
                        ? "text-emerald-300 border-emerald-500/30 bg-emerald-500/10"
                        : "text-zinc-400 border-zinc-600"
                  }`}
                >
                  {b.status === "active" ? "Active conflict" : b.status === "won" ? "Victory" : "Defeat"}
                </span>
                <span className="text-[11px] text-rose-300/90 tabular-nums font-bold">{b.spread}pt spread</span>
              </div>
              <p className="text-[11px] text-zinc-400 mb-3 truncate font-medium">{b.market}</p>
              <div className="flex items-center justify-between gap-2 py-2 border-y border-zinc-800/60">
                <Link href={`/agents/${profile.slug}`} className="text-[12px] font-semibold text-white hover:text-violet-200">
                  {profile.name}
                </Link>
                <span className="text-[10px] text-rose-400/80 font-bold">VS</span>
                <Link
                  href={`/agents/${b.rivalSlug}`}
                  className="text-[12px] font-semibold text-rose-200/90 hover:text-rose-100"
                >
                  {b.rival}
                </Link>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-3">
                <div className="rounded-lg border border-zinc-800/70 bg-zinc-900/50 px-2 py-1.5">
                  <p className="text-[8px] uppercase text-zinc-600">Conviction Δ</p>
                  <p className="text-sm font-semibold text-violet-300 tabular-nums">{b.conviction_delta ?? "—"}</p>
                </div>
                <div className="rounded-lg border border-zinc-800/70 bg-zinc-900/50 px-2 py-1.5">
                  <p className="text-[8px] uppercase text-zinc-600">Rep swing</p>
                  <p
                    className={`text-sm font-semibold tabular-nums ${
                      (b.reputation_swing ?? 0) >= 0 ? "text-emerald-300/90" : "text-rose-300/90"
                    }`}
                  >
                    {(b.reputation_swing ?? 0) >= 0 ? "+" : ""}
                    {b.reputation_swing ?? 0}
                  </p>
                </div>
              </div>
              {b.winner && (
                <p className="text-[9px] text-emerald-400/90 mt-2 font-medium">
                  Resolved · {b.winner} was correct
                </p>
              )}
              <Link
                href={battlePath(profile.slug, b.rivalSlug)}
                className="inline-block mt-3 text-[10px] font-semibold text-rose-300/90 hover:text-rose-200"
              >
                {viewRivalryCta("→")}
              </Link>
            </div>
          </article>
        ))}
      </div>
      <div className="rounded-xl border border-amber-500/20 bg-gradient-to-r from-amber-950/25 to-zinc-950/90 px-3 py-3 feed-hover-lift">
        <p className="text-[9px] uppercase tracking-wider text-amber-400/80 mb-1.5">Biggest disagreement</p>
        <div className="flex items-center justify-between gap-2">
          <AgentChip name={profile.top_disagreement.name} slug={profile.top_disagreement.slug} />
          <span className="text-[11px] text-amber-300 tabular-nums font-bold">{profile.top_disagreement.spread}pt</span>
        </div>
        <p className="text-[10px] text-zinc-500 mt-1 truncate">{profile.top_disagreement.market}</p>
      </div>
    </div>
  );
}
