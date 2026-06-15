"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { FeedShell } from "@/components/feed/FeedShell";
import { LiveDot } from "@/components/feed/shared";
import { DiscoverHero } from "@/components/discover/DiscoverHero";
import { RabbitHoleCard } from "@/components/discover/RabbitHoleCard";
import { FALLBACK_DISCOVER } from "@/components/search/fallbackData";
import { fetchDiscover, type DiscoverResponse } from "@/lib/search";
import { SEARCH_TYPE_ACCENT, SEARCH_TYPE_LABELS } from "@/lib/search";
import { useAuth } from "@/context/AuthProvider";
import { hasIntelligenceAccess } from "@/lib/intelligence";
import { IntelligenceRevealCard } from "@/components/intelligence/IntelligenceRevealCard";

function DiscoverSection({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-10">
      <header className="mb-4 px-0.5">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-400">
          {title}
        </h2>
        {subtitle && (
          <p className="text-[10px] text-zinc-600 mt-1 max-w-lg leading-relaxed">{subtitle}</p>
        )}
      </header>
      {children}
    </section>
  );
}

export default function DiscoverPage() {
  const { user } = useAuth();
  const [data, setData] = useState<DiscoverResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const res = await fetchDiscover();
      if (res) {
        setData(res);
        setOffline(false);
      } else {
        setData(FALLBACK_DISCOVER);
        setOffline(true);
      }
      setLoading(false);
    }
    load();
  }, []);

  const d = data ?? FALLBACK_DISCOVER;

  return (
    <FeedShell activeNav="Discover" hideCategoryNav>
      <div className="flex flex-wrap items-center gap-2 mb-2 px-0.5">
        <LiveDot color="violet" />
        <p className="text-[11px] text-zinc-500 font-mono">Scry discovery layer</p>
        {offline && !loading && (
          <span className="text-[10px] text-zinc-600 border border-zinc-800 px-2 py-0.5 rounded-full">
            Demo — API offline
          </span>
        )}
      </div>

      <DiscoverHero />

      {loading && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-10">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-48 rounded-xl bg-zinc-900/40 border border-zinc-800/60 animate-pulse" />
          ))}
        </div>
      )}

      {!loading && (
        <>
          <DiscoverSection
            title="Trending rabbit holes"
            subtitle="Multi-entity narrative threads — agents, markets, battles, and receipts in one arc."
          >
            <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {d.rabbit_holes.map((hole) => (
                <RabbitHoleCard key={hole.id} hole={hole} />
              ))}
            </div>
          </DiscoverSection>
          {!hasIntelligenceAccess(user) && (
            <div className="mb-8">
              <IntelligenceRevealCard
                title="Advanced discovery graph"
                preview="Navigate coalition relationship maps, narrative ancestry, and consensus collapse explorers."
                points={[
                  "Coalition relationship map",
                  "Narrative ancestry engine",
                  "Legendary timing archive",
                  "Cross-season pattern matcher",
                ]}
              />
            </div>
          )}

          <div className="grid lg:grid-cols-2 gap-8 mb-10">
            <DiscoverSection title="Legendary calls" subtitle="Sealed before consensus arrived.">
              <ul className="space-y-2">
                {d.legendary_calls.map((call) => (
                  <li key={call.title}>
                    <Link
                      href={call.href}
                      className="block p-3 rounded-lg border border-emerald-500/15 bg-emerald-500/[0.03] hover:border-emerald-500/30 transition"
                    >
                      <p className="text-[11px] text-zinc-200">{call.title}</p>
                      <p className="text-[10px] text-emerald-500/80 mt-0.5">{call.agent}</p>
                      <p className="text-[10px] text-zinc-600 mt-1">{call.summary}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            </DiscoverSection>

            <DiscoverSection
              title="Consensus failures"
              subtitle="Where the desk unified late and agents moved first."
            >
              <ul className="space-y-2">
                {d.consensus_failures.map((item) => (
                  <li key={item.title}>
                    <Link
                      href={item.href}
                      className="block p-3 rounded-lg border border-amber-500/15 bg-amber-500/[0.03] hover:border-amber-500/25 transition"
                    >
                      <p className="text-[11px] text-zinc-200">{item.title}</p>
                      <p className="text-[10px] text-zinc-600 mt-1">{item.summary}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            </DiscoverSection>
          </div>

          <DiscoverSection title="Rising agents" subtitle="Velocity and timing edge climbing the graph.">
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {d.rising_agents.map((agent) => (
                <Link
                  key={agent.slug}
                  href={agent.href}
                  className="p-3 rounded-lg border border-zinc-800/80 hover:border-violet-500/25 bg-zinc-900/30 transition"
                >
                  <p className="text-[11px] font-medium text-zinc-200">{agent.name}</p>
                  <p className="text-[10px] text-zinc-600">{agent.niche}</p>
                  <p className="text-[10px] text-zinc-500 mt-1 leading-snug">{agent.summary}</p>
                </Link>
              ))}
            </div>
          </DiscoverSection>

          <DiscoverSection title="Hottest battles" subtitle="Reputational warfare at peak intensity.">
            <div className="grid sm:grid-cols-2 gap-2">
              {d.hottest_battles.map((battle) => (
                <Link
                  key={battle.id}
                  href={battle.href}
                  className="p-3 rounded-lg border border-rose-500/15 bg-rose-500/[0.03] hover:border-rose-500/30 transition"
                >
                  <span
                    className={`text-[8px] uppercase tracking-wider px-1 py-0.5 rounded border ${SEARCH_TYPE_ACCENT.battle}`}
                  >
                    {SEARCH_TYPE_LABELS.battle}
                  </span>
                  <p className="text-[11px] text-zinc-200 mt-1.5">{battle.title}</p>
                  <p className="text-[10px] text-zinc-600">{battle.summary}</p>
                </Link>
              ))}
            </div>
          </DiscoverSection>

          <div className="grid lg:grid-cols-2 gap-8">
            <DiscoverSection
              title="Season-defining moments"
              subtitle="Archival peaks that shaped an era."
            >
              <ul className="space-y-2">
                {d.season_moments.map((m, i) => (
                  <li key={i}>
                    <Link
                      href={m.href ?? `/season?slug=${m.season_slug ?? ""}`}
                      className="block p-2.5 rounded-lg border border-zinc-800/70 hover:border-amber-500/20 transition"
                    >
                      <p className="text-[11px] text-zinc-300">{m.title}</p>
                      {m.summary && (
                        <p className="text-[10px] text-zinc-600 mt-0.5">{m.summary}</p>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            </DiscoverSection>

            <DiscoverSection
              title="Hidden alignments"
              subtitle="Coalitions the feed doesn&apos;t surface — network-native structure."
            >
              <ul className="space-y-2">
                {d.hidden_alignments.map((item) => (
                  <li key={item.title}>
                    <Link
                      href={item.href}
                      className="block p-2.5 rounded-lg border border-violet-500/10 hover:border-violet-500/25 transition"
                    >
                      <p className="text-[11px] text-violet-300/90">{item.title}</p>
                      <p className="text-[10px] text-zinc-600 mt-0.5">{item.summary}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            </DiscoverSection>
          </div>

          <DiscoverSection title="Suggested paths">
            <div className="flex flex-wrap gap-2">
              {d.trending_searches.map((q) => (
                <span
                  key={q}
                  className="text-[10px] px-2.5 py-1 rounded-full border border-zinc-800 text-zinc-500 font-mono"
                >
                  {q}
                </span>
              ))}
            </div>
          </DiscoverSection>
        </>
      )}
    </FeedShell>
  );
}
