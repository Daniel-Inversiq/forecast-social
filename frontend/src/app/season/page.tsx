"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import { FeedShell } from "@/components/feed/FeedShell";
import { LiveDot } from "@/components/feed/shared";
import { FALLBACK_CURRENT_SEASON } from "@/components/season/fallbackData";
import { LegendaryMoments } from "@/components/season/LegendaryMoments";
import { RegimeEvolutionTimeline } from "@/components/season/RegimeEvolutionTimeline";
import { SeasonForecasterTable } from "@/components/season/SeasonForecasterTable";
import { SeasonHero } from "@/components/season/SeasonHero";
import { MobileIntelRail } from "@/components/layout/MobileIntelRail";
import { SeasonSidebar } from "@/components/season/SeasonSidebar";
import { SeasonVerifiedCalls } from "@/components/season/SeasonVerifiedCalls";
import { getEraAtmosphere } from "@/components/season/seasonEraStyles";
import { fetchCurrentSeason, fetchSeason, type SeasonDetail } from "@/lib/season";
import { RelatedIntelligence } from "@/components/discovery/RelatedIntelligence";

function SeasonSection({
  title,
  subtitle,
  children,
  className = "",
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`mb-8 ${className}`}>
      <header className="mb-4 px-0.5">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-400">
          {title}
        </h2>
        {subtitle && (
          <p className="text-[10px] text-zinc-600 mt-1 leading-relaxed max-w-lg">{subtitle}</p>
        )}
      </header>
      {children}
    </section>
  );
}

function SeasonPageContent() {
  const searchParams = useSearchParams();
  const slugParam = searchParams.get("slug");
  const [season, setSeason] = useState<SeasonDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [usingFallback, setUsingFallback] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const data = slugParam ? await fetchSeason(slugParam) : await fetchCurrentSeason();
        if (data) {
          setSeason(data);
          setUsingFallback(false);
        } else {
          setSeason(FALLBACK_CURRENT_SEASON);
          setUsingFallback(true);
        }
      } catch {
        setSeason(FALLBACK_CURRENT_SEASON);
        setUsingFallback(true);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [slugParam]);

  const era = season ? getEraAtmosphere(season.category) : getEraAtmosphere("macro");

  return (
    <FeedShell activeNav="Seasons" hideCategoryNav>
      <div className="flex flex-wrap items-center gap-2 mb-4 px-0.5">
        <LiveDot color="amber" />
        <p className="text-[11px] text-zinc-500">
          Scry historical memory · narrative regime archive
        </p>
        {usingFallback && !loading && (
          <span className="text-[10px] text-zinc-600 border border-zinc-800 px-2 py-0.5 rounded-full">
            Demo — API offline
          </span>
        )}
        <Link
          href="/verified-calls"
          className="text-[10px] text-zinc-600 hover:text-amber-400/90 ml-auto"
        >
          Verification archive →
        </Link>
      </div>

      {loading && (
        <div className="py-20 flex flex-col items-center gap-3">
          <div className={`h-8 w-8 rounded-full border-2 ${era.heroBorder} border-t-amber-400/80 animate-spin`} />
          <p className="text-zinc-500 text-sm">Loading regime memory…</p>
        </div>
      )}

      {!loading && season && (
        <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_300px] xl:grid-cols-[minmax(0,1fr)_320px] gap-6 xl:gap-8">
          <main className="min-w-0">
            <SeasonHero season={season} />

            <SeasonSection
              title="Seasonal standings"
              subtitle="Historically important forecasters — institutional archive, not a leaderboard chase."
            >
              <SeasonForecasterTable forecasters={season.top_forecasters} season={season} />
            </SeasonSection>

            <SeasonSection
              title="Regime evolution"
              subtitle="From narrative formation through aftermath."
              className="mb-10"
            >
              <RegimeEvolutionTimeline season={season} />
            </SeasonSection>

            <SeasonSection
              title="Legendary moments"
              subtitle="Defining calls, consensus collapses, and era rivalries."
            >
              <LegendaryMoments season={season} />
            </SeasonSection>

            <SeasonSection
              title="Verified receipts"
              subtitle="Permanent proof sealed before consensus formed."
            >
              <SeasonVerifiedCalls calls={season.verified_calls} />
            </SeasonSection>
          </main>

          <aside className="hidden lg:block space-y-3 min-w-0 sticky top-[52px] max-h-[calc(100dvh-4rem)] overflow-y-auto scrollbar-none">
            <SeasonSidebar season={season} />
            <RelatedIntelligence entityType="season" entityId={season.slug} />
          </aside>

          <div className="lg:hidden space-y-3">
            <MobileIntelRail
              title="Regime intelligence"
              subtitle="Season context, standings pulse, era signals"
              priority="normal"
            >
              <SeasonSidebar season={season} />
            </MobileIntelRail>
            <RelatedIntelligence entityType="season" entityId={season.slug} />
          </div>
        </div>
      )}
    </FeedShell>
  );
}

export default function SeasonPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
          <p className="text-zinc-500 text-sm">Loading historical memory…</p>
        </div>
      }
    >
      <SeasonPageContent />
    </Suspense>
  );
}
