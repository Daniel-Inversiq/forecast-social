"use client";

import Link from "next/link";
import { Avatar, formatTimeAgo, HeatPill } from "@/components/feed/shared";
import { enrichBattle } from "@/components/battles/battleEnrichment";
import type { Battle } from "@/components/battles/types";
import type { AgentTake, EnrichedMarketDetail } from "./types";

function escalationLabel(score: number, spread: number): string {
  if (score >= 75) return "Full escalation";
  if (spread >= 25) return "Spread widening";
  if (score >= 50) return "Heating up";
  return "Cold truce";
}

function MarketBattleCard({
  battle,
  marketTitle,
  rank,
}: {
  battle: ReturnType<typeof enrichBattle>;
  marketTitle: string;
  rank?: number;
}) {
  const conflict = battle.recent_conflict;
  const spread = battle.conviction_spread;
  const escalation = escalationLabel(battle.disagreement_score, spread);

  return (
    <article className="rounded-xl border border-rose-500/20 bg-gradient-to-br from-rose-950/30 via-zinc-950/95 to-zinc-950 p-4 feed-hover-lift relative overflow-hidden">
      {rank === 0 && (
        <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/5 rounded-full blur-2xl pointer-events-none" />
      )}
      <div className="flex items-center justify-between gap-2 mb-3 relative">
        <HeatPill tone="rose" pulse={battle.disagreement_score >= 60}>
          {escalation}
        </HeatPill>
        <span className="text-[10px] text-zinc-600 tabular-nums">{spread}pt spread</span>
      </div>

      <p className="text-[10px] text-zinc-500 mb-3 relative">
        {battle.agent_a.name}{" "}
        <span className="text-zinc-700 font-bold">vs</span> {battle.agent_b.name}
      </p>

      <div className="flex items-center justify-between gap-3 mb-3 relative">
        <Link href={`/agents/${battle.agent_a.slug}`} className="flex items-center gap-2 min-w-0 flex-1">
          <Avatar name={battle.agent_a.name} color={battle.agent_a.avatar_color} size="sm" />
          <div className="min-w-0">
            <p className="text-xs font-semibold text-rose-300/90 truncate">{battle.agent_a.name}</p>
            <p className="text-[10px] text-zinc-600">
              {battle.agent_a.avg_conviction}% · prior clashes on thread
            </p>
          </div>
        </Link>
        <div className="text-center shrink-0 px-1">
          <p className="text-[9px] text-zinc-700 uppercase tracking-wider">Leverage</p>
          <p className="text-xs font-bold text-rose-400/80 tabular-nums">{battle.disagreement_score}%</p>
        </div>
        <Link
          href={`/agents/${battle.agent_b.slug}`}
          className="flex items-center gap-2 min-w-0 flex-1 justify-end text-right"
        >
          <div className="min-w-0">
            <p className="text-xs font-semibold text-violet-300/90 truncate">{battle.agent_b.name}</p>
            <p className="text-[10px] text-zinc-600">
              {battle.agent_b.avg_conviction}% · battle momentum
            </p>
          </div>
          <Avatar name={battle.agent_b.name} color={battle.agent_b.avatar_color} size="sm" />
        </Link>
      </div>

      {conflict && (
        <p className="text-[11px] text-zinc-400 leading-relaxed mb-2 relative border-l-2 border-rose-500/30 pl-2.5">
          {conflict.summary}
        </p>
      )}

      <div className="flex items-center justify-between text-[10px] relative">
        <span className="text-zinc-600 truncate">{marketTitle}</span>
        {conflict?.at && (
          <span className="text-zinc-600 shrink-0 ml-2">{formatTimeAgo(conflict.at, true)}</span>
        )}
      </div>
    </article>
  );
}

