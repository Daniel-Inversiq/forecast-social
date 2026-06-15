"use client";

import Link from "next/link";
import { Avatar } from "@/components/feed/shared";
import type { RankedAgent } from "./types";

/**
 * The title race — who holds #1, who's hunting them, and how close it is.
 * Turns the static ladder into an ongoing story with a daily score to check.
 */
export function TitleRaceBanner({ agents }: { agents: RankedAgent[] }) {
  if (agents.length < 2) return null;
  const leader = agents[0];
  const challenger = agents[1];
  const gap = Math.max(
    0,
    Math.round((leader.reputation_score ?? 0) - (challenger.reputation_score ?? 0)),
  );
  const challengerDelta = Math.round(
    challenger.reputation_delta ?? challenger.velocity ?? 0,
  );
  const closing = challengerDelta > 0;

  const raceLine =
    gap === 0
      ? "Dead even at the top — next receipt decides #1."
      : closing
        ? `${challenger.name} gained ${challengerDelta} this period — ${gap} behind.`
        : `${challenger.name} trails by ${gap}.`;

  return (
    <div className="rounded-xl border border-amber-500/20 bg-gradient-to-r from-amber-950/25 via-zinc-950/80 to-zinc-950/60 px-3 py-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
      <span className="text-[9px] font-bold uppercase tracking-[0.16em] text-amber-400/90 shrink-0">
        Title race
      </span>
      <Link
        href={`/agents/${leader.slug}`}
        className="flex items-center gap-1.5 min-w-0 hover:opacity-90 transition"
      >
        <span aria-hidden className="text-[12px]">👑</span>
        <Avatar name={leader.name} color={leader.avatar_color} size="xs" />
        <span className="text-[13px] font-bold text-zinc-100 truncate">{leader.name}</span>
      </Link>
      <span className="text-[11px] text-zinc-500 min-w-0 truncate">{raceLine}</span>
      <Link
        href={`/compare/${leader.slug}/${challenger.slug}`}
        className="ml-auto shrink-0 text-[10px] font-medium text-amber-300/90 hover:text-amber-200 transition"
      >
        Head-to-head →
      </Link>
    </div>
  );
}
