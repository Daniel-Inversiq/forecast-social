"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { FeedShell } from "@/components/feed/FeedShell";
import { HeatPill, LiveDot } from "@/components/feed/shared";
import { FALLBACK_ARCHIVE } from "@/components/season/fallbackData";
import { SeasonArchiveCard } from "@/components/season/SeasonArchiveCard";
import { fetchSeasonArchive } from "@/lib/season";
import type { SeasonSummary } from "@/lib/season";

export default function SeasonArchivePage() {
  const [seasons, setSeasons] = useState<SeasonSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [usingFallback, setUsingFallback] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const data = await fetchSeasonArchive();
        if (data.length > 0) {
          setSeasons(data);
          setUsingFallback(false);
        } else {
          setSeasons(FALLBACK_ARCHIVE);
          setUsingFallback(true);
        }
      } catch {
        setSeasons(FALLBACK_ARCHIVE);
        setUsingFallback(true);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <FeedShell activeNav="Seasons" hideCategoryNav>
      <div className="flex flex-wrap items-center gap-2 mb-4 px-0.5">
        <LiveDot color="amber" />
        <p className="text-[11px] text-zinc-500">Institutional memory · closed narrative eras</p>
      </div>

      <section className="season-memory-hero mb-8 rounded-xl border border-amber-500/12 bg-zinc-950/60 px-5 py-6 sm:px-6 sm:py-7 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-amber-950/20 via-zinc-950/60 to-violet-950/10 pointer-events-none" />
        <div className="relative max-w-2xl">
          <p className="text-[9px] font-semibold uppercase tracking-[0.22em] text-amber-400/75 mb-2">
            Historical memory layer
          </p>
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <HeatPill tone="amber">Closed eras</HeatPill>
            <Link
              href="/season"
              className="text-[10px] text-amber-400/80 hover:text-amber-300 border border-amber-500/20 px-2 py-0.5 rounded-full"
            >
              ← Active regime
            </Link>
          </div>
          <h1 className="text-xl sm:text-2xl font-semibold text-white/95 tracking-tight mb-2">
            Narrative regime archive
          </h1>
          <p className="text-[12px] text-zinc-500 leading-relaxed">
            Browse archived market eras — reputation snapshots, defining ruptures, and consensus
            conditions preserved in Scry&apos;s public forecasting memory. Each era is collectible,
            memorable, and historically alive.
          </p>
          {usingFallback && !loading && (
            <p className="text-[10px] text-zinc-600 mt-3">Demo archive — API offline</p>
          )}
        </div>
      </section>

      {loading ? (
        <p className="text-zinc-500 text-sm py-16 text-center">Loading institutional memory…</p>
      ) : (
        <>
          <p className="text-[10px] uppercase tracking-wider text-zinc-600 mb-4 px-0.5">
            {seasons.length} archived regimes
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-2 gap-4">
            {seasons.map((s) => (
              <SeasonArchiveCard key={s.slug} season={s} />
            ))}
          </div>
        </>
      )}
    </FeedShell>
  );
}
