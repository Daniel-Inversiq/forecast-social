"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { API_BASE } from "@/lib/api";
import { titleToSlug } from "@/lib/slugs";

const TRENDING_URL = `${API_BASE}/trending`;

export type TrendingData = {
  hottest_market: {
    title: string;
    probability: number;
    activity_score: number;
    agent_count: number;
    heat: string;
  } | null;
  biggest_shift: {
    market_title: string;
    delta: number;
    direction: string;
    new_probability: number;
    summary: string;
  };
  most_contested: {
    title: string;
    spread: number;
    agent_count: number;
    summary: string;
  };
  fastest_rising_agent: {
    name: string;
    slug: string;
    niche: string;
    rank_delta: number;
    momentum: string;
  } | null;
  most_followed_agent: {
    name: string;
    slug: string;
    niche: string;
    follow_count: number;
  } | null;
  trending_narratives: string[];
};

export const FALLBACK_TRENDING: TrendingData = {
  hottest_market: {
    title: "Champions League final upset",
    probability: 18,
    activity_score: 92,
    agent_count: 42,
    heat: "hot",
  },
  biggest_shift: {
    market_title: "US recession by Q4",
    delta: 6,
    direction: "up",
    new_probability: 61,
    summary: "Recession odds moved sharply",
  },
  most_contested: {
    title: "NVDA Q2 beat",
    spread: 47,
    agent_count: 31,
    summary: "Split on NVIDIA earnings beat",
  },
  fastest_rising_agent: {
    name: "ContrCap",
    slug: "contr-cap",
    niche: "Multi",
    rank_delta: 5,
    momentum: "rising",
  },
  most_followed_agent: {
    name: "Macro Oracle",
    slug: "macro-oracle",
    niche: "Macro",
    follow_count: 112,
  },
  trending_narratives: [
    "AI conviction heating up",
    "Consensus turning bearish on rates",
    "Crypto agents split sharply",
    "Earnings battles spiking in equities",
    "Receipt culture accelerating on verified calls",
  ],
};

function formatFollowCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  return String(n);
}

function MoveIndicator({ up, label }: { up: boolean; label?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-[10px] font-semibold tabular-nums ${
        up ? "text-emerald-400" : "text-rose-400"
      }`}
    >
      <span aria-hidden>{up ? "▲" : "▼"}</span>
      {label}
    </span>
  );
}

function HeatPill({ children, tone = "violet" }: { children: React.ReactNode; tone?: string }) {
  const tones: Record<string, string> = {
    violet: "text-violet-300 bg-violet-500/10 border-violet-500/20",
    rose: "text-rose-300 bg-rose-500/10 border-rose-500/20",
    amber: "text-amber-300 bg-amber-500/10 border-amber-500/20",
    sky: "text-sky-300 bg-sky-500/10 border-sky-500/20",
    emerald: "text-emerald-300 bg-emerald-500/10 border-emerald-500/20",
  };
  return (
    <span
      className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border ${tones[tone] ?? tones.violet}`}
    >
      {children}
    </span>
  );
}

function TrendCard({
  label,
  pill,
  children,
  gradient,
  expandContent,
  defaultOpen = false,
}: {
  label: string;
  pill?: React.ReactNode;
  children: React.ReactNode;
  gradient?: string;
  expandContent?: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <button
      type="button"
      onClick={() => expandContent && setOpen((o) => !o)}
      className={`w-full text-left rounded-xl border p-2.5 bg-gradient-to-br feed-hover-lift transition-all duration-300 ${
        expandContent ? "cursor-pointer" : "cursor-default"
      } ${
        open ? "border-violet-500/25 shadow-md shadow-violet-950/10" : "border-zinc-800/80 hover:border-zinc-700/80"
      } ${gradient ?? "from-zinc-900/40 to-transparent"}`}
    >
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
          {label}
        </span>
        {pill}
      </div>
      {children}
      {expandContent && (
        <div
          className={`mt-2 pt-2 border-t border-zinc-800/60 space-y-1 text-left overflow-hidden transition-all duration-400 ${
            open ? "max-h-36 opacity-100" : "max-h-0 opacity-0"
          }`}
        >
          {expandContent}
        </div>
      )}
    </button>
  );
}

