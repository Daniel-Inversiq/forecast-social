"use client";

import Link from "next/link";
import { HeatPill, LiveDot } from "@/components/feed/shared";
import { NarrativeStateBadge } from "@/components/markets/NarrativeStateBadge";
import type { ConvictionSignal } from "./types";

const DIRECTION_LABEL = {
  toward: "Network moving toward you",
  away: "Network moving away",
  stable: "Network stable",
};

const DIRECTION_COLOR = {
  toward: "text-emerald-400/90",
  away: "text-rose-400/90",
  stable: "text-zinc-500",
};

export function ConvictionMap({ signals }: { signals: ConvictionSignal[] }) {
  if (signals.length === 0) return null;

  return (
    <section className="mb-4">
      <div className="flex items-center gap-2 mb-2 px-0.5">
        <LiveDot color="violet" />
        <HeatPill tone="teal">Signal map</HeatPill>
        <h2 className="text-[11px] font-semibold text-zinc-300">Conviction map</h2>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {signals.map((s) => (
          <Link
            key={s.id}
            href={`/markets/${s.slug}`}
            className="group rounded-xl border border-zinc-800/80 bg-zinc-950/90 p-2.5 feed-hover-lift hover:border-violet-500/30 transition"
          >
            <p className="text-[8px] uppercase tracking-wider text-zinc-600 mb-1">{s.label}</p>
            <p className="text-[10px] font-semibold text-white leading-snug line-clamp-2 min-h-[2rem] mb-1.5 group-hover:text-violet-200 transition">
              {s.market_title}
            </p>
            <div className="flex items-center justify-between gap-1 mb-1.5">
              <span
                className={`text-[9px] font-bold px-1 py-0.5 rounded border ${
                  s.side === "YES"
                    ? "text-emerald-300 border-emerald-500/30 bg-emerald-500/10"
                    : "text-rose-300 border-rose-500/30 bg-rose-500/10"
                }`}
              >
                {s.side}
              </span>
              <span className="text-[10px] font-semibold text-violet-300 tabular-nums">{s.signal_value}</span>
            </div>
            <NarrativeStateBadge state={s.narrative_state} compact />
            <p className="text-[8px] text-zinc-600 mt-1.5 truncate">{s.signal_sub}</p>
            <div className="flex items-center justify-between mt-1.5 pt-1.5 border-t border-zinc-800/60">
              <span className="text-[8px] text-zinc-600 tabular-nums">{s.rep_exposure} rep exp</span>
              <span className={`text-[8px] ${DIRECTION_COLOR[s.network_direction]}`}>
                {DIRECTION_LABEL[s.network_direction]}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
