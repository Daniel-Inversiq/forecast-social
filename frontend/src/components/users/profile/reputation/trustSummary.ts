import type { EnrichedUserProfile } from "@/components/users/profile/types";
import { getResolvedReceipts } from "./receiptData";
import type { ScryReceipt } from "./types";
import { buildRankProgress } from "./rankProgress";
import { computeCredibilitySnapshot } from "@/lib/credibility";

export function buildProfileTrustSummary(
  profile: EnrichedUserProfile,
  receipts: ScryReceipt[],
): string {
  const name = profile.name;
  const rank = buildRankProgress(profile, receipts);
  const resolved = getResolvedReceipts(receipts);
  const { forecastRecord, current, lifetimeEarned } = computeCredibilitySnapshot(receipts);
  const correct = forecastRecord.correct;
  const earned = lifetimeEarned;
  const timing = Math.round(profile.timing_quality);

  if (resolved.length === 0) {
    const rankWord = rank.currentLabel.toLowerCase();
    const niche = profile.specialty_label?.toLowerCase() ?? profile.niche?.toLowerCase() ?? "forecasting";
    return `${name} is an ${rankWord} ${niche} forecaster with ${timing}% early-call timing and 0 resolved calls on record so far.`;
  }

  const macroHint =
    profile.category_tags.some((t) => /macro|fed|policy/i.test(t)) || /macro/i.test(profile.niche)
      ? " from macro timing calls"
      : "";

  const credibilityPhrase =
    earned > current
      ? `${current} credibility (${earned} lifetime earned)`
      : `${current} credibility`;
  return `${name} has ${resolved.length} resolved call${resolved.length === 1 ? "" : "s"}, ${correct} correct, and ${credibilityPhrase} on record${macroHint}.`;
}
