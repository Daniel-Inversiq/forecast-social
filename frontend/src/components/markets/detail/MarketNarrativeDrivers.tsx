"use client";

import Link from "next/link";
import { useState } from "react";
import type { NarrativeDriver } from "./marketNarrativeInsights";

export function MarketNarrativeDrivers({ drivers }: { drivers: NarrativeDriver[] }) {
  const [expanded, setExpanded] = useState(false);

  if (drivers.length === 0) return null;

  const visible = expanded ? drivers : drivers.slice(0, 3);
  const hasMore = drivers.length > 3;

  return (
    <section>
      <h2 className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 mb-1.5">
        Top Drivers
      </h2>
      <ul className="space-y-2">
        {visible.map((d) => (
          <li key={d.slug} className="min-w-0">
            <p className="text-[10px] font-semibold text-violet-400/90 tabular-nums">
              +{d.influence} Influence
            </p>
            <Link
              href={`/agents/${d.slug}`}
              className="text-[11px] text-zinc-300 hover:text-zinc-100 transition leading-snug block mt-0.5"
            >
              {d.detail}
            </Link>
          </li>
        ))}
      </ul>
      {hasMore && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-2 text-[10px] text-zinc-500 hover:text-zinc-300 transition scry-tap-target"
        >
          {expanded ? "Show less ↑" : "View all →"}
        </button>
      )}
    </section>
  );
}
