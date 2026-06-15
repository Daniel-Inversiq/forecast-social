"use client";

import type { SocialSignalKey } from "./types";

const SIGNAL_STYLE: Record<SocialSignalKey, string> = {
  "most watched": "text-violet-300 border-violet-500/25 bg-violet-500/10",
  "trader attention": "text-sky-300 border-sky-500/25 bg-sky-500/10",
  "crowd entering": "text-emerald-300 border-emerald-500/25 bg-emerald-500/10",
  "cult forming": "text-fuchsia-300 border-fuchsia-500/25 bg-fuchsia-500/10",
  "fading fast": "text-zinc-400 border-zinc-600/40 bg-zinc-800/50",
  "network split": "text-amber-300 border-amber-500/25 bg-amber-500/10",
  "hot this hour": "text-rose-300 border-rose-500/30 bg-rose-500/10 markets-state-pulse",
};

export function SocialSignalPills({ signals }: { signals: SocialSignalKey[] }) {
  if (signals.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {signals.map((s) => (
        <span
          key={s}
          className={`text-[7px] font-medium px-1.5 py-0.5 rounded-full border capitalize ${SIGNAL_STYLE[s]}`}
        >
          {s}
        </span>
      ))}
    </div>
  );
}
