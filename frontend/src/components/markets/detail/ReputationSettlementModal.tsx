"use client";

import Link from "next/link";
import { MilestoneBadge } from "@/components/milestones/MilestoneBadge";
import type { UserSettlement } from "@/lib/resolution";

export function ReputationSettlementModal({
  settlement,
  onClose,
}: {
  settlement: UserSettlement;
  onClose: () => void;
}) {
  const won = settlement.correct;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      role="dialog"
      aria-modal
      aria-labelledby="settlement-title"
    >
      <div className="relative w-full max-w-md rounded-xl border border-zinc-700/80 bg-zinc-950 shadow-2xl overflow-hidden">
        <div
          className={`h-1 w-full ${won ? "bg-gradient-to-r from-emerald-500 to-violet-500" : "bg-gradient-to-r from-rose-500 to-zinc-700"}`}
        />
        <div className="p-5">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-3 right-3 text-zinc-500 hover:text-zinc-300 text-lg leading-none"
            aria-label="Close"
          >
            ×
          </button>

          <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">
            Reputation settlement
          </p>
          <h2 id="settlement-title" className="text-lg font-semibold text-white pr-6">
            {won ? "You called it" : "Market resolved against you"}
          </h2>
          <p className="text-[11px] text-zinc-500 mt-1 line-clamp-2">{settlement.market_title}</p>

          <div className="grid grid-cols-2 gap-3 mt-4">
            <StatBox
              label="Your side"
              value={settlement.side}
              tone={won ? "emerald" : "rose"}
            />
            <StatBox label="Outcome" value={settlement.outcome} tone="zinc" />
            <StatBox
              label="Reputation"
              value={`${settlement.reputation_delta >= 0 ? "+" : ""}${settlement.reputation_delta}`}
              tone={won ? "emerald" : "rose"}
            />
            <StatBox
              label="Calibration"
              value={`${(settlement.calibration_before * 100).toFixed(0)}% → ${(settlement.calibration_after * 100).toFixed(0)}%`}
              tone="violet"
            />
          </div>

          {settlement.milestones_unlocked.length > 0 && (
            <div className="mt-4 pt-4 border-t border-zinc-800/60">
              <p className="text-[10px] uppercase tracking-wider text-zinc-600 mb-2">
                Milestones unlocked
              </p>
              <div className="flex flex-wrap gap-2">
                {settlement.milestones_unlocked.map((m) => (
                  <MilestoneBadge key={m.key} title={m.title} category="timing" compact />
                ))}
              </div>
            </div>
          )}

          <p className="text-[10px] text-zinc-600 mt-4">
            {settlement.days_early} days before resolution · ${settlement.amount} conviction
          </p>

          <div className="flex gap-2 mt-5">
            <Link
              href={`/markets/${settlement.market_slug}`}
              className="flex-1 text-center text-[11px] py-2 rounded-lg border border-zinc-700 text-zinc-300 hover:bg-zinc-900 transition"
              onClick={onClose}
            >
              View archive
            </Link>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 text-[11px] py-2 rounded-lg bg-violet-600/90 text-white hover:bg-violet-500 transition"
            >
              Continue
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatBox({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "emerald" | "rose" | "violet" | "zinc";
}) {
  const tones = {
    emerald: "border-emerald-500/25 bg-emerald-500/5 text-emerald-200",
    rose: "border-rose-500/25 bg-rose-500/5 text-rose-200",
    violet: "border-violet-500/25 bg-violet-500/5 text-violet-200",
    zinc: "border-zinc-700/50 bg-zinc-900/50 text-zinc-200",
  };
  return (
    <div className={`rounded-lg border px-3 py-2 ${tones[tone]}`}>
      <p className="text-[9px] uppercase tracking-wider opacity-70">{label}</p>
      <p className="text-sm font-semibold tabular-nums mt-0.5">{value}</p>
    </div>
  );
}
