"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthProvider";
import { createCheckoutSession, createPortalSession } from "@/lib/billing";
import { hasIntelligenceAccess } from "@/lib/intelligence";

export function IntelligenceBillingSection() {
  const { user, loading, refreshUser } = useAuth();
  const searchParams = useSearchParams();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successNote, setSuccessNote] = useState<string | null>(null);

  const hasAccess = hasIntelligenceAccess(user);
  const canManageBilling = Boolean(user?.has_billing_customer);

  useEffect(() => {
    if (searchParams.get("checkout") !== "success") return;
    let cancelled = false;
    (async () => {
      await refreshUser();
      if (!cancelled) {
        setSuccessNote("Intelligence Access is active. Premium surfaces are unlocked.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [searchParams, refreshUser]);

  const startCheckout = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const url = await createCheckoutSession();
      window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout failed");
      setBusy(false);
    }
  }, []);

  const openPortal = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const url = await createPortalSession();
      window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open portal");
      setBusy(false);
    }
  }, []);

  if (loading) {
    return (
      <section className="mt-4 rounded-xl border border-zinc-800 bg-zinc-950/70 p-4">
        <p className="text-[11px] text-zinc-500">Loading billing…</p>
      </section>
    );
  }

  if (!user) {
    return (
      <section className="mt-4 rounded-xl border border-zinc-800 bg-zinc-950/70 p-4">
        <h2 className="text-sm font-semibold text-zinc-100">Intelligence Access subscription</h2>
        <p className="text-[11px] text-zinc-500 mt-1">
          Sign in to subscribe or manage your Intelligence Access plan.
        </p>
        <Link
          href="/login"
          className="mt-3 inline-block text-[11px] text-amber-300 hover:text-amber-200 border border-amber-500/30 rounded-full px-2.5 py-0.5"
        >
          Sign in →
        </Link>
      </section>
    );
  }

  return (
    <section className="mt-4 rounded-xl border border-zinc-800 bg-zinc-950/70 p-4">
      <h2 className="text-sm font-semibold text-zinc-100">Intelligence Access subscription</h2>
      <p className="text-[11px] text-zinc-500 mt-1">
        {hasAccess && canManageBilling
          ? "Your subscription is active. Manage billing, payment method, or cancellation in the Stripe customer portal."
          : hasAccess
            ? "Intelligence Access is active on this account."
            : "Subscribe to unlock institutional-grade intelligence surfaces across Scry."}
      </p>
      {user.intelligence_current_period_end && hasAccess && (
        <p className="text-[10px] text-zinc-500 mt-2">
          Current period ends{" "}
          <span className="text-zinc-300">
            {new Date(user.intelligence_current_period_end).toLocaleDateString()}
          </span>
          {user.intelligence_subscription_status
            ? ` · ${user.intelligence_subscription_status}`
            : null}
        </p>
      )}
      {successNote && (
        <p className="text-[11px] text-amber-300/90 mt-2">{successNote}</p>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {hasAccess && canManageBilling ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => openPortal()}
            className="text-[11px] rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-amber-200 hover:bg-amber-500/20 disabled:opacity-50"
          >
            Manage subscription
          </button>
        ) : !hasAccess ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => startCheckout()}
            className="text-[11px] rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-amber-200 hover:bg-amber-500/20 disabled:opacity-50"
          >
            Start Intelligence Access
          </button>
        ) : null}
      </div>
      {error && <p className="text-[11px] text-red-400 mt-2">{error}</p>}
    </section>
  );
}
