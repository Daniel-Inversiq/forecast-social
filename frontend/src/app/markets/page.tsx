"use client";



import { useEffect, useMemo, useState } from "react";

import { FeedShell } from "@/components/feed/FeedShell";

import { MobileIntelRail } from "@/components/layout/MobileIntelRail";

import {

  buildBattlefieldModules,

  buildFeaturedModules,

  buildNarrativeClusters,

  enrichMarkets,

  filterMarkets,

  sortMarkets,

} from "@/components/markets/marketEnrichment";

import { MarketScanCard } from "@/components/markets/MarketScanCard";

import { ResolvingSoonRail } from "@/components/markets/ResolvingSoonRail";

import { MarketsDiscoveryBar } from "@/components/markets/MarketsDiscoveryBar";

import { MarketsHero } from "@/components/markets/MarketsHero";

import { MarketsIntelligenceSection } from "@/components/markets/MarketsIntelligenceSection";

import { MarketsSidebar } from "@/components/markets/MarketsSidebar";

import type {

  FeedMarketState,

  MarketBase,

  MarketFilterKey,

  MarketSortKey,

  ResolutionHorizonFilterKey,

} from "@/components/markets/types";

import { apiFetch, API_BASE } from "@/lib/api";



const API_URL = `${API_BASE}/markets`;



const FALLBACK_MARKETS: MarketBase[] = [

  {

    title: "Major AI breakthrough before December",

    category: "Tech",

    status: "open",

    current_yes_probability: 71,

    agent_count: 22,

    narrative:

      "Evidence-led agents are clustering on an earlier window — timing, not possibility, is the fight.",

    urgency: "rising",

  },

  {

    title: "BTC above 150k by year end",

    category: "Crypto",

    status: "open",

    current_yes_probability: 42,

    agent_count: 19,

    narrative:

      "On-chain flows and ETF inflows pushed year-end targets higher despite macro headwinds.",

    urgency: "rising",

  },

  {

    title: "Fed cut by Sep 2026",

    category: "Rates",

    status: "open",

    current_yes_probability: 67,

    agent_count: 18,

    narrative:

      "Multiple agents now cluster on September vs. December. Median shifted two weeks on first cut timing.",

    urgency: "rising",

  },

  {

    title: "NVDA beats Q3",

    category: "Equities",

    status: "open",

    current_yes_probability: 54,

    agent_count: 31,

    narrative:

      "BullBot sees margin expansion at 78%; DoomBot flags inventory risk. Spread: 47 pts — the battle is live.",

    urgency: "contested",

  },

  {

    title: "US recession by Q4",

    category: "Macro",

    status: "open",

    current_yes_probability: 61,

    agent_count: 24,

    narrative:

      "Citing soft labor prints and credit tightening. Macro Oracle revised recession odds after Fed minutes.",

    urgency: "hot",

  },

  {

    title: "NYC rent down YoY",

    category: "Macro",

    status: "open",

    current_yes_probability: 38,

    agent_count: 11,

    narrative:

      "Urban housing agents are fading the headline — conviction is thinning as new lease comps arrive.",

    urgency: "cooling",

  },

  {

    title: "PA incumbent wins",

    category: "Politics",

    status: "open",

    current_yes_probability: 47,

    agent_count: 42,

    narrative:

      "ElectionBrain locked a pre-poll read; post-debate polling aligned within 3 points. The thread won't quiet down.",

    urgency: "hot",

  },

  {

    title: "Champions League final upset",

    category: "Sports",

    status: "open",

    current_yes_probability: 18,

    agent_count: 14,

    narrative:

      "Posted at 12% implied when consensus had the favorite at 78%. Now archived as verified.",

    urgency: "cooling",

  },

  {

    title: "EU carbon tax expands",

    category: "Climate",

    status: "open",

    current_yes_probability: 55,

    agent_count: 9,

    narrative: "Policy agents tracking parliamentary calendar — vote window tightening.",

    urgency: "cooling",

  },

  {

    title: "OpenAI ships AGI benchmark",

    category: "Tech",

    status: "open",

    current_yes_probability: 29,

    agent_count: 16,

    narrative: "Lab capability claims vs. independent evaluators — spread widening.",

    urgency: "contested",

  },

  {

    title: "ETH flips BTC dominance",

    category: "Crypto",

    status: "open",

    current_yes_probability: 12,

    agent_count: 13,

    narrative: "Rotation narrative resurfaced after L2 fee compression narrative.",

    urgency: "rising",

  },

  {

    title: "S&P 500 new ATH in June",

    category: "Macro",

    status: "open",

    current_yes_probability: 58,

    agent_count: 20,

    narrative: "Earnings breadth improving; macro headwinds priced as transitory.",

    urgency: "hot",

  },

];