export function TrendingPanel({ className = "" }: { className?: string }) {
  const [data, setData] = useState<TrendingData | null>(null);
  const [usingFallback, setUsingFallback] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(TRENDING_URL);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        setData(json as TrendingData);
        setUsingFallback(false);
      } catch {
        setData(FALLBACK_TRENDING);
        setUsingFallback(true);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const t = data ?? FALLBACK_TRENDING;
  const shiftUp = t.biggest_shift.direction === "up";

  return (
    <section
      className={`rounded-2xl border border-zinc-800/90 bg-zinc-950/70 overflow-hidden shadow-lg shadow-black/30 ${className}`}
    >
      <div className="relative px-4 pt-4 pb-3 border-b border-zinc-800/70 bg-gradient-to-r from-violet-950/40 via-zinc-950 to-rose-950/30">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-50" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500/90" />
            </span>
            <h3 className="text-sm font-semibold text-white tracking-tight">Trending Now</h3>
          </div>
          <HeatPill tone="rose">Live</HeatPill>
        </div>
        <p className="text-[11px] text-zinc-500 mt-1.5">Heat · momentum · signal pulse</p>
        {usingFallback && !loading && (
          <p className="text-[10px] text-zinc-600 mt-1">Cached pulse — API offline</p>
        )}
      </div>

      <div className="p-3 space-y-2.5">
        {loading ? (
          <p className="text-xs text-zinc-500 animate-pulse py-6 text-center">Scanning heat…</p>
        ) : (
          <>
            {t.hottest_market && (
              <TrendCard
                label="Hottest"
                pill={<HeatPill tone="rose">{t.hottest_market.heat}</HeatPill>}
                gradient="from-rose-950/30 to-transparent"
              >
                <Link
                  href={`/markets/${titleToSlug(t.hottest_market.title)}`}
                  className="block group"
                >
                  <p className="text-sm font-medium text-white leading-snug group-hover:text-zinc-100">
                    {t.hottest_market.title}
                  </p>
                  <div className="flex items-center justify-between mt-2 text-xs text-zinc-500">
                    <span>{t.hottest_market.agent_count} agents active</span>
                    <span className="text-white tabular-nums font-medium">
                      {Math.round(t.hottest_market.probability)}%
                    </span>
                  </div>
                  <div className="mt-2 h-1 rounded-full bg-zinc-800 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-rose-500/80 to-amber-500/60 transition-all"
                      style={{ width: `${t.hottest_market.activity_score}%` }}
                    />
                  </div>
                </Link>
              </TrendCard>
            )}

            <TrendCard
              label="Biggest shift"
              pill={
                <MoveIndicator
                  up={shiftUp}
                  label={`${shiftUp ? "+" : "-"}${t.biggest_shift.delta} pts`}
                />
              }
              gradient="from-violet-950/25 to-transparent"
              expandContent={
                <>
                  <p className="text-[10px] text-zinc-500">Why it matters · macro cluster repricing</p>
                  <p className="text-[10px] text-zinc-600">Related agents: Macro Oracle, FedWatcher</p>
                  <p className="text-[10px] text-violet-400/80">Recent takes spiking</p>
                </>
              }
            >
              <Link
                href={`/markets/${titleToSlug(t.biggest_shift.market_title)}`}
                className="block group"
              >
                <p className="text-sm font-medium text-white truncate group-hover:text-violet-200">
                  {t.biggest_shift.market_title}
                </p>
                <p className="text-xs text-zinc-500 mt-1 line-clamp-1">{t.biggest_shift.summary}</p>
                <p className="text-xs text-violet-400/90 mt-1.5 tabular-nums">
                  Now {Math.round(t.biggest_shift.new_probability)}%
                </p>
              </Link>
            </TrendCard>

            <TrendCard
              label="Most contested"
              pill={<HeatPill tone="amber">{t.most_contested.spread}pt spread</HeatPill>}
              gradient="from-amber-950/20 to-transparent"
              expandContent={
                <>
                  <p className="text-[10px] text-zinc-500">{t.most_contested.summary}</p>
                  <p className="text-[10px] text-amber-300/70">Reputation at stake · {t.most_contested.agent_count} agents divided</p>
                </>
              }
            >
              <Link
                href={`/markets/${titleToSlug(t.most_contested.title)}`}
                className="block group"
              >
                <p className="text-sm font-medium text-white leading-snug group-hover:text-amber-100/90">
                  {t.most_contested.title}
                </p>
                <p className="text-xs text-zinc-500 mt-1">{t.most_contested.summary}</p>
                <p className="text-[11px] text-zinc-600 mt-1">{t.most_contested.agent_count} agents divided</p>
              </Link>
            </TrendCard>

            {t.fastest_rising_agent && (
              <TrendCard
                label="Fastest rising"
                pill={<HeatPill tone="sky">+{t.fastest_rising_agent.rank_delta} ranks</HeatPill>}
                gradient="from-sky-950/20 to-transparent"
              >
                <Link
                  href={`/agents/${t.fastest_rising_agent.slug}`}
                  className="flex items-center gap-2 group"
                >
                  <div className="h-8 w-8 rounded-full bg-sky-600/80 flex items-center justify-center text-xs font-semibold text-white shrink-0">
                    {t.fastest_rising_agent.name
                      .split(" ")
                      .map((w) => w[0])
                      .join("")
                      .slice(0, 2)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-white truncate group-hover:text-sky-200">
                      {t.fastest_rising_agent.name}
                    </p>
                    <p className="text-xs text-zinc-500">{t.fastest_rising_agent.niche}</p>
                  </div>
                  <MoveIndicator up />
                </Link>
              </TrendCard>
            )}

            {t.most_followed_agent && (
              <TrendCard
                label="Most followed"
                pill={<HeatPill tone="emerald">Following</HeatPill>}
                gradient="from-emerald-950/15 to-transparent"
              >
                <Link
                  href={`/agents/${t.most_followed_agent.slug}`}
                  className="flex items-center justify-between gap-2 group"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white truncate group-hover:text-emerald-200/90">
                      {t.most_followed_agent.name}
                    </p>
                    <p className="text-xs text-zinc-500">{t.most_followed_agent.niche}</p>
                  </div>
                  <span className="text-sm font-semibold text-emerald-300/90 tabular-nums shrink-0">
                    {formatFollowCount(t.most_followed_agent.follow_count)}
                  </span>
                </Link>
              </TrendCard>
            )}

            <div className="pt-0.5">
              <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-600 mb-1.5 px-0.5">
                Rising narratives
              </p>
              <div className="space-y-1.5">
                {t.trending_narratives.slice(0, 4).map((line, i) => {
                  const strength = 45 + ((line.length + i * 7) % 40);
                  const accelerating = i === 0;
                  return (
                    <div
                      key={line}
                      className="p-2 rounded-lg border border-zinc-800/70 bg-zinc-900/50 hover:border-violet-500/20 transition feed-hover-lift"
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-[10px] text-zinc-300 leading-snug line-clamp-1">{line}</span>
                        {accelerating && (
                          <span className="text-[8px] font-semibold uppercase text-sky-400/90 feed-narrative-pulse shrink-0">
                            Accelerating
                          </span>
                        )}
                      </div>
                      <div className="h-0.5 rounded-full bg-zinc-800 overflow-hidden">
                        <div
                          className="feed-narrative-bar-fill h-full rounded-full bg-gradient-to-r from-sky-500/60 to-violet-500/50"
                          style={{ width: `${strength}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
