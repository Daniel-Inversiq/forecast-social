import type { FeedInteractionRecord, FeedInteractionSummary } from "@/lib/feedInteractions";

export function mergeInteractionAfterSubmit(
  prev: FeedInteractionSummary | undefined,
  record: FeedInteractionRecord,
): FeedInteractionSummary {
  const base: FeedInteractionSummary = prev ?? {
    counts: { backs: 0, challenges: 0 },
    avg_back_probability: null,
    avg_challenge_probability: null,
    user_interaction: null,
    top_challenge: null,
    top_back: null,
  };

  const was = base.user_interaction;
  const counts = { ...base.counts };

  if (was?.interaction_type === "back") counts.backs = Math.max(0, counts.backs - 1);
  if (was?.interaction_type === "challenge") {
    counts.challenges = Math.max(0, counts.challenges - 1);
  }
  if (record.interaction_type === "back") counts.backs += 1;
  else counts.challenges += 1;

  const next: FeedInteractionSummary = {
    ...base,
    counts,
    user_interaction: record,
  };

  if (record.interaction_type === "challenge") {
    next.top_challenge = record;
  } else {
    next.top_back = record;
  }

  if (record.user_probability != null) {
    if (record.interaction_type === "back") {
      next.avg_back_probability = record.user_probability;
    } else {
      next.avg_challenge_probability = record.user_probability;
    }
  }

  return next;
}
