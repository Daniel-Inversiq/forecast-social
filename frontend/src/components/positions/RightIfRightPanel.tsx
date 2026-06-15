"use client";

import { HeatPill } from "@/components/feed/shared";
import type { EnrichedActivePosition } from "./types";

export function RightIfRightPanel({ positions }: { positions: EnrichedActivePosition[] }) {
  const top = [...positions]
    .sort((a, b) => b.amount + b.rep_exposure - (a.amount + a.rep_exposure))
    .slice(0, 3);

  if (top.length === 0) return null;

  return (
    <section className="rounded-xl border border-violet-500/20 bg-gradient-to-br from-violet-950/30 to-zinc-950/95 overflow-hidden mb-4">
      <div className="px-3 py-2.5 border-b border-violet-500/15">
        <HeatPill tone="violet">Strategic</HeatPill>
        <h2 className="text-[11px] font-semibold text-white mt-1.5">
          What happens if you&apos;re right?
        </h2>
        <p className="text-[9px] text-zinc-600 mt-0.5">
          Projected reputation · verification · network shifts
        </p>
      </div>
      <div className="divide-y divide-zinc-800/50">
        {top.map((p) => (
          <div key={p.id} className="px-3 py-2.5">
            <p className="text-[10px] font-semibold text-zinc-200 mb-1 truncate">{p.market_title}</p>
            <p className="text-[9px] text-zinc-600 mb-2">
              If verified · {p.verification_odds}% probability
            </p>
            <ul className="space-y-1">
              {p.right_if_right.summary_lines.map((line, i) => (
                <li key={i} className="text-[10px] text-violet-300/90 flex items-start gap-1.5">
                  <span className="text-zinc-700 shrink-0">▸</span>
                  {line}
                </li>
              ))}
            </ul>
            {p.right_if_right.exposed_agents.length > 0 && (
              <p className="text-[8px] text-zinc-600 mt-2">
                Exposed: {p.right_if_right.exposed_agents.join(", ")}
              </p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
