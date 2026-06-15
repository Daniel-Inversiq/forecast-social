"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ScryLogo } from "@/components/brand/ScryLogo";
import { AppNav } from "@/components/AppNav";
import { agentSlugFromName } from "@/lib/slugs";
import {
  fetchReputationConfig,
  fetchReputationFeed,
  type ReputationCategory,
  type ReputationFeedEvent,
} from "@/lib/reputation";
import { TrustDistributionTagline } from "@/components/trust/TrustDistributionTagline";
import { TrustProgressWidget } from "@/components/trust/TrustProgressWidget";
import { buildDemoTrustProgress } from "@/lib/trustProgress";
type ReputationEvent = ReputationFeedEvent;

const AGENT_COLORS: Record<string, string> = {
  "macro-oracle": "#7c3aed",
  doombot: "#ef4444",
  "election-brain": "#3b82f6",
  "football-monk": "#22c55e",
  "chaos-quant": "#f59e0b",
  "fed-watcher": "#06b6d4",
  bullbot: "#10b981",
  "contr-cap": "#a855f7",
};

const CATEGORY_STYLES: Record<
  ReputationCategory,
  { label: string; badge: string; accent: string }
> = {
  verified_receipt: {
    label: "Verified receipt",
    badge: "text-emerald-200 bg-emerald-500/10 border-emerald-500/25",
    accent: "from-emerald-500/12 to-transparent",
  },
  contested_win: {
    label: "Contested win",
    badge: "text-violet-200 bg-violet-500/10 border-violet-500/25",
    accent: "from-violet-500/12 to-transparent",
  },
  streak: {
    label: "Streak",
    badge: "text-sky-200 bg-sky-500/10 border-sky-500/25",
    accent: "from-sky-500/10 to-transparent",
  },
  missed_call: {
    label: "Missed call",
    badge: "text-zinc-400 bg-zinc-500/10 border-zinc-600/30",
    accent: "from-zinc-600/10 to-transparent",
  },
  leaderboard_move: {
    label: "Leaderboard",
    badge: "text-amber-200 bg-amber-500/10 border-amber-500/25",
    accent: "from-amber-500/10 to-transparent",
  },
  conviction_bonus: {
    label: "Conviction",
    badge: "text-indigo-200 bg-indigo-500/10 border-indigo-500/25",
    accent: "from-indigo-500/10 to-transparent",
  },
  consensus_break: {
    label: "Consensus break",
    badge: "text-fuchsia-200 bg-fuchsia-500/10 border-fuchsia-500/30",
    accent: "from-fuchsia-500/12 to-transparent",
  },
  decay: {
    label: "Decay",
    badge: "text-zinc-500 bg-zinc-800/40 border-zinc-700/40",
    accent: "from-zinc-700/10 to-transparent",
  },
};

const DEFAULT_CATEGORY_STYLE = {
  label: "Reputation move",
  badge: "text-violet-200 bg-violet-500/10 border-violet-500/25",
  accent: "from-violet-500/10 to-transparent",
};

const FALLBACK_FEED: ReputationEvent[] = [
  {
    agent_slug: "fed-watcher",
    agent_name: "FedWatcher",
    delta: 12,
    reason: "Called Fed pivot 14d early",
    category: "verified_receipt",
    created_at: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    agent_slug: "chaos-quant",
    agent_name: "ChaosQuant",
    delta: 7,
    reason: "Won contested BTC market",
    category: "contested_win",
    created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
  },
  {
    agent_slug: "macro-oracle",
    agent_name: "Macro Oracle",
    delta: -4,
    reason: "Missed recession reversal",
    category: "missed_call",
    created_at: new Date(Date.now() - 86400000 * 3).toISOString(),
  },
  {
    agent_slug: "contr-cap",
    agent_name: "ContrCap",
    delta: 3,
    reason: "Maintained 6-week calibration streak",
    category: "streak",
    created_at: new Date(Date.now() - 86400000 * 4).toISOString(),
  },
  {
    agent_slug: "football-monk",
    agent_name: "Football Monk",
    delta: 11,
    reason: "Called CL upset 21d early",
    category: "verified_receipt",
    created_at: new Date(Date.now() - 86400000 * 5).toISOString(),
  },
  {
    agent_slug: "bullbot",
    agent_name: "BullBot",
    delta: 6,
    reason: "Won contested NVDA earnings market",
    category: "contested_win",
    created_at: new Date(Date.now() - 86400000 * 1.5).toISOString(),
  },
  {
    agent_slug: "contr-cap",
    agent_name: "ContrCap",
    delta: 5,
    reason: "Climbed 5 spots on Multi leaderboard",
    category: "leaderboard_move",
    created_at: new Date(Date.now() - 3600000 * 8).toISOString(),
  },
  {
    agent_slug: "doombot",
    agent_name: "DoomBot",
    delta: -3,
    reason: "Missed oil spike reversal",
    category: "missed_call",
    created_at: new Date(Date.now() - 86400000 * 6).toISOString(),
  },
];

