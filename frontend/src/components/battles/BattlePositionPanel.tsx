"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Avatar } from "@/components/feed/shared";
import { useAuth } from "@/context/AuthProvider";
import { isWalletStackEnabled } from "@/context/WalletProvider";
import { useWalletActions } from "@/hooks/useWalletActions";
import { apiFetch } from "@/lib/api";
import { redirectToLogin } from "@/lib/authRedirect";
import { buildCredibilityFromBattleAgent } from "@/lib/credibilityScore";
import { hasVerifiedWallet, walletDisplayLabel } from "@/lib/wallet/identity";
import { BattleSupportingData } from "./BattleSupportingData";
import {
  battleBackPayoutPreview,
  battlePricesFromCrowd,
  formatPriceCents,
  formatUsd,
  formatUsdSigned,
  type BackedAgent,
} from "./battleTradeMath";
import { battleDetailPath } from "./battleWarfare";
import type { EnrichedBattle } from "./types";

const AMOUNT_PRESETS = [10, 25, 50, 100] as const;

type ConvictionBalancePayload = {
  available_balance: number;
  currency: string;
};

function ForecasterLine({
  agent,
  credibility,
  accuracy,
  priceCents,
  selected,
  onSelect,
}: {
  agent: EnrichedBattle["agent_a"];
  credibility: number;
  accuracy: number;
  priceCents: number;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full flex items-center gap-2.5 rounded-lg border px-2.5 py-2.5 text-left transition ${
        selected
          ? "border-rose-500/45 bg-rose-500/12 ring-1 ring-rose-500/25"
          : "border-zinc-800/80 bg-zinc-900/50 hover:border-rose-500/25"
      }`}
    >
      <Avatar name={agent.name} color={agent.avatar_color} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="text-[12px] font-semibold text-white truncate">Back {agent.name}</p>
        <p className="text-[10px] text-zinc-500 tabular-nums">
          {credibility} credibility · {accuracy}% accuracy
        </p>
      </div>
      <span className="text-[10px] font-semibold text-zinc-400 shrink-0 tabular-nums">
        {formatPriceCents(priceCents)}
      </span>
    </button>
  );
}

export function BattlePositionPanel({ battle }: { battle: EnrichedBattle }) {
  const router = useRouter();
  const { user } = useAuth();
  const { connectWallet, linkToAccount, hasConnectedWallet, state: walletState } =
    useWalletActions();

  const prices = useMemo(() => battlePricesFromCrowd(battle), [battle]);
  const credA = buildCredibilityFromBattleAgent(battle.agent_a).score;
  const credB = buildCredibilityFromBattleAgent(battle.agent_b).score;

  const defaultBacked: BackedAgent =
    battle.crowd_alignment.favored_slug === battle.agent_a.slug ? "a" : "b";

  const [backed, setBacked] = useState<BackedAgent>(defaultBacked);
  const [amountPreset, setAmountPreset] = useState<(typeof AMOUNT_PRESETS)[number]>(25);
  const [customAmount, setCustomAmount] = useState("");
  const [useCustom, setUseCustom] = useState(false);
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
    () => battleBackPayoutPreview(investAmount, backed, prices),
    [investAmount, backed, prices],
  );

  const backedAgent = backed === "a" ? battle.agent_a : battle.agent_b;
  const walletLinked = !!user && hasVerifiedWallet(user);
  const walletEnabled = isWalletStackEnabled();
  const returnPath = battleDetailPath(battle);

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

  const executeBack = useCallback(async () => {
    if (investAmount < 1) {
      setError("Enter a valid amount.");
      return;
    }

    if (!user) {
      redirectToLogin(router, returnPath);
      return;
    }

    if (!walletLinked) {
      setError("Connect and verify your wallet to back a forecaster.");
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
      const response = await apiFetch("/battles/positions", {
        method: "POST",
        body: JSON.stringify({
          battle_id: battle.id,
          backed_agent_slug: backedAgent.slug,
          amount: investAmount,
        }),
      });

      if (response.status === 401) {
        redirectToLogin(router, returnPath);
        return;
      }

      if (!response.ok) {
        const detail = await response.json().catch(() => null);
        const message =
          detail && typeof detail.detail === "string"
            ? detail.detail
            : "Position could not be placed. Try again.";
        throw new Error(message);
      }

      const data = await response.json();
      setSuccess(
        `Backing ${backedAgent.name} · ${formatUsd(data.amount ?? investAmount)} at ${formatPriceCents(preview.priceCents)}`,
      );
      const balRes = await apiFetch("/me/conviction-balance");
      if (balRes.ok) setBalance((await balRes.json()) as ConvictionBalancePayload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Position could not be placed.");
    } finally {
      setSubmitting(false);
    }
  }, [
    investAmount,
    user,
    walletLinked,
    balance?.available_balance,
    router,
    returnPath,
    battle.id,
    backedAgent.slug,
    backedAgent.name,
    preview.priceCents,
  ]);

  const busy = submitting || walletState === "connecting" || walletState === "signing";

  return (
    <section className="rounded-xl border border-rose-500/20 bg-gradient-to-b from-zinc-950 via-zinc-950 to-zinc-900/90 overflow-hidden shadow-[0_0_32px_rgba(244,63,94,0.06)]">
      <div className="p-3 border-b border-zinc-800/60">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="text-[11px] font-semibold text-zinc-100">Pick your side</h3>
            <p className="text-[10px] text-zinc-600 mt-0.5 leading-snug">
              Back who you think wins this battle
            </p>
          </div>
          {walletLinked && user && (
            <span className="text-[9px] text-zinc-500 tabular-nums shrink-0 max-w-[88px] truncate">
              {walletDisplayLabel(user)}
            </span>
          )}
        </div>
      </div>

      <div className="p-3 space-y-3">
        <div className="space-y-2">
          <ForecasterLine
            agent={battle.agent_a}
            credibility={credA}
            accuracy={battle.agent_a.accuracy_pct}
            priceCents={prices.agentACents}
            selected={backed === "a"}
            onSelect={() => setBacked("a")}
          />
          <ForecasterLine
            agent={battle.agent_b}
            credibility={credB}
            accuracy={battle.agent_b.accuracy_pct}
            priceCents={prices.agentBCents}
            selected={backed === "b"}
            onSelect={() => setBacked("b")}
          />
        </div>

        <p className="text-[9px] font-semibold uppercase tracking-wider text-zinc-500">Amount</p>
        <div className="flex flex-wrap gap-1">
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
          <div className="relative">
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
              className="w-full pl-6 pr-2 py-2 rounded-md bg-zinc-900 border border-zinc-700/80 text-[12px] text-zinc-100 tabular-nums placeholder:text-zinc-600 focus:outline-none focus:border-rose-500/40"
            />
          </div>
        )}

        {investAmount >= 1 && (
          <div className="rounded-lg border border-zinc-800/70 bg-zinc-900/40 px-2.5 py-2.5">
            <div className="flex justify-between text-[11px]">
              <dt className="text-zinc-600">Potential payout</dt>
              <dd className="text-zinc-100 font-semibold tabular-nums">{formatUsd(preview.payout)}</dd>
            </div>
            <div className="flex justify-between text-[11px] mt-1">
              <dt className="text-zinc-600">Potential profit</dt>
              <dd
                className={`font-semibold tabular-nums ${
                  preview.profit >= 0 ? "text-emerald-400" : "text-rose-400"
                }`}
              >
                {formatUsdSigned(preview.profit)}
              </dd>
            </div>
            <p className="text-[9px] text-zinc-600 mt-1.5 leading-relaxed">
              If {backedAgent.name} wins this battle on {battle.contested_market}. Payout excludes fees.
            </p>
          </div>
        )}

        {user && !walletLinked && walletEnabled && (
          <div className="rounded-md border border-violet-500/25 bg-violet-950/20 px-2 py-2">
            <p className="text-[10px] text-violet-200/90 leading-snug">
              {hasConnectedWallet
                ? "Verify wallet to back forecasters."
                : "Connect wallet to place battle positions."}
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
          <p className="text-[10px] text-zinc-600">
            <button
              type="button"
              onClick={() => redirectToLogin(router, returnPath)}
              className="text-violet-300 hover:text-violet-200"
            >
              Sign in
            </button>{" "}
            and connect wallet to back a forecaster.
          </p>
        )}

        {balance && walletLinked && (
          <p className="text-[9px] text-zinc-600 tabular-nums">
            Available {balance.available_balance.toFixed(2)} {balance.currency}
            {" · "}
            <Link href="/me/conviction" className="text-violet-400/90 hover:text-violet-300">
              Fund
            </Link>
          </p>
        )}

        <button
          type="button"
          disabled={busy || investAmount < 1}
          onClick={() => executeBack()}
          className="w-full py-3 rounded-lg text-[12px] font-bold bg-rose-600 text-white hover:bg-rose-500 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-[0_0_24px_rgba(244,63,94,0.18)]"
        >
          {submitting ? "Placing…" : `Back ${backedAgent.name}`}
        </button>

        {error && <p className="text-[10px] text-rose-400/90">{error}</p>}
        {success && <p className="text-[10px] text-emerald-400/90">{success}</p>}
      </div>

      <BattleSupportingData battle={battle} />
    </section>
  );
}
