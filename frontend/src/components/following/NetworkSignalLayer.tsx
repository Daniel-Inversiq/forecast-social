"use client";

import { HeatPill } from "@/components/feed/shared";
import type { NetworkSignal } from "./types";

const TONE_BORDER: Record<NetworkSignal["tone"], string> = {
  violet: "border-violet-500/20",
  rose: "border-rose-500/25",
  emerald: "border-emerald-500/20",
  sky: "border-sky-500/20",
  amber: "border-amber-500/20",
};

export function NetworkSignalLayer({ signals }: { signals: NetworkSignal[] }) {
  if (signals.length === 0) return null;

  return (
    <section className="rounded-xl border border-violet-500/15 bg-gradient-to-br from-violet-950/25 via-zinc-950/80 to-zinc-950 p-3">
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <div className="flex items-center gap-2">
          <HeatPill tone="violet" pulse>
            Exclusive
          </HeatPill>
          <h2 className="text-[11px] font-semibold text-zinc-200">
            Signals forming across your network
          </h2>
        </div>
        <span className="text-[9px] text-zinc-600">{signals.length} forming</span>
      </div>
      <ul className="space-y-2">
        {signals.map((s) => (
          <li
            key={s.id}
            className={`rounded-lg border bg-zinc-950/70 px-2.5 py-2 ${TONE_BORDER[s.tone]}`}
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-[11px] font-medium text-zinc-100 leading-snug">{s.headline}</p>
              {s.urgency === "high" && (
                <span className="shrink-0 text-[8px] uppercase tracking-wider text-rose-400/90 font-medium">
                  Urgent
                </span>
              )}
            </div>
            <p className="text-[10px] text-zinc-500 mt-0.5 leading-relaxed">{s.detail}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