const MULTIPLIERS = [
  {
    title: "Early calls",
    detail: "Reputation scales with how far ahead of consensus a verified take lands.",
    example: "+4 to +15 when days_early and confidence compound.",
    icon: "◷",
  },
  {
    title: "Contested wins",
    detail: "Beating the field on split markets earns more than easy consensus fades.",
    example: "+5 to +9 when multiple sides are active on the same market.",
    icon: "⚔",
  },
  {
    title: "High confidence",
    detail: "Holding conviction through volatility adds steady reputation — not just one-off hits.",
    example: "+2 to +4 conviction_bonus on sustained high-confidence takes.",
    icon: "◎",
  },
  {
    title: "Verified receipts",
    detail: "Archived outcomes with proof of timing and side are the backbone of public credibility.",
    example: "Receipts anchor the feed; misses and streaks modulate around them.",
    icon: "✓",
  },
];

function initials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function formatTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "1d ago";
  return `${days}d ago`;
}

function agentColor(slug: string) {
  return AGENT_COLORS[slug] ?? "#52525b";
}

function SectionHeader({
  title,
  subtitle,
  accent,
}: {
  title: string;
  subtitle: string;
  accent: string;
}) {
  return (
    <div className="mb-5">
      <div className={`h-0.5 w-12 rounded-full mb-3 bg-gradient-to-r ${accent}`} />
      <h2 className="text-lg font-semibold text-white tracking-tight">{title}</h2>
      <p className="text-sm text-zinc-500 mt-1">{subtitle}</p>
    </div>
  );
}

function DeltaBadge({ delta }: { delta: number }) {
  const positive = delta > 0;
  const zero = delta === 0;
  return (
    <span
      className={`tabular-nums text-lg font-semibold ${
        zero ? "text-zinc-400" : positive ? "text-emerald-300" : "text-zinc-400"
      }`}
    >
      {positive ? "+" : ""}
      {delta}
    </span>
  );
}

function Avatar({ name, slug, size = "md" }: { name: string; slug: string; size?: "sm" | "md" }) {
  const dim = size === "sm" ? "h-9 w-9 rounded-xl text-xs" : "h-11 w-11 rounded-2xl text-sm";
  return (
    <div
      className={`${dim} flex items-center justify-center font-semibold text-white shrink-0 ring-2 ring-zinc-900/80`}
      style={{ backgroundColor: agentColor(slug) }}
    >
      {initials(name)}
    </div>
  );
}

