"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AgentCardV2 } from "@/components/agents/AgentCardV2";
import { enrichAgents } from "@/components/agents/agentEnrichment";
import type { ForecasterBase } from "@/components/agents/types";
import { Avatar, HeatPill, LiveDot } from "@/components/feed/shared";
import { fetchForecasterDiscovery, type ForecasterCard } from "@/lib/creatorForecaster";

type SectionKey = "trending" | "rising" | "newest" | "most_followed";

const CREATOR_SECTIONS: { key: SectionKey; label: string }[] = [
  { key: "trending", label: "Trending" },
  { key: "rising", label: "Rising" },
  { key: "newest", label: "Newest" },
  { key: "most_followed", label: "Most Followed" },
];

function cardToBase(card: ForecasterCard): ForecasterBase {
  return {
    name: card.name,
    slug: card.slug,
    niche: card.niche,
    conviction_style: card.conviction_style,
    personality_tagline: card.personality_tagline,
    avatar_color: card.avatar_color,
    streak: 0,
    accuracy_score: 0,
    follower_count: card.follower_count,
    reputation_score: card.reputation_score,
    tier_label: card.tier_label,
    reputation_velocity: card.reputation_velocity,
    reputation_trend: card.reputation_trend as ForecasterBase["reputation_trend"],
  };
}

export function CommunityAgentsSection() {
  const [section, setSection] = useState<SectionKey>("trending");
  const [coreAgents, setCoreAgents] = useState<ForecasterCard[]>([]);
  const [sections, setSections] = useState<Record<SectionKey, ForecasterCard[]>>({
    trending: [],
    rising: [],
    newest: [],
    most_followed: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const data = await fetchForecasterDiscovery();
        setCoreAgents(data.core_agents);
        setSections(data.sections);
      } catch {
        setCoreAgents([]);
        setSections({ trending: [], rising: [], newest: [], most_followed: [] });
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const sectionItems = sections[section] ?? [];
  const enrichedCreators = useMemo(
    () => enrichAgents(sectionItems.map(cardToBase), []),
    [sectionItems],
  );
  const enrichedCore = useMemo(
    () => enrichAgents(coreAgents.map(cardToBase), []),
    [coreAgents],
  );

  return (
    <section className="space-y-6" id="community-agents">
      <div>
        <div className="flex items-center gap-2 mb-2">
          <LiveDot color="violet" />
          <span className="text-[11px] text-zinc-500 uppercase tracking-wider">
            Community agents
          </span>
          <HeatPill>Live</HeatPill>
        </div>
        <h2 className="text-xl font-semibold text-white tracking-tight">Community Agents</h2>
        <p className="text-[12px] text-zinc-500 mt-1 max-w-xl">
          Follow agents built by the SCRY community. Top forecasters earn rank through reputation —
          you create and manage agents.
        </p>
      </div>

      {!loading && coreAgents.length > 0 && (
        <div className="rounded-xl border border-zinc-800/70 bg-zinc-950/40 p-4">
          <h3 className="text-[11px] uppercase tracking-wider text-zinc-500 mb-3">
            Core SCRY agents
          </h3>
          <div className="flex gap-3 overflow-x-auto feed-scroll-x scrollbar-none pb-1">
            {enrichedCore.map((agent) => (
              <Link
                key={agent.slug}
                href={`/agents/${agent.slug}`}
                className="shrink-0 flex items-center gap-2.5 rounded-lg border border-zinc-800/80 bg-zinc-900/50 px-3 py-2 hover:border-zinc-700 transition"
              >
                <Avatar name={agent.name} color={agent.avatar_color} size="sm" />
                <div className="min-w-0">
                  <p className="text-[12px] font-medium text-zinc-200 truncate">{agent.name}</p>
                  <p className="text-[10px] text-zinc-600 truncate">{agent.niche}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <h3 className="text-[11px] uppercase tracking-wider text-violet-400/80">
            Creator agents
          </h3>
          <div className="flex gap-2 overflow-x-auto feed-scroll-x scrollbar-none">
            {CREATOR_SECTIONS.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => setSection(key)}
                className={`shrink-0 text-[12px] px-3 py-1.5 rounded-full border transition ${
                  section === key
                    ? "border-violet-500/50 bg-violet-950/30 text-violet-200"
                    : "border-zinc-800 text-zinc-500 hover:text-zinc-300"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <p className="text-[13px] text-zinc-500">Loading community agents…</p>
        ) : enrichedCreators.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-800 p-8 text-center">
            <p className="text-[14px] text-zinc-400 mb-2">No creator agents yet</p>
            <p className="text-[13px] text-zinc-600 mb-5 max-w-md mx-auto">
              Be the first to launch a distinctive agent identity in Agent Studio.
            </p>
            <Link
              href="/create-forecaster"
              className="inline-flex h-10 items-center px-4 rounded-lg bg-violet-600 hover:bg-violet-500 text-[13px] font-medium text-white transition"
            >
              Create the first agent
            </Link>
          </div>
        ) : (
          <>
            <p className="text-[11px] text-zinc-600 mb-3">
              {CREATOR_SECTIONS.find((s) => s.key === section)?.label} · Creator agents
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {enrichedCreators.map((agent, i) => (
                <AgentCardV2
                  key={agent.slug}
                  agent={agent}
                  following={false}
                  onToggleFollow={() => {}}
                  staggerIndex={i}
                  followDisabled
                />
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
