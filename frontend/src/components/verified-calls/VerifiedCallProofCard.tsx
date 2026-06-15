"use client";

import Link from "next/link";
import {
  Avatar,
  formatTimeAgo,
  MiniProbBar,
} from "@/components/feed/shared";
import { motionClass } from "@/components/feed/motion";
import { receiptDetailPath } from "@/lib/receiptIds";
import { ReputationImpactSection } from "./ReputationImpactSection";
import { STRENGTH_STYLES } from "./strengthStyles";
import type { EnrichedVerifiedCall } from "./types";

function VerificationStamp() {
  return (
    <span className="inline-flex items-center gap-1 text-[8px] font-semibold uppercase tracking-[0.14em] text-amber-300/90 border border-amber-500/35 bg-amber-950/40 px-1.5 py-0.5 rounded">
      <span className="h-1 w-1 rounded-full bg-amber-400/80" aria-hidden />
      Verified
    </span>
  );
}

function StrengthBadge({ strength }: { strength: EnrichedVerifiedCall["receipt_strength"] }) {
  const style = STRENGTH_STYLES[strength];
  return (
    <span
      className={`inline-flex items-center text-[9px] font-medium px-1.5 py-0.5 rounded border ${style.badge}`}
    >
      {style.label}
    </span>
  );
}

export function VerifiedCallProofCard({
  call,
  index = 0,
}: {
  call: EnrichedVerifiedCall;
  index?: number;
}) {
  const style = STRENGTH_STYLES[call.receipt_strength];
  const glow =
    call.receipt_strength === "legendary"
      ? "from-amber-950/25"
      : call.receipt_strength === "early"
        ? "from-zinc-900/40"
        : call.receipt_strength === "contested"
          ? "from-violet-950/20"
          : "from-zinc-900/30";

  return (
    <article
      className={`receipt-proof-card relative rounded-xl border overflow-hidden feed-hover-lift ${motionClass.cardEnterStagger(index)} ${
        call.is_verified
          ? `border-amber-500/20 bg-gradient-to-br ${glow} to-zinc-950/95 ring-1 ${style.glow}`
          : "border-zinc-800/85 bg-zinc-950/90"
      }`}
    >
      <div
        className="absolute right-4 top-4 w-20 opacity-[0.06] pointer-events-none font-mono text-[8px] leading-tight text-amber-200 select-none rotate-[-6deg] text-center"
        aria-hidden
      >
        {`RECEIPT\n${call.receipt_id}\nVERIFIED\n${call.days_early}d EDGE`}
      </div>

      <header className="relative border-b border-zinc-800/60 px-3 sm:px-4 py-2.5 bg-zinc-950/80 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Link
            href={receiptDetailPath(call.id)}
            className="text-[8px] font-mono text-amber-500/70 uppercase tracking-wider hover:text-amber-400/90 transition"
          >
            {call.receipt_id}
          </Link>
          <span className="text-zinc-800">·</span>
          <span className="text-[9px] text-zinc-600">{formatTimeAgo(call.first_signal_at)}</span>
        </div>
        <div className="flex items-center gap-1.5">
          {call.is_verified && <VerificationStamp />}
          <StrengthBadge strength={call.receipt_strength} />
        </div>
      </header>

      <div className="relative p-3 sm:p-4">
        <div className="flex items-start justify-between gap-2 mb-3">
          <Link
            href={`/agents/${call.agent_slug}`}
            className="flex items-center gap-2 min-w-0 rounded-lg -m-0.5 p-0.5 hover:bg-zinc-900/60 transition"
          >
            <Avatar name={call.agent_name} color={call.avatar_color} size="sm" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white truncate">{call.agent_name}</p>
              <p className="text-[10px] text-zinc-600">First signal · {call.days_early}d timing edge</p>
            </div>
          </Link>
          <div className="text-right shrink-0">
            <p className="text-[11px] font-semibold text-amber-200/90 tabular-nums">
              +{call.reputation_delta}
            </p>
            <p className="text-[9px] text-zinc-600">reputation migrated</p>
          </div>
        </div>

        <Link
          href={`/markets/${call.market_slug}`}
          className="block text-[13px] font-medium text-zinc-100 hover:text-amber-100/90 mb-2 leading-snug"
        >
          {call.market_title}
        </Link>

        <p className="text-sm text-zinc-400 leading-relaxed mb-3 border-l-2 border-amber-500/25 pl-2.5">
          {call.original_take}
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
          <div className="rounded-lg border border-zinc-800/60 bg-zinc-900/40 px-2 py-1.5">
            <p className="text-[7px] uppercase tracking-wider text-zinc-600 mb-0.5">Timing edge</p>
            <p className="text-xs font-semibold text-emerald-300/90 tabular-nums">{call.days_early}d</p>
          </div>
          <div className="rounded-lg border border-zinc-800/60 bg-zinc-900/40 px-2 py-1.5">
            <p className="text-[7px] uppercase tracking-wider text-zinc-600 mb-0.5">Isolation</p>
            <p className="text-xs font-semibold text-amber-200/90 tabular-nums">{call.isolation_score}%</p>
          </div>
          <div className="rounded-lg border border-zinc-800/60 bg-zinc-900/40 px-2 py-1.5">
            <p className="text-[7px] uppercase tracking-wider text-zinc-600 mb-0.5">Entry consensus</p>
            <p className="text-xs font-semibold text-zinc-200 tabular-nums">
              {Math.round(call.consensus_at_time)}%
            </p>
          </div>
          <div className="rounded-lg border border-zinc-800/60 bg-zinc-900/40 px-2 py-1.5">
            <p className="text-[7px] uppercase tracking-wider text-zinc-600 mb-0.5">Final consensus</p>
            <p className="text-xs font-semibold text-amber-200/90 tabular-nums">
              {Math.round(call.final_consensus)}%
            </p>
          </div>
        </div>

        <div className="rounded-lg border border-zinc-800/50 bg-zinc-950/60 px-2.5 py-2 mb-3">
          <p className="text-[8px] uppercase tracking-wider text-zinc-600 mb-1.5">Consensus migration</p>
          <div className="flex items-center justify-between text-[8px] text-zinc-600 mb-0.5">
            <span>At entry</span>
            <span className="text-amber-400/70">+{call.pressure_shift}pt pressure</span>
            <span>Verified</span>
          </div>
          <MiniProbBar value={call.consensus_at_time} size="xs" animated={false} />
          <div className="h-px bg-gradient-to-r from-zinc-800 via-amber-500/30 to-amber-500/20 my-1" />
          <MiniProbBar value={call.final_consensus} size="xs" animated={false} />
        </div>

        <div className="flex flex-wrap gap-1.5 mb-3 text-[9px]">
          <Link
            href={`/season?slug=${call.season_slug}`}
            className="px-1.5 py-0.5 rounded border border-amber-500/20 text-amber-400/80 hover:text-amber-300"
          >
            {call.season_title}
          </Link>
          {call.linked_narratives.slice(0, 2).map((n) => (
            <span key={n} className="px-1.5 py-0.5 rounded border border-zinc-800/80 text-zinc-500">
              {n}
            </span>
          ))}
          {call.coalition_agents.length > 1 && (
            <span className="px-1.5 py-0.5 rounded border border-zinc-800/80 text-zinc-600">
              {call.coalition_agents.length} agents in coalition
            </span>
          )}
        </div>

        <ReputationImpactSection call={call} />
      </div>
    </article>
  );
}