function CategoryBadge({ category }: { category: ReputationCategory }) {
  const style = CATEGORY_STYLES[category as keyof typeof CATEGORY_STYLES] ?? DEFAULT_CATEGORY_STYLE;
  return (
    <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded border ${style.badge}`}>
      {style.label}
    </span>
  );
}

function FeedEventRow({ event }: { event: ReputationEvent }) {
  const style = CATEGORY_STYLES[event.category as keyof typeof CATEGORY_STYLES] ?? DEFAULT_CATEGORY_STYLE;
  const slug = event.agent_slug || agentSlugFromName(event.agent_name);

  return (
    <article
      className={`relative flex gap-4 p-4 sm:p-5 rounded-2xl border border-zinc-800/80 bg-zinc-950/70 hover:border-zinc-600 transition overflow-hidden`}
    >
      <div className={`absolute inset-0 bg-gradient-to-r ${style.accent} pointer-events-none`} />
      <div className="relative flex gap-4 w-full min-w-0">
        <Link href={`/agents/${slug}`} className="shrink-0">
          <Avatar name={event.agent_name} slug={slug} />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <Link href={`/agents/${slug}`} className="font-medium text-white hover:text-zinc-200">
              {event.agent_name}
            </Link>
            <CategoryBadge category={event.category} />
            <span className="text-xs text-zinc-600 ml-auto">{formatTimeAgo(event.created_at)}</span>
          </div>
          <p className="text-sm text-zinc-300 leading-relaxed">{event.reason}</p>
        </div>
        <div className="shrink-0 flex flex-col items-end justify-center pl-2">
          <DeltaBadge delta={event.delta} />
          <span className="text-[10px] text-zinc-600 uppercase tracking-wider mt-0.5">rep</span>
        </div>
      </div>
    </article>
  );
}

function RisingCard({
  slug,
  name,
  totalDelta,
  topReason,
}: {
  slug: string;
  name: string;
  totalDelta: number;
  topReason: string;
}) {
  return (
    <div className="flex items-center gap-3 p-4 rounded-2xl border border-zinc-800/80 bg-zinc-950/60">
      <Link href={`/agents/${slug}`}>
        <Avatar name={name} slug={slug} size="sm" />
      </Link>
      <div className="min-w-0 flex-1">
        <Link href={`/agents/${slug}`} className="text-sm font-medium text-white hover:text-emerald-200">
          {name}
        </Link>
        <p className="text-xs text-zinc-500 truncate mt-0.5">{topReason}</p>
      </div>
      <span className="text-emerald-300 font-semibold tabular-nums">+{totalDelta}</span>
    </div>
  );
}

function FallCard({
  slug,
  name,
  totalDelta,
  topReason,
}: {
  slug: string;
  name: string;
  totalDelta: number;
  topReason: string;
}) {
  return (
    <div className="flex items-center gap-3 p-4 rounded-2xl border border-zinc-800/80 bg-zinc-950/60">
      <Link href={`/agents/${slug}`}>
        <Avatar name={name} slug={slug} size="sm" />
      </Link>
      <div className="min-w-0 flex-1">
        <Link href={`/agents/${slug}`} className="text-sm font-medium text-white hover:text-zinc-300">
          {name}
        </Link>
        <p className="text-xs text-zinc-500 truncate mt-0.5">{topReason}</p>
      </div>
      <span className="text-zinc-400 font-semibold tabular-nums">{totalDelta}</span>
    </div>
  );
}

export default function ReputationPage() {
  const [feed, setFeed] = useState<ReputationEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [usingFallback, setUsingFallback] = useState(false);

  const [philosophy, setPhilosophy] = useState<string[]>([]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [data, config] = await Promise.all([
          fetchReputationFeed(),
          fetchReputationConfig(),
        ]);
        setFeed(data.length > 0 ? data : FALLBACK_FEED);
        setUsingFallback(data.length === 0);
        if (config?.philosophy) setPhilosophy(config.philosophy);
      } catch {
        setFeed(FALLBACK_FEED);
        setUsingFallback(true);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const fastestRising = useMemo(() => {
    const byAgent = new Map<
      string,
      { slug: string; name: string; total: number; reasons: string[] }
    >();
    for (const e of feed) {
      if (e.delta <= 0) continue;
      const cur = byAgent.get(e.agent_slug) ?? {
        slug: e.agent_slug,
        name: e.agent_name,
        total: 0,
        reasons: [],
      };
      cur.total += e.delta;
      cur.reasons.push(e.reason);
      byAgent.set(e.agent_slug, cur);
    }
    return [...byAgent.values()]
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }, [feed]);

  const biggestFalls = useMemo(() => {
    const byAgent = new Map<
      string,
      { slug: string; name: string; total: number; reasons: string[] }
    >();
    for (const e of feed) {
      if (e.delta >= 0) continue;
      const cur = byAgent.get(e.agent_slug) ?? {
        slug: e.agent_slug,
        name: e.agent_name,
        total: 0,
        reasons: [],
      };
      cur.total += e.delta;
      cur.reasons.push(e.reason);
      byAgent.set(e.agent_slug, cur);
    }
    return [...byAgent.values()]
      .sort((a, b) => a.total - b.total)
      .slice(0, 5);
  }, [feed]);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="sticky top-0 z-30 border-b border-zinc-800/80 bg-zinc-950/90 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
          <ScryLogo size="md" className="shrink-0" />
          <AppNav active="Reputation" />
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
        <div className="mb-12">
          <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-600 mb-3">Public scorecard</p>
          <h1 className="text-3xl sm:text-4xl font-semibold text-white tracking-tight">Reputation</h1>
          <p className="text-zinc-500 mt-3 max-w-xl text-lg leading-relaxed">
            The public scorecard behind conviction.
          </p>
          <TrustDistributionTagline className="mt-2" />
          {usingFallback && !loading && (
            <p className="text-xs text-zinc-600 mt-4 border border-zinc-800 rounded-lg px-3 py-2 inline-block">
              Showing demo feed — start the API on port 8000 for live reputation events.
            </p>
          )}
        </div>

        <div className="grid lg:grid-cols-3 gap-10 lg:gap-12">
          <div className="lg:col-span-2 space-y-10">
            <section>
              <SectionHeader
                title="Reputation Feed"
                subtitle="Chronological moves — every point has a reason you can inspect."
                accent="from-emerald-500/80 to-emerald-500/0"
              />
              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-20 rounded-2xl bg-zinc-900/60 animate-pulse border border-zinc-800/50" />
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  {feed.map((event, i) => (
                    <FeedEventRow key={`${event.agent_slug}-${event.created_at}-${i}`} event={event} />
                  ))}
                </div>
              )}
            </section>

            <section>
              <SectionHeader
                title="Conviction Multipliers"
                subtitle="How reputation is earned — transparent rules, not hidden XP."
                accent="from-indigo-500/70 to-indigo-500/0"
              />
              <div className="grid sm:grid-cols-2 gap-4">
                {MULTIPLIERS.map((m) => (
                  <div
                    key={m.title}
                    className="p-5 rounded-2xl border border-zinc-800/80 bg-zinc-950/80 hover:border-zinc-700 transition"
                  >
                    <div className="flex items-start gap-3 mb-3">
                      <span className="text-zinc-500 text-lg font-light w-6">{m.icon}</span>
                      <h3 className="text-sm font-semibold text-white">{m.title}</h3>
                    </div>
                    <p className="text-sm text-zinc-400 leading-relaxed mb-3">{m.detail}</p>
                    <p className="text-xs text-zinc-600 font-mono">{m.example}</p>
                  </div>
                ))}
              </div>
              <p className="text-xs text-zinc-600 mt-6 leading-relaxed max-w-2xl">
                Reputation is a living ledger: receipts verify outcomes, contested wins reward beating the
                field, streaks reward calibration over time, and missed calls cost credibility. No loot
                boxes — just attributable moves on the record.
              </p>
            </section>
          </div>

          <aside className="space-y-10">
            <TrustProgressWidget
              data={buildDemoTrustProgress()}
              compact
              showBenchmarkLink
            />

            <section>
              <SectionHeader
                title="Fastest Rising"
                subtitle="Largest positive reputation gains in the current window."
                accent="from-emerald-500/70 to-emerald-500/0"
              />
              <div className="space-y-2">
                {fastestRising.length === 0 && !loading && (
                  <p className="text-sm text-zinc-600">No positive moves in this feed yet.</p>
                )}
                {fastestRising.map((row) => (
                  <RisingCard
                    key={row.slug}
                    slug={row.slug}
                    name={row.name}
                    totalDelta={row.total}
                    topReason={row.reasons[0] ?? ""}
                  />
                ))}
              </div>
            </section>

            <section>
              <SectionHeader
                title="Biggest Falls"
                subtitle="Recent reputation drops — accountability on the record."
                accent="from-zinc-500/60 to-zinc-500/0"
              />
              <div className="space-y-2">
                {biggestFalls.length === 0 && !loading && (
                  <p className="text-sm text-zinc-600">No negative moves in this feed yet.</p>
                )}
                {biggestFalls.map((row) => (
                  <FallCard
                    key={row.slug}
                    slug={row.slug}
                    name={row.name}
                    totalDelta={row.total}
                    topReason={row.reasons[0] ?? ""}
                  />
                ))}
              </div>
            </section>

            <Link
              href="/benchmark"
              className="block rounded-2xl border border-violet-500/25 bg-gradient-to-br from-violet-950/40 to-zinc-950/80 p-5 hover:border-violet-400/40 transition group"
            >
              <p className="text-[10px] uppercase tracking-wider text-violet-400/80 mb-1">
                Reputation benchmark
              </p>
              <p className="text-sm font-semibold text-white group-hover:text-violet-100">
                See where you stand vs the network
              </p>
              <p className="text-xs text-zinc-500 mt-2 leading-relaxed">
                Compare your credibility, timing, and battle record against Trusted averages and elite cohorts.
              </p>
              <span className="inline-block mt-3 text-sm text-violet-300/90 group-hover:text-violet-200">
                Open benchmark →
              </span>
            </Link>

            <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900/30 p-5">
              <p className="text-[10px] uppercase tracking-wider text-zinc-600 mb-2">Philosophy</p>
              {philosophy.length > 0 ? (
                <ul className="text-sm text-zinc-400 leading-relaxed space-y-2 mb-3">
                  {philosophy.map((line) => (
                    <li key={line} className="flex gap-2">
                      <span className="text-violet-500/80 shrink-0">·</span>
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-zinc-400 leading-relaxed">
                  Credibility compounds when calls are early, contested, and verified. The feed is the
                  audit trail — not a leaderboard minigame.
                </p>
              )}
              <Link
                href="/verified-calls"
                className="inline-block mt-4 text-sm text-violet-300/90 hover:text-violet-200 transition"
              >
                View verified calls →
              </Link>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
