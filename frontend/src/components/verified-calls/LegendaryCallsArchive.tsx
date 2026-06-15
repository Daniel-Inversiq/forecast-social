"use client";

import Link from "next/link";
import { Avatar } from "@/components/feed/shared";
import type { EnrichedVerifiedCall } from "./types";

function LegendaryCard({ call }: { call: EnrichedVerifiedCall }) {
  return (
    <article className="legendary-archive-card relative rounded-xl border border-amber-500/20 bg-gradient-to-br from-amber-950/35 via-zinc-950/90 to-zinc-950/95 p-3.5 feed-hover-lift overflow-hidden">
      <div
        className="absolute top-2 right-2 text-[7px] font-mono uppercase tracking-widest text-amber-500/25 rotate-12 select-none"
        aria-hidden
      >
        ARCHIVED
      </div>
      <p className="text-[8px] font-mono text-amber-500/60 mb-2">{call.receipt_id}</p>
      <Link
        href={`/markets/${call.market_slug}`}
        className="text-sm font-semibold text-amber-50/95 hover:text-amber-100 leading-snug block mb-2 pr-8"
      >
        {call.market_title}
      </Link>

      <div className="flex items-center gap-2 mb-3">
        <Avatar name={call.agent_name} color={call.avatar_color} size="xs" />
        <div>
          <Link href={`/agents/${call.agent_slug}`} className="text-[11px] font-medium text-zinc-200 hover:text-white">
            {call.agent_name}
          </Link>
          <p className="text-[9px] text-zinc-600">first signal · {call.days_early}d before verification</p>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-[9px] mb-3">
        <div>
          <dt className="text-zinc-600 uppercase tracking-wider text-[7px]">Original conviction</dt>
          <dd className="text-zinc-200 tabular-nums">{Math.round(call.confidence)}%</dd>
        </div>
        <div>
          <dt className="text-zinc-600 uppercase tracking-wider text-[7px]">Isolation at entry</dt>
          <dd className="text-amber-200/90 tabular-nums">{call.isolation_score}%</dd>
        </div>
        <div>
          <dt className="text-zinc-600 uppercase tracking-wider text-[7px]">Verification delay</dt>
          <dd className="text-zinc-300 tabular-nums">{call.verification_delay_days}d</dd>
        </div>
        <div>
          <dt className="text-zinc-600 uppercase tracking-wider text-[7px]">Consensus migration</dt>
          <dd className="text-zinc-300 tabular-nums">
            {Math.round(call.consensus_at_time)}% → {Math.round(call.final_consensus)}%
          </dd>
        </div>
        <div>
          <dt className="text-zinc-600 uppercase tracking-wider text-[7px]">Reputation shift</dt>
          <dd className="text-emerald-300/90 tabular-nums">+{call.reputation_delta}</dd>
        </div>
        <div>
          <dt className="text-zinc-600 uppercase tracking-wider text-[7px]">Season memory</dt>
          <dd>
            <Link href={`/season?slug=${call.season_slug}`} className="text-amber-300/80 hover:text-amber-200">
              {call.season_title}
            </Link>
          </dd>
        </div>
      </dl>

      {(call.linked_rivalries.length > 0 || call.linked_narratives.length > 0) && (
        <div className="flex flex-wrap gap-1 pt-2 border-t border-amber-500/10">
          {call.linked_narratives.slice(0, 2).map((n) => (
            <span
              key={n}
              className="text-[8px] px-1.5 py-0.5 rounded border border-zinc-800/80 text-zinc-500"
            >
              {n}
            </span>
          ))}
          {call.linked_rivalries.map((r) => (
            <span
              key={r}
              className="text-[8px] px-1.5 py-0.5 rounded border border-violet-500/20 text-violet-400/80"
            >
              {r}
            </span>
          ))}
        </div>
      )}
    </article>
  );
}

export function LegendaryCallsArchive({ calls }: { calls: EnrichedVerifiedCall[] }) {
  const legendary = calls
    .filter((c) => c.receipt_strength === "legendary" || c.isolation_score >= 75)
    .sort((a, b) => b.reputation_delta - a.reputation_delta)
    .slice(0, 5);

  if (!legendary.length) return null;

  return (
    <section className="mb-4">
      <div className="flex items-center justify-between gap-2 mb-2 px-0.5">
        <div>
          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-400/85">
            Legendary calls
          </span>
          <p className="text-[10px] text-zinc-600 mt-0.5">Permanent receipts in the network&apos;s public memory</p>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {legendary.map((c) => (
          <LegendaryCard key={c.id} call={c} />
        ))}
      </div>
    </section>
  );
}
