"use client";

import { ScryLogo } from "@/components/brand/ScryLogo";
import { TOTAL_ONBOARDING_STEPS } from "@/lib/onboarding";

const GLOW_BY_STEP: Record<number, string> = {
  1: "onboarding-glow-violet",
  2: "onboarding-glow-cyan",
  3: "onboarding-glow-fuchsia",
  4: "onboarding-glow-amber",
  5: "onboarding-glow-emerald",
};

export function OnboardingGlow({ step }: { step: number }) {
  const glowClass = GLOW_BY_STEP[step] ?? GLOW_BY_STEP[1];
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
      <div className={`absolute inset-0 transition-opacity duration-1000 ${glowClass}`} />
      <div className="onboarding-particles absolute inset-0" />
      <div
        className="absolute inset-0 opacity-[0.025]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
        }}
      />
    </div>
  );
}

export function OnboardingProgress({ step }: { step: number }) {
  const pct = (step / TOTAL_ONBOARDING_STEPS) * 100;
  return (
    <div className="w-full max-w-lg mx-auto">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-medium tracking-[0.18em] uppercase text-zinc-500">
          Calibrating intelligence
        </span>
        <span className="text-[10px] tabular-nums text-zinc-600">
          {step}/{TOTAL_ONBOARDING_STEPS}
        </span>
      </div>
      <div className="h-[3px] rounded-full bg-zinc-800/60 overflow-hidden">
        <div
          className="onboarding-progress-fill h-full rounded-full bg-gradient-to-r from-violet-500 via-fuchsia-500 to-cyan-400"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function OnboardingHeader({
  step,
  onBack,
  onContinueLater,
}: {
  step: number;
  onBack?: () => void;
  onContinueLater?: () => void;
}) {
  return (
    <header className="relative z-20 border-b border-zinc-800/40 bg-zinc-950/50 backdrop-blur-xl">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
        <ScryLogo size="md" />
        <div className="flex items-center gap-3">
          {onContinueLater && (
            <button
              type="button"
              onClick={onContinueLater}
              className="text-[11px] text-zinc-500 hover:text-zinc-300 transition hidden sm:inline"
            >
              Continue later
            </button>
          )}
          {step > 1 && onBack && (
            <button
              type="button"
              onClick={onBack}
              className="text-xs text-zinc-500 hover:text-zinc-200 transition px-2 py-1 rounded-lg hover:bg-zinc-800/50"
            >
              Back
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

export function StepTransition({
  visible,
  children,
  stepKey,
}: {
  visible: boolean;
  children: React.ReactNode;
  stepKey: number;
}) {
  return (
    <div
      key={stepKey}
      className={`onboarding-step transition-all duration-600 ease-out ${
        visible
          ? "opacity-100 translate-y-0 pointer-events-auto relative z-10"
          : "opacity-0 translate-y-6 pointer-events-none absolute inset-0 z-0"
      }`}
      aria-hidden={!visible}
    >
      {children}
    </div>
  );
}

export function OnboardingContinueButton({
  disabled,
  onClick,
  label = "Continue",
  variant = "secondary",
}: {
  disabled?: boolean;
  onClick: () => void;
  label?: string;
  variant?: "primary" | "secondary";
}) {
  const base =
    variant === "primary"
      ? "bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white shadow-[0_0_40px_-10px_rgba(139,92,246,0.55)] border-transparent"
      : "bg-zinc-800/80 hover:bg-zinc-700/90 text-white border-zinc-700/80";

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`px-8 py-3.5 rounded-xl text-sm font-semibold border transition-all duration-300 disabled:opacity-35 disabled:cursor-not-allowed ${base}`}
    >
      {label}
    </button>
  );
}
