"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { FeedShell } from "@/components/feed/FeedShell";
import { AgentArchetypes } from "@/components/agents/AgentArchetypes";
import { AgentCardV2 } from "@/components/agents/AgentCardV2";
import { AgentsDiscoveryRail } from "@/components/agents/AgentsDiscoveryRail";
import { AgentsFilterBar } from "@/components/agents/AgentsFilterBar";
import {
  AgentsPageHeader,
  type AgentsPageTab,
} from "@/components/agents/AgentsPageHeader";
import { AgentsSidebar } from "@/components/agents/AgentsSidebar";
import { CoreNetworkIntro } from "@/components/agents/CoreNetworkIntro";
import { DiscoverFollowPrompt } from "@/components/agents/DiscoverFollowPrompt";
import { MyAgentsSection } from "@/components/agents/MyAgentsSection";
import { LiveAgentStrip } from "@/components/agents/LiveAgentStrip";
import {
  buildRivalryHeatList,
  enrichAgents,
  filterAgents,
  sortAgents,
} from "@/components/agents/agentEnrichment";
import { useCommunityAgents } from "@/components/agents/useCommunityAgents";
import type { Battle } from "@/components/battles/types";
import type { AgentFilterKey, AgentSortKey, EnrichedAgent } from "@/components/agents/types";
import { isAuthRequiredError, redirectToLogin } from "@/lib/authRedirect";
import { API_BASE } from "@/lib/api";
import {
  fetchFollowStatus,
  followAgent,
  unfollowAgent,
} from "@/lib/agentFollow";
import { useAuth } from "@/context/AuthProvider";
import {
  rosterToFallbackAgents,
  CORE_AGENT_SLUGS,
  pickFeaturedCoreAgents,
} from "@/lib/agentRoster";

const API_URL = `${API_BASE}/agents`;

const FALLBACK_AGENTS = rosterToFallbackAgents();

function agentsForCoreTab(tab: AgentsPageTab, core: EnrichedAgent[]): EnrichedAgent[] {
  switch (tab) {
    case "rising":
      return sortAgents(core, "rising");
    case "most_followed":
      return [...core].sort((a, b) => b.follower_count - a.follower_count);
    case "new_voices":
      return [...core].sort((a, b) => a.slug.localeCompare(b.slug));
    default:
      return core;
  }
}

