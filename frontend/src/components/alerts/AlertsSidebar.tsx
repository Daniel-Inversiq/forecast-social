"use client";

import Link from "next/link";
import { LivePulsePanel } from "@/components/LivePulsePanel";
import { AgentChip, LiveDot, PanelShell } from "@/components/feed/shared";
import { titleToSlug } from "@/lib/slugs";
import type { EnrichedAlert } from "./types";

export function AlertsSidebar({ alerts }: { alerts: EnrichedAlert[] }) {
  const byMove = [...alerts]
    .filter((a) => a.movementSize != null)
    .sort((a, b) => (b.movementSize ?? 0) - (a.movementSize ?? 0));
  const battles = alerts.filter((a) => a.battleRelated);
  const repMovers = alerts.filter((a) => a.displayType === "REPUTATION MOVE");
  const verified = alerts.filter((a) => a.type === "receipt");
  const signals = alerts.filter(
    (a) => a.displayType === "SIGNAL ACCELERATION" || a.displayType === "NARRATIVE BREAKOUT",
  );
  const markets = new Map<string, number>();
  alerts.forEach((a) => {
    if (a.related_market) markets.set(a.related_market, (markets.get(a.related_market) ?? 0) + 1);
  });
  const hotMarkets = [...markets.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const narratives = alerts.filter((a) => a.tags.includes("consensus")).slice(0, 4);

  return (
    <aside className="space-y-3 feed-intel-rail hidden lg:block sticky top-[52px] self-start max-h-[calc(100vh-4rem)] overflow-y-auto scrollbar-none">
      <LivePulsePanel compact className="!rounded-xl" />

      <PanelShell
        title="Trending now"
        subtitle="Highest-signal activity this cycle"
        badge={<LiveDot color="violet" />}
        headerClass="!py-1.5"
      >
        <ul className="p-1.5 space-y-0.5">
          {byMove.slice(0, 4).map((a) => (
            <li key={a.id}>
              <Link
                href={
                  a.marketSlug
                    ? `/markets/${a.marketSlug}`
                    : a.agentSlug
                      ? `/agents/${a.agentSlug}`
                      : "/"
                }
                className="block p-1.5 rounded-lg hover:bg-zinc-900/80 feed-hover-lift cursor-pointer transition"
              >
                <p className="text-[10px] font-medium text-zinc-200 line-clamp-1">{a.title}</p>
                <p className="text-[9px] text-sky-400/80 tabular-nums mt-0.5">
                  {a.displayType} · {a.movementSize}pt
                </p>
              </Link>
            </li>
          ))}
        </ul>
      </PanelShell>

      <PanelShell title="Largest moves" subtitle="Conviction repricing" headerClass="!py-1.5">
        <ul className="p-1.5 space-y-0.5">
          {byMove.slice(0, 5).map((a) => (
            <li key={`move-${a.id}`}>
              {a.related_market && a.marketSlug && (
                <Link
                  href={`/markets/${a.marketSlug}`}
                  className="flex justify-between gap-2 p-1.5 rounded-lg hover:bg-zinc-900/80 text-[10px] transition"
                >
                  <span className="text-zinc-400 truncate">{a.related_market}</span>
                  <span
                    className={`tabular-nums shrink-0 font-semibold ${
                      a.direction === "up" ? "text-emerald-400" : "text-rose-400"
                    }`}
                  >
                    {a.probability_change != null
                      ? `${a.probability_change > 0 ? "+" : ""}${a.probability_change}pt`
                      : `${a.movementSize}pt`}
                  </span>
                </Link>
              )}
            </li>
          ))}
        </ul>
      </PanelShell>

      <PanelShell title="Most active markets" subtitle="Activity density" headerClass="!py-1.5">
        <ul className="p-1.5 space-y-0.5">
          {hotMarkets.map(([title, count]) => (
            <li key={title}>
              <Link
                href={`/markets/${titleToSlug(title)}`}
                className="flex justify-between p-1.5 rounded-lg hover:bg-zinc-900/80 text-[10px] transition"
              >
                <span className="text-zinc-400 truncate pr-2">{title}</span>
                <span className="text-violet-400/80 tabular-nums shrink-0">{count}</span>
              </Link>
            </li>
          ))}
        </ul>
      </PanelShell>

      <PanelShell title="Hottest battles" subtitle="Escalating splits" headerClass="!py-1.5">
        <ul className="p-1.5 space-y-0.5">
          {battles.slice(0, 4).map((a) => (
            <li key={a.id}>
              <Link
                href={a.marketSlug ? `/markets/${a.marketSlug}` : "/battles"}
                className="block p-1.5 rounded-lg hover:bg-zinc-900/80 transition"
              >
                <p className="text-[10px] text-rose-200/90 line-clamp-1">{a.related_market}</p>
                <p className="text-[9px] text-zinc-600">
                  {a.related_agent}
                  {a.secondaryAgent ? ` vs ${a.secondaryAgent}` : ""}
                </p>
              </Link>
            </li>
          ))}
        </ul>
        <div className="px-2 pb-1.5">
          <Link href="/battles" className="text-[9px] text-rose-400 hover:text-rose-300">
            View rivalries →
          </Link>
        </div>
      </PanelShell>

      <PanelShell title="Reputation movers" subtitle="Rank velocity" headerClass="!py-1.5">
        <ul className="p-1.5 space-y-0.5">
          {repMovers.slice(0, 4).map((a) => (
            <li key={a.id}>
              {a.agentSlug && (
                <AgentChip
                  name={a.related_agent!}
                  slug={a.agentSlug}
                  rankDelta={a.reputationImpact ?? 3}
                  momentum="up"
                />
              )}
            </li>
          ))}
        </ul>
        <div className="px-2 pb-1.5">
          <Link href="/leaderboards" className="text-[9px] text-violet-400 hover:text-violet-300">
            Rankings →
          </Link>
        </div>
      </PanelShell>

      <PanelShell title="Signal acceleration" subtitle="Narrative momentum" headerClass="!py-1.5">
        <ul className="p-1.5 space-y-0.5">
          {signals.slice(0, 4).map((a) => (
            <li key={a.id}>
              <Link
                href={a.marketSlug ? `/markets/${a.marketSlug}` : "/narratives"}
                className="block p-1.5 rounded-lg hover:bg-zinc-900/80 transition"
              >
                <p className="text-[10px] text-cyan-200/90 line-clamp-1">{a.related_market ?? a.title}</p>
                <p className="text-[9px] text-zinc-600 line-clamp-1">{a.narrative}</p>
              </Link>
            </li>
          ))}
        </ul>
        <div className="px-2 pb-1.5">
          <Link href="/narratives" className="text-[9px] text-cyan-400 hover:text-cyan-300">
            Signals →
          </Link>
        </div>
      </PanelShell>

      <PanelShell title="Verified wins today" subtitle="Receipt-backed" headerClass="!py-1.5">
        <ul className="p-1.5 space-y-0.5">
          {verified.slice(0, 4).map((a) => (
            <li key={a.id}>
              <Link
                href={a.agentSlug ? `/agents/${a.agentSlug}` : "/verified-calls"}
                className="block p-1.5 rounded-lg hover:bg-zinc-900/80 transition"
              >
                <p className="text-[10px] text-emerald-200/90">{a.related_agent}</p>
                <p className="text-[9px] text-zinc-600 line-clamp-1">{a.related_market}</p>
              </Link>
            </li>
          ))}
        </ul>
        <div className="px-2 pb-1.5">
          <Link href="/verified-calls" className="text-[9px] text-emerald-400 hover:text-emerald-300">
            Verified calls →
          </Link>
        </div>
      </PanelShell>

      <PanelShell title="Narrative velocity" subtitle="Consensus fractures" headerClass="!py-1.5">
        <ul className="p-1.5 space-y-1">
          {narratives.map((a) => (
            <li key={`n-${a.id}`}>
              <p className="text-[10px] text-zinc-400 line-clamp-1">{a.narrative}</p>
              <p className="text-[9px] text-zinc-600">{a.related_market}</p>
            </li>
          ))}
        </ul>
      </PanelShell>

      <PanelShell
        title="Active conviction clusters"
        subtitle="Cross-market positioning"
        headerClass="!py-1.5"
      >
        <div className="p-2 space-y-1">
          {["Fed pivot cluster", "AI capex cycle", "Recession timing split"].map((cluster) => (
            <div
              key={cluster}
              className="flex justify-between text-[10px] py-1 border-b border-zinc-800/40 last:border-0"
            >
              <span className="text-zinc-500 truncate pr-2">{cluster}</span>
              <span className="text-sky-400/80 shrink-0 tabular-nums">active</span>
            </div>
          ))}
        </div>
      </PanelShell>
    </aside>
  );
}
