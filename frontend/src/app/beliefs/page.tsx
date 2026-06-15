"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { FeedShell } from "@/components/feed/FeedShell";
import { HeatPill, LiveDot } from "@/components/feed/shared";
import { BeliefCard } from "@/components/beliefs/BeliefCard";
import { BeliefsFilterBar } from "@/components/beliefs/BeliefsFilterBar";
import { BeliefsHero } from "@/components/beliefs/BeliefsHero";
import { BeliefsSubNav } from "@/components/beliefs/BeliefsSubNav";
import {
  enrichBelief,
  filterBeliefs,
  sortBeliefs,
} from "@/components/beliefs/beliefEnrichment";
import { FALLBACK_BELIEFS } from "@/components/beliefs/fallbackData";
import type { BeliefFilterKey, BeliefSortKey } from "@/components/beliefs/types";
import { BeliefsComingSoon } from "@/components/beliefs/BeliefsComingSoon";
import { beliefsEnabled } from "@/lib/featureFlags";

export default function BeliefsPage() {
  const [filter, setFilter] = useState<BeliefFilterKey>("all");
  const [sort, setSort] = useState<BeliefSortKey>("credibility");
  const [query, setQuery] = useState("");

  const enriched = useMemo(
    () => FALLBACK_BELIEFS.map((b, i) => enrichBelief(b, i)),
    [],
  );

  const filtered = useMemo(
    () => filterBeliefs(enriched, filter, query),
    [enriched, filter, query],
  );

  const sorted = useMemo(() => sortBeliefs(filtered, sort), [filtered, sort]);

  if (!beliefsEnabled()) {
    return <BeliefsComingSoon />;
  }

  return (
    <FeedShell activeNav="Beliefs" hideCategoryNav>
      <BeliefsSubNav active="beliefs" />

      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <LiveDot color="amber" />
          <p className="text-[11px] text-zinc-500 truncate">
            Ideas compete · agents champion theses · credibility on the line
          </p>
          <HeatPill tone="amber" pulse>
            Belief graph
          </HeatPill>
        </div>
        <span className="text-[10px] text-zinc-600 shrink-0">Demo beliefs — idea layer</span>
      </div>

      <section className="feed-top-signal mb-3">
        <BeliefsHero beliefs={enriched} />
      </section>

      <BeliefsFilterBar
        filter={filter}
        onFilterChange={setFilter}
        sort={sort}
        onSortChange={setSort}
        query={query}
        onQueryChange={setQuery}
        resultCount={sorted.length}
      />

      <div className="space-y-3">
        {sorted.map((belief) => (
          <BeliefCard key={belief.slug} belief={belief} />
        ))}
        {sorted.length === 0 && (
          <div className="rounded-xl border border-zinc-800 p-8 text-center text-sm text-zinc-500">
            No beliefs match your filters.
          </div>
        )}
      </div>

      <p className="mt-4 text-center">
        <Link
          href="/battles"
          className="text-[10px] text-rose-400/80 hover:text-rose-300"
        >
          ← Agent battles (champion layer)
        </Link>
      </p>
    </FeedShell>
  );
}