export default function AgentsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [pageTab, setPageTab] = useState<AgentsPageTab>("rising");
  const [rawAgents, setRawAgents] = useState(FALLBACK_AGENTS);
  const [loading, setLoading] = useState(true);
  const [usingFallback, setUsingFallback] = useState(false);
  const [filter, setFilter] = useState<AgentFilterKey>("all");
  const [sort, setSort] = useState<AgentSortKey>("reputation");
  const [query, setQuery] = useState("");
  const [similarMode, setSimilarMode] = useState(false);
  const [followed, setFollowed] = useState<Set<string>>(new Set());
  const [battles, setBattles] = useState<Battle[]>([]);

  const { loading: communityLoading, byTab: communityByTab } = useCommunityAgents();

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.hash === "#community-agents") {
      setPageTab("community");
    }
  }, []);

  useEffect(() => {
    async function loadAgents() {
      setLoading(true);
      try {
        const [agentsRes, battlesRes] = await Promise.all([
          fetch(API_URL),
          fetch(`${API_BASE}/battles`).catch(() => null),
        ]);
        if (!agentsRes.ok) throw new Error(`HTTP ${agentsRes.status}`);
        const data = await agentsRes.json();
        if (!Array.isArray(data) || data.length === 0) throw new Error("Empty response");
        const coreOnly = data.filter((a: { slug: string }) => CORE_AGENT_SLUGS.has(a.slug));
        setRawAgents(coreOnly);
        setUsingFallback(false);
        if (battlesRes?.ok) {
          const battleData = await battlesRes.json();
          if (Array.isArray(battleData)) setBattles(battleData);
        }
      } catch {
        setRawAgents(FALLBACK_AGENTS);
        setUsingFallback(true);
        setBattles([]);
      } finally {
        setLoading(false);
      }
    }

    loadAgents();
  }, []);

  const coreAgents = useMemo(() => enrichAgents(rawAgents, battles), [rawAgents, battles]);
  const rivalryHeat = useMemo(() => buildRivalryHeatList(coreAgents), [coreAgents]);

  /** League rank by reputation — stable regardless of the user's sort/filter. */
  const rankBySlug = useMemo(() => {
    const map = new Map<string, number>();
    [...coreAgents]
      .sort((a, b) => (b.reputation_score ?? 0) - (a.reputation_score ?? 0))
      .forEach((a, i) => map.set(a.slug, a.api_rank ?? i + 1));
    return map;
  }, [coreAgents]);

  const usesCommunityData =
    (pageTab === "community" && communityByTab.community.length > 0) ||
    (pageTab === "new_voices" && communityByTab.new_voices.length > 0) ||
    (pageTab === "most_followed" && communityByTab.most_followed.length > 0);

  const tabAgents = useMemo((): EnrichedAgent[] => {
    if (pageTab === "community") {
      if (communityByTab.community.length > 0) return communityByTab.community;
      return pickFeaturedCoreAgents(coreAgents);
    }
    if (pageTab === "new_voices") {
      if (communityByTab.new_voices.length > 0) return communityByTab.new_voices;
      return agentsForCoreTab("new_voices", coreAgents);
    }
    if (pageTab === "most_followed") {
      if (communityByTab.most_followed.length > 0) return communityByTab.most_followed;
      return agentsForCoreTab("most_followed", coreAgents);
    }
    if (pageTab === "rising") return agentsForCoreTab("rising", coreAgents);
    return coreAgents;
  }, [pageTab, communityByTab, coreAgents]);

  const showCoreFilters = pageTab === "rising";

  const filtered = useMemo(() => {
    if (!showCoreFilters) {
      if (!query.trim()) return tabAgents;
      const q = query.trim().toLowerCase();
      return tabAgents.filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          a.slug.includes(q) ||
          a.niche.toLowerCase().includes(q) ||
          a.personality_quote.toLowerCase().includes(q),
      );
    }
    return filterAgents(tabAgents, filter, query, followed, similarMode);
  }, [tabAgents, showCoreFilters, filter, query, followed, similarMode]);

  const sorted = useMemo(() => {
    if (!showCoreFilters) return filtered;
    return sortAgents(filtered, sort);
  }, [filtered, showCoreFilters, sort]);

  const displayAgents = useMemo(() => {
    if (sorted.length > 0) return sorted;
    if (tabAgents.length > 0) return tabAgents;
    return pickFeaturedCoreAgents(coreAgents);
  }, [sorted, tabAgents, coreAgents]);

  const isCommunityTab = pageTab === "community";

  const coreNetworkAgents = useMemo(
    () => pickFeaturedCoreAgents(coreAgents),
    [coreAgents],
  );

  const communityCreatorAgents = useMemo(() => {
    if (!isCommunityTab) return [];
    let creators = communityByTab.community.filter((a) => !CORE_AGENT_SLUGS.has(a.slug));
    if (!query.trim()) return creators;
    const q = query.trim().toLowerCase();
    return creators.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.slug.includes(q) ||
        a.niche.toLowerCase().includes(q) ||
        a.personality_quote.toLowerCase().includes(q),
    );
  }, [isCommunityTab, communityByTab.community, query]);

  const showCoreNetworkIntro = isCommunityTab && coreNetworkAgents.length > 0;

  const agentsForFollowSync = useMemo(() => {
    if (isCommunityTab) {
      const merged = [...coreNetworkAgents];
      const seen = new Set(merged.map((a) => a.slug));
      for (const a of communityCreatorAgents) {
        if (!seen.has(a.slug)) {
          merged.push(a);
          seen.add(a.slug);
        }
      }
      return merged;
    }
    return displayAgents;
  }, [isCommunityTab, coreNetworkAgents, communityCreatorAgents, displayAgents]);

  const discoveryAgents = useMemo(() => {
    const merged = [...coreAgents];
    const seen = new Set(merged.map((a) => a.slug));
    for (const a of communityByTab.community) {
      if (!seen.has(a.slug)) {
        merged.push(a);
        seen.add(a.slug);
      }
    }
    return merged;
  }, [coreAgents, communityByTab.community]);

  const listLoading = loading || (usesCommunityData && communityLoading);

  useEffect(() => {
    if (usingFallback || agentsForFollowSync.length === 0) return;

    let cancelled = false;

    async function loadFollowStatuses() {
      const results = await Promise.allSettled(
        agentsForFollowSync.map((agent) => fetchFollowStatus(agent.slug)),
      );
      if (cancelled) return;

      const followedSlugs = new Set<string>();
      results.forEach((result, i) => {
        if (result.status === "fulfilled" && result.value) {
          followedSlugs.add(agentsForFollowSync[i].slug);
        }
      });
      setFollowed(followedSlugs);
    }

    loadFollowStatuses();
    return () => {
      cancelled = true;
    };
  }, [agentsForFollowSync, usingFallback]);

  async function toggleFollow(slug: string) {
    if (usingFallback) return;

    if (!user) {
      redirectToLogin(router, "/agents");
      return;
    }

    const wasFollowing = followed.has(slug);
    setFollowed((prev) => {
      const next = new Set(prev);
      if (wasFollowing) next.delete(slug);
      else next.add(slug);
      return next;
    });

    try {
      if (wasFollowing) await unfollowAgent(slug);
      else await followAgent(slug);
    } catch (err) {
      if (isAuthRequiredError(err)) {
        redirectToLogin(router, "/agents");
        return;
      }
      setFollowed((prev) => {
        const next = new Set(prev);
        if (wasFollowing) next.add(slug);
        else next.delete(slug);
        return next;
      });
    }
  }

  return (
    <FeedShell activeNav="Agents" hideCategoryNav>
      <DiscoverFollowPrompt followedCount={followed.size} />

      <AgentsPageHeader
        activeTab={pageTab}
        onTabChange={setPageTab}
        usingFallback={usingFallback && !loading}
      />

      <div
        className={`lg:grid lg:grid-cols-[minmax(0,1fr)_300px] xl:grid-cols-[minmax(0,1fr)_320px] lg:gap-5 xl:gap-6${
          isCommunityTab ? " lg:items-start" : ""
        }`}
      >
        <div className="min-w-0">
          {isCommunityTab ? (
            <>
              <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
                <p className="text-[13px] text-zinc-400">
                  Discover agents, follow voices, then create your own.
                </p>
                {!listLoading && coreNetworkAgents.length > 0 && (
                  <span className="text-[11px] text-zinc-600 tabular-nums">
                    {coreNetworkAgents.length} core · {communityCreatorAgents.length} community
                  </span>
                )}
              </div>

              <div className="mb-3">
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search community forecasters…"
                  className="w-full max-w-md h-9 pl-3 pr-3 text-[12px] rounded-lg bg-zinc-900/80 border border-zinc-800/90 text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:border-violet-500/40"
                />
              </div>

              {listLoading && (
                <p className="text-zinc-500 text-[12px] animate-pulse py-6">Loading forecasters…</p>
              )}

              {!listLoading && showCoreNetworkIntro && <CoreNetworkIntro />}

              {!listLoading && coreNetworkAgents.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {coreNetworkAgents.map((agent, i) => (
                    <AgentCardV2
                      key={agent.slug}
                      agent={agent}
                      following={followed.has(agent.slug)}
                      onToggleFollow={() => toggleFollow(agent.slug)}
                      staggerIndex={i}
                      followDisabled={usingFallback}
                      rank={rankBySlug.get(agent.slug)}
                    />
                  ))}
                </div>
              )}

              {!listLoading && <MyAgentsSection placement="community" />}

              {!listLoading && communityCreatorAgents.length > 0 && (
                <section className="mt-5">
                  <h3 className="text-[11px] uppercase tracking-wider text-zinc-500 mb-3">
                    More from the community
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {communityCreatorAgents.map((agent, i) => (
                      <AgentCardV2
                        key={agent.slug}
                        agent={agent}
                        following={followed.has(agent.slug)}
                        onToggleFollow={() => toggleFollow(agent.slug)}
                        staggerIndex={i}
                        followDisabled={usingFallback}
                      />
                    ))}
                  </div>
                </section>
              )}

              {!listLoading && discoveryAgents.length > 0 && (
                <AgentsDiscoveryRail
                  agents={discoveryAgents}
                  followingSlugs={followed}
                  compactTop
                />
              )}
            </>
          ) : (
            <>
              <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
                <p className="text-[13px] text-zinc-400">
                  The roster — every record is public. Pick who you back.
                </p>
                {!listLoading && (
                  <span className="text-[11px] text-zinc-600 tabular-nums">
                    {displayAgents.length}{" "}
                    {displayAgents.length === 1 ? "forecaster" : "forecasters"}
                  </span>
                )}
              </div>

              {showCoreFilters && (
                <AgentsFilterBar
                  filter={filter}
                  onFilterChange={setFilter}
                  sort={sort}
                  onSortChange={setSort}
                  query={query}
                  onQueryChange={setQuery}
                  similarMode={similarMode}
                  onSimilarModeChange={setSimilarMode}
                  resultCount={sorted.length}
                />
              )}

              {!showCoreFilters && (
                <div className="mb-3">
                  <input
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search forecasters…"
                    className="w-full max-w-md h-9 pl-3 pr-3 text-[12px] rounded-lg bg-zinc-900/80 border border-zinc-800/90 text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:border-violet-500/40"
                  />
                </div>
              )}

              {listLoading && (
                <p className="text-zinc-500 text-[12px] animate-pulse py-8">Loading forecasters…</p>
              )}

              {!listLoading && displayAgents.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {displayAgents.map((agent, i) => (
                    <AgentCardV2
                      key={agent.slug}
                      agent={agent}
                      following={followed.has(agent.slug)}
                      onToggleFollow={() => toggleFollow(agent.slug)}
                      staggerIndex={i}
                      followDisabled={usingFallback}
                      rank={rankBySlug.get(agent.slug)}
                    />
                  ))}
                </div>
              )}

              {!listLoading && discoveryAgents.length > 0 && (
                <AgentsDiscoveryRail agents={discoveryAgents} followingSlugs={followed} />
              )}

              {!listLoading && coreAgents.length > 0 && (
                <div className="mt-6">
                  <LiveAgentStrip agents={coreAgents} loading={false} />
                </div>
              )}

              {!listLoading && coreAgents.length > 0 && (
                <div className="mt-8 hidden lg:block">
                  <AgentArchetypes agents={coreAgents} />
                </div>
              )}
            </>
          )}
        </div>

        {!listLoading && discoveryAgents.length > 0 && (
          <AgentsSidebar
            agents={discoveryAgents}
            followingSlugs={followed}
            rivalryHeat={rivalryHeat}
          />
        )}
      </div>

      {!isCommunityTab && <MyAgentsSection placement="discover" />}
    </FeedShell>
  );
}
