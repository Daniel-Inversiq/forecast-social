"use client";

import { useEffect, useMemo, useState } from "react";
import { useForecasterSubscriptions } from "@/context/ForecasterSubscriptionsProvider";
import {
  buildForecasterPlans,
  modalSubtitle,
  planSubtitle,
  TRUST_SUBSCRIPTION_COPY,
  type ForecasterSubscriptionPlan,
} from "@/lib/forecasterSubscriptions";
import { BetaDisclosure } from "@/components/trust/BetaDisclosure";
import { SubscriptionBadge } from "./SubscriptionBadge";

function PlanCard({
  plan,
  onSelect,
  disabled,
}: {
  plan: ForecasterSubscriptionPlan;
  onSelect: (tier: "pro" | "premium") => void;
  disabled?: boolean;
}) {
  const isPaid = plan.tier === "pro" || plan.tier === "premium";
  const highlighted = plan.tier === "pro";

  return (
    <div
      className={`rounded-xl border p-3 flex flex-col gap-2 ${
        plan.isSubscribed
          ? "border-emerald-500/35 bg-emerald-950/20"
          : highlighted
            ? "border-amber-500/30 bg-amber-950/15 shadow-[0_0_28px_-12px_rgba(245,158,11,0.25)]"
            : plan.tier === "premium"
              ? "border-violet-500/25 bg-violet-950/15"
              : "border-zinc-800/80 bg-zinc-900/40"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-white capitalize">{plan.tier}</span>
        {plan.tier === "pro" && <SubscriptionBadge variant="pro" />}
        {plan.tier === "premium" && <SubscriptionBadge variant="premium" />}
        {plan.isSubscribed && (
          <span className="text-[9px] font-semibold uppercase tracking-wider text-emerald-300">
            Current
          </span>
        )}
      </div>
      <p className="text-xl font-bold tabular-nums text-zinc-100">
        {plan.priceMonthly === 0 ? "$0" : `$${plan.priceMonthly}`}
        {plan.priceMonthly > 0 && (
          <span className="text-[11px] font-normal text-zinc-500">/month</span>
        )}
      </p>
      <p className="text-[11px] text-zinc-400 leading-relaxed">{planSubtitle(plan.tier)}</p>
      <ul className="text-[10px] text-zinc-500 space-y-0.5 flex-1">
        {plan.benefits.slice(0, 4).map((b) => (
          <li key={b} className="flex gap-1.5">
            <span className="text-violet-400/70">·</span>
            <span>{b}</span>
          </li>
        ))}
      </ul>
      {isPaid && !plan.isSubscribed && (
        <button
          type="button"
          disabled={disabled}
          onClick={() => onSelect(plan.tier as "pro" | "premium")}
          className={`w-full text-[11px] font-semibold py-2.5 rounded-lg border transition disabled:opacity-50 ${
            plan.tier === "premium"
              ? "border-violet-500/40 text-violet-100 bg-violet-500/15 hover:bg-violet-500/25"
              : "border-amber-500/40 text-amber-100 bg-amber-500/12 hover:bg-amber-500/22"
          }`}
        >
          Start {plan.tier === "premium" ? "Premium" : "Pro"}
        </button>
      )}
    </div>
  );
}

export function ForecasterSubscribeModal({
  open,
  onClose,
  forecasterId,
  forecasterName,
}: {
  open: boolean;
  onClose: () => void;
  forecasterId: string;
  forecasterName: string;
}) {
  const { getTier, subscribe, unsubscribe } = useForecasterSubscriptions();
  const activeTier = getTier(forecasterId);
  const [successTier, setSuccessTier] = useState<"pro" | "premium" | null>(null);
  const [managing, setManaging] = useState(false);

  const plans = useMemo(
    () => buildForecasterPlans(forecasterId, forecasterName, activeTier),
    [forecasterId, forecasterName, activeTier],
  );

  useEffect(() => {
    if (!open) {
      setSuccessTier(null);
      setManaging(false);
    }
  }, [open]);

  if (!open) return null;

  function handleSubscribe(tier: "pro" | "premium") {
    subscribe(forecasterId, forecasterName, tier);
    setSuccessTier(tier);
  }

  function handleUnsubscribe() {
    unsubscribe(forecasterId);
    setManaging(false);
    onClose();
  }

  const showSuccess = successTier != null && !managing;

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Close subscription modal"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="subscribe-modal-title"
        className="relative w-full sm:max-w-md max-h-[90vh] overflow-hidden rounded-t-2xl sm:rounded-2xl border border-amber-500/20 bg-zinc-950/98 shadow-2xl shadow-amber-950/20 flex flex-col"
      >
        <div className="px-4 py-3.5 border-b border-zinc-800/80 bg-gradient-to-br from-amber-950/40 via-violet-950/30 to-zinc-950">
          {showSuccess ? (
            <>
              <h2 id="subscribe-modal-title" className="text-sm font-semibold text-emerald-200">
                You&apos;re subscribed
              </h2>
              <p className="text-[12px] text-zinc-300 mt-1 leading-relaxed">
                You&apos;re subscribed to {forecasterName}{" "}
                {successTier === "premium" ? "Premium" : "Pro"}.
              </p>
            </>
          ) : managing && activeTier ? (
            <>
              <h2 id="subscribe-modal-title" className="text-sm font-semibold text-white">
                Manage subscription
              </h2>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                {forecasterName} · {activeTier === "premium" ? "Premium" : "Pro"}
              </p>
            </>
          ) : (
            <>
              <h2 id="subscribe-modal-title" className="text-sm font-semibold text-white">
                Subscribe to {forecasterName}
              </h2>
              <p className="text-[11px] text-zinc-400 mt-1 leading-relaxed">
                {modalSubtitle(forecasterName)}
              </p>
            </>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 scrollbar-none">
          {showSuccess ? (
            <div className="rounded-xl border border-emerald-500/25 bg-emerald-950/20 px-4 py-6 text-center">
              <p className="text-3xl mb-2">✦</p>
              <p className="text-[12px] text-zinc-300 leading-relaxed">
                Subscriber-only reads and early signals from {forecasterName} are now unlocked.
              </p>
            </div>
          ) : managing && activeTier ? (
            <div className="space-y-3">
              <p className="text-[11px] text-zinc-400">
                You have active {activeTier === "premium" ? "Premium" : "Pro"} access. Upgrade or
                cancel below.
              </p>
              {activeTier === "pro" && (
                <button
                  type="button"
                  onClick={() => handleSubscribe("premium")}
                  className="w-full text-[11px] font-semibold py-2.5 rounded-lg border border-violet-500/40 text-violet-100 bg-violet-500/15 hover:bg-violet-500/25"
                >
                  Upgrade to Premium · $29/month
                </button>
              )}
              <button
                type="button"
                onClick={handleUnsubscribe}
                className="w-full text-[11px] py-2.5 rounded-lg border border-zinc-700 text-zinc-400 hover:text-rose-300 hover:border-rose-500/30 transition"
              >
                Cancel subscription
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {plans.map((plan) => (
                <PlanCard
                  key={plan.id}
                  plan={plan}
                  onSelect={handleSubscribe}
                  disabled={plan.isSubscribed}
                />
              ))}
            </div>
          )}

          <BetaDisclosure includeSubscriptionNote tone="muted" className="mt-1" />
          <p className="text-[9px] text-zinc-600 leading-relaxed">{TRUST_SUBSCRIPTION_COPY}</p>
        </div>

        <div className="sticky bottom-0 px-4 py-3 border-t border-zinc-800/60 bg-zinc-950/95 backdrop-blur-sm flex justify-end gap-2">
          {activeTier && !showSuccess && !managing && (
            <button
              type="button"
              onClick={() => setManaging(true)}
              className="mr-auto text-[10px] text-zinc-500 hover:text-zinc-300 transition"
            >
              Manage
            </button>
          )}
          {managing && (
            <button
              type="button"
              onClick={() => setManaging(false)}
              className="mr-auto text-[10px] text-zinc-500 hover:text-zinc-300 transition"
            >
              Back
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="text-[11px] px-4 py-2 rounded-lg border border-zinc-700 text-zinc-300 hover:text-white transition"
          >
            {showSuccess ? "Done" : "Close"}
          </button>
        </div>
      </div>
    </div>
  );
}
