"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ForecasterBase } from "@/components/agents/types";
import { FollowedAgentCardV2 } from "@/components/following/FollowedAgentCardV2";
import { IntelligenceFeedCard } from "@/components/following/IntelligenceFeedCard";
import { NetworkClusterCard } from "@/components/following/NetworkClusterCard";
import {
  buildIntelligenceFeed,
  buildNetworkClusters,
  enrichFollowedAgents,
  mergeAgentCatalog,
} from "@/components/following/networkEnrichment";
import type { FollowingFeed } from "@/components/following/types";
import { HeatPill } from "@/components/feed/shared";
import { apiFetch, API_BASE } from "@/lib/api";
import { rosterToFallbackAgents } from "@/lib/agentRoster";

const FALLBACK_AGENTS: ForecasterBase[] = rosterToFallbackAgents();

export function UserProfileFollowingTab() {
  const [feed, setFeed] = useState<FollowingFeed | null>(null);
  const [catalog, setCatalog] = useState<ForecasterBase[]>([]);
  const [loading, setLoading] = useState(true);

  const loadFeed = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/following/feed");
      if (res.ok) setFeed(await res.json());
    } catch {
      setFeed(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFeed();
  }, [loadFeed]);

  useEffect(() => {
    async function loadCatalog() {
      try {
        const res = await fetch(`${API_BASE}/agents`);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            setCatalog(data);
            return;
          }
        }
      } catch {
        /* fallback */
      }
      setCatalog(FALLBACK_AGENTS);
    }
    loadCatalog();
  }, []);

  const followed = useMemo(() => {
    if (!feed?.followed_agents?.length) return [];
    if (catalog.length > 0) {
      return mergeAgentCatalog(feed.followed_agents, catalog);
    }
    return enrichFollowedAgents(feed.followed_agents);
  }, [feed, catalog]);

  const intelligence = useMemo(
    () => (feed ? buildIntelligenceFeed(feed, followed) : []),
    [feed, followed],
  );
  const clusters = useMemo(() => buildNetworkClusters(followed), [followed]);

  if (loading) {
    return (
      <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-10 flex justify-center">
        <div className="h-6 w-6 rounded-full border-2 border-violet-500/30 border-t-violet-400 animate-spin" />
      </div>
    );
  }

  if (!feed?.followed_agents?.length) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-dashed border-zinc-800/80 bg-zinc-950/50 p-8 text-center">
          <p className="text-[12px] text-zinc-400">No agents in your intelligence network yet.</p>
          <p className="text-[11px] text-zinc-600 mt-2 max-w-sm mx-auto">
            Follow forecasting agents to tune your conviction feed and narrative signals.
          </p>
          <Link
            href="/agents"
            className="inline-block mt-4 text-[11px] font-medium text-violet-300 hover:text-violet-200 border border-violet-500/30 px-4 py-2 rounded-lg"
          >
            Browse agent directory
          </Link>
        </div>
        <Link
          href="/following"
          className="block text-center text-[11px] text-violet-400 hover:text-violet-300 py-2"
        >
          Open full following network →
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 px-0.5">
        <HeatPill tone="violet">Network</HeatPill>
        <p className="text-[11px] text-zinc-500">
          {followed.length} agents · intelligence feed preferences
        </p>
        <Link href="/following" className="ml-auto text-[10px] text-violet-400 hover:text-violet-300">
          Full feed →
        </Link>
      </div>

      {clusters.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {clusters.slice(0, 2).map((c) => (
            <NetworkClusterCard key={c.id} cluster={c} />
          ))}
        </div>
      )}

      <div>
        <p className="text-[10px] uppercase tracking-wider text-zinc-600 mb-2">Followed agents</p>
        <div className="space-y-2">
          {followed.slice(0, 6).map((a, i) => (
            <FollowedAgentCardV2 key={a.slug} agent={a} staggerIndex={i} />
          ))}
        </div>
      </div>

      {intelligence.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-wider text-zinc-600 mb-2">
            Narrative signals
          </p>
          <div className="space-y-2">
            {intelligence.slice(0, 4).map((insight, i) => (
              <IntelligenceFeedCard key={insight.id} insight={insight} index={i} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
