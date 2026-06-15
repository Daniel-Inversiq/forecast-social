"use client";

import { useCallback, useState } from "react";
import { useLogin, usePrivy, useWallets } from "@privy-io/react-auth";
import type { Address } from "viem";
import { useAuth } from "@/context/AuthProvider";
import { setStoredToken } from "@/lib/api";
import type { ScryChainKey } from "@/lib/wallet/chains";
import { DEFAULT_CHAIN_KEY } from "@/lib/wallet/chains";
import {
  detectChainFromProvider,
  verifyAndLinkWallet,
  verifyAndLoginWallet,
  verifyAndRegisterWallet,
} from "@/lib/wallet/service";
import { isWalletStackEnabled } from "@/context/WalletProvider";

export type WalletLinkState =
  | "idle"
  | "connecting"
  | "signing"
  | "linking"
  | "success"
  | "error";

export function useWalletActions() {
  const { user, refreshUser } = useAuth();
  const { ready, authenticated } = usePrivy();
  const { login } = useLogin();
  const { wallets } = useWallets();
  const [state, setState] = useState<WalletLinkState>("idle");
  const [error, setError] = useState<string | null>(null);

  const getActiveWallet = useCallback(async () => {
    const wallet = wallets[0];
    if (!wallet) return null;
    const provider = await wallet.getEthereumProvider();
    const chainId = (await provider.request({ method: "eth_chainId" })) as string;
    const chain = detectChainFromProvider(chainId) as ScryChainKey;
    return {
      address: wallet.address as Address,
      provider,
      chain,
    };
  }, [wallets]);

  const connectWallet = useCallback(async () => {
    if (!isWalletStackEnabled()) {
      throw new Error("Wallet stack not configured. Set NEXT_PUBLIC_PRIVY_APP_ID.");
    }
    setError(null);
    setState("connecting");
    await login();
    setState("idle");
  }, [login]);

  const linkToAccount = useCallback(async () => {
    if (!user) throw new Error("Sign in to link a wallet");
    setError(null);
    setState("signing");
    try {
      let active = await getActiveWallet();
      if (!active) {
        setState("connecting");
        await login();
        active = await getActiveWallet();
      }
      if (!active) throw new Error("No wallet connected");

      setState("linking");
      const updated = await verifyAndLinkWallet(
        active.provider,
        active.address,
        active.chain ?? DEFAULT_CHAIN_KEY,
      );
      await refreshUser();
      setState("success");
      return updated;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Wallet link failed";
      setError(message);
      setState("error");
      throw err;
    }
  }, [user, getActiveWallet, login, refreshUser]);

  const loginWithWallet = useCallback(async () => {
    setError(null);
    setState("signing");
    try {
      let active = await getActiveWallet();
      if (!active) {
        setState("connecting");
        await login();
        active = await getActiveWallet();
      }
      if (!active) throw new Error("No wallet connected");

      setState("linking");
      const auth = await verifyAndLoginWallet(
        active.provider,
        active.address,
        active.chain ?? DEFAULT_CHAIN_KEY,
      );
      setStoredToken(auth.access_token);
      await refreshUser();
      setState("success");
      return auth;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Wallet login failed";
      setError(message);
      setState("error");
      throw err;
    }
  }, [getActiveWallet, login, refreshUser]);

  const registerWithWallet = useCallback(
    async (username: string, email?: string) => {
      setError(null);
      setState("signing");
      try {
        let active = await getActiveWallet();
        if (!active) {
          setState("connecting");
          await login();
          active = await getActiveWallet();
        }
        if (!active) throw new Error("No wallet connected");

        setState("linking");
        const auth = await verifyAndRegisterWallet(
          active.provider,
          active.address,
          active.chain ?? DEFAULT_CHAIN_KEY,
          username,
          email,
        );
        setStoredToken(auth.access_token);
        await refreshUser();
        setState("success");
        return auth;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Wallet registration failed";
        setError(message);
        setState("error");
        throw err;
      }
    },
    [getActiveWallet, login, refreshUser],
  );

  const reset = useCallback(() => {
    setState("idle");
    setError(null);
  }, []);

  return {
    ready,
    authenticated,
    wallets,
    state,
    error,
    connectWallet,
    linkToAccount,
    loginWithWallet,
    registerWithWallet,
    reset,
    hasConnectedWallet: wallets.length > 0,
  };
}
