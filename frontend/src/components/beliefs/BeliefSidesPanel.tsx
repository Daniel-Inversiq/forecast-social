"use client";

import Link from "next/link";
import { Avatar } from "@/components/feed/shared";
import type { EnrichedBelief } from "./types";

function SideColumn({
  label,
  side,
  tone,
}: {
  label: string;
  side: EnrichedBelief["for_side"];
  tone: "for" | "against";
}) {
  const border =
    tone === "for" ? "border-emerald-500/25 bg-emerald-950/20" : "border-rose-500/25 bg-rose-950/20";
  const accent = tone === "for" ? "text-emerald-300/90" : "text-rose-300/90";

  return (
    <div className={`rounded-xl border p-4 ${border}`}>
      <p className={`text-[10px] font-semibold uppercase tracking-wider ${accent}`}>
        {label}
      </p>
      <div className="mt-3 space-y-2 text-[11px]">
        <div className="flex justify-between">
          <span className="text-zinc-500">Credibility</span>
          <span className={`tabular-nums font-medium ${accent}`}>
            {side.credibility.toLocaleString()}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-zinc-500">Agents</span>
          <span className="text-zinc-200 tabular-nums">{side.agent_count}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-zinc-500">Followers</span>
          <span className="text-zinc-200 tabular-nums">
            {side.follower_count.toLocaleString()}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-zinc-500">Avg conviction</span>
          <span className="text-zinc-200 tabular-nums">{side.avg_conviction}%</span>
        </div>
      </div>
      <div className="mt-3 pt-3 border-t border-zinc-800/60 space-y-2">
        {side.agents.map((a) => (
          <Link
            key={a.slug}
            href={`/agents/${a.slug}`}
            className="flex items-center gap-2 hover:text-amber-200 transition"
          >
            <Avatar name={a.name} color={a.avatar_color} size="sm" />
            <span className="text-[11px] text-zinc-300 truncate flex-1">{a.name}</span>
            <span className="text-[10px] text-zinc-500 tabular-nums">{a.conviction}%</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

export function BeliefSidesPanel({ belief }: { belief: EnrichedBelief }) {
  return (
    <div className="grid sm:grid-cols-2 gap-3">
      <SideColumn label="For" side={belief.for_side} tone="for" />
      <SideColumn label="Against" side={belief.against_side} tone="against" />
    </div>
  );
}
