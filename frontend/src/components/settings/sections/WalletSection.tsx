"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthProvider";
import { isWalletStackEnabled } from "@/context/WalletProvider";
import { useWalletActions } from "@/hooks/useWalletActions";
import { unlinkWallet } from "@/lib/wallet/api";
import { getBalancePlaceholder } from "@/lib/wallet/service";
import type { ScryChainKey } from "@/lib/wallet/chains";
import { ChainIndicator } from "@/components/wallet/ChainIndicator";
import { VerifiedWalletBadge } from "@/components/wallet/VerifiedWalletBadge";
import { WalletIdentityChip, WalletLinkedConvictionBadge } from "@/components/wallet/WalletIdentityChip";
import { SettingsDivider, SettingsPanel } from "../ui";
import { hasVerifiedWallet, walletDisplayLabel } from "@/lib/wallet/identity";
import { apiFetch } from "@/lib/api";

type ConvictionBalancePayload = {
  available_balance: number;
  locked_balance: number;
  total_exposure: number;
  global_exposure_cap: number;
  remaining_exposure: number;
  currency: string;
  wallet_address: string | null;
  has_verified_wallet: boolean;
};

function WalletLinkControls() {
  const { user, refreshUser } = useAuth();
  const { state, error, linkToAccount, connectWallet, reset, hasConnectedWallet } =
    useWalletActions();
  const [unlinking, setUnlinking] = useState(false);
  const [unlinkError, setUnlinkError] = useState<string | null>(null);

  const busy = state === "connecting" || state === "signing" || state === "linking" || unlinking;
  const verified = user && hasVerifiedWallet(user);
  const chain = user?.wallet_chain as ScryChainKey | undefined;
  const balance = chain ? getBalancePlaceholder(chain) : null;
  const [convictionBalance, setConvictionBalance] = useState<ConvictionBalancePayload | null>(null);
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    async function loadConvictionBalance() {
      try {
        const response = await apiFetch("/me/conviction-balance");
        if (!response.ok || cancelled) return;
        const data = (await response.json()) as ConvictionBalancePayload;
        if (!cancelled) setConvictionBalance(data);
      } catch {
        /* ignore */
      }
    }
    loadConvictionBalance();
    return () => {
      cancelled = true;
    };
  }, [user]);


  async function handleUnlink() {
    setUnlinkError(null);
    setUnlinking(true);
    try {
      await unlinkWallet();
      await refreshUser();
    } catch (err) {
      setUnlinkError(err instanceof Error ? err.message : "Failed to unlink");
    } finally {
      setUnlinking(false);
    }
  }

  return (
    <div className="space-y-5">
      <SettingsPanel
        title="Wallet identity"
        description="Link a verified wallet to anchor your forecasting identity on-chain. No funds are moved in this phase."
      >
        {verified && user ? (
          <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/50 p-4 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <WalletIdentityChip identity={user} />
              <WalletLinkedConvictionBadge />
            </div>
            <p className="text-[11px] text-zinc-500 font-mono">
              {walletDisplayLabel(user) ?? user.wallet_address}
            </p>
            {chain && <ChainIndicator chain={chain} />}
            <p className="text-[10px] text-zinc-600">
              Connected{" "}
              {user.wallet_connected_at
                ? new Date(user.wallet_connected_at).toLocaleDateString()
                : "recently"}
            </p>
            <SettingsDivider />
            <button
              type="button"
              disabled={busy}
              onClick={handleUnlink}
              className="text-[11px] px-3 py-1.5 rounded-lg border border-zinc-700 text-zinc-400 hover:text-rose-300 hover:border-rose-500/30 transition disabled:opacity-50"
            >
              {unlinking ? "Unlinking…" : "Unlink wallet"}
            </button>
            {unlinkError && <p className="text-[11px] text-rose-400">{unlinkError}</p>}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-950/30 p-4 space-y-3">
            <p className="text-[12px] text-zinc-400 leading-relaxed">
              Connect MetaMask, Coinbase Wallet, Rainbow, or WalletConnect on Base or Polygon.
              Your wallet is verified with a signed message — Scry never trusts unverified addresses.
            </p>
            <div className="flex flex-wrap gap-2">
              {!hasConnectedWallet && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => connectWallet().catch(() => {})}
                  className="text-[11px] font-medium px-3 py-2 rounded-lg bg-violet-600/90 text-white hover:bg-violet-500 transition disabled:opacity-50"
                >
                  {state === "connecting" ? "Opening wallet…" : "Connect wallet"}
                </button>
              )}
              <button
                type="button"
                disabled={busy}
                onClick={() => linkToAccount().catch(() => {})}
                className="text-[11px] font-medium px-3 py-2 rounded-lg border border-violet-500/35 text-violet-200 hover:bg-violet-500/10 transition disabled:opacity-50"
              >
                {state === "signing" || state === "linking"
                  ? "Verifying signature…"
                  : "Verify & link wallet"}
              </button>
            </div>
            {state === "success" && (
              <p className="text-[11px] text-emerald-400">Wallet linked successfully.</p>
            )}
            {error && (
              <p className="text-[11px] text-rose-400">
                {error}{" "}
                <button type="button" onClick={reset} className="underline hover:text-rose-300">
                  Dismiss
                </button>
              </p>
            )}
          </div>
        )}
      </SettingsPanel>

      <SettingsPanel
        title="Conviction Capital"
        description="USDC-backed public exposure for your forecasting identity."
      >
        <div className="rounded-xl border border-zinc-800/60 bg-zinc-950/40 p-4">
          <div className="flex items-center gap-2 mb-2">
            <VerifiedWalletBadge compact />
            <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Live</span>
          </div>
          {convictionBalance ? (
            <div className="grid grid-cols-3 gap-3">
              <BalanceCell
                label="Available"
                value={`${convictionBalance.available_balance.toFixed(2)} ${convictionBalance.currency}`}
                hint="Ready for conviction allocation"
              />
              <BalanceCell
                label="Locked exposure"
                value={`${convictionBalance.locked_balance.toFixed(2)} ${convictionBalance.currency}`}
                hint="Committed to open positions"
              />
              <BalanceCell
                label="Remaining cap"
                value={`${convictionBalance.remaining_exposure.toFixed(2)} ${convictionBalance.currency}`}
                hint={`${convictionBalance.total_exposure.toFixed(2)} / ${convictionBalance.global_exposure_cap.toFixed(2)} used`}
              />
            </div>
          ) : (
            <p className="text-[11px] text-zinc-500">
              {balance
                ? "Loading Conviction Capital balance..."
                : "Link a wallet to activate Conviction Capital staking."}
            </p>
          )}
          <div className="mt-3">
            <Link
              href="/me/conviction"
              className="inline-flex text-[11px] font-medium text-violet-300 px-3 py-1.5 rounded-lg border border-violet-500/30 hover:bg-violet-500/10 transition"
            >
              Manage Conviction Capital →
            </Link>
          </div>
        </div>
      </SettingsPanel>
    </div>
  );
}

function BalanceCell({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="text-center px-2 py-2 rounded-lg border border-zinc-800/50 bg-zinc-900/30">
      <p className="text-[8px] uppercase tracking-wider text-zinc-600 mb-0.5">{label}</p>
      <p className="text-sm font-semibold text-zinc-500 tabular-nums">{value}</p>
      <p className="text-[8px] text-zinc-700 mt-0.5">{hint}</p>
    </div>
  );
}

export function WalletSection() {
  if (!isWalletStackEnabled()) {
    return (
      <SettingsPanel
        title="Wallet"
        description="Crypto-native identity for Scry forecasters."
      >
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
          <p className="text-[12px] text-amber-200/90 leading-relaxed">
            Wallet connectivity requires a Privy app ID. Add{" "}
            <code className="text-[10px] bg-zinc-900 px-1 py-0.5 rounded">NEXT_PUBLIC_PRIVY_APP_ID</code>{" "}
            to your environment to enable Base and Polygon wallet linking.
          </p>
        </div>
      </SettingsPanel>
    );
  }

  return <WalletLinkControls />;
}
