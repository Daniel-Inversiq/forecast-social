import { createPublicClient, createWalletClient, custom, type Address } from "viem";
import { mainnet } from "viem/chains";
import type { ScryChainKey } from "./chains";
import { chainConfig, chainFromId } from "./chains";
import { placeholderBalance, type WalletBalanceSnapshot } from "./balance";
import {
  linkWallet,
  requestWalletNonce,
  unlinkWallet,
  walletLogin,
  walletRegister,
  type WalletVerifyPayload,
} from "./api";

export type ConnectedWallet = {
  address: Address;
  chain: ScryChainKey;
};

const ensClient = createPublicClient({
  chain: mainnet,
  transport: custom({
    request: async ({ method, params }) => {
      const res = await fetch("https://cloudflare-eth.com", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error.message);
      return json.result;
    },
  }),
});

export async function resolveEnsName(address: Address): Promise<string | null> {
  try {
    return await ensClient.getEnsName({ address });
  } catch {
    return null;
  }
}

export async function signVerificationMessage(
  provider: EIP1193Provider,
  address: Address,
  chain: ScryChainKey,
  message: string,
): Promise<string> {
  const client = createWalletClient({
    chain: chainConfig(chain).viemChain,
    transport: custom(provider),
  });
  return client.signMessage({ account: address, message });
}

export async function buildVerifiedPayload(
  provider: EIP1193Provider,
  address: Address,
  chain: ScryChainKey,
): Promise<WalletVerifyPayload> {
  const { message } = await requestWalletNonce(address, chain);
  const signature = await signVerificationMessage(provider, address, chain, message);
  const ens_name = await resolveEnsName(address);
  return { address, chain, message, signature, ens_name };
}

export async function verifyAndLinkWallet(
  provider: EIP1193Provider,
  address: Address,
  chain: ScryChainKey,
) {
  const payload = await buildVerifiedPayload(provider, address, chain);
  return linkWallet(payload);
}

export async function verifyAndLoginWallet(
  provider: EIP1193Provider,
  address: Address,
  chain: ScryChainKey,
) {
  const payload = await buildVerifiedPayload(provider, address, chain);
  return walletLogin(payload);
}

export async function verifyAndRegisterWallet(
  provider: EIP1193Provider,
  address: Address,
  chain: ScryChainKey,
  username: string,
  email?: string,
) {
  const payload = await buildVerifiedPayload(provider, address, chain);
  return walletRegister({ ...payload, username, email });
}

export function detectChainFromProvider(chainIdHex: string): ScryChainKey {
  const chainId = Number.parseInt(chainIdHex, 16);
  return chainFromId(chainId) ?? "base";
}

export function getBalancePlaceholder(chain: ScryChainKey): WalletBalanceSnapshot {
  return placeholderBalance(chain);
}

export { unlinkWallet };

type EIP1193Provider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};
