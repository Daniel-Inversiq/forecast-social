"use client";

import type { CredibilityOnboardingState } from "@/lib/credibilityOnboarding";

const PHASE_CLASS: Record<CredibilityOnboardingState["phase"], string> = {
  booting: "text-cyan-300/95",
  building: "text-violet-300/95",
  training: "text-amber-300/95",
};

const PHASE_BAR: Record<CredibilityOnboardingState["phase"], string> = {
  booting: "from-cyan-500/80 to-violet-500/60",
  building: "from-violet-500/80 to-fuchsia-500/50",
  training: "from-amber-500/80 to-violet-500/50",
};

function ProgressBar({
  current,
  required,
  phase,
}: {
  current: number;
  required: number;
  phase: CredibilityOnboardingState["phase"];
}) {
  const pct = required > 0 ? Math.min(100, (current / required) * 100) : 0;
  return (
    <div className="mt-1.5 w-full">
      <div className="h-1 rounded-full bg-zinc-800/90 overflow-hidden">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${PHASE_BAR[phase]} transition-all duration-500`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function CredibilityOnboardingDisplay({
  onboarding,
  variant = "card",
  className = "",
}: {
  onboarding: CredibilityOnboardingState;
  variant?: "hero" | "card" | "compact" | "table" | "inline";
  className?: string;
}) {
  const accent = PHASE_CLASS[onboarding.phase];

  if (variant === "inline") {
    return (
      <div className={`min-w-0 ${className}`}>
        <p className={`text-[10px] font-medium leading-snug ${accent}`}>{onboarding.headline}</p>
        <p className="text-[9px] text-zinc-500 leading-snug mt-0.5">{onboarding.subline}</p>
        {onboarding.progress && (
          <ProgressBar
            current={onboarding.progress.current}
            required={onboarding.progress.required}
            phase={onboarding.phase}
          />
        )}
      </div>
    );
  }

  if (variant === "compact" || variant === "table") {
    return (
      <div className={`text-right shrink-0 max-w-[9rem] ${className}`}>
        <p className="text-[8px] uppercase tracking-wider text-zinc-600 leading-none">Status</p>
        <p className={`text-[11px] font-semibold leading-snug mt-0.5 ${accent}`}>
          {onboarding.headline}
        </p>
        <p className="text-[8px] text-zinc-500 mt-0.5 leading-snug line-clamp-2">
          {onboarding.subline}
        </p>
        {onboarding.progress && (
          <ProgressBar
            current={onboarding.progress.current}
            required={onboarding.progress.required}
            phase={onboarding.phase}
          />
        )}
      </div>
    );
  }

  if (variant === "hero") {
    return (
      <div className={`reputation-score-hero text-center xl:text-left ${className}`}>
        <p className="text-[10px] uppercase tracking-[0.18em] text-zinc-500 mb-1">Getting started</p>
        <p className={`text-2xl sm:text-3xl font-semibold leading-tight tracking-tight ${accent}`}>
          {onboarding.headline}
        </p>
        <p className="text-[12px] text-zinc-400 mt-3 max-w-xs mx-auto xl:mx-0 leading-relaxed">
          {onboarding.subline}
        </p>
        {onboarding.progress && (
          <div className="mt-4 max-w-xs mx-auto xl:mx-0">
            <ProgressBar
              current={onboarding.progress.current}
              required={onboarding.progress.required}
              phase={onboarding.phase}
            />
          </div>
        )}
        <p className="text-[11px] text-zinc-600 mt-3 max-w-xs mx-auto xl:mx-0">
          Credibility unlocks after your first resolved forecasts hit the ledger.
        </p>
      </div>
    );
  }

  return (
    <div className={`text-right shrink-0 max-w-[10.5rem] ${className}`}>
      <p className="text-[8px] uppercase tracking-wider text-zinc-600">Status</p>
      <p className={`text-[13px] font-semibold leading-snug mt-0.5 ${accent}`}>
        {onboarding.headline}
      </p>
      <p className="text-[9px] text-zinc-500 mt-1 leading-snug">{onboarding.subline}</p>
      {onboarding.progress && (
        <ProgressBar
          current={onboarding.progress.current}
          required={onboarding.progress.required}
          phase={onboarding.phase}
        />
      )}
    </div>
  );
}
