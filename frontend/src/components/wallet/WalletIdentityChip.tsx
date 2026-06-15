"use client";

import type { WalletIdentityFields } from "@/lib/wallet/identity";
import {
  hasVerifiedWallet,
  walletDisplayLabel,
  walletSecondaryLabel,
} from "@/lib/wallet/identity";
import type { ScryChainKey } from "@/lib/wallet/chains";
import { ChainIndicator } from "./ChainIndicator";
import { VerifiedWalletBadge } from "./VerifiedWalletBadge";

export function WalletIdentityChip({
  identity,
  showVerified = true,
  showChain = true,
  compact = false,
}: {
  identity: WalletIdentityFields;
  showVerified?: boolean;
  showChain?: boolean;
  compact?: boolean;
}) {
  if (!hasVerifiedWallet(identity)) return null;

  const label = walletDisplayLabel(identity);
  const secondary = walletSecondaryLabel(identity);
  const chain = identity.wallet_chain as ScryChainKey | undefined;

  return (
    <span className={`inline-flex flex-wrap items-center gap-1.5 ${compact ? "" : "mt-1"}`}>
      {label && (
        <span
          className={`inline-flex items-center gap-1 rounded-full border border-zinc-700/50 bg-zinc-900/60 font-mono text-zinc-300 ${
            compact ? "px-1.5 py-0.5 text-[8px]" : "px-2 py-0.5 text-[9px]"
          }`}
        >
          {label}
        </span>
      )}
      {showVerified && <VerifiedWalletBadge compact={compact} />}
      {showChain && chain && <ChainIndicator chain={chain} compact={compact} />}
      {!compact && secondary && !identity.ens_name && (
        <span className="text-[9px] text-zinc-600">{secondary}</span>
      )}
    </span>
  );
}

export function WalletLinkedConvictionBadge({ compact = false }: { compact?: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border border-violet-500/20 bg-violet-500/8 text-violet-200/90 ${
        compact ? "px-1.5 py-0.5 text-[8px]" : "px-2 py-0.5 text-[9px]"
      }`}
    >
      Wallet-linked conviction
    </span>
  );
}
