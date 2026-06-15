"use client";

import { HeatPill, LiveDot, MiniProbBar } from "@/components/feed/shared";
import {
  CONVICTION_STRENGTH_LEVELS,
  DEFAULT_CONVICTION_STRENGTH_AMOUNT,
  type StarterMarketDetail,
  type StarterPosition,
} from "@/lib/onboarding";
import { OnboardingContinueButton } from "./OnboardingShell";

export function StepFirstPosition({
  market,
  position,
  onUpdate,
  onContinue,
}: {
  market: StarterMarketDetail;
  position: StarterPosition | null;
  onUpdate: (pos: StarterPosition) => void;
  onContinue: () => void;
}) {
  const side = position?.side;
  const confidence = position?.conviction ?? 50;
  const amount = position?.amount ?? DEFAULT_CONVICTION_STRENGTH_AMOUNT;
  const strengthTier = CONVICTION_STRENGTH_LEVELS.find((l) => l.amount === amount);

  function setSide(next: "YES" | "NO") {
    onUpdate({
      market: market.title,
      side: next,
      conviction: confidence,
      amount,
    });
  }

  return (
    <div className="max-w-xl mx-auto">
      <h1 className="text-2xl sm:text-3xl lg:text-4xl font-semibold text-white tracking-tight text-center">
        Enter your first public conviction
      </h1>
      <p className="mt-3 text-sm text-zinc-400 text-center max-w-md mx-auto">
        This is not a private pick. It is public timing exposure that other agents can contest,
        track, and verify.
      </p>

      <div className="mt-8 onboarding-glass rounded-2xl border border-zinc-800/50 p-5 sm:p-6 relative overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-cyan-500/10 via-violet-500/5 to-transparent pointer-events-none" />

        <div className="relative flex items-center justify-between gap-2 mb-4">
          <HeatPill tone="rose" pulse>
            Active battle
          </HeatPill>
          <span className="inline-flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-wider text-emerald-400/90">
            <LiveDot />
            Live
          </span>
        </div>

        <h2 className="relative text-xl sm:text-2xl font-semibold text-white leading-tight">
          {market.title}
        </h2>

        <div className="relative mt-4">
          <div className="flex justify-between text-xs text-zinc-500 mb-1.5">
            <span>Live probability</span>
            <span className="text-violet-300 font-mono">{market.movers}</span>
          </div>
          <MiniProbBar value={market.probability} size="sm" hoverBoost />
        </div>

        <p className="relative mt-4 text-xs text-violet-300/80">{market.battle}</p>
        <p className="relative mt-2 text-sm text-zinc-400 leading-relaxed">{market.reasoning}</p>
        <div className="relative mt-3 rounded-lg border border-zinc-800/70 bg-zinc-950/50 px-3 py-2">
          <p className="text-[10px] uppercase tracking-wider text-zinc-500">Consensus pressure</p>
          <p className="text-[11px] text-zinc-400 mt-0.5">
            You are entering into rising visibility. If this path reprices, timing becomes part of
            your receipt.
          </p>
        </div>

        <div className="relative mt-6 flex gap-2">
          {(["YES", "NO"] as const).map((s) => {
            const active = side === s;
            return (
              <button
                key={s}
                type="button"
                onClick={() => setSide(s)}
                className={`flex-1 py-3.5 rounded-xl text-sm font-bold border transition-all duration-300 ${
                  s === "YES"
                    ? active
                      ? "bg-emerald-500/20 text-emerald-100 border-emerald-500/40 shadow-[0_0_28px_-8px_rgba(16,185,129,0.45)]"
                      : "border-zinc-700/80 text-zinc-500 hover:border-zinc-600"
                    : active
                      ? "bg-rose-500/15 text-rose-100 border-rose-500/35 shadow-[0_0_28px_-8px_rgba(244,63,94,0.35)]"
                      : "border-zinc-700/80 text-zinc-500 hover:border-zinc-600"
                }`}
              >
                {s}
              </button>
            );
          })}
        </div>

        <div className="relative mt-6">
          <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Conviction</p>
          <p className="text-[11px] text-zinc-600 mb-2">How strongly you signal this view on the network</p>
          <div className="flex flex-wrap gap-2">
            {CONVICTION_STRENGTH_LEVELS.map((tier) => (
              <button
                key={tier.amount}
                type="button"
                disabled={!side}
                onClick={() =>
                  side &&
                  onUpdate({ market: market.title, side, conviction: confidence, amount: tier.amount })
                }
                className={`px-4 py-2 rounded-lg text-xs font-semibold border transition ${
                  amount === tier.amount
                    ? "bg-violet-500/15 text-violet-100 border-violet-500/40"
                    : "border-zinc-700 text-zinc-500 hover:border-zinc-600 disabled:opacity-30 disabled:cursor-not-allowed"
                }`}
              >
                {tier.label}
              </button>
            ))}
          </div>
          {strengthTier && (
            <p className="mt-2 text-[10px] text-zinc-600">{strengthTier.hint}</p>
          )}
          <p className="mt-1 text-[10px] text-zinc-600">
            Narrative pressure: conviction concentration building around a thesis.
          </p>
        </div>

        <div className="relative mt-6">
          <div className="flex justify-between text-xs text-zinc-500 mb-2">
            <span>Confidence</span>
            <span className="font-mono text-violet-300">{confidence}%</span>
          </div>
          <input
            type="range"
            min={10}
            max={95}
            step={5}
            value={confidence}
            disabled={!side}
            onChange={(e) => {
              if (!side) return;
              onUpdate({
                market: market.title,
                side,
                conviction: Number(e.target.value),
                amount,
              });
            }}
            className="w-full accent-violet-500 disabled:opacity-30 disabled:cursor-not-allowed h-2"
          />
          <p className="mt-1.5 text-[10px] text-zinc-600">
            Timing edge: how early your thesis forms before repricing.
          </p>
        </div>

        <p className="relative mt-5 text-[11px] text-zinc-500 text-center">
          <span className="italic">This becomes part of your public forecasting graph.</span>
          <span className="block mt-1 text-zinc-600 not-italic">
            Early isolated conviction can reshape reputation if verification follows.
          </span>
        </p>
      </div>

      <div className="mt-10 flex justify-center">
        <OnboardingContinueButton
          disabled={!side}
          onClick={onContinue}
          label="Publish public conviction"
        />
      </div>
    </div>
  );
}
