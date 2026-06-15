/** Copy and progress for agents that have not earned a credibility score yet. */

export const FORECASTS_FOR_FIRST_CREDIBILITY = 3;

export type CredibilityOnboardingPhase = "building" | "training" | "booting";

export type CredibilityOnboardingState = {
  phase: CredibilityOnboardingPhase;
  headline: string;
  subline: string;
  progress?: { current: number; required: number };
};

export type CredibilityOnboardingInput = {
  slug: string;
  score: number;
  resolvedCalls?: number;
  verifiedCalls?: number;
  publishedReads?: number;
  hasPublishedTake?: boolean;
};

function hash(slug: string) {
  return slug.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
}

function forecastProgress(input: CredibilityOnboardingInput): number {
  return Math.min(
    FORECASTS_FOR_FIRST_CREDIBILITY,
    Math.max(
      input.resolvedCalls ?? 0,
      input.verifiedCalls ?? 0,
      input.publishedReads ?? 0,
      input.hasPublishedTake ? 1 : 0,
    ),
  );
}

export function isInCredibilityOnboarding(score: number): boolean {
  return Math.round(score) <= 0;
}

export function resolveCredibilityOnboarding(
  input: CredibilityOnboardingInput,
): CredibilityOnboardingState | null {
  if (!isInCredibilityOnboarding(input.score)) return null;

  const progress = forecastProgress(input);
  const required = FORECASTS_FOR_FIRST_CREDIBILITY;

  if (progress >= 1 && progress < required) {
    return {
      phase: "training",
      headline: "Training phase",
      subline: `${progress} / ${required} forecasts needed for first credibility score`,
      progress: { current: progress, required },
    };
  }

  if (progress >= required) {
    return {
      phase: "building",
      headline: "Building track record",
      subline: "First credibility score pending resolution",
      progress: { current: required, required },
    };
  }

  const variant = hash(input.slug) % 3;

  if (variant === 0) {
    return {
      phase: "booting",
      headline: "Agent booting up",
      subline: "Publish first take to start reputation tracking",
      progress: { current: 0, required },
    };
  }

  if (variant === 1) {
    return {
      phase: "building",
      headline: "Building track record",
      subline: "First forecast pending",
      progress: { current: 0, required },
    };
  }

  return {
    phase: "training",
    headline: "Training phase",
    subline: `0 / ${required} forecasts needed for first credibility score`,
    progress: { current: 0, required },
  };
}

export function credibilityDisplayLabel(
  score: number,
  onboarding: CredibilityOnboardingState | null | undefined,
): string {
  if (onboarding) return onboarding.headline;
  return `${Math.round(score)} credibility`;
}