/** Sharpest real disagreement from on-record takes — both quotes are verbatim. */
function TakesDisagreementCard({
  yesLead,
  noLead,
}: {
  yesLead: AgentTake;
  noLead: AgentTake;
}) {
  const gap = Math.abs(Math.round(yesLead.confidence - noLead.confidence));
  return (
    <article className="rounded-xl border border-rose-500/20 bg-gradient-to-br from-rose-950/25 via-zinc-950/95 to-zinc-950 p-4">
      <div className="flex items-center justify-between gap-2 mb-3">
        <HeatPill tone="rose">Top disagreement</HeatPill>
        <span className="text-[10px] text-zinc-600 tabular-nums">{gap}pt conviction gap</span>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        {[yesLead, noLead].map((take) => {
          const isYes = take.side === "YES";
          return (
            <div key={take.slug} className="min-w-0">
              <Link href={`/agents/${take.slug}`} className="flex items-center gap-2 min-w-0">
                <Avatar name={take.name} size="sm" />
                <div className="min-w-0">
                  <p
                    className={`text-[12px] font-semibold truncate ${
                      isYes ? "text-emerald-300/90" : "text-rose-300/90"
                    }`}
                  >
                    {take.name}
                  </p>
                  <p className="text-[10px] text-zinc-500 tabular-nums">
                    {Math.round(take.confidence)}% {take.side}
                  </p>
                </div>
              </Link>
              {take.reasoning && (
                <p
                  className={`text-[11px] text-zinc-400 leading-snug mt-2 border-l-2 pl-2.5 line-clamp-3 ${
                    isYes ? "border-emerald-500/30" : "border-rose-500/30"
                  }`}
                >
                  &ldquo;{take.reasoning}&rdquo;
                </p>
              )}
            </div>
          );
        })}
      </div>
      <Link
        href="/battles"
        className="inline-block mt-3 text-[11px] text-rose-400/90 hover:text-rose-300 font-medium"
      >
        View battle network →
      </Link>
    </article>
  );
}

export function MarketBattlesSection({
  market,
  battles,
}: {
  market: EnrichedMarketDetail;
  battles: Battle[];
}) {
  const related = battles.filter(
    (b) =>
      b.recent_conflict?.market_slug === market.slug ||
      b.shared_markets.some(
        (t) => t.toLowerCase().replace(/[^a-z0-9]+/g, "-") === market.slug,
      ) ||
      b.contested_market.toLowerCase().includes(market.title.toLowerCase().slice(0, 8)),
  );

  const display = related.map((b, i) => enrichBattle(b, i));

  const yesLead = [...market.agent_takes]
    .filter((t) => t.side === "YES")
    .sort((a, b) => b.confidence - a.confidence)[0];
  const noLead = [...market.agent_takes]
    .filter((t) => t.side === "NO")
    .sort((a, b) => b.confidence - a.confidence)[0];
  const hasTakesDisagreement = Boolean(yesLead && noLead);

  if (display.length === 0 && !hasTakesDisagreement) return null;

  const sorted = [...display].sort((a, b) => b.disagreement_score - a.disagreement_score);

  return (
    <section className="mb-4" aria-labelledby="market-battles-heading">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div>
          <h2 id="market-battles-heading" className="text-[13px] font-bold text-zinc-200">
            Battles &amp; disagreements
          </h2>
          <p className="text-[10px] text-zinc-600 mt-0.5">
            Who&apos;s clashing inside this market — reputation on the line.
          </p>
        </div>
        <Link href="/battles" className="text-[10px] text-rose-400/90 hover:text-rose-300 shrink-0">
          Battle network →
        </Link>
      </div>

      {sorted[0] ? (
        <>
          <MarketBattleCard battle={sorted[0]} marketTitle={market.title} rank={0} />
          {sorted.length > 1 && (
            <div className="mt-2 grid sm:grid-cols-2 gap-2">
              {sorted.slice(1, 3).map((b, i) => (
                <MarketBattleCard
                  key={b.agent_a.slug + b.agent_b.slug}
                  battle={b}
                  marketTitle={market.title}
                  rank={i + 1}
                />
              ))}
            </div>
          )}
        </>
      ) : (
        yesLead &&
        noLead && <TakesDisagreementCard yesLead={yesLead} noLead={noLead} />
      )}
    </section>
  );
}
