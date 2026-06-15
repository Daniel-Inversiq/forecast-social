"use client";

import Link from "next/link";
import type { SeasonShift } from "@/lib/season";
import type { EraAtmosphere } from "./seasonEraStyles";
import { getEraAtmosphere } from "./seasonEraStyles";

const SHIFT_TONES: Record<string, string> = {
  repricing: "border-violet-500/20 text-violet-300/90",
  narrative_shift: "border-amber-500/20 text-amber-300/90",
  forecaster_lead: "border-emerald-500/20 text-emerald-300/90",
  verified_call: "border-amber-500/20 text-amber-300/90",
  reputation_collapse: "border-rose-500/20 text-rose-300/90",
  narrative_peak: "border-sky-500/20 text-sky-300/90",
};

export function SeasonTimeline({
  shifts,
  era: eraProp,
}: {
  shifts: SeasonShift[];
  era?: EraAtmosphere;
}) {
  const era = eraProp ?? getEraAtmosphere("macro");

  if (shifts.length === 0) {
    return (
      <p className="text-[11px] text-zinc-600 py-6 text-center">No regime shifts recorded yet.</p>
    );
  }

  return (
    <ol className={`relative border-l ml-3 space-y-5 pl-5 ${era.railTint}`}>
      {shifts.map((shift, i) => {
        const tone = SHIFT_TONES[shift.shift_type] ?? "border-zinc-700 text-zinc-400";
        const date = shift.occurred_at
          ? new Date(shift.occurred_at).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
            })
          : null;
        return (
          <li key={`${shift.title}-${i}`} className="relative">
            <span
              className={`absolute -left-[23px] top-2 h-2.5 w-2.5 rounded-full ring-4 ring-zinc-950 ${era.phaseMarker}`}
            />
            <div className="rounded-xl border border-zinc-800/70 bg-zinc-950/60 px-3.5 py-3 feed-hover-lift">
              <div className="flex flex-wrap items-center gap-2 mb-1.5">
                <span className="text-[8px] uppercase tracking-wider text-zinc-600">Historical event</span>
                <span className={`text-[8px] uppercase tracking-wider px-1.5 py-0.5 rounded border ${tone}`}>
                  {shift.shift_type.replace(/_/g, " ")}
                </span>
                {date && <span className="text-[9px] text-zinc-600 tabular-nums ml-auto">{date}</span>}
              </div>
              <p className="text-[13px] font-medium text-zinc-100 leading-snug">{shift.title}</p>
              <p className="text-[11px] text-zinc-500 mt-1 leading-relaxed">{shift.body}</p>
              {shift.agent_slug && (
                <Link
                  href={`/agents/${shift.agent_slug}`}
                  className={`text-[10px] hover:underline mt-2 inline-block ${era.accentText}`}
                >
                  View forecaster →
                </Link>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
