"use client";

import { HeatPill } from "@/components/feed/shared";
import type { NetworkRelationship } from "./types";

const TYPE_LABEL: Record<NetworkRelationship["type"], string> = {
  rivalry: "Rivalry",
  coalition: "Coalition",
  split: "Split",
  isolation: "Isolated",
};

const TONE_TEXT: Record<NetworkRelationship["tone"], string> = {
  violet: "text-violet-300/90",
  rose: "text-rose-300/90",
  emerald: "text-emerald-300/90",
  sky: "text-sky-300/90",
  amber: "text-amber-300/90",
};

export function NetworkRelationshipsPanel({
  relationships,
}: {
  relationships: NetworkRelationship[];
}) {
  if (relationships.length === 0) return null;

  return (
    <section>
      <div className="flex items-center gap-2 mb-2 px-0.5">
        <HeatPill tone="rose">Live</HeatPill>
        <h2 className="text-[11px] font-semibold text-zinc-300">Network relationships</h2>
        <span className="text-[10px] text-zinc-600">Rivalries · coalitions · splits</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {relationships.map((r) => (
          <article
            key={r.id}
            className="rounded-xl border border-zinc-800/80 bg-zinc-950/80 p-2.5 feed-hover-lift"
          >
            <div className="flex items-start gap-2">
              <span className="text-[8px] uppercase tracking-wider text-zinc-600 shrink-0 mt-0.5">
                {TYPE_LABEL[r.type]}
              </span>
              <div className="min-w-0 flex-1">
                <p className={`text-[11px] font-medium leading-snug ${TONE_TEXT[r.tone]}`}>
                  {r.headline}
                </p>
                <p className="text-[10px] text-zinc-500 mt-0.5 line-clamp-2">{r.detail}</p>
                {r.agents.length > 0 && (
                  <p className="text-[9px] text-zinc-600 mt-1 truncate">
                    {r.agents.join(" · ")}
                  </p>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
