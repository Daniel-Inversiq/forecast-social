"use client";

import { LIFECYCLE_LABELS, LIFECYCLE_PHASES } from "./types";
import type { EnrichedNarrative, LifecyclePhase } from "./types";

const PHASE_ACCENT: Record<LifecyclePhase, string> = {
  WEAK_SIGNAL: "border-zinc-600/50 text-zinc-500",
  CLUSTERING: "border-amber-500/35 text-amber-300/90",
  PRESSURE_BUILDING: "border-amber-500/50 text-amber-200",
  CONSENSUS_BREAK: "border-violet-500/45 text-violet-300/90",
  REPRICING: "border-teal-500/40 text-teal-300/90",
  DOMINANT_NARRATIVE: "border-zinc-500/40 text-zinc-400",
  COLLAPSE: "border-rose-500/35 text-rose-300/80",
};

export function SignalLifecycleRail({ narratives }: { narratives: EnrichedNarrative[] }) {
  const counts = new Map<LifecyclePhase, number>();
  for (const n of narratives) {
    counts.set(n.lifecycle_phase, (counts.get(n.lifecycle_phase) ?? 0) + 1);
  }

  const dominant = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "CLUSTERING";

  return (
    <section className="mb-3 rounded-xl border border-zinc-800/70 bg-zinc-950/50 p-3 sm:p-3.5 overflow-hidden relative">
      <div className="absolute inset-0 bg-gradient-to-r from-violet-950/15 via-transparent to-amber-950/10 pointer-events-none" />
      <div className="relative">
        <div className="flex items-center justify-between gap-2 mb-2.5">
          <div>
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-400">
              Signal lifecycle
            </h2>
            <p className="text-[10px] text-zinc-600 mt-0.5">
              Where narratives sit before the world notices
            </p>
          </div>
          <span className="text-[9px] text-zinc-600 tabular-nums">
            {narratives.length} tracked
          </span>
        </div>

        <div className="hidden sm:flex items-stretch gap-0.5 mb-2">
          {LIFECYCLE_PHASES.map((phase, i) => {
            const count = counts.get(phase) ?? 0;
            const active = phase === dominant;
            return (
              <div key={phase} className="flex-1 min-w-0 flex flex-col items-center gap-1">
                <div
                  className={`w-full h-1 rounded-full transition-all ${
                    count > 0
                      ? active
                        ? "bg-gradient-to-r from-amber-500/80 to-violet-500/60"
                        : "bg-zinc-700/80"
                      : "bg-zinc-800/60"
                  }`}
                  style={{ opacity: count > 0 ? 0.4 + Math.min(count, 4) * 0.15 : 0.25 }}
                />
                {i < LIFECYCLE_PHASES.length - 1 && (
                  <span className="absolute hidden" aria-hidden>
                    →
                  </span>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex gap-1.5 overflow-x-auto feed-scroll-x scrollbar-none pb-0.5">
          {LIFECYCLE_PHASES.map((phase) => {
            const count = counts.get(phase) ?? 0;
            const active = phase === dominant;
            return (
              <div
                key={phase}
                className={`shrink-0 rounded-lg border px-2.5 py-1.5 min-w-[100px] ${
                  active
                    ? "border-amber-500/30 bg-amber-950/25"
                    : "border-zinc-800/80 bg-zinc-900/30"
                } ${PHASE_ACCENT[phase]}`}
              >
                <p className="text-[8px] uppercase tracking-wider truncate">
                  {LIFECYCLE_LABELS[phase]}
                </p>
                <p className="text-sm font-semibold tabular-nums mt-0.5 text-white">{count}</p>
              </div>
            );
          })}
        </div>

        <p className="text-[9px] text-zinc-600 mt-2">
          Weak signal → clustering → pressure → break → repricing → dominant → collapse
        </p>
      </div>
    </section>
  );
}
