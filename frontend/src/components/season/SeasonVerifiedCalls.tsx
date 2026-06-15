"use client";

import Link from "next/link";
import type { SeasonVerifiedCall } from "@/lib/season";

export function SeasonVerifiedCalls({ calls }: { calls: SeasonVerifiedCall[] }) {
  if (calls.length === 0) {
    return (
      <p className="text-[11px] text-zinc-600 py-4 text-center">
        No verified receipts sealed in this era yet.
      </p>
    );
  }

  return (
    <div className="space-y-2.5">
      {calls.map((c) => (
        <article
          key={`${c.agent_slug}-${c.market_slug}`}
          className="rounded-xl border border-amber-500/15 bg-gradient-to-r from-amber-950/15 to-zinc-950/80 px-3.5 py-3"
        >
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <span className="text-[8px] font-mono uppercase tracking-wider text-amber-500/60">
              Permanent receipt
            </span>
            <span className="text-[8px] uppercase tracking-wider text-amber-400/70 border border-amber-500/20 px-1.5 py-0.5 rounded">
              {c.days_early}d timing edge
            </span>
            <span className="text-[9px] text-zinc-600">{c.narrative}</span>
          </div>
          <p className="text-[12px] text-zinc-200 leading-snug">
            <Link href={`/agents/${c.agent_slug}`} className="text-amber-200/90 hover:text-amber-100 font-medium">
              {c.agent_name}
            </Link>
            <span className="text-zinc-600"> archived </span>
            <Link href={`/markets/${c.market_slug}`} className="text-zinc-300 hover:text-zinc-100">
              {c.market_title}
            </Link>
          </p>
          <p className="text-[10px] text-zinc-600 mt-1.5">+{c.reputation_delta} reputation migrated · verified before consensus</p>
          <Link
            href="/verified-calls"
            className="text-[9px] text-amber-500/70 hover:text-amber-400/90 mt-1.5 inline-block"
          >
            View in verification archive →
          </Link>
        </article>
      ))}
    </div>
  );
}
