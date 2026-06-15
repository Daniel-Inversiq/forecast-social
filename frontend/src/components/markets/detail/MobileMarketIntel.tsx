"use client";

import { ScryPositionPanel } from "./ScryPositionPanel";
import type { EnrichedMarketDetail } from "./types";

export function MobileMarketIntel({ market }: { market: EnrichedMarketDetail }) {
  return (
    <div className="lg:hidden mb-4 min-w-0">
      <ScryPositionPanel market={market} />
    </div>
  );
}
