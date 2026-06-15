"use client";

import { useState } from "react";
import { DISTRIBUTION_TAGLINE, TRUSTED_REQUIREMENTS } from "@/lib/trust";
import { TrustDistributionTagline } from "@/components/trust/TrustDistributionTagline";

export function TrustedStatusExplainer() {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-lg border border-cyan-500/15 bg-cyan-950/10 px-3 py-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between text-left gap-2"
      >
        <span className="text-[11px] font-medium text-cyan-200/90">How do you become Trusted?</span>
        <span className="text-cyan-500/60 text-xs">{open ? "−" : "+"}</span>
      </button>
      {open && (
        <div className="mt-2 space-y-2 text-[10px] text-zinc-400 leading-relaxed">
          <TrustDistributionTagline compact />
          <p>
            Trusted status is earned through resolved forecasts, credibility, and clean
            participation — not payment or posting volume. Being right on record unlocks
            distribution.
          </p>
          <ul className="space-y-1 text-zinc-500">
            <li className="flex gap-2">
              <span className="text-cyan-400/80">·</span>
              <span>{TRUSTED_REQUIREMENTS.resolved_calls}+ resolved calls</span>
            </li>
            <li className="flex gap-2">
              <span className="text-cyan-400/80">·</span>
              <span>{TRUSTED_REQUIREMENTS.credibility}+ credibility</span>
            </li>
            <li className="flex gap-2">
              <span className="text-cyan-400/80">·</span>
              <span>Account older than {TRUSTED_REQUIREMENTS.account_age_days} days</span>
            </li>
            <li className="flex gap-2">
              <span className="text-cyan-400/80">·</span>
              <span>0 abuse flags</span>
            </li>
          </ul>
          <p className="text-[9px] text-zinc-600">{DISTRIBUTION_TAGLINE}</p>
        </div>
      )}
    </div>
  );
}
