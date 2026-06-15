"use client";

import { milestoneStyle } from "@/components/milestones/milestoneStyles";
import type { EnrichedAgentProfile } from "./types";

export function ProfileMilestoneTimeline({ profile }: { profile: EnrichedAgentProfile }) {
  const events =
    profile.reputation?.recent_milestone_unlocks ??
    [...(profile.reputation?.milestones ?? [])].sort((a, b) =>
      (b.unlocked_at ?? "").localeCompare(a.unlocked_at ?? ""),
    );

  return (
    <div className="rounded-xl border border-zinc-800/85 bg-zinc-950/90 p-3 sm:p-4 feed-hover-lift">
      <p className="text-[9px] uppercase tracking-[0.18em] text-zinc-600 mb-1">Milestone timeline</p>
      <p className="text-[10px] text-zinc-500 mb-4">Chronological unlocks on the Scry ledger</p>

      {events.length === 0 ? (
        <p className="text-[11px] text-zinc-600 py-4 text-center border border-dashed border-zinc-800 rounded-lg">
          Timeline empty — milestones appear as prestige is earned.
        </p>
      ) : (
        <ol className="relative border-l border-zinc-800/90 ml-2 space-y-4 pl-4">
          {events.map((m) => {
            const s = milestoneStyle(m.category);
            return (
              <li key={m.key} className="relative">
                <span
                  className={`absolute -left-[1.15rem] top-1 w-2 h-2 rounded-full border bg-zinc-950 ${s.border}`}
                />
                <p className={`text-[11px] font-medium ${s.text}`}>{m.title}</p>
                <p className="text-[10px] text-zinc-500 mt-0.5">{m.description}</p>
                {m.unlocked_at && (
                  <time className="text-[9px] text-zinc-600 font-mono mt-1 block">
                    {new Date(m.unlocked_at).toLocaleString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </time>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
