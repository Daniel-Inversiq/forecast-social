import { API_BASE, apiFetch } from "@/lib/api";
import type { AuthResponse, AuthUser } from "@/lib/auth";
import type { ScryChainKey } from "./chains";

export type WalletNonceResponse = {
  message: string;
  nonce: string;
  expires_in_seconds: number;
};

export type WalletVerifyPayload = {
  address: string;
  chain: ScryChainKey;
  message: string;
  signature: string;
  ens_name?: string | null;
};

export async function requestWalletNonce(
  address: string,
  chain: ScryChainKey,
): Promise<WalletNonceResponse> {
  const res = await fetch(`${API_BASE}/wallet/nonce`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address, chain }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.detail ?? "Failed to request verification nonce");
  }
  return (await res.json()) as WalletNonceResponse;
}

export async function linkWallet(payload: WalletVerifyPayload): Promise<AuthUser> {
  const res = await apiFetch("/wallet/link", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.detail ?? "Failed to link wallet");
  }
  return (await res.json()) as AuthUser;
}

export async function unlinkWallet(): Promise<AuthUser> {
  const res = await apiFetch("/wallet/unlink", { method: "POST" });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.detail ?? "Failed to unlink wallet");
  }
  return (await res.json()) as AuthUser;
}

export async function walletLogin(payload: WalletVerifyPayload): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE}/auth/wallet-login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.detail ?? "Wallet login failed");
  }
  return (await res.json()) as AuthResponse;
}

export async function walletRegister(
  payload: WalletVerifyPayload & { username: string; email?: string },
): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE}/auth/wallet-register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.detail ?? "Wallet registration failed");
  }
  return (await res.json()) as AuthResponse;
}

export async function fetchWalletChains(): Promise<
  { key: string; name: string; chain_id: number; usdc_enabled: boolean }[]
> {
  const res = await fetch(`${API_BASE}/wallet/chains`);
  if (!res.ok) return [];
  const data = (await res.json()) as { chains: { key: string; name: string; chain_id: number; usdc_enabled: boolean }[] };
  return data.chains;
}
