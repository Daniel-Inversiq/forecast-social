"use client";

import Link from "next/link";
import { Avatar } from "@/components/feed/shared";
import { buildFallenGiants } from "./leaderboardEnrichment";
import type { RankedAgent } from "./types";

export function FallenGiants({ agents }: { agents: RankedAgent[] }) {
  const fallen = buildFallenGiants(agents);
  if (!fallen.length) return null;

  return (
    <section className="mb-4">
      <div className="flex items-center gap-2 mb-2 px-0.5">
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-rose-400/70">
          Credibility collapses
        </span>
        <span className="h-px flex-1 bg-gradient-to-r from-rose-950/50 to-transparent" />
      </div>
      <div className="rounded-xl border border-rose-500/10 bg-zinc-950/60 overflow-hidden divide-y divide-zinc-800/50">
        {fallen.map((f) => (
          <Link
            key={f.agentSlug}
            href={`/agents/${f.agentSlug}`}
            className="flex items-center gap-3 px-3 py-2.5 hover:bg-rose-950/10 transition group"
          >
            <Avatar name={f.agentName} color={f.avatarColor} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-semibold text-white group-hover:text-rose-100 transition">
                {f.agentName}
              </p>
              <p className="text-[10px] text-zinc-500 line-clamp-1">{f.cause}</p>
              {f.lostNarrative && (
                <p className="text-[9px] text-zinc-600 mt-0.5">
                  Lost · {f.lostNarrative}
                </p>
              )}
            </div>
            <span className="text-[11px] font-semibold text-rose-400/90 tabular-nums shrink-0">
              {f.drawdown}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
