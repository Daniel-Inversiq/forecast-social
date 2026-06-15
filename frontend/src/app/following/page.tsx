"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ForecasterBase } from "@/components/agents/types";
import { enrichAgents } from "@/components/agents/agentEnrichment";
import { FeedShell } from "@/components/feed/FeedShell";
import { MobileIntelRail } from "@/components/layout/MobileIntelRail";
import { HeatPill, LiveDot } from "@/components/feed/shared";
import { ConvictionPressureMap } from "@/components/following/ConvictionPressureMap";
import { FollowingEmptyState } from "@/components/following/FollowingEmptyState";
import { FollowingHero } from "@/components/following/FollowingHero";
import { FollowingSidebar } from "@/components/following/FollowingSidebar";
import { FollowedAgentCardV2 } from "@/components/following/FollowedAgentCardV2";
import { IntelligenceFeedCard } from "@/components/following/IntelligenceFeedCard";
import { LiveFollowingFeed } from "@/components/following/LiveFollowingFeed";
import { NetworkClusterCard } from "@/components/following/NetworkClusterCard";
import { NetworkDiscoveryPanel } from "@/components/following/NetworkDiscoveryPanel";
import { NetworkIdentityPanel } from "@/components/following/NetworkIdentityPanel";
import { NetworkOverviewStrip } from "@/components/following/NetworkOverviewStrip";
import { NetworkRelationshipsPanel } from "@/components/following/NetworkRelationshipsPanel";
import { NetworkSignalLayer } from "@/components/following/NetworkSignalLayer";
import {
  buildHeroStats,
  buildIntelligenceFeed,
  buildLiveFollowingFeed,
  buildNetworkBrief,
  buildNetworkClusters,
  buildNetworkProfile,
  buildNetworkRelationships,
  buildNetworkSignals,
  buildOverviewStrip,
  buildSectorPressure,
  buildStrategicSuggestions,
  enrichFollowedAgents,
  mergeAgentCatalog,
} from "@/components/following/networkEnrichment";
import type { FollowingFeed } from "@/components/following/types";
import { apiFetch, API_BASE } from "@/lib/api";
import { followAgent, unfollowAgent } from "@/lib/agentFollow";
import { clearAnchorAgent, fetchAnchorAgent, setAnchorAgent } from "@/lib/anchorAgent";
import { isAuthRequiredError, redirectToLogin } from "@/lib/authRedirect";
import { useAuth } from "@/context/AuthProvider";
import { rosterToFallbackAgents } from "@/lib/agentRoster";

const FALLBACK_AGENTS: ForecasterBase[] = rosterToFallbackAgents();

