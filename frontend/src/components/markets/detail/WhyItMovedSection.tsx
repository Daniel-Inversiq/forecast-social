"use client";

import Link from "next/link";
import { useMemo } from "react";
import { formatTimeAgo } from "@/components/feed/shared";
import { WhyMarketMovingPanel } from "./WhyMarketMovingPanel";
import type { ActivityItem, EnrichedMarketDetail } from "./types";

type DriverKind = "receipt" | "battle" | "take" | "shift";

const DRIVER_META: Record<DriverKind, { label: string; cls: string }> = {
  receipt: { label: "Receipt", cls: "text-emerald-300 border-emerald-500/25 bg-emerald-500/10" },
  battle: { label: "Battle", cls: "text-rose-300 border-rose-500/25 bg-rose-500/10" },
  take: { label: "Take", cls: "text-violet-300 border-violet-500/25 bg-violet-500/10" },
  shift: { label: "Shift", cls: "text-sky-300 border-sky-500/25 bg-sky-500/10" },
};

function driverKind(item: ActivityItem): DriverKind {
  if (item.type === "receipt" || item.type === "verified_call") return "receipt";
  if (item.type === "rivalry" || item.type === "battle_escalation") return "battle";
  if (item.type === "confidence_shift" || item.type === "consensus_shift") return "shift";
  return "take";
}

/** Most recent agent/receipt/battle events behind the price action. */
export function pickRecentDrivers(activity: ActivityItem[], limit = 4): ActivityItem[] {
  return [...activity]
    .sort((a, b) => Date.parse(b.created_at ?? "") - Date.parse(a.created_at ?? ""))
    .slice(0, limit);
}

export function WhyItMovedSection({ market }: { market: EnrichedMarketDetail }) {
  const drivers = useMemo(
    () => pickRecentDrivers(market.recent_activity ?? []),
    [market.recent_activity],
  );

  if (!market.why_moving && drivers.length === 0) return null;

  return (
    <section className="mb-4" aria-labelledby="why-moved-heading">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="why-moved-heading" className="text-[13px] font-bold text-zinc-200">
          Why it moved
        </h2>
        <span className="text-[10px] text-zinc-600">
          Agents, receipts, and battles behind the price
        </span>
      </div>

      {market.why_moving && <WhyMarketMovingPanel why={market.why_moving} />}

      {drivers.length > 0 && (
        <ul className="mt-2 rounded-lg border border-zinc-800/70 bg-zinc-950/60 divide-y divide-zinc-800/50">
          {drivers.map((item, i) => {
            const kind = driverKind(item);
            const meta = DRIVER_META[kind];
            return (
              <li key={`${item.agent_slug}-${item.created_at}-${i}`} className="px-3 py-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className={`text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border shrink-0 ${meta.cls}`}
                  >
                    {meta.label}
                  </span>
                  <Link
                    href={`/agents/${item.agent_slug}`}
                    className="text-[11px] font-semibold text-zinc-200 hover:text-white truncate"
                  >
                    {item.agent_name}
                  </Link>
                  {item.probability != null && (
                    <span className="text-[10px] tabular-nums text-zinc-500 shrink-0">
                      → {Math.round(item.probability)}%
                    </span>
                  )}
                  <span className="text-[9px] text-zinc-600 ml-auto shrink-0">
                    {formatTimeAgo(item.created_at, true)}
                  </span>
                </div>
                <p className="text-[10px] text-zinc-500 leading-snug mt-1 line-clamp-1">
                  {item.title}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
