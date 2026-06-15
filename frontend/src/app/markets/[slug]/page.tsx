"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { FeedShell } from "@/components/feed/FeedShell";
import { AgentConsensusSection } from "@/components/markets/detail/AgentConsensusSection";
import { buildFallbackMarket } from "@/components/markets/detail/fallbackData";
import { MarketBattlesSection } from "@/components/markets/detail/MarketBattlesSection";
import { MarketDiscussionSection } from "@/components/markets/detail/MarketDiscussionSection";
import { MarketDetailHeader } from "@/components/markets/detail/MarketDetailHeader";
import { MarketResolutionRulesSection } from "@/components/markets/detail/MarketResolutionRulesSection";
import { MarketChartSection } from "@/components/markets/detail/MarketChartSection";
import { MarketVerifiedCallsSection } from "@/components/markets/detail/MarketVerifiedCallsSection";
import { WhyItMovedSection } from "@/components/markets/detail/WhyItMovedSection";
import { MobileMarketIntel } from "@/components/markets/detail/MobileMarketIntel";
import { RelatedMarketsSection } from "@/components/markets/detail/RelatedMarketsSection";
import { ScryPositionPanel } from "@/components/markets/detail/ScryPositionPanel";
import { enrichMarketDetail } from "@/components/markets/detail/marketDetailEnrichment";
import { ResolutionTimelinePanel } from "@/components/markets/detail/ResolutionTimeline";
import { ReputationSettlementModal } from "@/components/markets/detail/ReputationSettlementModal";
import type { MarketDetail } from "@/components/markets/detail/types";
import type { MarketBase } from "@/components/markets/types";
import { FALLBACK_BATTLES } from "@/components/battles/fallbackData";
import type { Battle } from "@/components/battles/types";
import {
  fetchMarketResolution,
  fetchMySettlement,
  isMarketResolved,
  type ResolutionTimeline,
  type UserSettlement,
} from "@/lib/resolution";
import { parseMarketSideParam } from "@/components/markets/marketSide";
import { titleToSlug } from "@/lib/slugs";
import { API_BASE } from "@/lib/api";
import { useAuth } from "@/context/AuthProvider";

