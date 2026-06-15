"use client";

import { HeatPill, MiniProbBar } from "@/components/feed/shared";
import { WalletIdentityChip } from "@/components/wallet/WalletIdentityChip";
import type { EnrichedUserProfile } from "./types";

export function UserConvictionIdentity({ profile }: { profile: EnrichedUserProfile }) {
  const calibration = Math.round(
    profile.reputation?.calibration_score ?? profile.accuracy_score,
  );
  const contrarian = profile.consensus_divergence;
  const timing = Math.round(profile.timing_quality);
  const early = profile.early_call_pct;

  return (
    <section className="rounded-xl border border-cyan-500/12 bg-gradient-to-br from-cyan-950/20 via-zinc-950/90 to-zinc-950/90 p-4 feed-hover-lift">
      <div className="flex items-center gap-2 mb-3">
        <HeatPill tone="sky">Conviction identity</HeatPill>
        <span className="text-[10px] text-zinc-600">Specialization · calibration · divergence</span>
        {profile.wallet_verified && (
          <WalletIdentityChip
            identity={{
              username: profile.slug,
              ens_name: profile.ens_name,
              wallet_address: profile.wallet_address,
              wallet_address_short: profile.wallet_address_short,
              wallet_chain: profile.wallet_chain,
              wallet_chain_label: profile.wallet_chain_label,
              wallet_verified: profile.wallet_verified,
            }}
            compact
            showChain={false}
          />
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-lg border border-violet-500/15 bg-violet-950/15 px-3 py-2.5">
          <p className="text-[8px] uppercase tracking-wider text-zinc-600">Specialization</p>
          <p className="text-[12px] font-semibold text-violet-200 mt-1">{profile.niche}</p>
          <p className="text-[9px] text-zinc-500 mt-1">{profile.conviction_style}</p>
        </div>

        <div className="rounded-lg border border-amber-500/15 bg-amber-950/10 px-3 py-2.5">
          <p className="text-[8px] uppercase tracking-wider text-zinc-600">Contrarian score</p>
          <p className="text-[12px] font-semibold text-amber-200/90 mt-1 tabular-nums">{contrarian}%</p>
          <p className="text-[9px] text-zinc-500 mt-1">Consensus-break tendency</p>
          <div className="mt-2">
            <MiniProbBar value={contrarian} />
          </div>
        </div>

        <div className="rounded-lg border border-emerald-500/15 bg-emerald-950/10 px-3 py-2.5">
          <p className="text-[8px] uppercase tracking-wider text-zinc-600">Calibration profile</p>
          <p className="text-[12px] font-semibold text-emerald-300/90 mt-1 tabular-nums">
            {calibration}%
          </p>
          <p className="text-[9px] text-zinc-500 mt-1">Resolved-call accuracy</p>
          <div className="mt-2">
            <MiniProbBar value={calibration} />
          </div>
        </div>

        <div className="rounded-lg border border-sky-500/15 bg-sky-950/10 px-3 py-2.5">
          <p className="text-[8px] uppercase tracking-wider text-zinc-600">Timing quality</p>
          <p className="text-[12px] font-semibold text-sky-300/90 mt-1 tabular-nums">{timing}%</p>
          <p className="text-[9px] text-zinc-500 mt-1">{early}% early vs consensus</p>
        </div>
      </div>
    </section>
  );
}
