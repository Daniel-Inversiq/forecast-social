"use client";

import { MiniSparkline } from "@/components/feed/shared";
import {
  CONVICTION_STYLES,
  type ConvictionStyleId,
  type Interest,
} from "@/lib/onboarding";
import { FeedPreviewPanel } from "./FeedPreviewPanel";
import { OnboardingContinueButton } from "./OnboardingShell";

const toneSpark: Record<string, "violet" | "emerald" | "sky" | "amber"> = {
  violet: "violet",
  sky: "sky",
  emerald: "emerald",
  amber: "amber",
  rose: "amber",
  fuchsia: "violet",
};

export function StepForecastingStyle({
  selected,
  interests,
  followedSlugs,
  onSelect,
  onContinue,
}: {
  selected: ConvictionStyleId | null;
  interests: Interest[];
  followedSlugs: string[];
  onSelect: (id: ConvictionStyleId) => void;
  onContinue: () => void;
}) {
  return (
    <div className="lg:grid lg:grid-cols-[1fr_260px] lg:gap-8 items-start">
      <div>
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-semibold text-white tracking-tight text-center lg:text-left">
          Choose your forecasting desk
        </h1>
        <p className="mt-3 text-sm text-zinc-400 text-center lg:text-left max-w-xl">
          This archetype influences first follows, feed shaping, and how Scry weights the signals
          around your profile.
        </p>

        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          {CONVICTION_STYLES.map((style) => {
            const isSelected = selected === style.id;
            return (
              <button
                key={style.id}
                type="button"
                onClick={() => onSelect(style.id)}
                className={`onboarding-archetype-card text-left p-4 sm:p-5 rounded-2xl border transition-all duration-300 ${
                  isSelected
                    ? "border-violet-400/45 bg-violet-500/10 ring-1 ring-violet-500/20 onboarding-archetype-selected"
                    : "border-zinc-800/70 bg-zinc-950/50 hover:border-zinc-600/70 hover:-translate-y-0.5"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-white text-sm sm:text-base">
                      {style.title}
                    </p>
                    <p className="text-xs text-zinc-500 mt-1.5 leading-relaxed">
                      {style.description}
                    </p>
                  </div>
                  <MiniSparkline
                    seed={style.sparkSeed}
                    tone={toneSpark[style.tone] ?? "violet"}
                    width={48}
                    height={18}
                  />
                </div>
                <div
                  className={`mt-3 h-1 rounded-full overflow-hidden bg-zinc-800/80 ${
                    isSelected ? "opacity-100" : "opacity-40"
                  }`}
                >
                  <div
                    className="h-full bg-gradient-to-r from-violet-500/80 to-cyan-400/60 rounded-full transition-all duration-500"
                    style={{ width: isSelected ? "88%" : "40%" }}
                  />
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-10 flex justify-center lg:justify-start">
          <OnboardingContinueButton disabled={!selected} onClick={onContinue} />
        </div>
      </div>

      <div className="hidden lg:block sticky top-24 mt-0">
        <FeedPreviewPanel
          interests={interests}
          convictionStyle={selected}
          followedSlugs={followedSlugs}
        />
      </div>
    </div>
  );
}
