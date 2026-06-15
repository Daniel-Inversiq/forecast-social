"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthProvider";
import { isWalletStackEnabled } from "@/context/WalletProvider";
import { useWalletActions } from "@/hooks/useWalletActions";
import { apiFetch } from "@/lib/api";
import { redirectToLogin } from "@/lib/authRedirect";
import { hasVerifiedWallet, walletDisplayLabel } from "@/lib/wallet/identity";
import {
  formatPriceCents,
  formatUsd,
  formatUsdSigned,
  marketPricesFromProbability,
  tradePayoutPreview,
  type TradeSide,
} from "./marketTradeMath";
import type { EnrichedMarketDetail } from "./types";

const AMOUNT_PRESETS = [10, 25, 50, 100] as const;

type ConvictionBalancePayload = {
  available_balance: number;
  currency: string;
};

export function MarketTradePanel({
  market,
  compactTop = false,
}: {
  market: EnrichedMarketDetail;
  compactTop?: boolean;
}) {
  const router = useRouter();
  const { user } = useAuth();
  const { connectWallet, linkToAccount, hasConnectedWallet, state: walletState } =
    useWalletActions();

  const prob = Math.round(market.current_yes_probability);
  const prices = useMemo(() => marketPricesFromProbability(prob), [prob]);

  const [amountPreset, setAmountPreset] = useState<(typeof AMOUNT_PRESETS)[number]>(25);
  const [customAmount, setCustomAmount] = useState("");
  const [useCustom, setUseCustom] = useState(false);
  const [tradeSide, setTradeSide] = useState<TradeSide>(prob >= 50 ? "YES" : "NO");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [balance, setBalance] = useState<ConvictionBalancePayload | null>(null);

  const investAmount = useMemo(() => {
    if (useCustom && customAmount.trim() !== "") {
      const n = Number(customAmount);
      if (!Number.isFinite(n) || n < 1) return 0;
      return Math.min(10_000, Math.round(n * 100) / 100);
    }
    return amountPreset;
  }, [useCustom, customAmount, amountPreset]);

  const preview = useMemo(
    () => tradePayoutPreview(investAmount, tradeSide, prices),
    [investAmount, tradeSide, prices],
  );

  const walletLinked = !!user && hasVerifiedWallet(user);
  const walletEnabled = isWalletStackEnabled();

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch("/me/conviction-balance");
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as ConvictionBalancePayload;
        if (!cancelled) setBalance(data);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const executeTrade = useCallback(
    async (side: TradeSide) => {
      setTradeSide(side);
      if (investAmount < 1) {
        setError("Enter a valid amount.");
        return;
      }

      if (!user) {
        redirectToLogin(router, `/markets/${market.slug}`);
        return;
      }

      if (!walletLinked) {
        setError("Connect and verify your wallet to trade.");
        return;
      }

      const available = balance?.available_balance ?? 0;
      if (available < investAmount) {
        setError("Insufficient balance. Fund your account to trade.");
        return;
      }

      setSubmitting(true);
      setError(null);
      setSuccess(null);

      try {
        const response = await apiFetch("/positions", {
          method: "POST",
          body: JSON.stringify({
            market_slug: market.slug,
            side,
            amount: investAmount,
          }),
        });

        if (response.status === 401) {
          redirectToLogin(router, `/markets/${market.slug}`);
          return;
        }

        if (!response.ok) {
          const detail = await response.json().catch(() => null);
          const message =
            detail && typeof detail.detail === "string"
              ? detail.detail
              : "Trade could not be placed. Try again.";
          throw new Error(message);
        }

        const data = await response.json();
        setSuccess(
          `Bought ${side} · ${formatUsd(data.amount ?? investAmount)} filled at ${formatPriceCents(side === "YES" ? prices.yesCents : prices.noCents)}`,
        );
        const balRes = await apiFetch("/me/conviction-balance");
        if (balRes.ok) setBalance((await balRes.json()) as ConvictionBalancePayload);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Trade could not be placed.");
      } finally {
        setSubmitting(false);
      }
    },
    [
      investAmount,
      user,
      walletLinked,
      balance?.available_balance,
      router,
      market.slug,
      prices.yesCents,
      prices.noCents,
    ],
  );

  const busy = submitting || walletState === "connecting" || walletState === "signing";

  return (
    <section
      className={`bg-gradient-to-b from-zinc-950 via-zinc-950 to-zinc-900/80 ${
        compactTop ? "p-2.5 pt-2" : "p-3"
      }`}
    >
      <div className={`flex items-start justify-between gap-2 ${compactTop ? "mb-2" : "mb-3"}`}>
        <div>
          <h3 className="text-[11px] font-semibold text-zinc-100">Trade</h3>
          {!compactTop && (
            <p className="text-[10px] text-zinc-600 mt-0.5">Real-money market · wallet required</p>
          )}
        </div>
        {walletLinked && user && (
          <span className="text-[9px] text-zinc-500 tabular-nums shrink-0 max-w-[88px] truncate">
            {walletDisplayLabel(user)}
          </span>
        )}
      </div>

      {/* Live prices */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <button
          type="button"
          onClick={() => setTradeSide("YES")}
          className={`rounded-lg border px-2.5 py-2 text-left transition ${
            tradeSide === "YES"
              ? "border-emerald-500/50 bg-emerald-500/15 ring-1 ring-emerald-500/25"
              : "border-zinc-800/80 bg-zinc-900/50 hover:border-emerald-500/30"
          }`}
        >
          <p className="text-[9px] uppercase tracking-wider text-emerald-500/80">YES price</p>
          <p className="text-lg font-bold text-emerald-300 tabular-nums leading-tight">
            {formatPriceCents(prices.yesCents)}
          </p>
        </button>
        <button
          type="button"
          onClick={() => setTradeSide("NO")}
          className={`rounded-lg border px-2.5 py-2 text-left transition ${
            tradeSide === "NO"
              ? "border-rose-500/50 bg-rose-500/15 ring-1 ring-rose-500/25"
              : "border-zinc-800/80 bg-zinc-900/50 hover:border-rose-500/30"
          }`}
        >
          <p className="text-[9px] uppercase tracking-wider text-rose-500/80">NO price</p>
          <p className="text-lg font-bold text-rose-300 tabular-nums leading-tight">
            {formatPriceCents(prices.noCents)}
          </p>
        </button>
      </div>

      {/* Amount */}
      <p className="text-[9px] font-semibold uppercase tracking-wider text-zinc-500 mb-1.5">
        Amount
      </p>
      <div className="flex flex-wrap gap-1 mb-2">
        {AMOUNT_PRESETS.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => {
              setUseCustom(false);
              setAmountPreset(n);
            }}
            className={`flex-1 min-w-[3.5rem] py-2 rounded-md text-[11px] font-semibold tabular-nums transition ${
              !useCustom && amountPreset === n
                ? "bg-zinc-100 text-zinc-900"
                : "bg-zinc-900/90 text-zinc-400 border border-zinc-800/80 hover:text-zinc-200"
            }`}
          >
            ${n}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setUseCustom(true)}
          className={`flex-1 min-w-[3.5rem] py-2 rounded-md text-[11px] font-semibold transition ${
            useCustom
              ? "bg-zinc-100 text-zinc-900"
              : "bg-zinc-900/90 text-zinc-400 border border-zinc-800/80 hover:text-zinc-200"
          }`}
        >
          Custom
        </button>
      </div>
      {useCustom && (
        <div className="relative mb-3">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[11px] text-zinc-500">
            $
          </span>
          <input
            type="number"
            min={1}
            max={10000}
            step={1}
            value={customAmount}
            onChange={(e) => setCustomAmount(e.target.value)}
            placeholder="Amount"
            className="w-full pl-6 pr-2 py-2 rounded-md bg-zinc-900 border border-zinc-700/80 text-[12px] text-zinc-100 tabular-nums placeholder:text-zinc-600 focus:outline-none focus:border-violet-500/40"
          />
        </div>
      )}

      {/* Payout preview */}
      {investAmount >= 1 && (
        <div className="rounded-lg border border-zinc-800/70 bg-zinc-900/40 px-2.5 py-2.5 mb-3">
          <p className="text-[10px] text-zinc-500 leading-snug">
            Invest {formatUsd(investAmount)} at {tradeSide}{" "}
            <span className="text-zinc-300 tabular-nums">{formatPriceCents(preview.priceCents)}</span>
          </p>
          <dl className="mt-2 space-y-1">
            <div className="flex justify-between text-[11px]">
              <dt className="text-zinc-600">Potential payout</dt>
              <dd className="text-zinc-100 font-semibold tabular-nums">{formatUsd(preview.payout)}</dd>
            </div>
            <div className="flex justify-between text-[11px]">
              <dt className="text-zinc-600">Potential profit</dt>
              <dd
                className={`font-semibold tabular-nums ${
                  preview.profit >= 0 ? "text-emerald-400" : "text-rose-400"
                }`}
              >
                {formatUsdSigned(preview.profit)}
              </dd>
            </div>
          </dl>
          <p className="text-[9px] text-zinc-600 mt-1.5 leading-relaxed">
            If {tradeSide} resolves correct. Payout excludes fees.
          </p>
        </div>
      )}

      {/* Wallet gate */}
      {user && !walletLinked && walletEnabled && (
        <div className="mb-2 rounded-md border border-violet-500/25 bg-violet-950/20 px-2 py-2">
          <p className="text-[10px] text-violet-200/90 leading-snug">
            {hasConnectedWallet
              ? "Verify wallet to enable trading."
              : "Connect wallet to trade on this market."}
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              hasConnectedWallet
                ? linkToAccount().catch(() => {})
                : connectWallet().catch(() => {})
            }
            className="mt-1.5 text-[10px] font-medium text-violet-300 hover:text-violet-200"
          >
            {hasConnectedWallet ? "Verify wallet →" : "Connect wallet →"}
          </button>
        </div>
      )}

      {!user && (
        <p className="text-[10px] text-zinc-600 mb-2">
          <button
            type="button"
            onClick={() => redirectToLogin(router, `/markets/${market.slug}`)}
            className="text-violet-300 hover:text-violet-200"
          >
            Sign in
          </button>
          {" "}
          and connect wallet to trade.
        </p>
      )}

      {balance && walletLinked && (
        <p className="text-[9px] text-zinc-600 mb-2 tabular-nums">
          Available {balance.available_balance.toFixed(2)} {balance.currency}
          {" · "}
          <Link href="/me/conviction" className="text-violet-400/90 hover:text-violet-300">
            Fund
          </Link>
        </p>
      )}

      {/* CTAs */}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={busy || investAmount < 1}
          onClick={() => executeTrade("YES")}
          className="py-3 rounded-lg text-[12px] font-bold bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-[0_0_20px_rgba(16,185,129,0.15)]"
        >
          {submitting && tradeSide === "YES" ? "Buying…" : "Buy YES"}
        </button>
        <button
          type="button"
          disabled={busy || investAmount < 1}
          onClick={() => executeTrade("NO")}
          className="py-3 rounded-lg text-[12px] font-bold bg-rose-600 text-white hover:bg-rose-500 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-[0_0_20px_rgba(244,63,94,0.12)]"
        >
          {submitting && tradeSide === "NO" ? "Buying…" : "Buy NO"}
        </button>
      </div>

      {error && <p className="text-[10px] text-rose-400/90 mt-2">{error}</p>}
      {success && <p className="text-[10px] text-emerald-400/90 mt-2">{success}</p>}
    </section>
  );
}
