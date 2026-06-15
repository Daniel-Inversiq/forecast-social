"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { HeatPill, LiveDot } from "@/components/feed/shared";
import { BriefIntelligenceCard } from "./BriefIntelligenceCard";
import { UserForecastingBrief } from "./UserForecastingBrief";
import {
  fetchTodayBrief,
  volatilityLabel,
  volatilityTone,
  type GlobalDailyBrief,
} from "@/lib/dailyBrief";
import { useAuth } from "@/context/AuthProvider";
import { hasIntelligenceAccess } from "@/lib/intelligence";
import { DeepBriefPanel } from "@/components/intelligence/premium/DeepBriefPanel";
import { IntelligenceRevealCard } from "@/components/intelligence/IntelligenceRevealCard";

export function DailyBriefTab() {
  const { user } = useAuth();
  const [globalBrief, setGlobalBrief] = useState<GlobalDailyBrief | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const global = await fetchTodayBrief(!!user);
      if (!cancelled) {
        setGlobalBrief(global);
        setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (loading) {
    return (
      <div className="space-y-3 animate-pulse">
        <div className="h-24 bg-zinc-900/80 rounded-xl" />
        <div className="h-32 bg-zinc-900/80 rounded-xl" />
      </div>
    );
  }

  const g = globalBrief;
  if (!g) {
    return (
      <p className="text-sm text-zinc-500 py-8 text-center">
        Brief unavailable. Check API connection.
      </p>
    );
  }

  const volTone = volatilityTone(g.volatility_state);

  return (
    <div className="space-y-4 brief-tab-content">
      <div className="brief-memo-panel rounded-xl border border-amber-500/25 bg-zinc-950/95 p-4">
        <div className="flex items-center gap-2 mb-2">
          <LiveDot color="amber" />
          <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-amber-500/80">
            Daily Memo · {g.date}
          </p>
          <HeatPill tone={volTone}>{volatilityLabel(g.volatility_state)}</HeatPill>
        </div>
        <h2 className="text-base font-semibold text-zinc-50 brief-memo-title mb-1.5">
          What moved across the network
        </h2>
        <p className="text-xs text-zinc-300/90 leading-snug border-l-2 border-amber-500/40 pl-2.5 brief-memo-lead">
          {g.summary}
        </p>
        <div className="mt-2.5 grid grid-cols-1 md:grid-cols-2 gap-1.5">
          <BriefIntelligenceCard label="Top shift" ticker="SHIFT">
            <p className="text-[10px] text-zinc-300 leading-snug line-clamp-2">
              {(g.biggest_consensus_shift as { headline?: string })?.headline ?? "—"}
            </p>
          </BriefIntelligenceCard>
          <BriefIntelligenceCard label="Contrarian desk" ticker="CTR">
            <p className="text-[10px] text-zinc-300 leading-snug line-clamp-2">
              {(g.strongest_contrarian as { headline?: string })?.headline ?? "—"}
            </p>
          </BriefIntelligenceCard>
          <BriefIntelligenceCard label="Rep move" ticker="REP">
            <p className="text-[10px] text-zinc-300 leading-snug line-clamp-2">
              {(g.top_reputation_move as { headline?: string })?.headline ?? "—"}
            </p>
          </BriefIntelligenceCard>
          <BriefIntelligenceCard label="Proof ledger" ticker="PROOF" tone="emerald">
            <p className="text-base font-semibold text-emerald-300/90 tabular-nums leading-none">
              {g.verified_calls_count}
            </p>
            <p className="text-[9px] text-zinc-500 mt-0.5">{g.verified_calls_count} in archive</p>
          </BriefIntelligenceCard>
        </div>
        {hasIntelligenceAccess(user) ? (
          <div className="mt-3">
            <DeepBriefPanel brief={g} />
          </div>
        ) : (
          <div className="mt-3">
            <IntelligenceRevealCard
              title="Deep Brief"
              preview="Hidden pressure, early-forming consensus, and network instability — institutional morning layer."
              points={[
                "Hidden pressure scan",
                "Early consensus formation",
                "Network instability index",
                "Premium intelligence paragraph",
              ]}
            />
          </div>
        )}

        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            href="/"
            className="text-[10px] text-amber-400/90 border border-amber-500/25 px-2 py-0.5 rounded-full"
          >
            Conviction feed
          </Link>
          <Link
            href="/narratives"
            className="text-[10px] text-zinc-500 border border-zinc-700/50 px-2 py-0.5 rounded-full hover:text-zinc-300"
          >
            Signals
          </Link>
          <Link
            href="/season"
            className="text-[10px] text-zinc-500 border border-zinc-700/50 px-2 py-0.5 rounded-full hover:text-zinc-300"
          >
            Active season
          </Link>
        </div>
      </div>

      {user ? (
        <UserForecastingBrief />
      ) : (
        <p className="text-[11px] text-zinc-500 text-center py-4">
          <Link href="/login" className="text-amber-400/90 hover:text-amber-300">
            Sign in
          </Link>{" "}
          for your personalized forecasting brief.
        </p>
      )}
    </div>
  );
}
