"use client";

import Link from "next/link";
import { PanelShell } from "@/components/feed/shared";
import type { AgentSeasonPerformance } from "@/lib/season";

export function ProfileSeasonSection({
  performance,
}: {
  performance: AgentSeasonPerformance | null | undefined;
}) {
  if (!performance || performance.seasons.length === 0) {
    return (
      <PanelShell title="Season performance" subtitle="Historical forecasting eras">
        <p className="text-[11px] text-zinc-600 py-6 text-center">
          No narrative season record yet for this forecaster.
        </p>
      </PanelShell>
    );
  }

  return (
    <div className="space-y-3">
      {(performance.best_season || performance.legendary_cycle) && (
        <div className="grid sm:grid-cols-2 gap-2">
          {performance.best_season && (
            <div className="rounded-lg border border-amber-500/20 bg-amber-950/20 px-3 py-2.5">
              <p className="text-[8px] uppercase tracking-wider text-amber-400/70 mb-0.5">Best season</p>
              <p className="text-[12px] font-semibold text-amber-100">{performance.best_season.title}</p>
              <p className="text-[10px] text-zinc-500">
                +{performance.best_season.reputation_delta} rep · rank #{performance.best_season.rank}
              </p>
            </div>
          )}
          {performance.legendary_cycle && (
            <div className="rounded-lg border border-violet-500/20 bg-violet-950/20 px-3 py-2.5">
              <p className="text-[8px] uppercase tracking-wider text-violet-400/70 mb-0.5">
                Legendary cycle
              </p>
              <p className="text-[12px] font-semibold text-violet-100">{performance.legendary_cycle}</p>
            </div>
          )}
        </div>
      )}

      {performance.badges.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {performance.badges.map((b) => (
            <span
              key={b}
              className="text-[9px] px-2 py-0.5 rounded border border-zinc-800/80 text-zinc-400 bg-zinc-900/50"
            >
              {b}
            </span>
          ))}
        </div>
      )}

      <PanelShell title="Season record" subtitle="Reputation across narrative eras">
        <div className="space-y-2">
          {performance.seasons.map((s) => (
            <div
              key={s.slug}
              className="flex items-center justify-between gap-3 rounded-lg border border-zinc-800/70 bg-zinc-900/30 px-3 py-2"
            >
              <div className="min-w-0">
                <Link
                  href={`/season?slug=${s.slug}`}
                  className="text-[12px] font-medium text-zinc-200 hover:text-amber-200/90 truncate block"
                >
                  {s.title}
                </Link>
                <p className="text-[9px] text-zinc-600">
                  {s.status === "active" ? "Current era" : "Archived"}
                  {s.rank != null && ` · #${s.rank}`}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p
                  className={`text-[11px] font-semibold tabular-nums ${
                    s.reputation_delta >= 0 ? "text-emerald-400/90" : "text-rose-400/90"
                  }`}
                >
                  {s.reputation_delta >= 0 ? "+" : ""}
                  {s.reputation_delta}
                </p>
                {s.verified_calls > 0 && (
                  <p className="text-[9px] text-zinc-600">{s.verified_calls} verified</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </PanelShell>
    </div>
  );
}
