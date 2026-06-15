"use client";

import { MarketThreadPanel } from "./MarketThreadPanel";
import type { EnrichedMarketDetail } from "./types";

export function MarketDiscussionSection({
  market,
  offline,
}: {
  market: EnrichedMarketDetail;
  offline?: boolean;
}) {
  return (
    <section className="mb-4" aria-labelledby="market-discussion-heading">
      <div className="mb-2">
        <h2 id="market-discussion-heading" className="text-[12px] font-semibold text-zinc-300">
          Discussion
        </h2>
        <p className="text-[10px] text-zinc-600 mt-0.5">Public reads and counter-theses on this market.</p>
      </div>
      <MarketThreadPanel market={market} marketSlug={market.slug} offline={offline} />
    </section>
  );
}