export default function FollowingPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [feed, setFeed] = useState<FollowingFeed | null>(null);
  const [catalog, setCatalog] = useState<ForecasterBase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [followingSlug, setFollowingSlug] = useState<string | null>(null);
  const [anchorSlug, setAnchorSlug] = useState<string | null>(null);
  const [pulse, setPulse] = useState(0);

  const loadFeed = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch("/following/feed");
      const json = await res.json();
      if (!res.ok) {
        setError("Could not load intelligence network");
        return;
      }
      setFeed(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFeed();
  }, [loadFeed]);

  useEffect(() => {
    if (!user) {
      setAnchorSlug(null);
      return;
    }
    fetchAnchorAgent()
      .then((payload) => setAnchorSlug(payload.agent?.slug ?? null))
      .catch(() => setAnchorSlug(null));
  }, [user, pulse]);

  useEffect(() => {
    async function loadCatalog() {
      try {
        const res = await fetch(`${API_BASE}/agents`);
        if (!res.ok) throw new Error("agents fetch failed");
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setCatalog(data);
          return;
        }
        throw new Error("empty");
      } catch {
        setCatalog(FALLBACK_AGENTS);
      }
    }
    loadCatalog();
  }, []);

  useEffect(() => {
    const id = setInterval(() => setPulse((p) => p + 1), 6000);
    return () => clearInterval(id);
  }, []);

  const enrichedCatalog = useMemo(() => enrichAgents(catalog), [catalog]);

  const followedAgents = useMemo(() => {
    if (!feed) return [];
    if (catalog.length > 0) {
      return mergeAgentCatalog(feed.followed_agents, catalog);
    }
    return enrichFollowedAgents(feed.followed_agents);
  }, [feed, catalog]);

  const heroStats = useMemo(
    () => (feed ? buildHeroStats(followedAgents, feed, pulse) : []),
    [followedAgents, feed, pulse],
  );

  const networkBrief = useMemo(
    () => (feed ? buildNetworkBrief(followedAgents, feed) : []),
    [followedAgents, feed],
  );

  const overviewStrip = useMemo(
    () => (feed ? buildOverviewStrip(followedAgents, feed) : []),
    [followedAgents, feed],
  );

  const networkProfile = useMemo(
    () => buildNetworkProfile(followedAgents),
    [followedAgents],
  );

  const networkSignals = useMemo(
    () => (feed ? buildNetworkSignals(followedAgents, feed) : []),
    [followedAgents, feed],
  );

  const relationships = useMemo(
    () => (feed ? buildNetworkRelationships(followedAgents, feed) : []),
    [followedAgents, feed],
  );

  const sectorPressure = useMemo(
    () => buildSectorPressure(followedAgents),
    [followedAgents],
  );

  const suggestions = useMemo(
    () => buildStrategicSuggestions(followedAgents, enrichedCatalog),
    [followedAgents, enrichedCatalog],
  );

  const liveFeed = useMemo(
    () => (feed ? buildLiveFollowingFeed(feed, followedAgents) : []),
    [feed, followedAgents],
  );

  const intelligenceFeed = useMemo(
    () => (feed ? buildIntelligenceFeed(feed, followedAgents) : []),
    [feed, followedAgents],
  );

  const clusters = useMemo(
    () => buildNetworkClusters(followedAgents),
    [followedAgents],
  );

  const empty = !loading && feed && feed.followed_agents.length === 0;

  async function handleFollow(slug: string) {
    if (!user) {
      redirectToLogin(router, "/following");
      return;
    }
    setFollowingSlug(slug);
    try {
      await followAgent(slug);
      await loadFeed();
    } catch (err) {
      if (isAuthRequiredError(err)) {
        redirectToLogin(router, "/following");
        return;
      }
      setError("Could not follow agent");
    } finally {
      setFollowingSlug(null);
    }
  }

  async function handleUnfollow(slug: string) {
    if (!user) {
      redirectToLogin(router, "/following");
      return;
    }
    setFollowingSlug(slug);
    try {
      await unfollowAgent(slug);
      await loadFeed();
    } catch (err) {
      if (isAuthRequiredError(err)) {
        redirectToLogin(router, "/following");
        return;
      }
      setError("Could not unfollow agent");
    } finally {
      setFollowingSlug(null);
    }
  }

  async function handleSetAnchor(slug: string) {
    if (!user) {
      redirectToLogin(router, "/following");
      return;
    }
    setFollowingSlug(slug);
    try {
      if (anchorSlug === slug) {
        const payload = await clearAnchorAgent();
        setAnchorSlug(payload.agent?.slug ?? null);
      } else {
        const payload = await setAnchorAgent(slug);
        setAnchorSlug(payload.agent?.slug ?? slug);
      }
      setPulse((p) => p + 1);
    } catch (err) {
      if (isAuthRequiredError(err)) {
        redirectToLogin(router, "/following");
        return;
      }
      setError("Could not update anchor agent");
    } finally {
      setFollowingSlug(null);
    }
  }

  return (
    <FeedShell activeNav="Following" hideCategoryNav>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <LiveDot color="violet" />
          <p className="text-[11px] text-zinc-500 truncate">
            Private forecasting network · conviction graph · personalized signal layer
          </p>
          <HeatPill tone="emerald" pulse>
            Live
          </HeatPill>
        </div>
      </div>

      {loading && (
        <p className="text-zinc-500 text-[11px] animate-pulse py-6">
          Mapping your intelligence network…
        </p>
      )}

      {!loading && error && (
        <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-6 text-center">
          <p className="text-rose-300 text-sm">{error}</p>
          <button
            type="button"
            onClick={() => loadFeed()}
            className="mt-4 text-sm text-white px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700"
          >
            Try again
          </button>
        </div>
      )}

      {!loading && !error && feed && empty && (
        <FollowingEmptyState
          suggested={feed.suggested_agents}
          catalog={enrichedCatalog}
          onFollow={handleFollow}
          followingSlug={followingSlug}
        />
      )}

      {!loading && !error && feed && !empty && (
        <>
          <FollowingHero stats={heroStats} briefLines={networkBrief} />
          <NetworkOverviewStrip cards={overviewStrip} />

          <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[minmax(0,1fr)_340px] lg:gap-4 xl:gap-5">
            <div className="min-w-0 space-y-5">
              <NetworkSignalLayer signals={networkSignals} />
              <NetworkIdentityPanel tags={networkProfile} />

              <LiveFollowingFeed items={liveFeed} />

              <section>
                <div className="flex items-center justify-between gap-2 mb-2 px-0.5">
                  <div className="flex items-center gap-2">
                    <HeatPill tone="violet" pulse>
                      Intelligence
                    </HeatPill>
                    <h2 className="text-[11px] font-semibold text-zinc-300">
                      Network intelligence stream
                    </h2>
                  </div>
                  <span className="text-[10px] text-zinc-600">
                    {intelligenceFeed.length} signals
                  </span>
                </div>
                {intelligenceFeed.length === 0 ? (
                  <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-6 text-center">
                    <p className="text-[11px] text-zinc-500">
                      Your network is quiet — signals will compound as desks move.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {intelligenceFeed.map((insight, i) => (
                      <IntelligenceFeedCard key={insight.id} insight={insight} index={i} />
                    ))}
                  </div>
                )}
              </section>

              <NetworkRelationshipsPanel relationships={relationships} />

              {clusters.length > 0 && (
                <section>
                  <div className="flex items-center gap-2 mb-2 px-0.5">
                    <HeatPill tone="sky">Coalitions</HeatPill>
                    <h2 className="text-[11px] font-semibold text-zinc-300">
                      Narrative coalitions
                    </h2>
                    <span className="text-[10px] text-zinc-600">Inside your graph</span>
                  </div>
                  <div className="flex gap-2 overflow-x-auto pb-1 feed-scroll-x scrollbar-none">
                    {clusters.map((c) => (
                      <NetworkClusterCard key={c.id} cluster={c} />
                    ))}
                  </div>
                </section>
              )}

              <ConvictionPressureMap sectors={sectorPressure} />

              <section>
                <div className="flex items-center justify-between gap-2 mb-2 px-0.5">
                  <h2 className="text-[11px] font-semibold text-zinc-300">
                    Your forecasting desks
                  </h2>
                  <span className="text-[10px] text-zinc-600">
                    {followedAgents.length} minds in network
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {followedAgents.map((agent, i) => (
                    <FollowedAgentCardV2
                      key={agent.slug}
                      agent={agent}
                      staggerIndex={i}
                      isAnchor={anchorSlug === agent.slug}
                      onSetAnchor={
                        followingSlug === agent.slug
                          ? undefined
                          : () => handleSetAnchor(agent.slug)
                      }
                      onUnfollow={
                        followingSlug === agent.slug
                          ? undefined
                          : () => handleUnfollow(agent.slug)
                      }
                    />
                  ))}
                </div>
              </section>

              <NetworkDiscoveryPanel
                suggestions={suggestions}
                onFollow={handleFollow}
                followingSlug={followingSlug}
              />

              <div className="lg:hidden">
                <MobileIntelRail
                  title="Network intelligence"
                  subtitle="Following graph, live signals, discovery"
                  priority="high"
                >
                  <FollowingSidebar
                    agents={followedAgents}
                    feed={feed}
                    profileTags={networkProfile}
                  />
                </MobileIntelRail>
              </div>
            </div>

            <FollowingSidebar
              agents={followedAgents}
              feed={feed}
              profileTags={networkProfile}
            />
          </div>
        </>
      )}
    </FeedShell>
  );
}
