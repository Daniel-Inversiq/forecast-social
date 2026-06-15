"use client";

import {
  INTEREST_META,
  INTEREST_OPTIONS,
  type ConvictionStyleId,
  type Interest,
} from "@/lib/onboarding";
import { FeedPreviewPanel } from "./FeedPreviewPanel";
import { OnboardingContinueButton } from "./OnboardingShell";

export function StepInterestGraph({
  selected,
  convictionStyle,
  followedSlugs,
  onToggle,
  onContinue,
}: {
  selected: Interest[];
  convictionStyle: ConvictionStyleId | null;
  followedSlugs: string[];
  onToggle: (interest: Interest) => void;
  onContinue: () => void;
}) {
  return (
    <div className="lg:grid lg:grid-cols-[1fr_280px] lg:gap-8 xl:gap-12 items-start">
      <div>
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-semibold text-white tracking-tight text-center lg:text-left">
          Which narrative domains do you read?
        </h1>
        <p className="mt-3 text-sm sm:text-base text-zinc-400 text-center lg:text-left leading-relaxed max-w-xl">
          Select pressure zones shaping the network. Your first follows, signal weighting, and
          battle discovery adapt from these choices.
        </p>

        <div className="mt-8 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3 gap-2.5 sm:gap-3">
          {INTEREST_OPTIONS.map((interest) => {
            const meta = INTEREST_META[interest];
            const isSelected = selected.includes(interest);
            return (
              <button
                key={interest}
                type="button"
                onClick={() => onToggle(interest)}
                className={`onboarding-interest-card group relative text-left p-4 sm:p-5 rounded-2xl border transition-all duration-300 ${
                  isSelected
                    ? "border-violet-400/50 onboarding-interest-selected"
                    : "border-zinc-800/70 bg-zinc-950/40 hover:border-zinc-600/80 hover:-translate-y-0.5"
                }`}
                style={
                  isSelected
                    ? ({ "--interest-glow": meta.glow } as React.CSSProperties)
                    : undefined
                }
              >
                <div
                  className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${meta.gradient} opacity-60 pointer-events-none`}
                />
                <span className="relative text-lg opacity-80" aria-hidden>
                  {meta.icon}
                </span>
                <p className="relative mt-2 font-semibold text-white text-sm sm:text-base">
                  {interest}
                </p>
                {isSelected && (
                  <span className="absolute top-3 right-3 h-2 w-2 rounded-full bg-violet-400 onboarding-pulse-dot" />
                )}
              </button>
            );
          })}
        </div>

        <div className="mt-10 flex justify-center lg:justify-start">
          <OnboardingContinueButton
            disabled={selected.length === 0}
            onClick={onContinue}
          />
        </div>
      </div>

      <div className="mt-8 lg:mt-0 hidden lg:block sticky top-24">
        <FeedPreviewPanel
          interests={selected}
          convictionStyle={convictionStyle}
          followedSlugs={followedSlugs}
        />
      </div>

      <div className="mt-6 lg:hidden">
        <FeedPreviewPanel
          interests={selected}
          convictionStyle={convictionStyle}
          followedSlugs={followedSlugs}
          compact
        />
      </div>
    </div>
  );
}
