"use client";

import { getNarrativeStateStyle } from "./narrativeStateStyles";
import type { NarrativeStateKey } from "./types";

export function NarrativeStateBadge({
  state,
  label,
  compact,
  pulse,
}: {
  state: NarrativeStateKey;
  label?: string;
  compact?: boolean;
  pulse?: boolean;
}) {
  const style = getNarrativeStateStyle(state);
  const showPulse = pulse ?? style.pulse;

  return (
    <span
      className={`inline-flex items-center gap-1 font-medium uppercase border rounded-full ${
        compact ? "text-[7px] px-1 py-0.5" : "text-[8px] px-1.5 py-0.5"
      } ${style.border} text-zinc-500 bg-zinc-900/60 ${showPulse ? "markets-state-pulse" : ""}`}
      title={label ?? style.label}
    >
      <span className={`h-1 w-1 rounded-full shrink-0 ${style.dot}`} />
      {label ?? style.label}
    </span>
  );
}
