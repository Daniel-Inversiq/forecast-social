"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { HeroMarketStrip } from "@/components/feed/HeroMarketStrip";
import { YourConvictionsLiveLayer } from "@/components/feed/YourConvictionsLiveLayer";
import { WhileYouWereAwayLayer } from "@/components/feed/WhileYouWereAwayLayer";
import { HeatPill, LiveDot } from "@/components/feed/shared";
import type { FeedMarket } from "@/components/feed/shared";
import { PublicReadCard } from "@/components/public-reads/PublicReadCard";
import { usePublicReads } from "@/components/public-reads/PublicReadsProvider";
import { pickFeedReads } from "@/components/public-reads/publicReadEnrichment";
import { useAuth } from "@/context/AuthProvider";
import { fetchOngoingStories, type OngoingStory } from "@/lib/ongoingStories";
import type { HomeFeedInterstitialKind } from "./homeFeedStream";

function InterstitialShell({
  label,
  href,
  hrefLabel,
  children,
  tone = "zinc",
}: {
  label: string;
  href: string;
  hrefLabel: string;
  children: React.ReactNode;
  tone?: "rose" | "violet" | "zinc";
}) {
  const border =
    tone === "rose"
      ? "border-rose-500/18"
      : tone === "violet"
        ? "border-violet-500/18"
        : "border-zinc-800/70";

  return (
    <div
      className={`rounded-lg border ${border} bg-zinc-950/75 overflow-hidden feed-fade-in feed-density-interstitial`}
    >
      <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 border-b border-zinc-800/50">
        <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-zinc-500">{label}</p>
        <Link href={href} className="text-[9px] text-violet-400/90 hover:text-violet-300 shrink-0">
          {hrefLabel}
        </Link>
      </div>
      <div className="px-2 py-2">{children}</div>
    </div>
  );
}

function StoryCarouselTile({ story }: { story: OngoingStory }) {
  const agents = story.agents?.slice(0, 2) ?? [];
  return (
    <Link
      href={story.href}
      className="feed-hover-lift shrink-0 w-[148px] sm:w-[160px] rounded-lg border border-rose-500/20 bg-rose-950/15 p-2 flex flex-col gap-1 min-h-[72px]"
    >
      <p className="text-[10px] font-semibold text-zinc-100 line-clamp-2 leading-snug">{story.title}</p>
      <p className="text-[9px] text-zinc-500 line-clamp-1">{story.recent_change ?? story.headline}</p>
      {agents.length > 0 && (
        <p className="text-[8px] text-rose-300/75 mt-auto truncate">
          {agents.map((a) => a.name).join(" vs ")}
        </p>
      )}
    </Link>
  );
}

function StoriesCarousel() {
  const [stories, setStories] = useState<OngoingStory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void fetchOngoingStories(6).then((data) => {
      if (cancelled) return;
      setStories(data?.stories?.slice(0, 5) ?? []);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!loading && stories.length === 0) return null;

  return (
    <InterstitialShell label="Stories still unfolding" href="/battles" hrefLabel="All →" tone="rose">
      <div className="flex items-center gap-1.5 mb-1.5">
        <LiveDot color="rose" />
        <HeatPill tone="rose">{loading ? "…" : `${stories.length} open`}</HeatPill>
      </div>
      <div className="flex gap-2 overflow-x-auto feed-scroll-x scrollbar-none -mx-0.5 px-0.5 pb-0.5">
        {loading &&
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="shrink-0 w-[148px] h-[72px] rounded-lg bg-zinc-900/50 animate-pulse" />
          ))}
        {!loading &&
          stories.map((s) => (
            <StoryCarouselTile key={s.story_key} story={s} />
          ))}
      </div>
    </InterstitialShell>
  );
}

function PublicReadsCarousel() {
  const { reads } = usePublicReads();
  const featured = pickFeedReads(reads, 3);
  if (featured.length === 0) return null;

  return (
    <InterstitialShell label="Public reads" href="/reads" hrefLabel="All reads →" tone="violet">
      <div className="flex gap-2 overflow-x-auto feed-scroll-x scrollbar-none -mx-0.5 px-0.5">
        {featured.map((read) => (
          <div key={read.id} className="shrink-0 w-[min(100%,280px)] sm:w-[260px]">
            <PublicReadCard read={read} compact />
          </div>
        ))}
      </div>
    </InterstitialShell>
  );
}

function PersonalStrip() {
  const { user } = useAuth();
  return (
    <div className="space-y-1.5 feed-density-interstitial">
      {user ? <YourConvictionsLiveLayer /> : <WhileYouWereAwayLayer />}
    </div>
  );
}

export function HomeFeedInterstitial({
  kind,
  markets,
  marketsLoading,
}: {
  kind: HomeFeedInterstitialKind;
  markets: FeedMarket[];
  marketsLoading: boolean;
}) {
  switch (kind) {
    case "personal":
      return <PersonalStrip />;
    case "stories":
      return <StoriesCarousel />;
    case "markets":
      if (!marketsLoading && markets.length === 0) return null;
      return (
        <InterstitialShell label="Narratives in motion" href="/markets" hrefLabel="Markets →">
          <HeroMarketStrip markets={markets} loading={marketsLoading} />
        </InterstitialShell>
      );
    case "public_reads":
      return <PublicReadsCarousel />;
    default:
      return null;
  }
}
