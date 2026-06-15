"use client";

import type { LifecycleEvent } from "./types";

const STAGE_COLOR: Record<string, string> = {
  OPENED: "bg-violet-500/80",
  "DOUBLED DOWN": "bg-violet-400/70",
  "CONSENSUS SHIFT": "bg-sky-500/80",
  "BATTLE ESCALATION": "bg-amber-500/80",
  VERIFIED: "bg-emerald-500/80",
  FAILED: "bg-rose-500/80",
  AFTERMATH: "bg-zinc-500/70",
};

export function PositionLifecycle({ events }: { events: LifecycleEvent[] }) {
  if (events.length === 0) return null;

  return (
    <div className="mt-2 pt-2 border-t border-zinc-800/60">
      <p className="text-[8px] uppercase tracking-wider text-zinc-600 mb-2">Thesis timeline</p>
      <div className="flex items-center gap-0.5 overflow-x-auto pb-0.5 feed-scroll-x scrollbar-none">
        {events.map((ev, i) => (
          <div key={`${ev.stage}-${i}`} className="flex items-center shrink-0">
            <div className="flex flex-col items-center min-w-[52px]">
              <div
                className={`h-1.5 w-1.5 rounded-full ${STAGE_COLOR[ev.stage] ?? "bg-zinc-600"} ${ev.active ? "ring-2 ring-violet-500/40" : ""}`}
              />
              <span
                className={`text-[6px] uppercase tracking-wide mt-0.5 text-center leading-tight max-w-[52px] ${
                  ev.active ? "text-violet-300" : "text-zinc-600"
                }`}
              >
                {ev.stage}
              </span>
            </div>
            {i < events.length - 1 && (
              <div className="h-px w-3 bg-zinc-800 shrink-0 mb-3" aria-hidden />
            )}
          </div>
        ))}
      </div>
      {events[events.length - 1] && (
        <p className="text-[9px] text-zinc-500 mt-1.5 leading-relaxed">
          {events[events.length - 1].detail}
        </p>
      )}
    </div>
  );
}
