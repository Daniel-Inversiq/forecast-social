import { resolveFeedActionLabel } from "@/lib/feedActionStates";
import type { FeedEvent } from "./feedMix";
import type { FeedInteractionSummary } from "@/lib/feedInteractions";

export type OpenLoopChip = {
  id: string;
  label: string;
  className: string;
  priority: number;
};

const OPEN_LOOP_CLASS =
  "text-amber-200/95 bg-amber-500/14 border-amber-500/35 font-medium";
const RISK_CLASS = "text-rose-200/90 bg-rose-500/12 border-rose-500/30 font-medium";
const CHALLENGE_CLASS = "text-violet-200/90 bg-violet-500/12 border-violet-500/28 font-medium";

export function deriveResolutionOpenLoop(event: FeedEvent): string | null {
  if (event.resolution_open_loop) return event.resolution_open_loop;
  if (event.resolution_horizon_bucket === "tonight") return "Resolution tonight";
  if (event.resolution_horizon_bucket === "soon") return "Resolving soon";
  if (event.horizon_label?.toLowerCase().includes("tonight")) return "Resolution tonight";
  return null;
}

export function collectOpenLoopChips(
  event: FeedEvent,
  interactions?: FeedInteractionSummary,
): OpenLoopChip[] {
  const chips: OpenLoopChip[] = [];

  const resolution = deriveResolutionOpenLoop(event);
  if (resolution) {
    chips.push({
      id: "resolution-loop",
      label: resolution,
      className: OPEN_LOOP_CLASS,
      priority: 0,
    });
  }

  const challenges = interactions?.counts.challenges ?? 0;
  if (challenges >= 3) {
    chips.push({
      id: "challenge-hot",
      label: "Challenge gaining support",
      className: CHALLENGE_CLASS,
      priority: 1,
    });
  } else if (challenges >= 1 && event.type !== "rivalry") {
    chips.push({
      id: "challenge-active",
      label: resolveFeedActionLabel(event),
      className: CHALLENGE_CLASS,
      priority: 4,
    });
  }

  if (event.credibility_split?.consensus_breaking) {
    chips.push({
      id: "consensus-fracture",
      label: "Consensus fracturing",
      className: OPEN_LOOP_CLASS,
      priority: 2,
    });
  }

  if ((event.disagreement_spread ?? 0) >= 28 && !event.credibility_split?.consensus_breaking) {
    chips.push({
      id: "consensus-split",
      label: "Consensus split widening",
      className: OPEN_LOOP_CLASS,
      priority: 3,
    });
  }

  if (event.personalization_reason?.toLowerCase().includes("position")) {
    const isolated =
      event.memory_labels?.some((l) => /isolat/i.test(l)) ||
      (event.movement_delta != null &&
        event.movement_delta !== 0 &&
        event.personalization_reason.toLowerCase().includes("against"));
    chips.push({
      id: "your-position",
      label: isolated ? "Your position is now isolated" : "Touches your position",
      className: isolated ? RISK_CLASS : CHALLENGE_CLASS,
      priority: 0,
    });
  }

  if (event.market_narrative_state === "fragmenting" || event.market_narrative_state === "panic repricing") {
    chips.push({
      id: "narrative-pressure",
      label: "Position risk elevated",
      className: RISK_CLASS,
      priority: 2,
    });
  }

  return chips;
}
