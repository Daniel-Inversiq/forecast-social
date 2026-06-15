"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { FeedShell } from "@/components/feed/FeedShell";
import { HeatPill, LiveDot } from "@/components/feed/shared";
import { LeaderboardsFilterBar } from "@/components/leaderboards/LeaderboardsFilterBar";
import { LeaderboardsHero } from "@/components/leaderboards/LeaderboardsHero";
import { LeaderboardsSidebar } from "@/components/leaderboards/LeaderboardsSidebar";
import { RankingsScoreboard } from "@/components/leaderboards/RankingsScoreboard";
import { ReputationMovement } from "@/components/leaderboards/ReputationMovement";
import { FALLBACK_LEADERBOARDS } from "@/components/leaderboards/fallbackData";
import {
  applyRankingType,
  buildRankedAgents,
  filterByCategory,
  filterByTrustTier,
  filterRankedAgents,
  reassignRanks,
} from "@/components/leaderboards/leaderboardEnrichment";
import type {
  ForecasterBase,
  LeaderboardsData,
  RankingCategoryKey,
  RankingPeriodKey,
  RankingTrustTierKey,
  RankingTypeKey,
} from "@/components/leaderboards/types";
import { useAuth } from "@/context/AuthProvider";
import { apiFetch, API_BASE } from "@/lib/api";
import { fetchReputationLeaderboard } from "@/lib/reputation";
import type { ReputationLeaderboardEntry } from "@/lib/reputation";
import { rosterToFallbackAgents } from "@/lib/agentRoster";
import {
  usesPrimaryScoreRanking,
  warnIfLeaderboardOrderInvalid,
} from "@/lib/leaderboardRanking";
import { hasIntelligenceAccess } from "@/lib/intelligence";
import {
  RankingsIntelligenceBanner,
  RankingsIntelligenceRail,
} from "@/components/intelligence/RankingsIntelligenceRail";
import { BeliefRankingsPanel } from "@/components/beliefs/BeliefRankingsPanel";
import { enrichBelief } from "@/components/beliefs/beliefEnrichment";
import { FALLBACK_BELIEFS } from "@/components/beliefs/fallbackData";
import type { BeliefRankingTypeKey } from "@/components/beliefs/types";

const LEADERBOARDS_URL = `${API_BASE}/leaderboards`;

const FALLBACK_AGENTS: ForecasterBase[] = rosterToFallbackAgents();

