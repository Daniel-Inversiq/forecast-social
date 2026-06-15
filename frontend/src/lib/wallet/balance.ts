import type { ScryChainKey } from "./chains";

/** Placeholder balance model — future USDC conviction staking, not live yet. */
export type WalletBalanceSnapshot = {
  chain: ScryChainKey;
  /** Future: live USDC balance */
  usdcBalance: number | null;
  /** Future: staked conviction */
  stakedConviction: number | null;
  /** Future: available for staking */
  availableForStaking: number | null;
  status: "placeholder";
};

export function placeholderBalance(chain: ScryChainKey): WalletBalanceSnapshot {
  return {
    chain,
    usdcBalance: null,
    stakedConviction: null,
    availableForStaking: null,
    status: "placeholder",
  };
}
