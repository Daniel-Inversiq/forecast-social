"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { HeatPill } from "@/components/feed/shared";
import { BriefIntelligenceCard } from "./BriefIntelligenceCard";
import { fetchMyBrief, type UserDailyBrief } from "@/lib/dailyBrief";
import { useAuth } from "@/context/AuthProvider";

type PositionSlice = {
  market_title?: string;
  market_slug?: string;
  side?: string;
  edge_estimate?: number;
};

export function UserForecastingBrief() {
  const { user } = useAuth();
  const [brief, setBrief] = useState<UserDailyBrief | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setBrief(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    async function load() {
      setLoading(true);
      const data = await fetchMyBrief();
      if (!cancelled) {
        setBrief(data);
        setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (!user) {
    return (
      <section className="brief-memo-panel rounded-xl border border-zinc-800/80 bg-zinc-950/90 p-4">
        <p className="text-[10px] uppercase tracking-wider text-zinc-600 mb-1">Your Forecasting Brief</p>
        <p className="text-xs text-zinc-500">
          Sign in to receive a personalized intelligence memo on reputation, calls, and timing.
        </p>
        <Link
          href="/login"
          className="inline-block mt-2 text-[10px] text-amber-400/90 hover:text-amber-300"
        >
          Enter the network →
        </Link>
      </section>
    );
  }

  if (loading) {
    return (
      <section className="brief-memo-panel rounded-xl border border-amber-500/15 p-4 animate-pulse">
        <div className="h-4 w-40 bg-zinc-800 rounded" />
      </section>
    );
  }

  if (!brief) return null;

  const strongest = brief.strongest_position as PositionSlice | null;
  const worst = brief.worst_position as PositionSlice | null;
  const delta = brief.reputation_delta;

  return (
    <section className="brief-memo-panel rounded-xl border border-amber-500/20 bg-gradient-to-br from-zinc-950/95 to-amber-950/5 p-4">
      <header className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-amber-500/75">
            Your Desk Memo
          </p>
          <p className="text-[10px] text-zinc-500">{brief.date}</p>
        </div>
        <HeatPill tone={delta >= 0 ? "emerald" : "rose"}>
          {delta >= 0 ? "+" : ""}
          {delta} rep
        </HeatPill>
      </header>

      <p className="text-[11px] text-zinc-300/90 leading-snug border-l-2 border-amber-500/35 pl-2 mb-2.5 brief-memo-lead">
        {brief.personalized_summary}
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
        <BriefIntelligenceCard label="Reputation" ticker="REP">
          <p className="text-sm font-semibold text-zinc-200 tabular-nums leading-none">
            {delta >= 0 ? "+" : ""}
            {delta}
          </p>
          {brief.rank_change != null && (
            <p className="text-[9px] text-zinc-500 mt-0.5">
              Rank {brief.rank_change >= 0 ? "+" : ""}
              {brief.rank_change}
            </p>
          )}
        </BriefIntelligenceCard>

        <BriefIntelligenceCard label="Best call" ticker="BEST" tone="emerald">
          {strongest ? (
            <p className="text-[10px] text-zinc-300 leading-snug line-clamp-2">
              <span className="text-zinc-200">{strongest.market_title}</span>
              {" · "}
              {strongest.side} ~{strongest.edge_estimate}%
            </p>
          ) : (
            <p className="text-[10px] text-zinc-500">No active positions</p>
          )}
        </BriefIntelligenceCard>

        <BriefIntelligenceCard label="Drag" ticker="DRAG" tone="rose">
          {worst ? (
            <p className="text-[10px] text-zinc-300 leading-snug line-clamp-2">
              <span className="text-zinc-200">{worst.market_title}</span>
              {" · "}
              {worst.side} ~{worst.edge_estimate}%
            </p>
          ) : (
            <p className="text-[10px] text-zinc-500">No drag on book</p>
          )}
        </BriefIntelligenceCard>

        <BriefIntelligenceCard label="Calibration" ticker="CAL">
          <p className="text-[10px] text-zinc-300 leading-snug">{brief.sections.timing_quality.label}</p>
        </BriefIntelligenceCard>

        {brief.milestone_unlocks.length > 0 && (
          <BriefIntelligenceCard label="Milestones" ticker="MS" className="sm:col-span-2">
            <p className="text-[10px] text-zinc-400 leading-snug line-clamp-2">
              {brief.milestone_unlocks
                .map((m) => `${String(m.agent_name)} · ${String(m.title)}`)
                .join(" · ")}
            </p>
          </BriefIntelligenceCard>
        )}
      </div>

      {brief.followed_narratives.length > 0 && (
        <p className="mt-2 text-[9px] text-zinc-600">
          Tracking: {brief.followed_narratives.join(" · ")}
        </p>
      )}
    </section>
  );
}