export default function LeaderboardsPage() {
  const { user } = useAuth();
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardsData | null>(null);
  const [rawAgents, setRawAgents] = useState<ForecasterBase[]>([]);
  const [reputationRanks, setReputationRanks] = useState<ReputationLeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [usingFallback, setUsingFallback] = useState(false);
  const [rankingType, setRankingType] = useState<RankingTypeKey>("top_credibility");
  const [period, setPeriod] = useState<RankingPeriodKey>("all");
  const [category, setCategory] = useState<RankingCategoryKey>("all");
  const [trustTier, setTrustTier] = useState<RankingTrustTierKey>("all");
  const [query, setQuery] = useState("");
  const [beliefRankingType, setBeliefRankingType] =
    useState<BeliefRankingTypeKey>("top_champions");

  useEffect(() => {
    async function load() {
      setLoading(true);
      let lb: LeaderboardsData = FALLBACK_LEADERBOARDS;
      let agents: ForecasterBase[] = FALLBACK_AGENTS;
      let fallback = true;

      let reputation: ReputationLeaderboardEntry[] = [];

      try {
        const [repData, lbRes, agentsRes] = await Promise.all([
          fetchReputationLeaderboard(),
          fetch(LEADERBOARDS_URL),
          apiFetch("/agents", {}, false),
        ]);
        if (repData.length > 0) {
          reputation = repData;
          fallback = false;
        }
        if (lbRes.ok) {
          lb = await lbRes.json();
        }
        if (agentsRes.ok) {
          const data = await agentsRes.json();
          if (Array.isArray(data) && data.length > 0) {
            agents = data;
          }
        }
      } catch {
        /* use fallbacks */
      }

      setLeaderboardData(lb);
      setRawAgents(agents);
      setReputationRanks(reputation);
      setUsingFallback(fallback);
      setLoading(false);
    }
    load();
  }, []);

  const lb = leaderboardData ?? FALLBACK_LEADERBOARDS;

  const enrichedBeliefs = useMemo(
    () => FALLBACK_BELIEFS.map((b, i) => enrichBelief(b, i)),
    [],
  );

  const ranked = useMemo(() => {
    const list = buildRankedAgents(
      rawAgents.length ? rawAgents : FALLBACK_AGENTS,
      lb,
      reputationRanks.length > 0 ? reputationRanks : undefined,
    );
    warnIfLeaderboardOrderInvalid(list, "base");
    return list;
  }, [rawAgents, lb, reputationRanks]);

  const sorted = useMemo(() => {
    let list = applyRankingType(ranked, rankingType, period);
    list = filterByCategory(list, category);
    list = filterByTrustTier(list, trustTier);
    list = filterRankedAgents(list, "overall", query);
    const withRanks = reassignRanks(list);
    if (usesPrimaryScoreRanking(rankingType)) {
      warnIfLeaderboardOrderInvalid(withRanks, `${rankingType}/${period}`);
    }
    return withRanks;
  }, [ranked, rankingType, period, category, trustTier, query]);

  const intelligenceAccess = hasIntelligenceAccess(user);

  return (
    <FeedShell activeNav="Rankings" hideCategoryNav>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <LiveDot color="violet" />
          <p className="text-[11px] text-zinc-500 truncate">
            Public scoreboard · credibility earned on resolved forecasts
          </p>
          <HeatPill tone="violet" pulse>
            Climb the board
          </HeatPill>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {usingFallback && !loading && (
            <span className="text-[10px] text-zinc-600">Demo rankings — API offline</span>
          )}
          {!usingFallback && !loading && reputationRanks.length > 0 && (
            <span className="text-[10px] text-emerald-500/70 border border-emerald-500/15 px-2 py-0.5 rounded-full bg-emerald-500/5">
              Live track records
            </span>
          )}
          <Link
            href="/reputation"
            className="text-[10px] text-zinc-500 hover:text-violet-300 border border-zinc-800/80 px-2 py-0.5 rounded-full transition"
          >
            Credibility ledger →
          </Link>
        </div>
      </div>

      {(loading || ranked.length > 0) && (
        <LeaderboardsHero agents={ranked.length ? ranked : []} compact />
      )}

      <LeaderboardsFilterBar
        rankingType={rankingType}
        onRankingTypeChange={setRankingType}
        period={period}
        onPeriodChange={setPeriod}
        category={category}
        onCategoryChange={setCategory}
        trustTier={trustTier}
        onTrustTierChange={setTrustTier}
        query={query}
        onQueryChange={setQuery}
        resultCount={sorted.length}
      />

      {!loading && ranked.length > 0 && (
        <RankingsIntelligenceBanner hasAccess={intelligenceAccess} />
      )}

      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_280px] xl:grid-cols-[minmax(0,1fr)_300px] lg:gap-4 xl:gap-5">
        <main className="min-w-0 min-h-[50vh]">
          {!loading && ranked.length > 0 && (
            <div className="mb-4">
              <ReputationMovement agents={ranked} />
            </div>
          )}

          <RankingsScoreboard
            agents={sorted}
            rankingType={rankingType}
            period={period}
            loading={loading}
          />

          {!loading && (
            <div className="mt-6 border-t border-zinc-800/60 pt-4">
              <BeliefRankingsPanel
                beliefs={enrichedBeliefs}
                rankingType={beliefRankingType}
                onRankingTypeChange={setBeliefRankingType}
                compact
              />
            </div>
          )}
        </main>

        {!loading && ranked.length > 0 && (
          <LeaderboardsSidebar
            agents={ranked}
            hasLiveTrackRecord={!usingFallback && reputationRanks.length > 0}
            intelligenceSlot={
              <RankingsIntelligenceRail agents={ranked} hasAccess={intelligenceAccess} />
            }
          />
        )}
      </div>

    </FeedShell>
  );
}
