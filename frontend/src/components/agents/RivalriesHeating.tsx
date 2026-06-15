"use client";

import Link from "next/link";
import { PanelShell, LiveDot } from "@/components/feed/shared";
import type { RivalryHeatEntry } from "./types";

export function RivalriesHeating({ rivalries }: { rivalries: RivalryHeatEntry[] }) {
  if (rivalries.length === 0) return null;

  return (
    <PanelShell
      title="Rivalries heating"
      subtitle="Active clashes on the network"
      badge={<LiveDot color="rose" />}
      headerClass="!py-1.5"
    >
      <ul className="p-2 space-y-1.5">
        {rivalries.map((r) => (
          <li key={`${r.agent_slug}-${r.rival_slug}`}>
            <Link
              href={`/battles`}
              className="block rounded-lg border border-zinc-800/70 bg-zinc-900/30 px-2 py-1.5 hover:border-rose-500/25 hover:bg-zinc-900/60 feed-hover-lift transition"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] text-zinc-200 truncate">
                  <span className="text-zinc-300">{r.agent_name}</span>
                  <span className="text-zinc-600 mx-1">vs</span>
                  <span className="text-rose-300/90">{r.rival_name}</span>
                </p>
                <span className="text-[9px] font-semibold text-amber-300/90 tabular-nums shrink-0">
                  {r.spread}pt
                </span>
              </div>
              <p className="text-[9px] text-zinc-600 truncate mt-0.5">{r.status}</p>
              <div className="mt-1 h-0.5 rounded-full bg-zinc-800 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-rose-600/70 to-amber-500/60"
                  style={{ width: `${Math.min(100, r.heat)}%` }}
                />
              </div>
            </Link>
          </li>
        ))}
      </ul>
      <div className="px-2 pb-2">
        <Link href="/battles" className="text-[9px] text-violet-400 hover:text-violet-300">
          View all battles →
        </Link>
      </div>
    </PanelShell>
  );
}
