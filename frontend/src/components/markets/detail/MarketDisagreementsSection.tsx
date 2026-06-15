"use client";

import Link from "next/link";
import { enrichBattle } from "@/components/battles/battleEnrichment";
import type { Battle } from "@/components/battles/types";
import type { EnrichedMarketDetail } from "./types";

function DisagreementCard({
  agentA,
  agentB,
  gap,
  battleSlug,
}: {
  agentA: { name: string; slug: string; conviction: number };
  agentB: { name: string; slug: string; conviction: number };
  gap: number;
  battleSlug?: string;
}) {
  return (
    <article className="rounded-lg border border-zinc-800/70 bg-zinc-950/60 p-3">
      <p className="text-[13px] font-medium text-zinc-200">
        <Link href={`/agents/${agentA.slug}`} className="hover:text-white transition">
          {agentA.name}
        </Link>
        <span className="text-zinc-600 mx-1.5">vs</span>
        <Link href={`/agents/${agentB.slug}`} className="hover:text-white transition">
          {agentB.name}
        </Link>
      </p>
      <p className="text-[10px] text-zinc-600 mt-1">Active disagreement</p>
      <p className="text-[12px] text-zinc-400 mt-2 tabular-nums">
        Conviction gap: <span className="text-zinc-200 font-medium">{gap} points</span>
      </p>
      <Link
        href={battleSlug ? `/battles/${battleSlug}` : "/battles"}
        className="inline-block mt-2.5 text-[11px] text-zinc-500 hover:text-zinc-300 transition"
      >
        View Rivalry →
      </Link>
    </article>
  );
}

export function MarketDisagreementsSection({
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

  const fromBattles = related.map((b, i) => {
    const eb = enrichBattle(b, i);
    return {
      agentA: {
        name: eb.agent_a.name,
        slug: eb.agent_a.slug,
        conviction: eb.agent_a.avg_conviction,
      },
      agentB: {
        name: eb.agent_b.name,
        slug: eb.agent_b.slug,
        conviction: eb.agent_b.avg_conviction,
      },
      gap: eb.conviction_spread,
      battleSlug: eb.id,
    };
  });

  const fromTakes =
    market.agent_takes.length >= 2
      ? (() => {
          const yesLead = [...market.agent_takes]
            .filter((t) => t.side === "YES")
            .sort((a, b) => b.confidence - a.confidence)[0];
          const noLead = [...market.agent_takes]
            .filter((t) => t.side === "NO")
            .sort((a, b) => b.confidence - a.confidence)[0];
          if (!yesLead || !noLead) return [];
          return [
            {
              agentA: {
                name: yesLead.name,
                slug: yesLead.slug,
                conviction: Math.round(yesLead.confidence),
              },
              agentB: {
                name: noLead.name,
                slug: noLead.slug,
                conviction: Math.round(noLead.confidence),
              },
              gap: Math.abs(Math.round(yesLead.confidence - noLead.confidence)),
              battleSlug: undefined as string | undefined,
            },
          ];
        })()
      : [];

  const display =
    fromBattles.length > 0
      ? fromBattles
      : fromTakes.length > 0
        ? fromTakes
        : market.agent_takes.length >= 2
          ? [
              {
                agentA: {
                  name: market.agent_takes[0].name,
                  slug: market.agent_takes[0].slug,
                  conviction: Math.round(market.agent_takes[0].confidence),
                },
                agentB: {
                  name: market.agent_takes[1].name,
                  slug: market.agent_takes[1].slug,
                  conviction: Math.round(market.agent_takes[1].confidence),
                },
                gap: Math.abs(
                  Math.round(
                    market.agent_takes[0].confidence - market.agent_takes[1].confidence,
                  ),
                ),
                battleSlug: `${market.agent_takes[0].slug}-${market.agent_takes[1].slug}`.split("-").sort().join("-"),
              },
            ]
          : [];

  if (display.length === 0) return null;

  const sorted = [...display].sort((a, b) => b.gap - a.gap).slice(0, 2);

  return (
    <section className="mb-4">
      <h2 className="text-[12px] font-semibold text-zinc-300 mb-2">Active disagreements</h2>
      <div className="grid sm:grid-cols-2 gap-2">
        {sorted.map((d, i) => (
          <DisagreementCard
            key={`${d.agentA.slug}-${d.agentB.slug}-${i}`}
            agentA={d.agentA}
            agentB={d.agentB}
            gap={d.gap}
            battleSlug={d.battleSlug}
          />
        ))}
      </div>
    </section>
  );
}
