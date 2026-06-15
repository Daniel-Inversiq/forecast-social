"use client";

import type { ScryChainKey } from "@/lib/wallet/chains";
import { chainConfig } from "@/lib/wallet/chains";

const CHAIN_DOT: Record<ScryChainKey, string> = {
  base: "bg-blue-400",
  polygon: "bg-violet-400",
};

export function ChainIndicator({
  chain,
  compact = false,
}: {
  chain: ScryChainKey;
  compact?: boolean;
}) {
  const config = chainConfig(chain);
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border border-zinc-700/60 bg-zinc-900/70 text-zinc-400 ${
        compact ? "px-1.5 py-0.5 text-[8px]" : "px-2 py-0.5 text-[9px]"
      }`}
      title={`Verified on ${config.name}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${CHAIN_DOT[chain]}`} aria-hidden />
      {config.name}
    </span>
  );
}
