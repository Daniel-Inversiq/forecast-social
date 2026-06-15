import { formatRelativeTime } from "./relativeTime";
import type { FeedEvent } from "@/components/feed/feedMix";

/** Primary feed liveness — when Scry published the reaction. */
export function feedDisplayTimestamp(event: FeedEvent): string {
  return event.feed_published_at ?? event.created_at;
}

export function feedSecondaryTimingLabel(event: FeedEvent): string | null {
  const source = event.source_event_time;
  const detected = event.candidate_detected_at;
  const sourceName = event.source_name?.trim();

  if (source) {
    const ago = formatRelativeTime(source, false);
    if (sourceName) {
      return `${sourceName} reported ${ago}`;
    }
    return `Source reported ${ago}`;
  }
  if (detected) {
    return `Source surfaced ${formatRelativeTime(detected, false)}`;
  }
  return null;
}
