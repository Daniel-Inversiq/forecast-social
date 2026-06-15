"use client";

import Link from "next/link";
import type { EnrichedVerifiedCall } from "./types";

type TimingModule = {
  id: string;
  label: string;
  call: EnrichedVerifiedCall;
  metric: string;
  sub: string;
};

function buildTimingModules(calls: EnrichedVerifiedCall[]): TimingModule[] {
  if (!calls.length) return [];

  const earliest = [...calls].sort((a, b) => b.days_early - a.days_early)[0];
  const isolated = [...calls].sort((a, b) => b.isolation_score - a.isolation_score)[0];
  const conviction = [...calls].sort((a, b) => b.confidence - a.confidence)[0];
  const reversal = [...calls].sort((a, b) => b.pressure_shift - a.pressure_shift)[0];
  const slowBurn = [...calls]
    .filter((c) => c.days_early >= 14)
    .sort((a, b) => b.narrative_resistance - a.narrative_resistance)[0];
  const highConv = [...calls]
    .filter((c) => c.confidence >= 85)
    .sort((a, b) => b.reputation_delta - a.reputation_delta)[0];

  const modules: (TimingModule | null)[] = [
    earliest && {
      id: "earliest",
      label: "Earliest verified",
      call: earliest,
      metric: `${earliest.days_early}d before repricing`,
      sub: `Rep density at entry: ${earliest.rep_density_at_entry}%`,
    },
    isolated && {
      id: "isolated",
      label: "Strongest isolated timing",
      call: isolated,
      metric: `${isolated.isolation_score}% isolation`,
      sub: `Narrative resistance: ${isolated.narrative_resistance}%`,
    },
    conviction && {
      id: "risk",
      label: "Highest-risk conviction",
      call: conviction,
      metric: `${Math.round(conviction.confidence)}% conviction`,
      sub: `${Math.round(conviction.consensus_at_time)}% consensus against`,
    },
    reversal && {
      id: "reversal",
      label: "Fastest consensus reversal",
      call: reversal,
      metric: `${reversal.pressure_shift}pt shift`,
      sub: `Verification velocity: ${reversal.verification_velocity}`,
    },
    slowBurn && {
      id: "slow",
      label: "Slow-burn thesis winner",
      call: slowBurn,
      metric: `${slowBurn.days_early}d thesis arc`,
      sub: slowBurn.season_title,
    },
    highConv && {
      id: "high",
      label: "High-conviction verified",
      call: highConv,
      metric: `+${highConv.reputation_delta} rep`,
      sub: highConv.market_title,
    },
  ];

  return modules.filter(Boolean) as TimingModule[];
}

export function TimingEdgeAnalysis({ calls }: { calls: EnrichedVerifiedCall[] }) {
  const modules = buildTimingModules(calls);
  if (!modules.length) return null;

  return (
    <section className="mb-4 rounded-xl border border-zinc-800/80 bg-zinc-950/40 p-3">
      <div className="mb-2.5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-400">
          Timing edge analysis
        </p>
        <p className="text-[10px] text-zinc-600 mt-0.5">
          Being early matters more than merely being correct
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {modules.map((m) => (
          <Link
            key={m.id}
            href={`/markets/${m.call.market_slug}`}
            className="rounded-lg border border-zinc-800/70 bg-zinc-900/40 px-2.5 py-2 feed-hover-lift hover:border-amber-500/25 transition"
          >
            <p className="text-[8px] uppercase tracking-wider text-zinc-600 mb-1">{m.label}</p>
            <p className="text-[11px] font-semibold text-zinc-100">{m.metric}</p>
            <p className="text-[9px] text-zinc-500 mt-0.5 truncate">{m.call.agent_name}</p>
            <p className="text-[9px] text-zinc-600 truncate">{m.sub}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
