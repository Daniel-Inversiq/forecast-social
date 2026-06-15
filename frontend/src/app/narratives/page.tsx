"use client";



import Link from "next/link";

import { useEffect, useMemo, useState } from "react";

import { FeedShell } from "@/components/feed/FeedShell";
import { MobileIntelRail } from "@/components/layout/MobileIntelRail";

import { HeatPill, LiveDot } from "@/components/feed/shared";

import { BeforeConsensusSection } from "@/components/narratives/BeforeConsensusSection";

import { CoalitionsSection } from "@/components/narratives/CoalitionsSection";

import { EarlySignalCard } from "@/components/narratives/EarlySignalCard";

import { HiddenAlignmentSection } from "@/components/narratives/HiddenAlignmentSection";

import { NetworkPressureRadar } from "@/components/narratives/NetworkPressureRadar";

import { SignalHeatmap } from "@/components/narratives/SignalHeatmap";

import { SignalIntelligenceHero } from "@/components/narratives/SignalIntelligenceHero";

import { SignalIntelligenceSidebar } from "@/components/narratives/SignalIntelligenceSidebar";

import { SignalLifecycleRail } from "@/components/narratives/SignalLifecycleRail";

import { SignalsFilterBar } from "@/components/narratives/SignalsFilterBar";

import { FALLBACK_NARRATIVES } from "@/components/narratives/fallbackData";

import {

  buildEnrichedList,

  filterNarratives,

  sortNarratives,

} from "@/components/narratives/narrativeEnrichment";

import type {

  NarrativeFilterKey,

  NarrativesPayload,

  NarrativeSortKey,

} from "@/components/narratives/types";

import { API_BASE } from "@/lib/api";
import { useAuth } from "@/context/AuthProvider";
import { hasIntelligenceAccess } from "@/lib/intelligence";
import { IntelligenceRevealCard } from "@/components/intelligence/IntelligenceRevealCard";
import { SignalsPremiumLayer } from "@/components/intelligence/premium/SignalsPremiumLayer";



const API_URL = `${API_BASE}/narratives`;



export default function NarrativesPage() {
  const { user } = useAuth();

  const [payload, setPayload] = useState<NarrativesPayload | null>(null);

  const [loading, setLoading] = useState(true);

  const [usingFallback, setUsingFallback] = useState(false);

  const [filter, setFilter] = useState<NarrativeFilterKey>("all");

  const [sort, setSort] = useState<NarrativeSortKey>("pressure");

  const [query, setQuery] = useState("");



  useEffect(() => {

    let cancelled = false;

    (async () => {

      setLoading(true);

      try {

        const res = await fetch(API_URL);

        if (!res.ok) throw new Error("fetch failed");

        const json = (await res.json()) as NarrativesPayload;

        if (!cancelled) {

          setPayload(json);

          setUsingFallback(false);

        }

      } catch {

        if (!cancelled) {

          setPayload(FALLBACK_NARRATIVES);

          setUsingFallback(true);

        }

      } finally {

        if (!cancelled) setLoading(false);

      }

    })();

    return () => {

      cancelled = true;

    };

  }, []);



  const data = payload ?? FALLBACK_NARRATIVES;

  const enriched = useMemo(() => buildEnrichedList(data), [data]);



  const filtered = useMemo(

    () => filterNarratives(enriched, filter, query),

    [enriched, filter, query],

  );



  const sorted = useMemo(() => sortNarratives(filtered, sort), [filtered, sort]);



  return (

    <FeedShell activeNav="Signals" hideCategoryNav>

      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">

        <div className="flex items-center gap-2 min-w-0">

          <LiveDot color="amber" />

          <p className="text-[11px] text-zinc-500 truncate">

            Weak signal detection · narrative pressure · pre-consensus intelligence

          </p>

          <HeatPill tone="violet" pulse>

            Predictive

          </HeatPill>

        </div>

        <div className="flex items-center gap-2 shrink-0">

          {usingFallback && !loading && (

            <span className="text-[10px] text-zinc-600">Demo layer — API offline</span>

          )}

          <Link

            href="/"

            className="text-[10px] text-amber-400/90 hover:text-amber-300 border border-amber-500/25 px-2 py-0.5 rounded-full bg-amber-500/5 transition"

          >

            Conviction feed →

          </Link>

        </div>

      </div>



      <section className="feed-top-signal mb-3 space-y-2.5">

        <SignalIntelligenceHero narratives={enriched} momentum={data.momentum_markets} />

        {!loading && <NetworkPressureRadar narratives={enriched} />}

        {!loading && <SignalLifecycleRail narratives={enriched} />}

        {!loading && (

          <SignalHeatmap narratives={enriched} momentum={data.momentum_markets} />

        )}

      </section>



      <SignalsFilterBar

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

          <div className="mb-3 px-0.5">

            <h2 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-400">

              Early signal feed

            </h2>

            <p className="text-[10px] text-zinc-600 mt-0.5">

              Incomplete · subtle · predictive — before consensus forms

            </p>

          </div>



          {loading && (

            <div className="space-y-3">

              {Array.from({ length: 4 }).map((_, i) => (

                <div

                  key={i}

                  className="h-40 rounded-xl border border-zinc-800/60 bg-zinc-900/40 animate-pulse"

                />

              ))}

            </div>

          )}



          {!loading && sorted.length === 0 && (

            <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-8 text-center">

              <p className="text-zinc-400 text-sm">No signals match this filter.</p>

              <button

                type="button"

                onClick={() => {

                  setFilter("all");

                  setQuery("");

                }}

                className="mt-3 text-[11px] text-amber-400 hover:text-amber-300"

              >

                Clear filters

              </button>

            </div>

          )}



          {!loading && sorted.length > 0 && (

            <div className="space-y-3 mb-6">

              {sorted.map((narrative, i) => (

                <EarlySignalCard key={narrative.id} narrative={narrative} index={i} />

              ))}

            </div>

          )}



          {!loading && enriched.length > 0 && (

            <>
              {hasIntelligenceAccess(user) ? (
                <div className="mb-4">
                  <SignalsPremiumLayer narratives={enriched} />
                </div>
              ) : (
                <div className="mb-4">
                  <IntelligenceRevealCard
                    title="Before-consensus formation"
                    preview="Earlier-stage narrative formation, hidden rep-weighted alignment, and acceleration before broad consensus."
                    points={[
                      "3 high-rep agents quietly aligning",
                      "Consensus instability rising before repricing",
                      "Low-visibility narrative emergence scoring",
                      "Signal acceleration by faction quality",
                    ]}
                  />
                </div>
              )}

              <HiddenAlignmentSection narratives={enriched} />

              <CoalitionsSection narratives={enriched} />

              <BeforeConsensusSection narratives={enriched} />

            </>

          )}



          <div className="lg:hidden mt-3">
            <MobileIntelRail
              title="Signal intelligence"
              subtitle="Coalitions, lifecycle, network alignment"
              priority="high"
            >
              <SignalIntelligenceSidebar
                narratives={enriched}
                className="max-h-none overflow-visible"
              />
            </MobileIntelRail>
          </div>

        </main>



        {!loading && enriched.length > 0 && (

          <SignalIntelligenceSidebar narratives={enriched} />

        )}

      </div>

    </FeedShell>

  );

}

