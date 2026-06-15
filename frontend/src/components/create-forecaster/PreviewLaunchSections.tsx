"use client";

import type {
  ForecastingIdentitySummary,
  LaunchTrajectorySummary,
  MonetizationSummary,
  NetworkPositioningSummary,
} from "@/lib/previewLaunchIntel";
import { starsDisplay } from "@/lib/previewLaunchIntel";
import { resolveCredibilityOnboarding } from "@/lib/credibilityOnboarding";

function SectionCard({
  title,
  children,
  accent = "violet",
}: {
  title: string;
  children: React.ReactNode;
  accent?: "violet" | "cyan" | "emerald" | "amber";
}) {
  const border =
    accent === "cyan"
      ? "border-cyan-500/25"
      : accent === "emerald"
        ? "border-emerald-500/25"
        : accent === "amber"
          ? "border-amber-500/25"
          : "border-violet-500/25";
  const glow =
    accent === "cyan"
      ? "from-cyan-500/5"
      : accent === "emerald"
        ? "from-emerald-500/5"
        : accent === "amber"
          ? "from-amber-500/5"
          : "from-violet-500/5";

  return (
    <div
      className={`rounded-xl border ${border} bg-gradient-to-br ${glow} to-zinc-950/80 overflow-hidden`}
    >
      <div className="px-4 py-2.5 border-b border-zinc-800/60 bg-zinc-900/50">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-400">
          {title}
        </h3>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function IdentityRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-baseline gap-0.5 sm:gap-4 py-2 border-b border-zinc-800/40 last:border-0">
      <dt className="text-[11px] uppercase tracking-wider text-zinc-500 sm:w-36 shrink-0">
        {label}
      </dt>
      <dd className="text-[14px] text-zinc-100 font-medium leading-snug">{value}</dd>
    </div>
  );
}

export function ForecastingIdentityPanel({ identity }: { identity: ForecastingIdentitySummary }) {
  return (
    <SectionCard title="Forecasting Identity" accent="violet">
      <dl>
        <IdentityRow label="Forecaster name" value={identity.name} />
        <IdentityRow label="Category" value={identity.category} />
        <IdentityRow label="Style" value={identity.style} />
        <IdentityRow label="Conviction" value={identity.conviction} />
        <IdentityRow label="Consensus tendency" value={identity.consensusTendency} />
        <IdentityRow label="Primary edge" value={identity.primaryEdge} />
        <IdentityRow label="Expected rivals" value={identity.expectedRivals.join(" · ")} />
      </dl>
    </SectionCard>
  );
}

export function NetworkPositioningPanel({
  positioning,
}: {
  positioning: NetworkPositioningSummary;
}) {
  return (
    <SectionCard title="Network Positioning" accent="cyan">
      <dl className="space-y-0">
        <IdentityRow label="Closest existing rival" value={positioning.closestRival} />
        <IdentityRow label="Not directly competing with" value={positioning.notCompetingWith} />
        <IdentityRow label="Unique angle" value={positioning.uniqueAngle} />
        <div className="py-3 mt-1 rounded-lg border border-cyan-500/20 bg-cyan-950/20 px-3">
          <p className="text-[10px] uppercase tracking-wider text-cyan-400/80 mb-1">
            Potential rivalry
          </p>
          <p className="text-[15px] font-semibold text-white tracking-tight">
            {positioning.potentialRivalry}
          </p>
        </div>
        <IdentityRow label="Expected category" value={positioning.expectedCategory} />
      </dl>
    </SectionCard>
  );
}

export function MonetizationPotentialPanel({
  monetization,
}: {
  monetization: MonetizationSummary;
}) {
  return (
    <SectionCard title="Monetization Potential" accent="amber">
      <p className="text-[11px] text-zinc-500 mb-3">
        Positioning guidance — not a revenue projection.
      </p>
      <div className="space-y-2 mb-4">
        <p className="text-[10px] uppercase tracking-wider text-zinc-500">Estimated audience fit</p>
        {monetization.audienceFit.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-3">
            <span className="text-[13px] text-zinc-300">{row.label}</span>
            <span className="text-[13px] text-amber-300/90 tracking-wider tabular-nums">
              {starsDisplay(row.stars)}
            </span>
          </div>
        ))}
      </div>
      <div className="space-y-3 pt-2 border-t border-zinc-800/50">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">
            Potential paid offer
          </p>
          <p className="text-[13px] text-zinc-200">&ldquo;{monetization.paidOffer}&rdquo;</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Best-fit plan</p>
          <p className="text-[14px] font-medium text-amber-200/95">{monetization.bestFitPlan}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Why</p>
          <p className="text-[12px] text-zinc-400 leading-relaxed">{monetization.planWhy}</p>
        </div>
      </div>
    </SectionCard>
  );
}

export function IfLaunchedTodayPanel({ launch }: { launch: LaunchTrajectorySummary }) {
  const launchOnboarding = resolveCredibilityOnboarding({
    slug: "preview-launch",
    score: launch.startingCredibility,
  });

  return (
    <SectionCard title="If launched today" accent="emerald">
      <dl>
        <IdentityRow label="Starting tier" value={launch.startingTier} />
        <IdentityRow
          label="Starting credibility"
          value={launchOnboarding?.headline ?? String(launch.startingCredibility)}
        />
        {launchOnboarding && (
          <div className="py-1.5">
            <p className="text-[12px] text-zinc-500 leading-relaxed">{launchOnboarding.subline}</p>
          </div>
        )}
        <IdentityRow label="Category" value={launch.category} />
        <IdentityRow label="Projected initial rank" value={launch.projectedInitialRank} />
      </dl>
      <div className="mt-3 pt-3 border-t border-zinc-800/50">
        <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2">Path to Trusted</p>
        <ul className="text-[13px] text-zinc-300 space-y-1 tabular-nums">
          {launch.pathToTrusted.map((step) => (
            <li key={step.label}>
              <span className="text-emerald-300/90 font-medium">{step.value}</span>{" "}
              <span className="text-zinc-500">{step.label}</span>
            </li>
          ))}
        </ul>
      </div>
      <p className="text-[12px] text-zinc-500 leading-relaxed mt-4 border-t border-zinc-800/40 pt-3">
        {launch.distributionCopy}
      </p>
    </SectionCard>
  );
}
