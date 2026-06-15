"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import type { EnrichedMarket } from "./types";

function CompactRow({
  market,
  metric,
}: {
  market: EnrichedMarket;
  metric: string;
}) {
  const prob = Math.round(market.current_yes_probability);
  return (
    <Link
      href={`/markets/${market.slug}`}
      className="flex items-center justify-between gap-2 px-2 py-1.5 hover:bg-zinc-900/60 transition text-[10px]"
    >
      <span className="text-zinc-300 truncate min-w-0 font-medium">{market.title}</span>
      <span className="shrink-0 tabular-nums text-zinc-500 whitespace-nowrap">
        {prob}% · {metric}
      </span>
    </Link>
  );
}

function SidebarBlock({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-zinc-800/80 bg-zinc-950/80 overflow-hidden">
      <div className="px-2 py-1.5 border-b border-zinc-800/60">
        <h3 className="text-[10px] font-semibold text-zinc-300">{title}</h3>
        <p className="text-[9px] text-zinc-600">{subtitle}</p>
      </div>
      <div className="divide-y divide-zinc-800/60">{children}</div>
    </section>
  );
}

export function MarketsSidebar({
  markets,
  layout = "sidebar",
}: {
  markets: EnrichedMarket[];
  layout?: "sidebar" | "inline";
}) {
  const open = markets.filter((m) => m.status === "open");

  const trending = [...open]
    .sort((a, b) => {
      const score = (m: EnrichedMarket) =>
        (m.is_hot ? 4 : 0) +
        (m.urgency === "hot" ? 3 : m.urgency === "rising" ? 2 : 0) +
        m.agent_count * 0.1;
      return score(b) - score(a);
    })
    .slice(0, 5);

  const movers = [...open]
    .sort((a, b) => Math.abs(b.movement_delta) - Math.abs(a.movement_delta))
    .slice(0, 5);

  const conviction = [...open]
    .sort(
      (a, b) =>
        Math.max(a.reputation_yes_share, 100 - a.reputation_yes_share) -
        Math.max(b.reputation_yes_share, 100 - b.reputation_yes_share),
    )
    .reverse()
    .slice(0, 5);

  const contested = [...open]
    .sort((a, b) => b.disagreement_pct - a.disagreement_pct)
    .slice(0, 5);

  return (
    <aside
      className={`space-y-2 ${layout === "sidebar" ? "hidden lg:block lg:sticky lg:top-14 lg:self-start" : "block"}`}
    >
      <SidebarBlock title="Trending markets" subtitle="Network attention">
        {trending.map((m) => (
          <CompactRow key={m.slug} market={m} metric={`${m.agent_count} agents`} />
        ))}
      </SidebarBlock>

      <SidebarBlock title="Biggest movers" subtitle="24h probability">
        {movers.map((m) => (
          <CompactRow
            key={m.slug}
            market={m}
            metric={`${m.movement_delta > 0 ? "+" : ""}${m.movement_delta}pt`}
          />
        ))}
      </SidebarBlock>

      <SidebarBlock title="Highest conviction" subtitle="Reputation lean">
        {conviction.map((m) => (
          <CompactRow key={m.slug} market={m} metric={`${m.reputation_yes_share}% YES`} />
        ))}
      </SidebarBlock>

      <SidebarBlock title="Most contested" subtitle="Agent disagreement">
        {contested.map((m) => (
          <CompactRow key={m.slug} market={m} metric={`${m.disagreement_pct}% split`} />
        ))}
      </SidebarBlock>
    </aside>
  );
}
