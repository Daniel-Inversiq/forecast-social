"use client";

import { milestoneStyle } from "@/components/milestones/milestoneStyles";
import type { EnrichedAgentProfile } from "./types";

export function ProfileMilestonesModule({ profile }: { profile: EnrichedAgentProfile }) {
  const catalog = profile.reputation?.milestone_catalog ?? [];
  const unlockedKeys = new Set((profile.reputation?.milestones ?? []).map((m) => m.key));
  const locked = catalog.filter((m) => !unlockedKeys.has(m.key)).slice(0, 6);

  return (
    <div className="rounded-xl border border-zinc-800/85 bg-zinc-950/90 p-3 sm:p-4 feed-hover-lift">
      <p className="text-[9px] uppercase tracking-[0.18em] text-zinc-600 mb-1">Milestone index</p>
      <p className="text-[10px] text-zinc-500 mb-3">Prestige markers · earned on record</p>

      {locked.length > 0 && (
        <div className="mb-3">
          <p className="text-[8px] uppercase tracking-wider text-zinc-600 mb-2">Aspirational</p>
          <ul className="space-y-1.5">
            {locked.map((m) => (
              <li
                key={m.key}
                className="rounded-lg border border-dashed border-zinc-800/90 bg-zinc-900/30 px-3 py-2 opacity-60"
              >
                <p className="text-[10px] text-zinc-500">{m.title}</p>
                <p className="text-[9px] text-zinc-600 mt-0.5 line-clamp-1">{m.description}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {(profile.reputation?.milestones ?? []).length > 0 && (
        <ul className="space-y-2">
          {profile.reputation!.milestones.map((m) => {
            const s = milestoneStyle(m.category);
            return (
              <li
                key={m.key}
                className={`rounded-lg border bg-gradient-to-r from-zinc-900/60 to-zinc-950/80 px-3 py-2 ${s.border} ${s.glow}`}
              >
                <p className={`text-[11px] font-semibold ${s.text}`}>{m.title}</p>
                <p className="text-[10px] text-zinc-500 mt-0.5 leading-relaxed">{m.description}</p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
