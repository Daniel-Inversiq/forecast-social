"use client";

import { HeatPill } from "@/components/feed/shared";
import { BattlefieldHeroModules } from "./BattlefieldHeroModules";
import { FeaturedMarketModules } from "./FeaturedMarketModules";
import { MarketFeedCardV2 } from "./MarketFeedCardV2";
import { MarketPulseStrip } from "./MarketPulseStrip";
import { NarrativeClusterCard } from "./NarrativeClusterCard";
import { ResolvedMarketArchiveCard } from "./ResolvedMarketArchiveCard";
import type {
  BattlefieldModule,
  EnrichedMarket,
  FeaturedModule,
  NarrativeCluster,
  MarketFilterKey,
} from "./types";

export function MarketsIntelligenceSection({
  battlefield,
  featured,
  clusters,
  markets,
  loading,
  openFeed,
  resolvedHorizonFeed,
  showingResolvedHorizon,
  sortedCount,
  resolvedArchive,
  filter,
  query,
}: {
  battlefield: BattlefieldModule[];
  featured: FeaturedModule[];
  clusters: NarrativeCluster[];
  markets: EnrichedMarket[];
  loading: boolean;
  openFeed: EnrichedMarket[];
  resolvedHorizonFeed: EnrichedMarket[];
  showingResolvedHorizon: boolean;
  sortedCount: number;
  resolvedArchive: EnrichedMarket[];
  filter: MarketFilterKey;
  query: string;
}) {
  const feedItems = showingResolvedHorizon ? resolvedHorizonFeed : openFeed;
  const hasIntel =
    battlefield.length > 0 ||
    featured.length > 0 ||
    clusters.length > 0 ||
    feedItems.length > 0;

  if (!hasIntel && !loading) return null;

  return (
    <section className="mt-8 pt-6 border-t border-zinc-800/60 space-y-5">
      <div className="px-0.5">
        <h2 className="text-[11px] font-semibold text-zinc-400">Analysis & narrative</h2>
        <p className="text-[10px] text-zinc-600 mt-0.5">
          Deeper context after you pick a market — not the default scan view.
        </p>
      </div>

      <BattlefieldHeroModules modules={battlefield} />
      <MarketPulseStrip markets={markets} loading={loading} />
      <FeaturedMarketModules modules={featured} />

      {clusters.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2 px-0.5">
            <HeatPill tone="sky">Clusters</HeatPill>
            <span className="text-[10px] text-zinc-600">Connected conviction stories</span>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 feed-scroll-x scrollbar-none">
            {clusters.map((c) => (
              <NarrativeClusterCard key={c.id} cluster={c} />
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="flex items-center justify-between gap-2 mb-2 px-0.5">
          <span className="text-[10px] text-zinc-500">Detailed market feed</span>
          <span className="text-[10px] text-zinc-600 tabular-nums">{sortedCount} markets</span>
        </div>
        {feedItems.length === 0 && sortedCount === 0 ? (
          <div className="rounded-lg border border-zinc-800/80 bg-zinc-950/60 p-4 text-center">
            <p className="text-[11px] text-zinc-500">No markets match this lens.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {feedItems.map((market, i) => (
              <MarketFeedCardV2 key={market.slug} market={market} index={i} />
            ))}
          </div>
        )}
      </div>

      {resolvedArchive.length > 0 && filter === "all" && !query.trim() && (
        <div>
          <div className="flex items-center gap-2 mb-2 px-0.5">
            <HeatPill tone="emerald">Archive</HeatPill>
            <span className="text-[10px] text-zinc-600">Resolved markets</span>
          </div>
          <div className="space-y-2">
            {resolvedArchive.slice(0, 4).map((market) => (
              <ResolvedMarketArchiveCard key={market.slug} market={market} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
