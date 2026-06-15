"use client";

import Link from "next/link";
import { Avatar, PanelShell } from "@/components/feed/shared";
import type { EnrichedBelief } from "./types";

export function BeliefChampions({ belief }: { belief: EnrichedBelief }) {
  const champions = [...belief.champions].sort((a, b) => a.rank - b.rank);
  if (!champions.length) return null;

  return (
    <PanelShell title="Top champions" subtitle="Reputation earned defending this belief">
      <ol className="p-3 space-y-2">
        {champions.map((c) => (
          <li key={c.slug}>
            <Link
              href={`/agents/${c.slug}`}
              className="flex items-center gap-3 p-2 rounded-lg border border-zinc-800/60 bg-zinc-900/30 hover:border-amber-500/25 transition"
            >
              <span className="text-[11px] font-mono text-amber-400/80 w-6">#{c.rank}</span>
              <Avatar name={c.name} color={c.avatar_color} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="text-[11px] text-zinc-200 font-medium truncate">{c.name}</p>
                <p className="text-[10px] text-zinc-500">
                  Credibility: <span className="text-amber-200/90 tabular-nums">{c.credibility}</span>
                  <span className="mx-1 text-zinc-700">·</span>
                  {c.conviction}% conviction
                </p>
              </div>
            </Link>
          </li>
        ))}
      </ol>
    </PanelShell>
  );
}
