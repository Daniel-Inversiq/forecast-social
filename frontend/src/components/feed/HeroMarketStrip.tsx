"use client";

import Link from "next/link";
import { ForecastThesisLine } from "@/components/forecast/ForecastThesisLine";
import { generateMarketThesis } from "@/lib/forecastThesis";
import { titleToSlug } from "@/lib/slugs";
import type { FeedMarket } from "./shared";
import {
  HeatPill,
  MiniProbBar,
  MiniSparkline,
  MoveBadge,
  syntheticMove,
  urgencyStyle,
} from "./shared";

function narrativeTrend(move: number): { label: string; dir: "up" | "down" | "flat" } {
  if (move >= 3) return { label: "Consensus rising", dir: "up" };
  if (move <= -3) return { label: "Consensus breaking", dir: "down" };
  return { label: "Credibility-weighted", dir: "flat" };
}

function FeaturedMarketCard({ market }: { market: FeedMarket }) {
  const urgency = urgencyStyle[market.urgency] ?? urgencyStyle.cooling;
  const move = syntheticMove(market.title);
  const trend = narrativeTrend(move);
  const slug = market.slug ?? titleToSlug(market.title);
  const narrativeTitle = market.narrative?.trim() || market.title;
  const thesis = generateMarketThesis(market.title, {
    probability: market.current_yes_probability,
    category: market.category,
    narrative: market.narrative,
    seed: slug,
  });

  return (
    <Link
      href={`/markets/${slug}`}
      className="feed-hero-card feed-hover-lift scry-surface-card group shrink-0 w-[148px] sm:w-[168px] lg:w-[176px] min-h-[88px] flex flex-col gap-1 p-2 rounded-lg hover:border-violet-500/30 hover:shadow-lg hover:shadow-violet-950/15"
    >
      <div className="flex items-center justify-between gap-1">
        <span className="text-[8px] font-medium text-violet-300/80 uppercase tracking-wide">
          {trend.label}
        </span>
        <MoveBadge delta={move} />
      </div>
      <p className="text-[12px] font-semibold scry-text-primary leading-snug line-clamp-2 group-hover:text-violet-50 transition-colors">
        {narrativeTitle}
      </p>
      <ForecastThesisLine thesis={thesis} compact className="flex-1 min-h-0" />
      <MiniProbBar value={market.current_yes_probability} size="xs" hoverBoost />
      <div className="flex items-center justify-between gap-1 mt-auto">
        <div className="text-[9px] scry-text-tertiary tabular-nums">
          <span className="text-violet-300/70">{Math.round(market.current_yes_probability)}% consensus</span>
          <span className="mx-0.5 opacity-50">·</span>
          <span>{market.agent_count} agents</span>
        </div>
        <MiniSparkline seed={market.title} width={36} height={12} />
      </div>
      <p className="text-[8px] text-zinc-600 line-clamp-1 capitalize">{urgency.text} narrative</p>
    </Link>
  );
}

export function HeroMarketStrip({
  markets,
  loading,
}: {
  markets: FeedMarket[];
  loading: boolean;
}) {
  const featured = [...markets]
    .sort((a, b) => {
      const order: Record<string, number> = { hot: 0, contested: 1, rising: 2, cooling: 3 };
      return (order[a.urgency] ?? 4) - (order[b.urgency] ?? 4);
    })
    .slice(0, 10);

  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-1.5 px-0.5">
        <div className="flex items-center gap-2">
          <HeatPill tone="rose" pulse>
            Live
          </HeatPill>
          <span className="text-[10px] font-semibold scry-text-primary">Narratives moving</span>
        </div>
        <Link href="/markets" className="text-[10px] text-violet-400/85 hover:text-violet-300 shrink-0">
          All narratives →
        </Link>
      </div>
      <div className="relative -mx-0.5">
        <div className="flex gap-2.5 overflow-x-auto pb-1 px-0.5 feed-scroll-x scrollbar-none">
          {loading &&
            Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="shrink-0 w-[188px] h-[96px] rounded-xl border border-zinc-800/60 bg-zinc-900/40 animate-pulse"
              />
            ))}
          {!loading && featured.map((m) => <FeaturedMarketCard key={m.title} market={m} />)}
        </div>
        <div
          className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-zinc-950 via-zinc-950/80 to-transparent"
          aria-hidden
        />
      </div>
    </div>
  );
}
