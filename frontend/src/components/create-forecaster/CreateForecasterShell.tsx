"use client";

import { ScryLogo } from "@/components/brand/ScryLogo";
import { TOTAL_WIZARD_STEPS, WIZARD_STEP_LABELS } from "@/lib/creatorForecaster";

const GLOW_BY_STEP: Record<number, string> = {
  1: "onboarding-glow-violet",
  2: "onboarding-glow-cyan",
  3: "onboarding-glow-fuchsia",
  4: "onboarding-glow-amber",
  5: "onboarding-glow-violet",
  6: "onboarding-glow-emerald",
  7: "onboarding-glow-violet",
};

export function StudioGlow({ step }: { step: number }) {
  const glowClass = GLOW_BY_STEP[step] ?? GLOW_BY_STEP[1];
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
      <div className={`absolute inset-0 transition-opacity duration-1000 ${glowClass}`} />
      <div className="onboarding-particles absolute inset-0" />
    </div>
  );
}

export function StudioProgress({ step }: { step: number }) {
  const pct = (step / TOTAL_WIZARD_STEPS) * 100;
  const label = WIZARD_STEP_LABELS[step - 1] ?? "Setup";
  return (
    <div className="w-full max-w-lg mx-auto">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-medium tracking-[0.18em] uppercase text-zinc-500">
          {label}
        </span>
        <span className="text-[10px] tabular-nums text-zinc-600">
          {step}/{TOTAL_WIZARD_STEPS}
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

export function StudioHeader({
  step,
  onBack,
}: {
  step: number;
  onBack?: () => void;
}) {
  return (
    <header className="relative z-20 border-b border-zinc-800/40 bg-zinc-950/50 backdrop-blur-xl">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
        <ScryLogo size="md" />
        <span className="text-[10px] uppercase tracking-[0.2em] text-violet-400/80 hidden sm:inline">
          Agent Studio
        </span>
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
    </header>
  );
}

export function StepPanel({
  title,
  subtitle,
  titleAccessory,
  children,
}: {
  title: string;
  subtitle?: string;
  titleAccessory?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div>
        <div className="flex items-center gap-2.5">
          <h1 className="text-2xl sm:text-3xl font-semibold text-white tracking-tight">{title}</h1>
          {titleAccessory}
        </div>
        {subtitle && (
          <p className="text-[13px] text-zinc-500 mt-2 max-w-lg leading-relaxed">{subtitle}</p>
        )}
      </div>
      {children}
    </div>
  );
}

export function StudioPrimaryButton({
  children,
  onClick,
  disabled,
  variant = "primary",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "primary" | "ghost";
}) {
  const base =
    variant === "primary"
      ? "bg-violet-600 hover:bg-violet-500 text-white shadow-lg shadow-violet-950/40"
      : "bg-zinc-800/80 hover:bg-zinc-700/80 text-zinc-200 border border-zinc-700/60";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`h-10 px-5 rounded-lg text-[13px] font-medium transition disabled:opacity-40 disabled:cursor-not-allowed ${base}`}
    >
      {children}
    </button>
  );
}
