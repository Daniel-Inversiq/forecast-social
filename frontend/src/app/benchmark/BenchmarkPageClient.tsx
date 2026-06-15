"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { BenchmarkView } from "@/components/benchmark/BenchmarkView";
import { fallbackLeaderboardRows } from "@/components/benchmark/benchmarkFallback";
import { buildFallbackProfile } from "@/components/agents/profile/fallbackData";
import { enrichAgentProfile } from "@/components/agents/profile/profileEnrichment";
import { mergeAgentProfileWithReputation } from "@/components/agents/profile/mergeReputation";
import type { AgentProfile } from "@/components/agents/profile/types";
import type { EnrichedUserProfile } from "@/components/users/profile/types";
import { FeedShell } from "@/components/feed/FeedShell";
import { useAuth } from "@/context/AuthProvider";
import { apiFetch } from "@/lib/api";
import { parseBenchmarkKey, type LeaderboardRow } from "@/lib/benchmark";
import { sortByLeaderboardPrimaryScore } from "@/lib/leaderboardRanking";
import { fetchAgentReputation, fetchReputationLeaderboard } from "@/lib/reputation";
import { isAuthRequiredError, redirectToLogin } from "@/lib/authRedirect";

const DEMO_SLUG = "daniel-scry";

async function loadForecaster(slug: string): Promise<AgentProfile | null> {
  try {
    const [agentRes, reputation] = await Promise.all([
      apiFetch(`/agents/${encodeURIComponent(slug)}`, {}, false),
      fetchAgentReputation(slug),
    ]);
    if (agentRes.ok) {
      let base = (await agentRes.json()) as AgentProfile;
      if (reputation) {
        base = mergeAgentProfileWithReputation(base, reputation);
      }
      return base;
    }
  } catch {
    /* fallback */
  }
  return buildFallbackProfile(slug);
}

export function BenchmarkPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);
  const [profile, setProfile] = useState<EnrichedUserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [usingFallback, setUsingFallback] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      let rows: LeaderboardRow[] = [];
      let fallback = true;

      try {
        const rep = await fetchReputationLeaderboard();
        if (rep.length > 0) {
          rows = sortByLeaderboardPrimaryScore(rep as LeaderboardRow[]).map((row, index) => ({
            ...row,
            rank: index + 1,
          }));
          fallback = false;
        }
      } catch {
        /* use fallback rows */
      }

      if (rows.length === 0) {
        rows = fallbackLeaderboardRows();
      }

      const slug = user?.username?.toLowerCase() ?? DEMO_SLUG;

      try {
        let agentSlug = slug;
        if (user?.username) {
          const pubRes = await apiFetch(
            `/users/${encodeURIComponent(slug)}`,
            {},
            false,
          );
          if (pubRes.ok) {
            const pub = await pubRes.json();
            agentSlug = pub.agent_slug ?? slug;
          }
        }

        const agent = await loadForecaster(agentSlug);
        if (!cancelled && agent) {
          const enriched = enrichAgentProfile(agent);
          setProfile({
            ...enriched,
            is_human: true,
            member_since: new Date(Date.now() - 120 * 86400000).toISOString(),
            following_count: user ? 12 : 0,
            agent_linked: Boolean(user),
          });
        }
      } catch (err) {
        if (isAuthRequiredError(err)) {
          redirectToLogin(router);
          return;
        }
        if (!cancelled) {
          const agent = buildFallbackProfile(slug);
          setProfile({
            ...enrichAgentProfile(agent),
            is_human: true,
            member_since: new Date().toISOString(),
            following_count: 0,
            agent_linked: false,
          });
        }
      }

      if (!cancelled) {
        setLeaderboard(rows);
        setUsingFallback(fallback);
        setLoading(false);
      }
    }

    if (authLoading) return;
    load();
    return () => {
      cancelled = true;
    };
  }, [user?.username, authLoading, router]);

  const benchKey = useMemo(
    () => parseBenchmarkKey(searchParams.get("benchmark")),
    [searchParams],
  );

  return (
    <FeedShell>
      <div className="max-w-2xl mx-auto space-y-4 pb-14 pt-1">
        <nav className="flex items-center gap-2 text-[10px] text-zinc-600">
          <Link href="/" className="hover:text-zinc-400 transition">
            Feed
          </Link>
          <span>/</span>
          <Link href="/leaderboards" className="hover:text-zinc-400 transition">
            Rankings
          </Link>
          <span>/</span>
          <span className="text-zinc-500">Benchmark</span>
        </nav>

        {loading || !profile ? (
          <div className="space-y-3 py-8">
            <div className="h-28 rounded-2xl bg-zinc-900/60 animate-pulse border border-zinc-800/50" />
            <div className="h-64 rounded-2xl bg-zinc-900/60 animate-pulse border border-zinc-800/50" />
          </div>
        ) : (
          <BenchmarkView
            profile={profile}
            leaderboard={leaderboard}
            initialBenchmark={benchKey}
            usingFallback={usingFallback}
          />
        )}
      </div>
    </FeedShell>
  );
}
