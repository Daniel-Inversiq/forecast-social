"use client";

import Link from "next/link";
import { useMemo } from "react";
import { HeatPill, LiveDot } from "@/components/feed/shared";
import { isNotificationUnread } from "@/lib/notifications";
import { buildAttentionSummary } from "./alertIntelligence";
import type { EnrichedAlert } from "./types";

const TONE: Record<string, string> = {
  rose: "border-rose-500/25 bg-rose-950/30 hover:border-rose-500/40",
  violet: "border-violet-500/25 bg-violet-950/25 hover:border-violet-500/40",
  amber: "border-amber-500/25 bg-amber-950/25 hover:border-amber-500/40",
  cyan: "border-cyan-500/25 bg-cyan-950/20 hover:border-cyan-500/40",
  emerald: "border-emerald-500/25 bg-emerald-950/20 hover:border-emerald-500/40",
  sky: "border-sky-500/25 bg-sky-950/25 hover:border-sky-500/40",
};

export function AttentionHero({
  alerts,
  liveConnected,
}: {
  alerts: EnrichedAlert[];
  liveConnected?: boolean;
}) {
  const summary = useMemo(() => buildAttentionSummary(alerts), [alerts]);
  const unread = alerts.filter((a) => isNotificationUnread(a)).length;
  const critical = alerts.filter(
    (a) => isNotificationUnread(a) && a.urgencyLabel === "Critical",
  ).length;

  return (
    <section className="attention-hero feed-top-signal mb-3 rounded-xl border border-violet-500/20 bg-zinc-950/60 overflow-hidden relative">
      <div className="attention-hero-glow absolute inset-0 pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-r from-violet-950/35 via-zinc-950/20 to-transparent pointer-events-none" />

      <div className="relative px-3 py-3 sm:px-4 sm:py-4">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <LiveDot color="violet" />
              <HeatPill tone="violet" pulse={liveConnected}>
                {liveConnected ? "Live" : "Attention"}
              </HeatPill>
              {unread > 0 && (
                <span className="text-[9px] font-semibold text-violet-200 bg-violet-500/15 border border-violet-500/30 px-1.5 py-0.5 rounded-full tabular-nums">
                  {unread} new
                </span>
              )}
              {critical > 0 && (
                <span className="text-[9px] font-semibold text-rose-200 bg-rose-500/15 border border-rose-500/30 px-1.5 py-0.5 rounded-full">
                  {critical} critical
                </span>
              )}
            </div>
            <h1 className="text-lg sm:text-xl font-semibold tracking-tight text-white">Attention</h1>
            <p className="text-[11px] sm:text-xs text-zinc-400 mt-1 max-w-xl">
              Your forecasting world moved while you were away.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {summary.map((card) => {
            const cls = TONE[card.tone] ?? TONE.violet;
            const inner = (
              <>
                <p className="text-[8px] uppercase tracking-wider text-zinc-600 mb-0.5">{card.label}</p>
                <p className="text-[11px] font-semibold text-zinc-100 leading-snug line-clamp-2">{card.line}</p>
              </>
            );
            if (card.href) {
              return (
                <Link
                  key={card.id}
                  href={card.href}
                  className={`rounded-lg border px-2.5 py-2.5 feed-hover-lift transition ${cls}`}
                >
                  {inner}
                </Link>
              );
            }
            return (
              <div key={card.id} className={`rounded-lg border px-2.5 py-2.5 ${cls}`}>
                {inner}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
