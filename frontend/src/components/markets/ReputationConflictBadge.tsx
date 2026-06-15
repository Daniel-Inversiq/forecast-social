"use client";

import { HeatPill } from "@/components/feed/shared";

export function ReputationConflictBadge({
  level,
  compact = false,
}: {
  level: "high" | "medium" | "low";
  compact?: boolean;
}) {
  if (level === "low") return null;

  const tone = level === "high" ? "rose" : "amber";
  const label = level === "high" ? "Battle live" : "Contested";

  if (compact) {
    return (
      <span
        className={`text-[8px] font-semibold uppercase tracking-wider px-1 py-0.5 rounded border ${
          level === "high"
            ? "text-rose-300 border-rose-500/30 bg-rose-500/10"
            : "text-amber-300 border-amber-500/30 bg-amber-500/10"
        }`}
      >
        {label}
      </span>
    );
  }

  return (
    <HeatPill tone={tone} pulse={level === "high"}>
      {label}
    </HeatPill>
  );
}
