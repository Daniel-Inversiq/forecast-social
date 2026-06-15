"use client";

import Link from "next/link";
import {
  Avatar,
  formatTimeAgo,
  MiniSparkline,
  MoveBadge,
  RankMotion,
} from "@/components/feed/shared";
import { useNotifications } from "@/context/NotificationsProvider";
import type { EnrichedAlert } from "./types";

const DISPLAY_BADGE: Record<string, string> = {
  violet: "text-violet-300 bg-violet-500/10 border-violet-500/25",
  rose: "text-rose-300 bg-rose-500/10 border-rose-500/25",
  emerald: "text-emerald-300 bg-emerald-500/10 border-emerald-500/25",
  sky: "text-sky-300 bg-sky-500/10 border-sky-500/25",
  amber: "text-amber-300 bg-amber-500/10 border-amber-500/25",
  cyan: "text-cyan-300 bg-cyan-500/10 border-cyan-500/25",
};

const URGENCY_LABEL: Record<string, string> = {
  Critical: "text-rose-200 bg-rose-500/15 border-rose-500/35",
  Watch: "text-sky-200 bg-sky-500/10 border-sky-500/30",
  Proof: "text-emerald-200 bg-emerald-500/12 border-emerald-500/30",
  Reputation: "text-amber-200 bg-amber-500/12 border-amber-500/28",
  Battle: "text-rose-200/90 bg-rose-950/40 border-rose-500/25",
  Position: "text-cyan-200 bg-cyan-500/10 border-cyan-500/28",
  Brief: "text-zinc-300 bg-zinc-800/60 border-zinc-600/40",
};

const URGENCY_GLOW: Record<string, string> = {
  critical: "border-l-rose-400/70 shadow-[inset_0_0_24px_-12px_rgba(244,63,94,0.2)]",
  high: "border-l-violet-500/50 bg-violet-950/10",
  normal: "border-l-zinc-700/60",
};

export function ActivityCard({ alert }: { alert: EnrichedAlert }) {
  const { markNotificationRead } = useNotifications();
  const badge = DISPLAY_BADGE[alert.tone] ?? DISPLAY_BADGE.violet;
  const labelCls = URGENCY_LABEL[alert.urgencyLabel] ?? URGENCY_LABEL.Watch;
  const glow = URGENCY_GLOW[alert.urgency];
  const sparkTone =
    alert.direction === "up" ? "emerald" : alert.direction === "down" ? "amber" : "violet";
  const delta =
    alert.probability_change ??
    (alert.movementSize && alert.direction !== "neutral"
      ? alert.direction === "down"
        ? -alert.movementSize
        : alert.movementSize
      : null);

  return (
    <article
      className={`attention-card group relative rounded-xl border border-zinc-800/80 bg-zinc-950/80 overflow-hidden feed-hover-lift border-l-2 ${glow} ${
        alert.unread ? "ring-1 ring-violet-500/12" : ""
      } ${alert.isStreamed ? "attention-card-new" : ""}`}
    >
      {alert.urgency === "critical" && (
        <div className="absolute inset-0 bg-gradient-to-r from-rose-500/5 via-transparent to-transparent pointer-events-none" />
      )}
      <div className="relative p-3 sm:p-4">
        <div className="flex items-start gap-3 min-w-0">
          <div className="relative shrink-0">
            <Avatar name={alert.related_agent ?? alert.related_market ?? "Network"} size="sm" />
            {alert.isLive && (
              <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-violet-400 ring-2 ring-zinc-950 feed-live-pill" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5 mb-1">
              <span
                className={`text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full border ${labelCls}`}
              >
                {alert.urgencyLabel}
              </span>
              <span
                className={`text-[8px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-full border ${badge}`}
              >
                {alert.displayType}
              </span>
              {delta != null && delta !== 0 && <MoveBadge delta={delta} />}
              {alert.reputationImpact != null && <RankMotion delta={alert.reputationImpact} />}
              <time className="text-[10px] text-zinc-600 tabular-nums ml-auto shrink-0">
                {formatTimeAgo(alert.timestamp, true)}
              </time>
            </div>

            <h2 className="text-sm font-semibold text-white leading-snug">{alert.headline}</h2>
            <p className="text-[11px] text-zinc-500 mt-1 line-clamp-3 leading-relaxed">{alert.body}</p>

            <div className="flex flex-wrap items-center gap-2 mt-2.5">
              {alert.related_market && (
                <span className="text-[10px] text-zinc-500 truncate max-w-full sm:max-w-[220px]">
                  {alert.related_market}
                </span>
              )}
              {alert.secondaryAgent && (
                <span className="text-[10px] text-rose-400/80">vs {alert.secondaryAgent}</span>
              )}
            </div>
          </div>

          <div className="hidden sm:flex flex-col items-end gap-1 shrink-0">
            <MiniSparkline seed={alert.id} tone={sparkTone} width={52} height={18} />
          </div>
        </div>

        <div className="mt-3 pt-2.5 border-t border-zinc-800/50 flex items-center justify-between gap-2">
          <span className="text-[9px] text-zinc-600 truncate">{alert.convictionContext}</span>
          <Link
            href={alert.cta.href}
            onClick={() => markNotificationRead(alert.id)}
            className="shrink-0 text-[10px] font-medium px-2.5 py-1 rounded-md border border-violet-500/30 bg-violet-500/10 text-violet-200 hover:bg-violet-500/20 transition relative z-[2]"
          >
            {alert.cta.label} →
          </Link>
        </div>
      </div>
    </article>
  );
}

export function ActivityStream({
  alerts,
  loading,
}: {
  alerts: EnrichedAlert[];
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="space-y-2.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="h-32 rounded-xl border border-zinc-800/60 bg-zinc-900/40 animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (alerts.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/80 p-8 text-center">
        <p className="text-zinc-300 text-sm font-medium">Quiet for now.</p>
        <p className="text-[11px] text-zinc-500 mt-2">Your positions are stable. Network pulse is calm.</p>
      </div>
    );
  }

  return (
    <section className="space-y-2.5">
      {alerts.map((a) => (
        <ActivityCard key={a.id} alert={a} />
      ))}
    </section>
  );
}
