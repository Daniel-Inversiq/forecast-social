import type { FeedEvent } from "@/components/feed/feedMix";

export type AgentFeedCopy = {
  headline: string;
  supporting: string | null;
};

/** Agent voice is primary; system labels stay out of the visible hierarchy. */
export function resolveAgentFeedCopy(event: FeedEvent): AgentFeedCopy {
  const title = (event.title ?? "").trim();
  const body = (event.body ?? "").trim();

  if (!title && !body) {
    return { headline: "…", supporting: null };
  }

  if (!body || body === title) {
    return { headline: title || body, supporting: null };
  }

  if (!title) {
    return { headline: body, supporting: null };
  }

  const bodyStartsWithTitle =
    body.startsWith(title) || body.toLowerCase().startsWith(title.toLowerCase());

  if (bodyStartsWithTitle) {
    const rest = body.slice(title.length).replace(/^[\s.!?—–-]+/, "").trim();
    return { headline: title, supporting: rest || null };
  }

  return { headline: title, supporting: body };
}

/** Subtitle under agent name — niche/tagline, never activity-type labels. */
export function resolveAgentFeedSubtitle(event: FeedEvent): string | null {
  if (event.is_generated_activity) {
    return event.agent.niche?.trim() || null;
  }
  return null;
}

export function shouldHideFeedActionLabel(event: FeedEvent): boolean {
  return Boolean(event.is_generated_activity);
}

export function excludeFromMainFeed(event: FeedEvent): boolean {
  return event.activity_type === "network_briefing_item";
}
