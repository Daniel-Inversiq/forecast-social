import { base, polygon, type Chain } from "viem/chains";

export type ScryChainKey = "base" | "polygon";

export type ScryChainConfig = {
  key: ScryChainKey;
  name: string;
  chainId: number;
  viemChain: Chain;
  nativeSymbol: string;
  usdcAddress: string;
  /** Future: enable when USDC balances ship */
  usdcEnabled: boolean;
};

export const SCRY_CHAINS: Record<ScryChainKey, ScryChainConfig> = {
  base: {
    key: "base",
    name: "Base",
    chainId: base.id,
    viemChain: base,
    nativeSymbol: "ETH",
    usdcAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    usdcEnabled: false,
  },
  polygon: {
    key: "polygon",
    name: "Polygon",
    chainId: polygon.id,
    viemChain: polygon,
    nativeSymbol: "MATIC",
    usdcAddress: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
    usdcEnabled: false,
  },
};

export const SCRY_SUPPORTED_CHAINS = Object.values(SCRY_CHAINS).map((c) => c.viemChain);

export const DEFAULT_CHAIN_KEY: ScryChainKey = "base";

export function chainFromId(chainId: number): ScryChainKey | null {
  for (const chain of Object.values(SCRY_CHAINS)) {
    if (chain.chainId === chainId) return chain.key;
  }
  return null;
}

export function chainConfig(key: ScryChainKey): ScryChainConfig {
  return SCRY_CHAINS[key];
}
