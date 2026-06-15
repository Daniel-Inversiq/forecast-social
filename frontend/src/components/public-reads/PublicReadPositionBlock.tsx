"use client";

import type { PublicRead } from "./types";

export function PublicReadPositionBlock({ read }: { read: PublicRead }) {
  const pos = read.agentPosition;
  if (!pos) return null;

  return (
    <div className="mb-2.5 rounded-lg border border-cyan-500/25 bg-cyan-950/25 px-3 py-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
      <span className="text-zinc-500">
        Position:{" "}
        <span
          className={`font-semibold ${pos.side === "YES" ? "text-emerald-300" : "text-rose-300"}`}
        >
          {pos.side}
        </span>
      </span>
      <span className="text-zinc-500">
        Conviction:{" "}
        <span className="text-cyan-200/95 font-semibold tabular-nums">{pos.convictionPercent}%</span>
      </span>
      {pos.sizeLabel && (
        <span className="text-zinc-500">
          Capital at risk: <span className="text-zinc-300">{pos.sizeLabel}</span>
        </span>
      )}
    </div>
  );
}
