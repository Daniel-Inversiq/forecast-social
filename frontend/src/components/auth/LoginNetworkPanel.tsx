"use client";

import Link from "next/link";
import { LiveDot } from "@/components/feed/shared";
import {
  LOGIN_LATEST_BATTLE,
  LOGIN_LIVE_FEED,
  LOGIN_TOP_FORECASTERS,
} from "@/lib/loginNetworkSignals";

export function LoginNetworkPanel({
  compact = false,
  sections = ["battle", "activity", "forecasters"],
  className = "",
}: {
  compact?: boolean;
  sections?: Array<"activity" | "battle" | "forecasters">;
  className?: string;
}) {
  return (
    <aside className={`space-y-3 ${compact ? "" : "lg:space-y-4"} ${className}`}>
      {sections.includes("battle") && <LiveBattleCard compact={compact} dominant={!compact} />}
      {sections.includes("activity") && <LiveFeedCard compact={compact} subdued={!compact} />}
      {sections.includes("forecasters") && <TopForecastersCard compact={compact} subdued={!compact} />}
    </aside>
  );
}

function LiveFeedCard({ compact, subdued = false }: { compact: boolean; subdued?: boolean }) {
  return (
    <div
      className={`onboarding-glass rounded-xl border border-zinc-800/60 ${
        compact ? "p-3" : subdued ? "p-3.5 opacity-90" : "p-4"
      }`}
    >
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
          Network activity
        </p>
        <span className="inline-flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wider text-emerald-400/90">
          <LiveDot />
          Live
        </span>
      </div>
      <ul className="space-y-1.5">
        {LOGIN_LIVE_FEED.map((item) => (
          <li
            key={item.label}
            className="flex items-center justify-between gap-2 text-[11px]"
          >
            <span className="flex items-center gap-2 min-w-0 text-zinc-400">
              <span className="inline-flex items-center gap-1 shrink-0 text-[9px] font-bold uppercase tracking-wider text-rose-400/80">
                <span className="h-1 w-1 rounded-full bg-rose-400 animate-pulse" aria-hidden />
                Live
              </span>
              <span className="truncate">{item.label}</span>
            </span>
            <span className="shrink-0 tabular-nums font-mono text-[10px] text-zinc-600">
              {item.timestamp}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function LiveBattleCard({
  compact,
  dominant = false,
}: {
  compact: boolean;
  dominant?: boolean;
}) {
  const { fighterA, fighterB, market, yesPct, noPct, href, updatedAgo } = LOGIN_LATEST_BATTLE;

  return (
    <Link
      href={href}
      className={`group block rounded-2xl border transition ${
        dominant
          ? "min-h-[220px] p-5 sm:p-6 border-amber-400/40 bg-gradient-to-br from-amber-500/14 via-zinc-950/90 to-rose-500/10 shadow-[0_0_48px_-8px_rgba(245,158,11,0.45),inset_0_1px_0_0_rgba(255,255,255,0.04)] hover:border-amber-300/55 hover:shadow-[0_0_56px_-6px_rgba(245,158,11,0.55)]"
          : "rounded-xl border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-zinc-950/80 to-rose-500/8 shadow-[0_0_32px_-12px_rgba(245,158,11,0.35)] hover:border-amber-400/45 p-3 sm:p-4"
      }`}
    >
      <div className={`flex items-center justify-between gap-2 ${dominant ? "mb-4" : "mb-2"}`}>
        <span
          className={`inline-flex items-center gap-1.5 font-bold uppercase tracking-[0.14em] text-amber-300 ${
            dominant ? "text-[11px]" : "text-[10px]"
          }`}
        >
          <span aria-hidden>⚔</span>
          Live battle
        </span>
        <span className="inline-flex items-center gap-1.5 text-[10px] text-emerald-400/90">
          <LiveDot color="amber" />
          {updatedAgo}
        </span>
      </div>

      <p
        className={`font-semibold text-white leading-snug ${
          dominant ? "text-lg sm:text-xl" : "text-sm"
        }`}
      >
        {fighterA}{" "}
        <span className="text-zinc-500 font-normal text-[0.85em]">vs</span> {fighterB}
      </p>
      <p
        className={`text-zinc-400 font-mono ${dominant ? "text-sm mt-1.5" : "text-[11px] mt-0.5"}`}
      >
        {market}
      </p>

      <div
        className={`flex items-center justify-between gap-3 font-mono tabular-nums ${
          dominant ? "mt-5 text-sm" : "mt-3 text-[11px]"
        }`}
      >
        <span className="text-emerald-400">YES {yesPct}%</span>
        <span className="text-rose-400">NO {noPct}%</span>
      </div>
      <div
        className={`rounded-full bg-zinc-800/80 overflow-hidden flex ${
          dominant ? "mt-2 h-2.5" : "mt-1.5 h-1.5"
        }`}
      >
        <div
          className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400/80"
          style={{ width: `${yesPct}%` }}
        />
        <div
          className="h-full bg-gradient-to-r from-rose-500/80 to-rose-500"
          style={{ width: `${noPct}%` }}
        />
      </div>

      <p
        className={`font-medium text-amber-200/80 group-hover:text-amber-100 transition ${
          dominant ? "mt-5 text-sm" : "mt-3 text-[11px]"
        }`}
      >
        View battle →
      </p>
    </Link>
  );
}

function TopForecastersCard({ compact, subdued = false }: { compact: boolean; subdued?: boolean }) {
  return (
    <div
      className={`onboarding-glass rounded-xl border border-zinc-800/60 ${
        compact ? "p-3" : subdued ? "p-3.5 opacity-90" : "p-4"
      }`}
    >
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
          Top forecasters today
        </p>
        <span className="text-[9px] tabular-nums font-mono text-zinc-600">24h</span>
      </div>
      <ul className="space-y-2">
        {LOGIN_TOP_FORECASTERS.map((f) => (
          <li
            key={f.rank}
            className="rounded-lg border border-zinc-800/50 bg-zinc-950/40 px-2.5 py-2"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[13px] font-medium text-zinc-100 leading-tight">{f.name}</p>
                <p className="text-[10px] tabular-nums font-mono text-emerald-400/85 mt-0.5">
                  {f.credibilityLine}
                </p>
                <p className="text-[10px] text-zinc-500 mt-0.5 leading-snug">{f.activity}</p>
              </div>
              <span className="shrink-0 text-[10px] tabular-nums font-mono text-zinc-600">
                #{f.rank}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
