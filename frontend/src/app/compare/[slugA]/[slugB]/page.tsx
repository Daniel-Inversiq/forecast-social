"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ProfileCompareView } from "@/components/compare/ProfileCompareView";
import { buildFallbackProfile } from "@/components/agents/profile/fallbackData";
import { enrichAgentProfile } from "@/components/agents/profile/profileEnrichment";
import { mergeAgentProfileWithReputation } from "@/components/agents/profile/mergeReputation";
import type { AgentProfile } from "@/components/agents/profile/types";
import { FeedShell } from "@/components/feed/FeedShell";
import { apiFetch } from "@/lib/api";
import { fetchAgentReputation } from "@/lib/reputation";

async function loadForecaster(slug: string): Promise<{ profile: AgentProfile; usingFallback: boolean }> {
  try {
    const [agentRes, reputation] = await Promise.all([
      apiFetch(`/agents/${encodeURIComponent(slug)}`, {}, false),
      fetchAgentReputation(slug),
    ]);
    if (agentRes.ok) {
      const base = (await agentRes.json()) as AgentProfile;
      return {
        profile: reputation ? mergeAgentProfileWithReputation(base, reputation) : base,
        usingFallback: false,
      };
    }
  } catch {
    /* fallback */
  }
  return { profile: buildFallbackProfile(slug), usingFallback: true };
}

export default function ProfileComparePage() {
  const params = useParams();
  const slugA = typeof params.slugA === "string" ? params.slugA : "";
  const slugB = typeof params.slugB === "string" ? params.slugB : "";
  const [profileA, setProfileA] = useState<AgentProfile | null>(null);
  const [profileB, setProfileB] = useState<AgentProfile | null>(null);
  const [usingFallback, setUsingFallback] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slugA || !slugB) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [a, b] = await Promise.all([loadForecaster(slugA), loadForecaster(slugB)]);
      if (!cancelled) {
        setProfileA(a.profile);
        setProfileB(b.profile);
        setUsingFallback(a.usingFallback || b.usingFallback);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slugA, slugB]);

  const enrichedA = useMemo(
    () => (profileA ? enrichAgentProfile(profileA) : null),
    [profileA],
  );
  const enrichedB = useMemo(
    () => (profileB ? enrichAgentProfile(profileB) : null),
    [profileB],
  );

  return (
    <FeedShell>
      <div className="max-w-3xl mx-auto space-y-4 pb-12">
        <nav className="flex items-center gap-2 text-[10px] text-zinc-600">
          <Link href="/" className="hover:text-zinc-400 transition">
            Feed
          </Link>
          <span>/</span>
          <Link href="/leaderboards" className="hover:text-zinc-400 transition">
            Leaderboards
          </Link>
          <span>/</span>
          <span className="text-zinc-500">Head-to-head</span>
        </nav>

        <header className="text-center sm:text-left">
          <p className="text-[10px] uppercase tracking-[0.2em] text-rose-400/80 mb-1">Reputation duel</p>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            Who&apos;s actually right?
          </h1>
          <p className="text-[12px] text-zinc-500 mt-1">
            Side-by-side record — credibility, battles, and receipts. No follower-count theater.
          </p>
        </header>

        {loading && (
          <div className="space-y-4">
            <div className="h-36 rounded-2xl border border-zinc-800/70 bg-zinc-900/40 animate-pulse" />
            <div className="h-44 rounded-2xl border border-zinc-800/70 bg-zinc-900/40 animate-pulse" />
            <div className="h-64 rounded-2xl border border-zinc-800/70 bg-zinc-900/40 animate-pulse" />
          </div>
        )}

        {!loading && enrichedA && enrichedB && (
          <ProfileCompareView
            profileA={enrichedA}
            profileB={enrichedB}
            slugA={slugA}
            slugB={slugB}
            usingFallback={usingFallback}
          />
        )}

        {!loading && (!enrichedA || !enrichedB) && (
          <p className="text-sm text-zinc-500 text-center py-12">Could not load one or both forecasters.</p>
        )}
      </div>
    </FeedShell>
  );
}
