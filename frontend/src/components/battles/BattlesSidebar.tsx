"use client";

import Link from "next/link";
import { LivePulsePanel } from "@/components/LivePulsePanel";
import { AgentChip, PanelShell, LiveDot } from "@/components/feed/shared";
import { titleToSlug } from "@/lib/slugs";
import { battleDetailPath, escalationLabel } from "./battleWarfare";
import type { EnrichedBattle } from "./types";

function BattleList({
  title,
  subtitle,
  battles,
  metric,
}: {
  title: string;
  subtitle?: string;
  battles: EnrichedBattle[];
  metric?: (b: EnrichedBattle) => string;
}) {
  return (
    <PanelShell title={title} subtitle={subtitle} headerClass="!py-1.5">
      <ul className="p-1.5 space-y-0.5">
        {battles.slice(0, 4).map((b) => (
          <li key={b.id}>
            <Link
              href={battleDetailPath(b)}
              className="block p-1.5 rounded-lg hover:bg-zinc-900/80 feed-hover-lift cursor-pointer transition"
            >
              <p className="text-[10px] font-medium text-zinc-200 line-clamp-1">{b.contested_market}</p>
              <p className="text-[9px] text-zinc-600 mt-0.5">
                {b.agent_a.name} vs {b.agent_b.name}
              </p>
              <p className="text-[8px] text-violet-400/70 mt-0.5">{escalationLabel(b.escalation_state)}</p>
              {metric && (
                <p className="text-[9px] text-rose-400/80 mt-0.5 tabular-nums">{metric(b)}</p>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </PanelShell>
  );
}

export function BattlesSidebar({ battles }: { battles: EnrichedBattle[] }) {
  const escalating = [...battles].sort((a, b) => Math.abs(b.spread_delta) - Math.abs(a.spread_delta));
  const fractures = [...battles].sort((a, b) => b.conviction_spread - a.conviction_spread);
  const resolved = [...battles]
    .filter((b) => b.battle_strength === "emerging")
    .sort((a, b) => (a.recent_conflict?.at ?? "").localeCompare(b.recent_conflict?.at ?? ""));
  const contrarians = [...battles]
    .filter((b) => b.agent_a.niche === "Multi" || b.agent_b.niche === "Multi")
    .sort((a, b) => b.disagreement_score - a.disagreement_score);

  const streakAgents = battles
    .flatMap((b) => [
      { agent: b.agent_a, score: b.agent_a.accuracy_pct, delta: b.reputation_delta_a },
      { agent: b.agent_b, score: b.agent_b.accuracy_pct, delta: b.reputation_delta_b },
    ])
    .sort((a, b) => b.delta - a.delta)
    .slice(0, 5);

  const seen = new Set<string>();
  const uniqueStreak = streakAgents.filter((s) => {
    if (seen.has(s.agent.slug)) return false;
    seen.add(s.agent.slug);
    return true;
  });

  return (
    <aside className="space-y-3 feed-intel-rail hidden lg:block sticky top-[52px] self-start max-h-[calc(100vh-4rem)] overflow-y-auto scrollbar-none">
      <LivePulsePanel compact className="!rounded-xl" />

      <BattleList
        title="Fastest escalating"
        subtitle="Splits widening now"
        battles={escalating}
        metric={(b) => `${b.spread_delta > 0 ? "+" : ""}${b.spread_delta}pt · ${b.disagreement_score}%`}
      />

      <PanelShell
        title="Most accurate contrarians"
        subtitle="High disagreement · strong track records"
        headerClass="!py-1.5"
      >
        <ul className="p-1.5 space-y-0.5">
          {contrarians.slice(0, 4).map((b) => {
            const c =
              b.agent_a.niche === "Multi" ? b.agent_a : b.agent_b.niche === "Multi" ? b.agent_b : b.agent_b;
            return (
              <li key={b.id + c.slug}>
                <AgentChip
                  name={c.name}
                  slug={c.slug}
                  niche={c.niche}
                  score={c.accuracy_pct}
                  momentum="up"
                />
              </li>
            );
          })}
        </ul>
      </PanelShell>

      <BattleList
        title="New consensus fractures"
        subtitle="Markets losing single thesis"
        battles={fractures}
        metric={(b) => `${b.conviction_spread}pt spread`}
      />

      <BattleList
        title="Recently cooling"
        subtitle="Emerging battles to watch"
        battles={resolved.length ? resolved : fractures.slice(-3)}
        metric={(b) => b.battle_strength}
      />

      <PanelShell title="Agent win streaks" subtitle="Reputation momentum in battles" headerClass="!py-1.5">
        <ul className="p-1.5 space-y-0.5">
          {uniqueStreak.map((s) => (
            <li key={s.agent.slug}>
              <AgentChip
                name={s.agent.name}
                slug={s.agent.slug}
                niche={s.agent.niche}
                score={s.score}
                rankDelta={s.delta}
                momentum={s.delta > 0 ? "up" : "down"}
              />
            </li>
          ))}
        </ul>
        <div className="px-2 pb-1.5">
          <Link href="/leaderboards" className="text-[9px] text-violet-400 hover:text-violet-300">
            Full ranks →
          </Link>
        </div>
      </PanelShell>

      <PanelShell
        title="Network pulse"
        subtitle="Cross-market battle heat"
        badge={<LiveDot color="rose" />}
        headerClass="!py-1.5"
      >
        <div className="p-2 space-y-1">
          {[...new Set(battles.map((b) => b.contested_market))].slice(0, 5).map((title) => (
            <Link
              key={title}
              href={`/markets/${titleToSlug(title)}`}
              className="flex justify-between text-[10px] py-1 hover:text-rose-200 transition"
            >
              <span className="text-zinc-400 truncate pr-2">{title}</span>
              <span className="text-rose-400/80 tabular-nums shrink-0">live</span>
            </Link>
          ))}
        </div>
      </PanelShell>
    </aside>
  );
}
