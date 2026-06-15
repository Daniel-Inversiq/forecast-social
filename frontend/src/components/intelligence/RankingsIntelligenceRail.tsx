"use client";

import Link from "next/link";
import type { RankedAgent } from "@/components/leaderboards/types";
import {
  formatWeeklyCredibility,
  rankMovementLine,
  weeklyCredibilityChange,
} from "@/lib/leaderboardActivity";

type PremiumRow = {
  slug: string;
  name: string;
  metric: string;
  tone: "rose" | "emerald";
};

function premiumUnderPressure(agents: RankedAgent[]): PremiumRow[] {
  return agents
    .filter(
      (a) =>
        a.rank_delta <= -2 ||
        (a.reputation_delta != null && a.reputation_delta < 0) ||
        weeklyCredibilityChange(a) < -2,
    )
    .map((a) => {
      const metric =
        rankMovementLine(a) ??
        formatWeeklyCredibility(weeklyCredibilityChange(a)) ??
        (a.reputation_delta != null
          ? `${a.reputation_delta} credibility`
          : null);
      if (!metric) return null;
      return {
        slug: a.slug,
        name: a.name,
        metric,
        tone: "rose" as const,
      };
    })
    .filter((r): r is PremiumRow => r != null)
    .slice(0, 2);
}

function premiumCredibilityRisers(agents: RankedAgent[]): PremiumRow[] {
  return agents
    .filter((a) => weeklyCredibilityChange(a) > 0)
    .sort((a, b) => weeklyCredibilityChange(b) - weeklyCredibilityChange(a))
    .map((a) => {
      const metric =
        formatWeeklyCredibility(weeklyCredibilityChange(a)) ?? rankMovementLine(a);
      if (!metric) return null;
      return {
        slug: a.slug,
        name: a.name,
        metric,
        tone: "emerald" as const,
      };
    })
    .filter((r): r is PremiumRow => r != null)
    .slice(0, 2);
}

/** Premium-only sidebar slice — hidden when there is no measurable signal. */
export function RankingsIntelligenceRail({
  agents,
  hasAccess,
}: {
  agents: RankedAgent[];
  hasAccess: boolean;
}) {
  if (!hasAccess) {
    return null;
  }

  return <RankingsPremiumRail agents={agents} />;
}

function RankingsPremiumRail({ agents }: { agents: RankedAgent[] }) {
  const pressure = premiumUnderPressure(agents);
  const risers = premiumCredibilityRisers(agents);
  const rows = [...pressure, ...risers];

  if (rows.length === 0) {
    return null;
  }

  return (
    <section
      className="rounded-lg border border-amber-500/12 bg-zinc-950/90 p-2.5 shrink-0"
      aria-label="Rankings intelligence"
    >
      <p className="text-[8px] font-semibold uppercase tracking-[0.18em] text-amber-400/75">
        Under pressure & risers
      </p>
      <ul className="mt-2 space-y-1 max-h-[7rem] overflow-y-auto scrollbar-none">
        {rows.map((row) => (
          <li key={`${row.tone}-${row.slug}`} className="text-[9px] leading-snug">
            <Link
              href={`/agents/${row.slug}`}
              className={
                row.tone === "rose"
                  ? "text-zinc-400 hover:text-rose-300/90"
                  : "text-zinc-400 hover:text-emerald-300/90"
              }
            >
              {row.name}
            </Link>
            <span className="text-zinc-600 tabular-nums"> · {row.metric}</span>
          </li>
        ))}
      </ul>
      <Link
        href="/premium"
        className="mt-2 inline-flex text-[9px] text-zinc-500 hover:text-zinc-400 transition"
      >
        Full desk →
      </Link>
    </section>
  );
}

/** One-line mobile banner — does not block the scoreboard grid. */
export function RankingsIntelligenceBanner({ hasAccess }: { hasAccess: boolean }) {
  if (hasAccess) return null;
  return (
    <div className="lg:hidden mb-2 flex items-center justify-between gap-2 rounded-lg border border-amber-500/10 bg-zinc-950/80 px-2.5 py-1.5">
      <p className="text-[10px] text-zinc-500 truncate min-w-0">
        <span className="text-amber-400/80 font-medium">Intelligence</span>
        {" · "}
        Deeper scoreboard analytics
      </p>
      <Link
        href="/premium"
        className="shrink-0 text-[9px] text-amber-300/90 hover:text-amber-200 border border-amber-500/20 rounded px-2 py-0.5"
      >
        Unlock →
      </Link>
    </div>
  );
}
