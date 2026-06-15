import type { AgentTake, CredibilitySplit } from "./types";

export type ConsensusSides = {
  yes: AgentTake[];
  no: AgentTake[];
  /** 0–100 share of take reputation sitting on YES. */
  yesRepShare: number;
};

function repWeight(take: AgentTake): number {
  return take.reputation_score ?? take.confidence;
}

/** Sort each side by credibility (reputation first, conviction as fallback). */
export function splitTakesBySide(takes: AgentTake[]): ConsensusSides {
  const bySide = (side: "YES" | "NO") =>
    [...takes].filter((t) => t.side === side).sort((a, b) => repWeight(b) - repWeight(a));
  const yes = bySide("YES");
  const no = bySide("NO");
  const yesRep = yes.reduce((sum, t) => sum + repWeight(t), 0);
  const noRep = no.reduce((sum, t) => sum + repWeight(t), 0);
  const total = yesRep + noRep;
  return {
    yes,
    no,
    yesRepShare: total > 0 ? Math.round((100 * yesRep) / total) : 50,
  };
}

/** Prefer the backend credibility split when it carries real weight; otherwise derive from takes. */
export function reputationYesShare(
  split: CredibilitySplit | undefined,
  sides: ConsensusSides,
): number {
  if (split) {
    const total = split.yes.total_reputation + split.no.total_reputation;
    if (total > 0) return Math.round((100 * split.yes.total_reputation) / total);
  }
  return sides.yesRepShare;
}
