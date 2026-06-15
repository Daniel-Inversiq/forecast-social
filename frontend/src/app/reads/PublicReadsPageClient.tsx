"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { FeedShell } from "@/components/feed/FeedShell";
import { HeatPill, LiveDot } from "@/components/feed/shared";
import { DISTRIBUTION_TAGLINE } from "@/lib/trust";
import { PublicReadCard } from "@/components/public-reads/PublicReadCard";
import { PublicReadsFilterBar } from "@/components/public-reads/PublicReadsFilterBar";
import { PublicReadsHero } from "@/components/public-reads/PublicReadsHero";
import { CreatePublicReadModal } from "@/components/public-reads/PublicReadModals";
import { BetaDisclosure } from "@/components/trust/BetaDisclosure";
import { filterPublicReads } from "@/components/public-reads/publicReadEnrichment";
import { usePublicReads } from "@/components/public-reads/PublicReadsProvider";
import type {
  PublicReadCategoryFilter,
  PublicReadConsensusFilter,
  PublicReadResolutionFilter,
  PublicReadTabKey,
  PublicReadTrustFilter,
} from "@/components/public-reads/types";

export function PublicReadsPageClient() {
  const searchParams = useSearchParams();
  const { reads } = usePublicReads();
  const [tab, setTab] = useState<PublicReadTabKey>("for_you");
  const [category, setCategory] = useState<PublicReadCategoryFilter>("all");
  const [trust, setTrust] = useState<PublicReadTrustFilter>("all");
  const [resolution, setResolution] = useState<PublicReadResolutionFilter>("all");
  const [consensus, setConsensus] = useState<PublicReadConsensusFilter>("all");
  const [query, setQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const agentSlug = searchParams.get("agent");

  useEffect(() => {
    if (searchParams.get("create") === "1") {
      setCreateOpen(true);
    }
  }, [searchParams]);

  const filtered = useMemo(
    () =>
      filterPublicReads(reads, {
        tab,
        category,
        trust,
        resolution,
        consensus,
        query,
      }),
    [reads, tab, category, trust, resolution, consensus, query],
  );

  return (
    <FeedShell activeNav="Reads" hideCategoryNav>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <LiveDot color="violet" />
          <p className="text-[11px] text-zinc-500 truncate">
            Public conviction · on-record forecasts · {DISTRIBUTION_TAGLINE}
          </p>
          <HeatPill tone="violet" pulse>
            Live
          </HeatPill>
        </div>
      </div>

      <PublicReadsHero reads={reads} onCreateClick={() => setCreateOpen(true)} />
      <BetaDisclosure tone="muted" className="mb-3" />

      <PublicReadsFilterBar
        tab={tab}
        onTabChange={setTab}
        category={category}
        onCategoryChange={setCategory}
        trust={trust}
        onTrustChange={setTrust}
        resolution={resolution}
        onResolutionChange={setResolution}
        consensus={consensus}
        onConsensusChange={setConsensus}
        query={query}
        onQueryChange={setQuery}
        resultCount={filtered.length}
      />

      {filtered.length === 0 ? (
        <div className="py-16 text-center border border-dashed border-zinc-800 rounded-xl">
          <p className="text-zinc-200 text-sm font-medium">No reads yet</p>
          <p className="text-zinc-500 text-[11px] mt-1 mb-3">
            Reads are where conviction gets priced in public before resolution. Publishing early builds
            reputation.
          </p>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="mt-3 text-sm text-violet-400 hover:text-violet-300"
          >
            Publish First Read →
          </button>
        </div>
      ) : (
        <div className="space-y-3 pb-8">
          {filtered.map((read) => (
            <PublicReadCard key={read.id} read={read} />
          ))}
        </div>
      )}

      <CreatePublicReadModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        defaultAuthor={
          agentSlug
            ? {
                authorId: `agent-${agentSlug}`,
                authorName: agentSlug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
                authorHandle: agentSlug.startsWith("agent-") ? agentSlug : `agent-${agentSlug}`,
              }
            : undefined
        }
      />
    </FeedShell>
  );
}
