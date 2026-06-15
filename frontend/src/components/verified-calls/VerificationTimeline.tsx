"use client";

import Link from "next/link";
import { Avatar, formatTimeAgo } from "@/components/feed/shared";
import { TIMELINE_PHASE_LABELS } from "./verifiedCallEnrichment";
import type { EnrichedVerifiedCall, TimelinePhase } from "./types";

function PhaseTrack({ phases, activeIndex }: { phases: TimelinePhase[]; activeIndex: number }) {
  return (
    <div className="flex items-center gap-0.5 overflow-x-auto scrollbar-none py-1">
      {phases.map((p, i) => {
        const done = i <= activeIndex;
        const current = i === activeIndex;
        return (
          <div key={p} className="flex items-center shrink-0">
            <span
              className={`text-[7px] uppercase tracking-wide px-1 py-0.5 rounded whitespace-nowrap ${
                current
                  ? "bg-amber-500/20 text-amber-200 border border-amber-500/30"
                  : done
                    ? "text-zinc-500"
                    : "text-zinc-700"
              }`}
            >
              {TIMELINE_PHASE_LABELS[p]}
            </span>
            {i < phases.length - 1 && (
              <span className={`w-2 h-px mx-0.5 ${done ? "bg-amber-500/40" : "bg-zinc-800"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function TimelineEntry({ call }: { call: EnrichedVerifiedCall }) {
  const activeIndex = call.timeline_phases.indexOf("verified");

  return (
    <article className="rounded-xl border border-zinc-800/80 bg-zinc-950/70 p-3 feed-hover-lift">
      <div className="flex items-start justify-between gap-2 mb-2">
        <Link href={`/agents/${call.agent_slug}`} className="flex items-center gap-2 min-w-0">
          <Avatar name={call.agent_name} color={call.avatar_color} size="xs" />
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-zinc-200 truncate">{call.agent_name}</p>
            <p className="text-[9px] text-zinc-600">first signal · {formatTimeAgo(call.first_signal_at)}</p>
          </div>
        </Link>
        <span className="text-[8px] font-mono text-amber-500/70 shrink-0">{call.receipt_id}</span>
      </div>

      <Link
        href={`/markets/${call.market_slug}`}
        className="text-[12px] font-medium text-white hover:text-amber-100/90 block mb-1.5"
      >
        {call.market_title}
      </Link>
      <p className="text-[10px] text-zinc-500 italic line-clamp-2 mb-2">&ldquo;{call.original_take}&rdquo;</p>

      <PhaseTrack phases={call.timeline_phases} activeIndex={activeIndex >= 0 ? activeIndex : call.timeline_phases.length - 1} />

      <div className="mt-2.5 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[9px]">
        <div>
          <p className="text-zinc-600 uppercase tracking-wider text-[7px] mb-0.5">Entry consensus</p>
          <p className="text-zinc-300 tabular-nums">{Math.round(call.consensus_at_time)}%</p>
        </div>
        <div>
          <p className="text-zinc-600 uppercase tracking-wider text-[7px] mb-0.5">At verification</p>
          <p className="text-amber-200/90 tabular-nums">{Math.round(call.final_consensus)}%</p>
        </div>
        <div>
          <p className="text-zinc-600 uppercase tracking-wider text-[7px] mb-0.5">Timing delta</p>
          <p className="text-emerald-300/90 tabular-nums">{call.days_early}d</p>
        </div>
        <div>
          <p className="text-zinc-600 uppercase tracking-wider text-[7px] mb-0.5">Reputation</p>
          <p className="text-amber-200/90 tabular-nums">+{call.reputation_delta}</p>
        </div>
      </div>

      {call.amplifiers.length > 0 && (
        <p className="text-[9px] text-zinc-600 mt-2">
          Amplified by{" "}
          {call.amplifiers.map((a, i) => (
            <span key={a.slug}>
              {i > 0 && ", "}
              <Link href={`/agents/${a.slug}`} className="text-zinc-400 hover:text-amber-200/80">
                {a.name}
              </Link>
            </span>
          ))}
          {call.downstream_battles > 0 && (
            <span className="text-zinc-700"> · {call.downstream_battles} downstream battles</span>
          )}
        </p>
      )}
    </article>
  );
}

export function VerificationTimeline({ calls }: { calls: EnrichedVerifiedCall[] }) {
  const featured = [...calls]
    .filter((c) => c.is_verified)
    .sort((a, b) => b.days_early * b.verification_velocity - a.days_early * a.verification_velocity)
    .slice(0, 4);

  return (
    <section className="mb-4">
      <div className="flex items-center gap-2 mb-2 px-0.5">
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-400/80">
          Live verification timeline
        </span>
        <span className="h-px flex-1 bg-gradient-to-r from-amber-900/40 to-transparent" />
      </div>
      <div className="space-y-2.5">
        {featured.map((c) => (
          <TimelineEntry key={c.id} call={c} />
        ))}
      </div>
    </section>
  );
}
