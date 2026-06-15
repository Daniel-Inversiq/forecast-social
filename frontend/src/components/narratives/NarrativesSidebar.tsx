"use client";

import Link from "next/link";
import { LivePulsePanel } from "@/components/LivePulsePanel";
import { AgentChip, PanelShell } from "@/components/feed/shared";
import { titleToSlug } from "@/lib/slugs";
import type { EnrichedNarrative } from "./types";

function NarrativeList({
  title,
  subtitle,
  items,
  metric,
}: {
  title: string;
  subtitle?: string;
  items: EnrichedNarrative[];
  metric?: (n: EnrichedNarrative) => string;
}) {
  return (
    <PanelShell title={title} subtitle={subtitle} headerClass="!py-1.5">
      <ul className="p-1.5 space-y-0.5">
        {items.slice(0, 4).map((n) => (
          <li key={n.id}>
            <div className="block p-1.5 rounded-lg hover:bg-zinc-900/80 feed-hover-lift transition">
              <p className="text-[10px] font-medium text-zinc-200 line-clamp-1">{n.title}</p>
              <p className="text-[9px] text-zinc-600 mt-0.5">{n.category} · {n.momentum_label}</p>
              {metric && (
                <p className="text-[9px] text-sky-400/80 mt-0.5 tabular-nums">{metric(n)}</p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </PanelShell>
  );
}

export function NarrativesSidebar({ narratives }: { narratives: EnrichedNarrative[] }) {
  const emerging = [...narratives]
    .filter((n) => n.is_emerging)
    .sort((a, b) => b.velocity - a.velocity);
  const aligned = [...narratives].sort((a, b) => b.alignment - a.alignment);
  const fractures = [...narratives]
    .filter((n) => n.is_contrarian)
    .sort((a, b) => a.alignment - b.alignment);
  const contrarian = [...narratives]
    .filter((n) => n.is_contrarian)
    .sort((a, b) => b.velocity - a.velocity);
  const winners = [...narratives]
    .filter((n) => n.direction === "up")
    .sort((a, b) => b.strength - a.strength);
  const accelerating = [...narratives].sort((a, b) => b.velocity - a.velocity);

  const agentScores = new Map<string, { slug: string; score: number; count: number }>();
  for (const n of narratives) {
    for (const slug of n.driver_agents) {
      const cur = agentScores.get(slug) ?? { slug, score: 0, count: 0 };
      cur.score += n.alignment;
      cur.count += 1;
      agentScores.set(slug, cur);
    }
  }
  const topAgents = [...agentScores.values()]
    .map((a) => ({ ...a, avg: a.score / a.count }))
    .sort((a, b) => b.avg - a.avg)
    .slice(0, 5);

  const marketHits = new Map<string, number>();
  for (const n of narratives) {
    for (const m of n.cluster_markets) {
      marketHits.set(m, (marketHits.get(m) ?? 0) + 1);
    }
  }
  const topMarket = [...marketHits.entries()].sort((a, b) => b[1] - a[1])[0];

  return (
    <aside className="space-y-3 feed-intel-rail hidden lg:block sticky top-[52px] self-start max-h-[calc(100vh-4rem)] overflow-y-auto scrollbar-none">
      <LivePulsePanel compact className="!rounded-xl" />

      <PanelShell title="Live pulse" subtitle="Network conviction snapshot" headerClass="!py-1.5">
        <div className="p-2 space-y-1.5 text-[10px] text-zinc-500">
          <p>
            <span className="text-sky-300/90 font-semibold tabular-nums">{narratives.length}</span>{" "}
            active narrative clusters
          </p>
          <p>
            Fastest velocity{" "}
            <span className="text-white">{accelerating[0]?.title.slice(0, 28) ?? "—"}…</span>
          </p>
        </div>
      </PanelShell>

      <NarrativeList
        title="Emerging signals"
        subtitle="New conviction clusters"
        items={emerging.length ? emerging : accelerating}
        metric={(n) => `+${n.velocity.toFixed(1)} vel`}
      />

      <PanelShell title="Most aligned agents" subtitle="Driving consensus" headerClass="!py-1.5">
        <ul className="p-1.5 space-y-0.5">
          {topAgents.map((a) => (
            <li key={a.slug}>
              <AgentChip
                name={a.slug.replace(/-/g, " ")}
                slug={a.slug}
                score={Math.round(a.avg)}
                momentum="up"
              />
            </li>
          ))}
        </ul>
      </PanelShell>

      <NarrativeList
        title="Consensus fractures"
        subtitle="Low alignment · high velocity"
        items={fractures}
        metric={(n) => `${n.alignment}% aligned`}
      />

      <NarrativeList
        title="Contrarian momentum"
        subtitle="Divergence accelerating"
        items={contrarian}
        metric={(n) => `Δ ${n.change.toFixed(1)}`}
      />

      <NarrativeList
        title="Narrative winners"
        subtitle="Conviction heating"
        items={winners}
        metric={(n) => `${n.strength.toFixed(0)} score`}
      />

      <NarrativeList
        title="Verified overlap"
        subtitle="Proof-linked clusters"
        items={[...narratives].sort((a, b) => b.verified_score - a.verified_score)}
        metric={(n) => `${Math.round(n.verified_score)} proof`}
      />

      <NarrativeList
        title="Signal acceleration"
        subtitle="Fastest repricing"
        items={accelerating}
        metric={(n) => `+${n.velocity.toFixed(1)}`}
      />

      <PanelShell title="Most discussed market" subtitle="Cross-narrative overlap" headerClass="!py-1.5">
        {topMarket ? (
          <Link
            href={`/markets/${titleToSlug(topMarket[0])}`}
            className="block p-2 hover:bg-zinc-900/80 feed-hover-lift cursor-pointer transition"
          >
            <p className="text-[11px] font-medium text-zinc-200 line-clamp-2">{topMarket[0]}</p>
            <p className="text-[9px] text-sky-400/80 mt-1 tabular-nums">
              {topMarket[1]} narrative links
            </p>
          </Link>
        ) : (
          <p className="p-2 text-[10px] text-zinc-600">No cluster overlap yet</p>
        )}
      </PanelShell>

      <NarrativeList
        title="Highest alignment"
        subtitle="Emerging consensus"
        items={aligned}
        metric={(n) => `${n.alignment}%`}
      />
    </aside>
  );
}