export default function MarketDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const slug = typeof params.slug === "string" ? params.slug : "";
  const initialSide = parseMarketSideParam(searchParams.get("side"));

  const [market, setMarket] = useState<MarketDetail | null>(null);
  const [battles, setBattles] = useState<Battle[]>(FALLBACK_BATTLES);
  const [allMarkets, setAllMarkets] = useState<MarketBase[]>([]);
  const [loading, setLoading] = useState(true);
  const [usingFallback, setUsingFallback] = useState(false);
  const [resolutionTimeline, setResolutionTimeline] = useState<ResolutionTimeline | null>(null);
  const [settlement, setSettlement] = useState<UserSettlement | null>(null);
  const [showSettlement, setShowSettlement] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    if (!slug) return;

    async function loadMarket() {
      setLoading(true);
      let offline = false;

      try {
        const response = await fetch(`${API_BASE}/markets/${slug}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = (await response.json()) as MarketDetail;
        setMarket(data);
        setUsingFallback(false);
      } catch {
        setMarket(buildFallbackMarket(slug));
        setUsingFallback(true);
        offline = true;
      }

      try {
        const battlesRes = await fetch(`${API_BASE}/battles`);
        if (battlesRes.ok) {
          const json = await battlesRes.json();
          if (Array.isArray(json) && json.length > 0) setBattles(json);
        }
      } catch {
        /* keep fallback battles */
      }

      try {
        const marketsRes = await fetch(`${API_BASE}/markets`);
        if (marketsRes.ok) {
          const json = await marketsRes.json();
          if (Array.isArray(json)) setAllMarkets(json);
        }
      } catch {
        /* ignore */
      }

      if (offline) setUsingFallback(true);
      setLoading(false);
    }

    loadMarket();
  }, [slug]);

  useEffect(() => {
    if (!slug || !market || !isMarketResolved(market)) return;
    fetchMarketResolution(slug).then((data) => {
      if (data?.timeline) setResolutionTimeline(data.timeline);
    });
  }, [slug, market]);

  useEffect(() => {
    if (!slug || !market || !isMarketResolved(market) || !user) return;
    const key = `settlement-seen-${slug}`;
    if (typeof window !== "undefined" && sessionStorage.getItem(key)) return;
    fetchMySettlement(slug).then((data) => {
      if (data?.settlement) {
        setSettlement(data.settlement);
        setShowSettlement(true);
        sessionStorage.setItem(key, "1");
      }
    });
  }, [slug, market, user]);

  const enriched = useMemo(
    () => (market ? enrichMarketDetail(market) : null),
    [market],
  );

  const relatedMarkets = useMemo(() => {
    if (!enriched || allMarkets.length === 0) return [];
    return allMarkets
      .filter((m) => (m.slug ?? titleToSlug(m.title)) !== slug)
      .filter(
        (m) =>
          m.category === enriched.category ||
          m.urgency === enriched.urgency ||
          m.narrative.toLowerCase().includes(enriched.category.toLowerCase()),
      )
      .slice(0, 4);
  }, [allMarkets, enriched, slug]);

  if (!slug) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center">
        <p className="text-zinc-500 text-sm">Invalid market.</p>
      </div>
    );
  }

  return (
    <FeedShell activeNav="Markets" hideCategoryNav>
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        {usingFallback && !loading && (
          <span className="text-[10px] text-zinc-600">Demo market — API offline</span>
        )}
        <Link
          href="/markets"
          className="text-[10px] text-zinc-500 hover:text-zinc-300 ml-auto transition"
        >
          All markets →
        </Link>
      </div>

      {loading && (
        <div className="space-y-2 py-2">
          <div className="h-14 rounded-lg border border-zinc-800/60 bg-zinc-900/40 animate-pulse" />
          <div className="h-[580px] rounded-lg border border-zinc-800/60 bg-zinc-900/40 animate-pulse" />
          <div className="h-20 rounded-lg border border-zinc-800/60 bg-zinc-900/40 animate-pulse" />
        </div>
      )}

      {!loading && enriched && (
        <>
          {isMarketResolved(enriched) && resolutionTimeline && (
            <div className="mb-2">
              <ResolutionTimelinePanel timeline={resolutionTimeline} />
            </div>
          )}

          <div className="grid lg:grid-cols-[minmax(0,1fr)_300px] xl:grid-cols-[minmax(0,1fr)_320px] gap-x-4 xl:gap-x-5 gap-y-1 items-start">
            <MarketDetailHeader
              market={enriched}
              selectedSide={initialSide}
              className="lg:col-span-2"
            />

            <main className="min-w-0 lg:col-start-1 lg:row-start-2 space-y-2">
              <MarketChartSection market={enriched} />
              <MobileMarketIntel market={enriched} />
              <WhyItMovedSection market={enriched} />
              <AgentConsensusSection market={enriched} selectedSide={initialSide} />
              <MarketBattlesSection market={enriched} battles={battles} />
              <MarketVerifiedCallsSection
                calls={enriched.verified_calls ?? []}
                marketSlug={enriched.slug}
                category={enriched.category}
              />
              <MarketDiscussionSection market={enriched} offline={usingFallback} />
              <MarketResolutionRulesSection market={enriched} />
              <RelatedMarketsSection markets={relatedMarkets} />
            </main>

            <div className="hidden lg:block min-w-0 lg:col-start-2 lg:row-start-2 lg:self-start">
              <ScryPositionPanel market={enriched} chartAligned />
            </div>
          </div>

          {showSettlement && settlement && (
            <ReputationSettlementModal
              settlement={settlement}
              onClose={() => setShowSettlement(false)}
            />
          )}
        </>
      )}
    </FeedShell>
  );
}
