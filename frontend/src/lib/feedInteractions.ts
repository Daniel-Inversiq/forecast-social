import { apiFetch } from "@/lib/api";

export type FeedInteractionType = "back" | "challenge";
export type FeedInteractionSide = "yes" | "no";

export type FeedInteractionUser = {
  id: number;
  username: string;
  avatar_color?: string | null;
  reputation_score?: number | null;
  wallet_verified?: boolean | null;
};

export type FeedInteractionRecord = {
  id: number;
  feed_event_id: number;
  interaction_type: FeedInteractionType;
  thesis_text?: string | null;
  user_probability?: number | null;
  side?: FeedInteractionSide | null;
  status: string;
  created_at?: string | null;
  updated_at?: string | null;
  user: FeedInteractionUser;
};

export type FeedInteractionSummary = {
  counts: { backs: number; challenges: number };
  avg_back_probability?: number | null;
  avg_challenge_probability?: number | null;
  user_interaction?: FeedInteractionRecord | null;
  top_challenge?: FeedInteractionRecord | null;
  top_back?: FeedInteractionRecord | null;
};

export type FeedInteractionPayload = {
  interaction_type: FeedInteractionType;
  thesis_text?: string;
  user_probability?: number;
  side?: FeedInteractionSide;
};

export class FeedInteractionAuthError extends Error {
  constructor() {
    super("AUTH_REQUIRED");
    this.name = "FeedInteractionAuthError";
  }
}

export async function postFeedInteraction(
  eventId: number,
  payload: FeedInteractionPayload,
): Promise<FeedInteractionRecord> {
  const res = await apiFetch(`/feed/events/${eventId}/interactions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (res.status === 401) throw new FeedInteractionAuthError();
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { detail?: string }).detail ?? `HTTP ${res.status}`);
  }
  return res.json();
}

export async function patchFeedInteraction(
  interactionId: number,
  payload: Partial<FeedInteractionPayload>,
): Promise<FeedInteractionRecord> {
  const res = await apiFetch(`/feed/interactions/${interactionId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (res.status === 401) throw new FeedInteractionAuthError();
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function removeFeedInteraction(interactionId: number): Promise<void> {
  const res = await apiFetch(`/feed/interactions/${interactionId}`, { method: "DELETE" });
  if (res.status === 401) throw new FeedInteractionAuthError();
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}

export async function fetchFeedEventInteractions(
  eventId: number,
): Promise<FeedInteractionSummary & { backs: FeedInteractionRecord[]; challenges: FeedInteractionRecord[] }> {
  const res = await apiFetch(`/feed/events/${eventId}/interactions`, {}, true);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
