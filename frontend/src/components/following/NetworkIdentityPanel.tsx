"use client";

import { HeatPill } from "@/components/feed/shared";
import type { NetworkProfileTag } from "./types";

const TAG_STYLES: Record<NetworkProfileTag["tone"], string> = {
  violet: "border-violet-500/25 bg-violet-500/10 text-violet-200",
  rose: "border-rose-500/25 bg-rose-500/10 text-rose-200",
  emerald: "border-emerald-500/25 bg-emerald-500/10 text-emerald-200",
  sky: "border-sky-500/25 bg-sky-500/10 text-sky-200",
  amber: "border-amber-500/25 bg-amber-500/10 text-amber-200",
  zinc: "border-zinc-700/60 bg-zinc-900/60 text-zinc-400",
};

export function NetworkIdentityPanel({ tags }: { tags: NetworkProfileTag[] }) {
  if (tags.length === 0) return null;

  return (
    <section className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-3">
      <div className="flex items-center gap-2 mb-2">
        <HeatPill tone="sky">Profile</HeatPill>
        <h2 className="text-[11px] font-semibold text-zinc-300">Your network profile</h2>
      </div>
      <p className="text-[10px] text-zinc-500 mb-2.5 leading-relaxed">
        Psychological read on the conviction graph you built — ideology, timing, and dissent
        exposure.
      </p>
      <div className="flex flex-wrap gap-1.5">
        {tags.map((tag) => (
          <span
            key={tag.label}
            className={`text-[10px] px-2 py-1 rounded-lg border font-medium ${
              TAG_STYLES[tag.tone]
            } ${tag.emphasis ? "ring-1 ring-violet-500/20" : ""}`}
          >
            {tag.label}
          </span>
        ))}
      </div>
    </section>
  );
}
