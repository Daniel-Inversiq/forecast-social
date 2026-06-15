import { studioAgentPath } from "@/lib/agentStudio";
import {
  FORECASTS_FOR_FIRST_CREDIBILITY,
  resolveCredibilityOnboarding,
} from "@/lib/credibilityOnboarding";

export type CreatorAgentActionKey = "train" | "publish" | "performance" | "earnings";

export type CreatorAgentAction = {
  key: CreatorAgentActionKey;
  label: string;
  href: string;
  hint?: string;
};

export type CreatorAgentActionInput = {
  slug: string;
  reputation_score?: number;
  follower_count?: number;
  verified_calls?: number;
  resolved_calls?: number;
};

const ACTION_STYLE: Record<
  CreatorAgentActionKey,
  string
> = {
  train:
    "border-cyan-500/35 text-cyan-100 bg-cyan-950/25 hover:bg-cyan-900/35",
  publish:
    "border-violet-500/40 text-violet-100 bg-violet-950/40 hover:bg-violet-900/50 shadow-[0_0_18px_-12px_rgba(139,92,246,0.65)]",
  performance:
    "border-zinc-600/70 text-zinc-200 bg-zinc-900/50 hover:bg-zinc-800/60",
  earnings:
    "border-emerald-500/35 text-emerald-100 bg-emerald-950/25 hover:bg-emerald-900/35",
};

export function creatorAgentActionButtonClass(key: CreatorAgentActionKey): string {
  return ACTION_STYLE[key];
}

/** Primary creator CTA — one action that matches where the agent is in its arc. */
export function resolveCreatorAgentAction(
  input: CreatorAgentActionInput,
): CreatorAgentAction {
  const slug = input.slug;
  const score = Math.round(input.reputation_score ?? 0);
  const followers = input.follower_count ?? 0;
  const onboarding = resolveCredibilityOnboarding({
    slug,
    score,
    resolvedCalls: input.resolved_calls,
    verifiedCalls: input.verified_calls,
  });

  if (onboarding) {
    const progress = onboarding.progress?.current ?? 0;

    if (onboarding.phase === "booting") {
      return {
        key: "publish",
        label: "Publish Take",
        href: studioAgentPath(slug, "reads"),
        hint: onboarding.subline,
      };
    }

    if (onboarding.phase === "training" && progress === 0) {
      return {
        key: "train",
        label: "Train Agent",
        href: studioAgentPath(slug, "knowledge"),
        hint: onboarding.subline,
      };
    }

    if (
      onboarding.phase === "building" &&
      onboarding.subline.toLowerCase().includes("pending resolution")
    ) {
      return {
        key: "performance",
        label: "View Performance",
        href: studioAgentPath(slug, "dashboard"),
        hint: onboarding.subline,
      };
    }

    if (onboarding.phase === "training" || onboarding.phase === "building") {
      return {
        key: "publish",
        label: "Publish Take",
        href: studioAgentPath(slug, "reads"),
        hint: onboarding.subline,
      };
    }
  }

  if (score >= 50 && followers >= 5) {
    return {
      key: "earnings",
      label: "Check Earnings",
      href: studioAgentPath(slug, "revenue"),
      hint: "See how this voice is monetizing",
    };
  }

  if (score > 0) {
    return {
      key: "performance",
      label: "View Performance",
      href: studioAgentPath(slug, "dashboard"),
      hint: "Track record, rank, and momentum",
    };
  }

  return {
    key: "publish",
    label: "Publish Take",
    href: studioAgentPath(slug, "reads"),
    hint: `Publish ${FORECASTS_FOR_FIRST_CREDIBILITY} takes to unlock credibility`,
  };
}
