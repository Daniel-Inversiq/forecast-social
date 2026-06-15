"use client";

import { Suspense } from "react";
import { FeedShell } from "@/components/feed/FeedShell";
import { HeatPill, LiveDot } from "@/components/feed/shared";
import { useAuth } from "@/context/AuthProvider";
import { IntelligenceBillingSection } from "@/components/intelligence/IntelligenceBillingSection";
import { IntelligenceDevControls } from "@/components/intelligence/IntelligenceDevControls";
import { INTELLIGENCE_CORE_SURFACES, INTELLIGENCE_NAME, hasIntelligenceAccess } from "@/lib/intelligence";

const DESK_SURFACES = [
  "Before-consensus signal formation",
  "Coalition relationship mapping",
  "Narrative ancestry and pressure regimes",
  "Reputation migration and fragility diagnostics",
  "Verification pathway probability modeling",
  "Historical timing analog explorer",
];

export default function IntelligenceAccessPage() {
  const { user } = useAuth();
  const enabled = hasIntelligenceAccess(user);

  return (
    <FeedShell activeNav="Feed" hideCategoryNav>
      <section className="rounded-2xl border border-amber-500/20 bg-gradient-to-b from-zinc-900/85 to-zinc-950 p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <LiveDot color="amber" />
          <p className="text-[10px] uppercase tracking-[0.18em] text-amber-300/80">
            Institutional Layer
          </p>
          <HeatPill tone="amber">{enabled ? "Active" : "Available"}</HeatPill>
        </div>
        <h1 className="text-xl sm:text-2xl font-semibold text-zinc-100 tracking-tight">{INTELLIGENCE_NAME}</h1>
        <p className="text-sm text-zinc-400 mt-2 max-w-2xl leading-relaxed">
          Access high-resolution conviction signals, hidden network alignment, and deeper forecasting
          infrastructure designed for institutional-grade visibility.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="text-[10px] rounded-full border border-zinc-700 px-2.5 py-1 text-zinc-300">
            Free
          </span>
          <span className="text-[10px] rounded-full border border-amber-500/35 bg-amber-500/10 px-2.5 py-1 text-amber-200">
            Intelligence Access
          </span>
        </div>
      </section>

      <section className="mt-4 grid lg:grid-cols-2 gap-3">
        {[...INTELLIGENCE_CORE_SURFACES, ...DESK_SURFACES].map((item) => (
          <div
            key={item}
            className="rounded-lg border border-zinc-800/90 bg-zinc-900/50 px-3 py-2 text-[11px] text-zinc-300"
          >
            {item}
          </div>
        ))}
      </section>

      <IntelligenceDevControls />

      <Suspense
        fallback={
          <section className="mt-4 rounded-xl border border-zinc-800 bg-zinc-950/70 p-4">
            <p className="text-[11px] text-zinc-500">Loading billing…</p>
          </section>
        }
      >
        <IntelligenceBillingSection />
      </Suspense>
    </FeedShell>
  );
}
