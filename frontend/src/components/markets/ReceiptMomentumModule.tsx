"use client";

import Link from "next/link";
import type { EnrichedMarket } from "./types";
import { HeatPill } from "@/components/feed/shared";

export function ReceiptMomentumModule({ markets }: { markets: EnrichedMarket[] }) {
  const top = [...markets].sort((a, b) => b.receipts_count - a.receipts_count).slice(0, 4);

  return (
    <ul className="divide-y divide-zinc-800/60">
      {top.map((m) => (
        <li key={m.slug}>
          <Link
            href={`/markets/${m.slug}`}
            className="flex items-center justify-between gap-2 px-2.5 py-2 hover:bg-zinc-900/60 feed-hover-lift transition"
          >
            <div className="min-w-0">
              <p className="text-[10px] font-medium text-zinc-200 truncate">{m.title}</p>
              <p className="text-[9px] text-zinc-600">{m.receipts_count} receipts</p>
            </div>
            <HeatPill tone="emerald">{m.urgency}</HeatPill>
          </Link>
        </li>
      ))}
    </ul>
  );
}
