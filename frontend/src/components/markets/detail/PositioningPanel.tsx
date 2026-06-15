"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { HeatPill, LiveDot, MiniProbBar } from "@/components/feed/shared";
import { useAuth } from "@/context/AuthProvider";
import { apiFetch } from "@/lib/api";
import { redirectToLogin } from "@/lib/authRedirect";
import { isMarketResolved } from "@/lib/resolution";
import { hasVerifiedWallet } from "@/lib/wallet/identity";
import type { CredibilitySplit, EnrichedMarketDetail } from "./types";

const AMOUNTS = [5, 10, 25] as const;
type ConvictionBalancePayload = {
  available_balance: number;
  locked_balance: number;
  total_exposure: number;
  global_exposure_cap: number;
  remaining_exposure: number;
  currency: string;
};

export function PositioningPanel({
  market,
}: {
  market: EnrichedMarketDetail;
}) {
  const router = useRouter();
  const { user } = useAuth();
  const [side, setSide] = useState<"YES" | "NO">("YES");
  const [amount, setAmount] = useState<number>(5);
  const [custom, setCustom] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [confirmedSide, setConfirmedSide] = useState<"YES" | "NO">("YES");
  const [confirmedAmount, setConfirmedAmount] = useState(5);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingPosition, setLoadingPosition] = useState(false);
  const [yourExposure, setYourExposure] = useState(0);
  const [globalExposure, setGlobalExposure] = useState(0);
  const [glowConfirm, setGlowConfirm] = useState(false);
  const [convictionBalance, setConvictionBalance] = useState<ConvictionBalancePayload | null>(null);

  const resolved = isMarketResolved(market);
  const prob = Math.round(market.current_yes_probability);
  const consensusSide = prob >= 50 ? "YES" : "NO";
  const isContrarian = side !== consensusSide;
  const credibility: CredibilitySplit = market.credibility;
  const alignedTakes = market.agent_takes.filter((t) => t.side === side);
  const highRepAligned = alignedTakes.filter((t) => (t.reputation_score ?? 0) >= 58).length;
  const alignedAgents = alignedTakes.length;

  const yesBloc = market.faction_blocs.find((b) => b.side === "YES");
  const noBloc = market.faction_blocs.find((b) => b.side === "NO");
  const alignedBloc = side === "YES" ? yesBloc : noBloc;
  const opposingBloc = side === "YES" ? noBloc : yesBloc;

  const alignmentPreview = useMemo(() => {
    if (isContrarian) {
      const momentum = opposingBloc?.momentum;
      const extra =
        momentum === "surging"
          ? "Rising consensus could isolate you if repricing continues."
          : momentum === "weakening"
            ? "Consensus weakening — contrarian path may gain leverage."
            : `${prob}% crowd leans ${consensusSide} — you are entering against the narrative.`;
      return {
        tone: "rose" as const,
        text: "You are entering against rising consensus.",
        sub: extra,
        exposure: "High reputational exposure · public dissent on record",
      };
    }
    if (alignedBloc?.momentum === "weakening") {
      return {
        tone: "amber" as const,
        text: "Your thesis aligns with a weakening high-rep bloc.",
        sub: `${alignedBloc.name} — ${alignedBloc.rep_concentration}% rep concentration, momentum fading.`,
        exposure: "Timing risk if repricing accelerates against your flank",
      };
    }
    if (highRepAligned >= 1) {
      return {
        tone: "emerald" as const,
        text: `You align with ${highRepAligned} high-reputation agent${highRepAligned > 1 ? "s" : ""}.`,
        sub: `${alignedBloc?.name ?? "Your coalition"} · ${alignedBloc?.rep_concentration ?? prob}% rep on ${side}.`,
        exposure: "Consensus pressure supports — credibility upside on verify",
      };
    }
    if (alignedAgents >= 2) {
      return {
        tone: "emerald" as const,
        text: `You align with ${alignedAgents} positioned agents on ${side}.`,
        sub: "This conviction reinforces your public forecasting record.",
        exposure: "Moderate exposure — crowd alignment reduces isolation risk",
      };
    }
    return {
      tone: "violet" as const,
      text: "Early conviction — before the coalition fully forms.",
      sub: "Position enters institutional memory ahead of crowd alignment.",
      exposure: "Asymmetric upside if narrative breaks your way",
    };
  }, [
    isContrarian,
    highRepAligned,
    alignedAgents,
    prob,
    consensusSide,
    side,
    alignedBloc,
    opposingBloc,
  ]);

  useEffect(() => {
    if (!user) {
      return;
    }

    let cancelled = false;
    async function loadPosition() {
      setLoadingPosition(true);
      try {
        const response = await apiFetch(`/markets/${market.slug}/my-position`);
        if (!response.ok || cancelled) return;
        const data = await response.json();
        if (data?.position) {
          setConfirmedSide(data.position.side);
          setConfirmedAmount(data.position.amount);
          setConfirmed(true);
        }
        if (typeof data?.your_exposure === "number") setYourExposure(data.your_exposure);
        if (typeof data?.global_exposure === "number") setGlobalExposure(data.global_exposure);
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) setLoadingPosition(false);
      }
    }

    loadPosition();
    return () => {
      cancelled = true;
    };
  }, [user, market.slug]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    async function loadBalance() {
      try {
        const res = await apiFetch("/me/conviction-balance");
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as ConvictionBalancePayload;
        if (!cancelled) setConvictionBalance(data);
      } catch {
        /* ignore */
      }
    }
    loadBalance();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const effectiveAmount =
    custom.trim() !== "" ? Math.max(1, Math.min(100, Number(custom) || 0)) : amount;
  const walletLinked = !!user && hasVerifiedWallet(user);
  const noBalance = (convictionBalance?.available_balance ?? 0) <= 0;
  const capReached = (convictionBalance?.remaining_exposure ?? 0) <= 0;

  const repSide = side === "YES" ? credibility.yes : credibility.no;
  const repOther = side === "YES" ? credibility.no : credibility.yes;
  const repAdvantage = repSide.total_reputation - repOther.total_reputation;
  const reputationImpact = Math.round(
    effectiveAmount *
      (isContrarian ? 1.35 : 1) *
      (1 + Math.min(0.4, repAdvantage / 200)) *
      (credibility.consensus_breaking && isContrarian ? 1.15 : 1) *
      2.0,
  );

  const handleSubmit = async () => {
    if (effectiveAmount < 1 || submitting) return;

    if (!user) {
      redirectToLogin(router, `/markets/${market.slug}`);
      return;
    }
    if (!walletLinked) {
      setError("Link wallet to stake conviction.");
      return;
    }
    if (noBalance) {
      setError("Fund Conviction Capital before committing position.");
      return;
    }
    if (capReached) {
      setError("Exposure cap reached. Reduce open exposure before adding new allocation.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const response = await apiFetch("/positions", {
        method: "POST",
        body: JSON.stringify({
          market_slug: market.slug,
          side,
          amount: effectiveAmount,
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
            : "Could not record your position. Try again.";
        throw new Error(message);
      }

      const data = await response.json();
      setConfirmedSide(data.side ?? side);
      setConfirmedAmount(data.amount ?? effectiveAmount);
      setConfirmed(true);
      if (typeof data?.public_exposure === "number") setYourExposure(data.public_exposure);
      setGlowConfirm(true);
      setTimeout(() => setGlowConfirm(false), 2400);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not record your position. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (resolved) {
    return (
      <aside className="rounded-xl border border-emerald-800/30 bg-emerald-950/5 p-4 lg:sticky lg:top-[4.5rem] war-room-archival">
        <p className="text-[10px] uppercase tracking-wider text-zinc-600 mb-2">Conviction archive</p>
        <p className="text-sm font-semibold text-emerald-300">
          Resolved {market.resolved_outcome ?? "—"}
        </p>
        <p className="text-[11px] text-zinc-500 mt-2 leading-relaxed">
          Positioning closed. Your record, receipts, and reputation aftermath remain permanent.
        </p>
      </aside>
    );
  }

  return (
    <div
      id="take-position"
      className={`rounded-xl border overflow-hidden transition-shadow duration-500 lg:sticky lg:top-[4.5rem] ${
        glowConfirm
          ? "border-emerald-500/40 shadow-lg shadow-emerald-500/10 ring-1 ring-emerald-500/25"
          : "border-violet-500/20 shadow-lg shadow-violet-950/20"
      } bg-zinc-950/95`}
    >
      <div className="px-3 py-2.5 border-b border-zinc-800/70 bg-gradient-to-r from-violet-950/40 via-zinc-950 to-rose-950/20">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <LiveDot />
            <h2 className="text-xs font-semibold text-white">Stake conviction</h2>
          </div>
          <HeatPill tone="violet" pulse>
            Public record
          </HeatPill>
        </div>
        <p className="text-[10px] text-zinc-500 mt-1 leading-relaxed">
          Consequential, public, reputational. Commit position into the conviction ledger.
        </p>
        <p className="text-[10px] text-zinc-600 mt-1">
          Requires Conviction Capital.
          <button
            type="button"
            onClick={() => router.push("/me/conviction")}
            className="ml-1 text-violet-300 hover:text-violet-200 underline underline-offset-2"
          >
            Open capital desk
          </button>
        </p>
      </div>

      <div className="p-3 sm:p-4">
        <div className="mb-3 rounded-lg border border-zinc-800/70 bg-zinc-900/40 px-2.5 py-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[9px] text-zinc-600 uppercase tracking-wider">Live market</span>
            <span className="text-[10px] text-violet-300 tabular-nums font-semibold">{prob}% YES</span>
          </div>
          <MiniProbBar value={prob} size="xs" animated />
        </div>

        {loadingPosition ? (
          <p className="text-sm text-zinc-500 text-center py-8">Loading your position…</p>
        ) : confirmed ? (
          <div
            className={`rounded-xl border px-4 py-5 text-center transition ${
              glowConfirm
                ? "border-emerald-500/40 bg-emerald-500/10"
                : "border-emerald-500/25 bg-emerald-500/5"
            }`}
          >
            <p className="text-sm text-emerald-300/95 font-medium">
              Position on public record — {confirmedSide} · {confirmedAmount} USDC allocation
            </p>
            <p className="text-[10px] text-zinc-500 mt-2">
              Reputation exposure · ~{Math.round(confirmedAmount * 2.2)} calibration points
            </p>
            <button
              type="button"
              onClick={() => {
                setConfirmed(false);
                setError(null);
              }}
              className="mt-4 text-[10px] text-zinc-500 hover:text-zinc-300 transition"
            >
              Adjust position
            </button>
          </div>
        ) : (
          <>
            <p className="text-[9px] uppercase tracking-wider text-zinc-600 mb-2">Conviction side</p>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {(["YES", "NO"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSide(s)}
                  className={`py-3 rounded-xl text-sm font-semibold transition border ${
                    side === s
                      ? s === "YES"
                        ? "bg-violet-500/20 text-violet-100 border-violet-500/50 shadow-md shadow-violet-500/15"
                        : "bg-zinc-800 text-white border-zinc-500 shadow-md shadow-black/20"
                      : "border-zinc-800 text-zinc-500 hover:border-zinc-600"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>

            <p className="text-[9px] uppercase tracking-wider text-zinc-600 mb-2">
              Conviction allocation
            </p>
            <div className="flex flex-wrap gap-2 mb-3">
              {AMOUNTS.map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => {
                    setAmount(a);
                    setCustom("");
                  }}
                  className={`flex-1 min-w-[52px] py-2 rounded-lg text-sm font-semibold border transition ${
                    amount === a && custom === ""
                      ? "bg-white text-zinc-950 border-white"
                      : "border-zinc-700 text-zinc-400 hover:border-zinc-500"
                  }`}
                >
                  {a} USDC
                </button>
              ))}
            </div>
            <input
              type="number"
              min={1}
              max={100}
              placeholder="Custom conviction (USDC)"
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              className="w-full mb-4 px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-violet-500/40 focus:ring-1 focus:ring-violet-500/20"
            />

            <div
              className={`rounded-lg border px-3 py-2.5 mb-3 ${
                alignmentPreview.tone === "rose"
                  ? "border-rose-500/25 bg-rose-500/5"
                  : alignmentPreview.tone === "emerald"
                    ? "border-emerald-500/25 bg-emerald-500/5"
                    : alignmentPreview.tone === "amber"
                      ? "border-amber-500/25 bg-amber-500/5"
                      : "border-violet-500/25 bg-violet-500/5"
              }`}
            >
              <p className="text-[11px] font-medium text-zinc-200">{alignmentPreview.text}</p>
              <p className="text-[10px] text-zinc-500 mt-1 leading-relaxed">{alignmentPreview.sub}</p>
              {"exposure" in alignmentPreview && (
                <p className="text-[9px] text-amber-400/70 mt-2 italic">{alignmentPreview.exposure}</p>
              )}
            </div>

            {alignedBloc && (
              <div className="rounded-lg border border-zinc-800/60 bg-zinc-900/30 px-3 py-2 mb-3">
                <p className="text-[9px] uppercase text-zinc-600">Faction alignment</p>
                <p className="text-[10px] text-zinc-400 mt-0.5">{alignedBloc.name}</p>
              </div>
            )}

            <div className="rounded-lg border border-zinc-800/70 bg-zinc-900/40 px-3 py-2.5 mb-4 space-y-1.5">
              <p className="text-[9px] uppercase tracking-wider text-zinc-600">Public record</p>
              <p className="text-[10px] text-zinc-400 leading-relaxed">
                This commitment affects your public exposure record. Allocation size and side are
                permanently archived.
              </p>
            </div>

            <div className="rounded-lg border border-zinc-800/70 bg-zinc-900/40 px-3 py-2.5 mb-4 space-y-1.5">
              <p className="text-[9px] uppercase tracking-wider text-zinc-600">Exposure status</p>
              <p className="text-[10px] text-zinc-400">
                Public exposure: {market.public_exposure ?? 0} USDC · Your exposure: {yourExposure} USDC
              </p>
              <p className="text-[10px] text-zinc-500">Global exposure: {globalExposure} / 100 USDC default cap</p>
              <p className="text-[10px] text-zinc-400">
                Crowd imbalance: {market.crowd_imbalance ?? 0} USDC · Conviction pressure:{" "}
                {market.conviction_pressure ?? "balanced"}
              </p>
              {(market.conviction_pressure === "crowded" || isContrarian) && (
                <p className="text-[10px] text-amber-300/80">
                  {market.conviction_pressure === "crowded"
                    ? "Crowded trade warning: exposure is concentrated on one side."
                    : "Isolated exposure warning: you are positioning against consensus."}
                </p>
              )}
            </div>

            {!walletLinked && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2.5 mb-3">
                <p className="text-[10px] text-amber-300">Link wallet to stake conviction.</p>
              </div>
            )}
            {walletLinked && noBalance && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2.5 mb-3">
                <p className="text-[10px] text-amber-300">No available USDC balance.</p>
                <button
                  type="button"
                  onClick={() => router.push("/me/conviction")}
                  className="mt-2 rounded-lg border border-violet-500/30 px-2 py-1 text-[10px] text-violet-300"
                >
                  Fund Conviction Capital
                </button>
              </div>
            )}
            {capReached && (
              <div className="rounded-lg border border-rose-500/30 bg-rose-500/5 px-3 py-2.5 mb-3">
                <p className="text-[10px] text-rose-300">
                  Exposure cap reached. Reduce open exposure before adding new allocation.
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 mb-4 text-[10px]">
              <div className="rounded-lg bg-zinc-900/60 border border-zinc-800/80 px-2 py-2">
                <p className="text-zinc-600">Est. reputation impact</p>
                <p className="text-amber-300/90 font-semibold tabular-nums">
                  {isContrarian ? "±" : "+"}
                  {reputationImpact}
                </p>
                <p className="text-[8px] text-zinc-600 mt-0.5">placeholder · live engine pending</p>
              </div>
              <div className="rounded-lg bg-zinc-900/60 border border-zinc-800/80 px-2 py-2">
                <p className="text-zinc-600">Credibility on {side}</p>
                <p className="text-zinc-300 font-semibold tabular-nums">
                  {Math.round(repSide.total_reputation)} rep
                </p>
              </div>
            </div>

            {error && (
              <p className="text-xs text-rose-400/90 mb-3 px-2 py-2 rounded-lg bg-rose-500/5 border border-rose-500/20">
                {error}
              </p>
            )}

            <button
              type="button"
              onClick={handleSubmit}
              disabled={effectiveAmount < 1 || submitting || !walletLinked || noBalance || capReached}
              className="w-full py-3 rounded-xl text-sm font-semibold bg-gradient-to-r from-violet-500 to-violet-600 text-white hover:from-violet-400 hover:to-violet-500 transition disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-violet-500/20"
            >
              {submitting ? "Committing conviction…" : "Commit position"}
            </button>
            <p className="text-[9px] text-zinc-600 text-center mt-2">
              Conviction allocation is capped and validated server-side
            </p>
          </>
        )}
      </div>
    </div>
  );
}
