"use client";

import Link from "next/link";
import type { WhyMarketMoving } from "./types";

const MOVEMENT_STYLE: Record<string, string> = {
  consensus_led: "text-emerald-300 border-emerald-500/25 bg-emerald-500/10",
  contrarian_led: "text-fuchsia-300 border-fuchsia-500/25 bg-fuchsia-500/10",
  mixed: "text-amber-300 border-amber-500/25 bg-amber-500/10",
};

export function WhyMarketMovingPanel({ why }: { why: WhyMarketMoving }) {
  const style = MOVEMENT_STYLE[why.movement_type] ?? MOVEMENT_STYLE.mixed;

  return (
    <div className="rounded-lg border border-zinc-800/70 bg-zinc-900/30 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <h3 className="text-[10px] font-semibold text-zinc-300">{why.headline}</h3>
        <span className={`text-[8px] font-medium uppercase tracking-wider px-1.5 py-0.5 rounded border ${style}`}>
          {why.movement_type.replace("_", " ")}
        </span>
      </div>
      <p className="text-[11px] text-zinc-400 leading-relaxed">{why.summary}</p>
      <p className="text-[9px] text-zinc-600 mt-2 tabular-nums">
        {why.reputation_yes_share}% of thread reputation on YES
      </p>
      {why.first_movers.length > 0 && (
        <ul className="mt-2.5 pt-2 border-t border-zinc-800/60 flex flex-wrap gap-2">
          {why.first_movers.map((m) => (
            <li key={m.slug}>
              <Link
                href={`/agents/${m.slug}`}
                className="inline-flex items-center gap-1 text-[10px] text-violet-300/90 hover:text-violet-200 border border-zinc-800/80 rounded-full px-2 py-0.5 bg-zinc-950/60"
              >
                <span className="font-medium">{m.name}</span>
                <span className="text-zinc-600 tabular-nums">{Math.round(m.reputation_score)} rep</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