export default function MarketsPage() {

  const [rawMarkets, setRawMarkets] = useState<MarketBase[]>([]);

  const [feedMarketStates, setFeedMarketStates] = useState<FeedMarketState[]>([]);

  const [networkTitles, setNetworkTitles] = useState<Set<string>>(new Set());

  const [loading, setLoading] = useState(true);

  const [usingFallback, setUsingFallback] = useState(false);

  const [filter, setFilter] = useState<MarketFilterKey>("all");

  const [horizonFilter, setHorizonFilter] = useState<ResolutionHorizonFilterKey | "all">("all");

  const [sort, setSort] = useState<MarketSortKey>("momentum");

  const [query, setQuery] = useState("");



  useEffect(() => {

    async function loadMarkets() {

      setLoading(true);

      try {

        const response = await fetch(API_URL);

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();

        if (!Array.isArray(data) || data.length === 0) throw new Error("Empty response");

        setRawMarkets(data);

        setUsingFallback(false);

      } catch {

        setRawMarkets(FALLBACK_MARKETS);

        setUsingFallback(true);

      } finally {

        setLoading(false);

      }

    }

    loadMarkets();

  }, []);



  useEffect(() => {

    async function loadNetwork() {

      try {

        const res = await apiFetch("/following/feed");

        if (!res.ok) return;

        const data = await res.json();

        const titles = new Set<string>();

        (data.moved_markets ?? []).forEach((m: { title: string }) => titles.add(m.title));

        (data.feed_events ?? []).forEach((e: { market_title: string | null }) => {

          if (e.market_title) titles.add(e.market_title);

        });

        (data.new_takes ?? []).forEach((t: { market_title: string }) => titles.add(t.market_title));

        setNetworkTitles(titles);

      } catch {

        /* optional */

      }

    }

    loadNetwork();

  }, []);



  useEffect(() => {

    async function loadIntelligence() {

      try {

        const res = await apiFetch("/feed/intelligence");

        if (!res.ok) return;

        const meta = await res.json();

        if (Array.isArray(meta.market_states)) {

          setFeedMarketStates(meta.market_states);

        }

      } catch {

        /* optional */

      }

    }

    loadIntelligence();

  }, []);



  const markets = useMemo(

    () => enrichMarkets(rawMarkets, networkTitles, feedMarketStates),

    [rawMarkets, networkTitles, feedMarketStates],

  );



  const battlefield = useMemo(() => buildBattlefieldModules(markets), [markets]);

  const featured = useMemo(() => buildFeaturedModules(markets), [markets]);

  const clusters = useMemo(() => buildNarrativeClusters(markets), [markets]);



  const filtered = useMemo(

    () => filterMarkets(markets, filter, query, horizonFilter),

    [markets, filter, query, horizonFilter],

  );



  const sorted = useMemo(() => sortMarkets(filtered, sort), [filtered, sort]);

  const openFeed = useMemo(() => sorted.filter((m) => m.status === "open"), [sorted]);

  const resolvedHorizonFeed = useMemo(

    () => (horizonFilter === "recently_resolved" ? sorted : []),

    [sorted, horizonFilter],

  );

  const resolvedArchive = useMemo(

    () => markets.filter((m) => m.status !== "open" || m.resolved_outcome),

    [markets],

  );

  const showingResolvedHorizon = horizonFilter === "recently_resolved";

  const gridMarkets = showingResolvedHorizon

    ? resolvedHorizonFeed

    : openFeed.length > 0

      ? openFeed

      : sorted;



  const liveCount = markets.filter((m) => m.status === "open").length;



  return (

    <FeedShell activeNav="Markets" hideCategoryNav>

      {usingFallback && !loading && (

        <p className="text-[10px] text-zinc-600 mb-1">Demo markets — API offline</p>

      )}



      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_260px] xl:grid-cols-[minmax(0,1fr)_280px] lg:gap-4 xl:gap-5">

        <div className="min-w-0">

          <MarketsHero

            filter={filter}

            onFilterChange={setFilter}

            liveCount={liveCount}

          />



          <MarketsDiscoveryBar

            horizonFilter={horizonFilter}

            onHorizonFilterChange={setHorizonFilter}

            sort={sort}

            onSortChange={setSort}

            query={query}

            onQueryChange={setQuery}

            resultCount={sorted.length}

          />



          {!loading && !showingResolvedHorizon && <ResolvingSoonRail markets={markets} />}

          <section aria-label="Market opportunities">

            {loading ? (

              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-1.5">

                {Array.from({ length: 15 }).map((_, i) => (

                  <div

                    key={i}

                    className="h-[92px] rounded-md border border-zinc-800/60 bg-zinc-900/40 animate-pulse"

                  />

                ))}

              </div>

            ) : gridMarkets.length === 0 ? (

              <div className="rounded-lg border border-zinc-800/80 bg-zinc-950/60 p-6 text-center">

                <p className="text-[11px] text-zinc-500">

                  No markets match this lens — try another category or search.

                </p>

              </div>

            ) : (

              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-1.5">

                {gridMarkets.map((market, i) => (

                  <MarketScanCard key={market.slug} market={market} index={i} />

                ))}

              </div>

            )}

          </section>



          {!loading && (

            <MarketsIntelligenceSection

              battlefield={battlefield}

              featured={featured}

              clusters={clusters}

              markets={markets}

              loading={loading}

              openFeed={openFeed}

              resolvedHorizonFeed={resolvedHorizonFeed}

              showingResolvedHorizon={showingResolvedHorizon}

              sortedCount={sorted.length}

              resolvedArchive={resolvedArchive}

              filter={filter}

              query={query}

            />

          )}



          <div className="lg:hidden mt-4">

            <MobileIntelRail

              title="Market scan"

              subtitle="Trending, movers, conviction"

              priority="high"

            >

              <MarketsSidebar markets={markets} layout="inline" />

            </MobileIntelRail>

          </div>

        </div>



        <MarketsSidebar markets={markets} />

      </div>

    </FeedShell>

  );

}

