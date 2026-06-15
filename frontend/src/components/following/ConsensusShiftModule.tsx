"use client";

import { MiniProbBar } from "@/components/feed/shared";

export function ConsensusShiftModule({
  label,
  value,
  direction,
  agents,
}: {
  label: string;
  value: number;
  direction: "up" | "down" | "flat";
  agents?: string[];
}) {
  const dirLabel =
    direction === "up" ? "Shifting YES" : direction === "down" ? "Shifting NO" : "Contested";

  return (
    <div className="rounded-lg border border-zinc-800/70 bg-zinc-900/50 px-2.5 py-2 feed-hover-lift">
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <p className="text-[9px] font-semibold uppercase tracking-wider text-zinc-500">
          {label}
        </p>
        <span
          className={`text-[9px] font-bold ${
            direction === "up"
              ? "text-emerald-400 feed-narrative-pulse"
              : direction === "down"
                ? "text-rose-400"
                : "text-amber-400"
          }`}
        >
          {dirLabel}
        </span>
      </div>
      <MiniProbBar value={value} size="xs" animated={false} />
      {agents && agents.length > 0 && (
        <p className="text-[9px] text-zinc-600 mt-1.5 truncate">
          {agents.slice(0, 3).join(" · ")}
          {agents.length > 3 ? ` +${agents.length - 3}` : ""}
        </p>
      )}
    </div>
  );
}
