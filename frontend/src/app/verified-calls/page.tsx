"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { FeedShell } from "@/components/feed/FeedShell";
import { HeatPill, LiveDot } from "@/components/feed/shared";
import { LivePulsePanel } from "@/components/LivePulsePanel";
import { BiggestReputationGains } from "@/components/verified-calls/BiggestReputationGains";
import { FALLBACK_VERIFIED_CALLS } from "@/components/verified-calls/fallbackData";
import { IgnoredAtFirst } from "@/components/verified-calls/IgnoredAtFirst";
import { LegendaryCallsArchive } from "@/components/verified-calls/LegendaryCallsArchive";
import { TimingEdgeAnalysis } from "@/components/verified-calls/TimingEdgeAnalysis";
import { VerificationChains } from "@/components/verified-calls/VerificationChains";
import { VerificationStreaksSection } from "@/components/verified-calls/VerificationStreaksSection";
import { VerificationSurface } from "@/components/verified-calls/VerificationSurface";
import { VerificationTimeline } from "@/components/verified-calls/VerificationTimeline";
import { VerifiedCallInsightRow } from "@/components/verified-calls/VerifiedCallInsightRow";
import { VerifiedCallProofCard } from "@/components/verified-calls/VerifiedCallProofCard";
import { VerifiedCallsEmptyState } from "@/components/verified-calls/VerifiedCallsEmptyState";
import { VerifiedCallsFilterBar } from "@/components/verified-calls/VerifiedCallsFilterBar";
import { VerifiedCallsHero } from "@/components/verified-calls/VerifiedCallsHero";
import { VerifiedCallsSidebar } from "@/components/verified-calls/VerifiedCallsSidebar";
import {
  buildBiggestReputationGains,
  enrichVerifiedCall,
  filterVerifiedCalls,
  sortVerifiedCalls,
} from "@/components/verified-calls/verifiedCallEnrichment";
import { parseReceiptsResponse } from "@/lib/receipts";
import type { BiggestReputationGain } from "@/lib/receipts";
import type {
  VerifiedCallBase,
  VerifiedCallFilterKey,
  VerifiedCallSortKey,
} from "@/components/verified-calls/types";
import { API_BASE } from "@/lib/api";

export default function VerifiedCallsPage() {
  const [raw, setRaw] = useState<VerifiedCallBase[]>([]);
  const [biggestGains, setBiggestGains] = useState<BiggestReputationGain[]>([]);
  const [loading, setLoading] = useState(true);
  const [usingFallback, setUsingFallback] = useState(false);
  const [filter, setFilter] = useState<VerifiedCallFilterKey>("all");
  const [sort, setSort] = useState<VerifiedCallSortKey>("timing_edge");
  const [query, setQuery] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE}/receipts`);
        const data = await res.json();
        if (!res.ok) throw new Error("API error");
        const parsed = parseReceiptsResponse(data);
        if (parsed && parsed.receipts.length > 0) {
          setRaw(parsed.receipts);
          setBiggestGains(
            parsed.biggest_reputation_gains.length > 0
              ? parsed.biggest_reputation_gains
              : [],
          );
          setUsingFallback(false);
        } else {
          setRaw(FALLBACK_VERIFIED_CALLS);
          setBiggestGains([]);
          setUsingFallback(true);
        }
      } catch {
        setRaw(FALLBACK_VERIFIED_CALLS);
        setBiggestGains([]);
        setUsingFallback(true);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const enriched = useMemo(() => raw.map(enrichVerifiedCall), [raw]);

  const topGains = useMemo(() => {
    if (biggestGains.length > 0) return biggestGains;
    return buildBiggestReputationGains(enriched);
  }, [biggestGains, enriched]);

  const filtered = useMemo(
    () => filterVerifiedCalls(enriched, filter, query),
    [enriched, filter, query],
  );

  const sorted = useMemo(() => sortVerifiedCalls(filtered, sort), [filtered, sort]);

  const showEmpty = !loading && enriched.length === 0;
  const showFilterEmpty = !loading && enriched.length > 0 && sorted.length === 0;

  return (
    <FeedShell activeNav="Receipts" hideCategoryNav>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <LiveDot color="amber" />
          <p className="text-[11px] text-zinc-500 truncate">
            Receipts · public proof of who called it before consensus
          </p>
          <HeatPill tone="amber" pulse>
            Proof layer
          </HeatPill>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {usingFallback && !loading && (
            <span className="text-[10px] text-zinc-600">Demo archive — API offline</span>
          )}
          <Link
            href="/season"
            className="text-[10px] text-amber-400/90 hover:text-amber-300 border border-amber-500/25 px-2 py-0.5 rounded-full bg-amber-500/5 transition"
          >
            Narrative seasons →
          </Link>
          <Link
            href="/reputation"
            className="text-[10px] text-zinc-500 hover:text-zinc-300 border border-zinc-800 px-2 py-0.5 rounded-full transition"
          >
            Reputation ledger →
          </Link>
        </div>
      </div>

      <section className="feed-top-signal mb-3 space-y-2.5">
        <VerifiedCallsHero calls={enriched} />
        {!loading && enriched.length > 0 && (
          <>
            <VerificationSurface calls={enriched} />
            <VerifiedCallInsightRow calls={enriched} />
          </>
        )}
        {!loading && topGains.length > 0 && (
          <div className="lg:hidden">
            <BiggestReputationGains gains={topGains} compact />
          </div>
        )}
      </section>

      <VerifiedCallsFilterBar
        filter={filter}
        onFilterChange={setFilter}
        sort={sort}
        onSortChange={setSort}
        query={query}
        onQueryChange={setQuery}
        resultCount={sorted.length}
      />

      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[minmax(0,1fr)_340px] lg:gap-4 xl:gap-5">
        <main className="min-w-0">
          {loading && (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="h-48 rounded-xl border border-zinc-800/60 bg-zinc-900/40 animate-pulse"
                />
              ))}
            </div>
          )}

          {showEmpty && <VerifiedCallsEmptyState />}

          {showFilterEmpty && (
            <VerifiedCallsEmptyState
              onClear={() => {
                setFilter("all");
                setQuery("");
              }}
            />
          )}

          {!loading && enriched.length > 0 && (
            <div className="space-y-1">
              <VerificationTimeline calls={enriched} />
              <LegendaryCallsArchive calls={enriched} />
              <TimingEdgeAnalysis calls={enriched} />
              <IgnoredAtFirst calls={enriched} />
              <VerificationChains calls={enriched} />
              <VerificationStreaksSection calls={enriched} />

              <div className="pt-2 pb-1">
                <div className="flex items-center gap-2 px-0.5 mb-3">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-400/75">
                    Permanent receipts
                  </span>
                  <span className="h-px flex-1 bg-gradient-to-r from-amber-900/30 to-transparent" />
                </div>
                <p className="text-[10px] text-zinc-600 mb-3 px-0.5">
                  Public proof in the network&apos;s forecasting history — timing, isolation, and
                  consensus migration archived.
                </p>
              </div>

              {sorted.map((call, i) => (
                <div key={call.id} className="mb-3">
                  <VerifiedCallProofCard call={call} index={i} />
                </div>
              ))}
            </div>
          )}

          <div className="lg:hidden mt-3">
            <LivePulsePanel compact className="!rounded-xl" />
          </div>
        </main>

        {!loading && enriched.length > 0 && (
          <VerifiedCallsSidebar calls={enriched} biggestGains={topGains} />
        )}
      </div>
    </FeedShell>
  );
}
