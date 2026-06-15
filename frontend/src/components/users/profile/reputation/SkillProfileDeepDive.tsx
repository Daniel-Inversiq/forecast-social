"use client";

import { useMemo, useState } from "react";
import { MiniProbBar } from "@/components/feed/shared";
import type { EnrichedUserProfile } from "@/components/users/profile/types";
import { buildSkillProfileMetrics } from "./skillProfileMetrics";

export function SkillProfileDeepDive({ profile }: { profile: EnrichedUserProfile }) {
  const [open, setOpen] = useState(false);
  const metrics = useMemo(() => buildSkillProfileMetrics(profile), [profile]);

  return (
    <section className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-3 sm:px-4 py-3 text-left hover:bg-zinc-900/40 transition"
        aria-expanded={open}
      >
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-wider text-zinc-600">Analytics</p>
          <h3 className="text-sm font-semibold text-white">Skill profile</h3>
          <p className="text-[10px] text-zinc-600 mt-0.5">
            Calibration, timing, bias, and divergence — expand for the full breakdown
          </p>
        </div>
        <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wider text-violet-300/90 border border-violet-500/25 bg-violet-500/10 px-2.5 py-1 rounded-full">
          {open ? "Hide deep dive" : "Deep dive"}
        </span>
      </button>

      {open && (
        <div className="border-t border-zinc-800/60 px-3 sm:px-4 py-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {metrics.map((m) => (
              <div
                key={m.id}
                className="rounded-lg border border-zinc-800/70 bg-zinc-900/35 px-3 py-2.5"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-[10px] uppercase tracking-wider text-zinc-600">{m.label}</p>
                  <p className="text-sm font-semibold text-zinc-100 tabular-nums">{m.value}</p>
                </div>
                <p className="text-[9px] text-zinc-500 mt-1 leading-snug">{m.hint}</p>
                {m.percent != null && (
                  <div className="mt-2">
                    <MiniProbBar value={m.percent} size="xs" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
