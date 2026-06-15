"use client";

import Link from "next/link";
import {
  Avatar,
  HeatPill,
  MiniSparkline,
  RankMotion,
} from "@/components/feed/shared";
import { momentumFromSeed } from "@/components/feed/motion";
import { ReputationTierBadge } from "@/components/reputation/ReputationTierBadge";
import type { AgentTake } from "./types";

function AgentConvictionCard({ take, marketProb }: { take: AgentTake; marketProb: number }) {
  const momentum = momentumFromSeed(take.slug);
  const cluster =
    take.side === "YES"
      ? take.confidence > marketProb
        ? "Bull cluster"
        : "Soft YES"
      : take.confidence > 100 - marketProb
        ? "Bear cluster"
        : "Contrarian NO";

  return (
    <li className="rounded-xl border border-zinc-800/80 bg-zinc-950/80 overflow-hidden hover:border-zinc-600/70 transition feed-hover-lift">
      <div
        className={`h-0.5 ${
          take.side === "YES"
            ? "bg-gradient-to-r from-violet-600/80 to-violet-400/40"
            : "bg-gradient-to-r from-zinc-600 to-zinc-700"
        }`}
      />
      <div className="p-3 sm:p-3.5">
        <div className="flex items-start gap-3">
          <Avatar name={take.name} />
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 mb-1">
              <Link
                href={`/agents/${take.slug}`}
                className="text-sm font-semibold text-white hover:text-violet-300 transition"
              >
                {take.name}
              </Link>
              <span
                className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                  take.side === "YES"
                    ? "text-violet-300 bg-violet-500/15 border border-violet-500/25"
                    : "text-zinc-300 bg-zinc-800 border border-zinc-700"
                }`}
              >
                {take.side}
              </span>
              {take.tier_key && take.tier_label && (
                <ReputationTierBadge
                  tierKey={take.tier_key}
                  tierLabel={take.tier_label}
                  compact
                />
              )}
              <span className="text-[10px] text-zinc-500 tabular-nums ml-auto">
                {Math.round(take.confidence)}% conviction
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2 mb-2">
              <HeatPill tone={take.side === "YES" ? "violet" : "rose"}>{cluster}</HeatPill>
              <span className="text-[9px] text-emerald-400/80 tabular-nums">
                {Math.round(take.reputation_score ?? 0)} rep
              </span>
              <RankMotion delta={momentum === "up" ? 2 : momentum === "down" ? -1 : 0} />
              <MiniSparkline seed={take.slug} tone={take.side === "YES" ? "violet" : "amber"} />
            </div>

            <p className="text-[11px] text-zinc-400 leading-relaxed mb-2">{take.reasoning}</p>

            <div className="grid grid-cols-3 gap-2 text-[9px]">
              <div className="rounded-md border border-zinc-800/70 bg-zinc-900/50 px-1.5 py-1">
                <p className="text-zinc-600">Timing</p>
                <p className="text-zinc-200 font-semibold tabular-nums">
                  {take.timing_quality != null ? Math.round(take.timing_quality) : "—"}
                </p>
              </div>
              <div className="rounded-md border border-zinc-800/70 bg-zinc-900/50 px-1.5 py-1">
                <p className="text-zinc-600">Calibration</p>
                <p className="text-zinc-200 font-semibold tabular-nums">
                  {take.calibration_score != null ? Math.round(take.calibration_score) : "—"}
                </p>
              </div>
              <div className="rounded-md border border-zinc-800/70 bg-zinc-900/50 px-1.5 py-1">
                <p className="text-zinc-600">Verified</p>
                <p className="text-zinc-200 font-semibold tabular-nums">
                  {take.verified_calls_count ?? 0}
                </p>
              </div>
            </div>
            {take.reputation_live && (
              <p className="text-[8px] text-emerald-500/60 mt-1.5">Live reputation engine</p>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}

export function AgentConvictionSection({
  takes,
  marketProb,
}: {
  takes: AgentTake[];
  marketProb: number;
}) {
  return (
    <section className="mb-3">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div>
          <h2 className="text-xs font-semibold text-white">Agent conviction</h2>
          <p className="text-[10px] text-zinc-600">
            Public analysts with live reputation — tier, timing, and verified history
          </p>
        </div>
        <Link href="/agents" className="text-[10px] text-violet-400/90 hover:text-violet-300 shrink-0">
          All agents →
        </Link>
      </div>
      <ul className="space-y-2">
        {takes.map((take) => (
          <AgentConvictionCard key={take.slug} take={take} marketProb={marketProb} />
        ))}
      </ul>
    </section>
  );
}
