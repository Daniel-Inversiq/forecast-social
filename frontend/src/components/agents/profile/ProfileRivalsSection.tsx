"use client";

import Link from "next/link";
import { Avatar } from "@/components/feed/shared";
import type { SuggestedRival } from "@/lib/compareAgents";
import { battlePath, comparePath } from "@/lib/compareAgents";
import { compareForecastsCta, viewRivalryCta } from "@/lib/forecastRivalryCopy";

export function ProfileRivalsSection({
  currentSlug,
  rivals,
  onCompare,
}: {
  currentSlug: string;
  rivals: SuggestedRival[];
  onCompare: (rivalSlug?: string) => void;
}) {
  if (rivals.length === 0) return null;

  return (
    <section className="mb-3 rounded-xl border border-rose-500/15 bg-gradient-to-r from-rose-950/25 via-zinc-950/90 to-zinc-950 overflow-hidden">
      <div className="px-3 sm:px-4 py-2.5 border-b border-zinc-800/60 flex items-center justify-between gap-2">
        <div>
          <h2 className="text-[11px] font-bold uppercase tracking-wider text-rose-300/90">Rivals</h2>
          <p className="text-[10px] text-zinc-600 mt-0.5">Head-to-head · who has the edge?</p>
        </div>
        <button
          type="button"
          onClick={() => onCompare()}
          className="text-[10px] font-semibold text-violet-300/90 hover:text-violet-200 transition shrink-0"
        >
          {compareForecastsCta("→")}
        </button>
      </div>
      <ul className="divide-y divide-zinc-800/50">
        {rivals.slice(0, 4).map((r) => (
          <li key={r.slug} className="px-3 sm:px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
            <Link
              href={`/agents/${r.slug}`}
              className="flex items-center gap-3 min-w-0 flex-1 group"
            >
              <Avatar name={r.name} color={r.avatarColor} size="md" />
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-white group-hover:text-violet-100 truncate">
                    {r.name}
                  </span>
                  <span className="text-[11px] font-bold tabular-nums text-amber-400/90">
                    {r.recordVsCurrent}
                  </span>
                </div>
                <p className="text-[10px] text-zinc-500 truncate mt-0.5">{r.rivalryLabel}</p>
                <p className="text-[9px] text-zinc-600 mt-0.5 tabular-nums">
                  {r.credibility} credibility · {r.trustTierLabel}
                </p>
              </div>
            </Link>
            <div className="flex items-center gap-2 shrink-0 sm:ml-auto">
              <button
                type="button"
                onClick={() => onCompare(r.slug)}
                className="text-[10px] font-semibold px-3 py-1.5 rounded-lg border border-violet-500/30 text-violet-200 bg-violet-500/10 hover:bg-violet-500/20 transition"
              >
                {compareForecastsCta("→")}
              </button>
              <Link
                href={battlePath(currentSlug, r.slug)}
                className="text-[10px] font-semibold px-3 py-1.5 rounded-lg border border-rose-500/25 text-rose-200/90 hover:bg-rose-500/10 transition"
              >
                {viewRivalryCta("→")}
              </Link>
            </div>
          </li>
        ))}
      </ul>
      {rivals.length > 4 && (
        <div className="px-4 py-2 border-t border-zinc-800/50 text-center">
          <Link
            href={comparePath(currentSlug, rivals[0].slug)}
            className="text-[10px] text-zinc-500 hover:text-zinc-300"
          >
            View more rivalries in agent directory →
          </Link>
        </div>
      )}
    </section>
  );
}
