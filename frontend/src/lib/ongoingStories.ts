import { apiFetch, apiFetchOptional } from "@/lib/api";

export type OngoingStoryAgent = {
  name: string;
  slug: string;
  niche: string;
  avatar_color: string;
};

export type OngoingStory = {
  story_key: string;
  story_type: "rivalry" | "arc" | "market";
  title: string;
  headline: string;
  score_line: string | null;
  recent_change: string | null;
  unresolved_line: string | null;
  why_today: string | null;
  resolution_line: string | null;
  agents: OngoingStoryAgent[];
  market_slug: string | null;
  market_title: string | null;
  arc_stage: string | null;
  battle_strength: string | null;
  is_live: boolean;
  href: string;
  watched: boolean;
  action_state?: string | null;
  action_state_label?: string | null;
};

export type ResolvedStory = {
  story_key: string;
  story_type: string;
  title: string;
  closure_headline: string;
  winner_line: string;
  receipt_line: string;
  reputation_line: string;
  href: string;
  resolved_at: string;
};

export type OngoingStoriesPayload = {
  stories: OngoingStory[];
  resolved: ResolvedStory[];
  active_story_keys: string[];
};

export async function fetchOngoingStories(limit = 3): Promise<OngoingStoriesPayload | null> {
  const res = await apiFetchOptional(`/feed/ongoing-stories?limit=${limit}`);
  if (!res?.ok) return null;
  try {
    return (await res.json()) as OngoingStoriesPayload;
  } catch {
    return null;
  }
}

export async function watchStory(storyKey: string, storyType: string): Promise<boolean> {
  const res = await apiFetch(`/feed/stories/${encodeURIComponent(storyKey)}/watch?story_type=${storyType}`, {
    method: "POST",
  });
  return res.ok;
}

export async function unwatchStory(storyKey: string): Promise<boolean> {
  const res = await apiFetch(`/feed/stories/${encodeURIComponent(storyKey)}/watch`, {
    method: "DELETE",
  });
  return res.ok;
}

export async function archiveResolvedStory(storyKey: string): Promise<boolean> {
  const res = await apiFetch(`/feed/stories/${encodeURIComponent(storyKey)}/archive`, {
    method: "POST",
  });
  return res.ok;
}

/** Local fallback when user is not signed in — stores watch intent for future sync. */
const LOCAL_WATCH_KEY = "scry-story-watches";

export function getLocalStoryWatches(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LOCAL_WATCH_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function setLocalStoryWatch(storyKey: string, watched: boolean): void {
  if (typeof window === "undefined") return;
  const current = new Set(getLocalStoryWatches());
  if (watched) current.add(storyKey);
  else current.delete(storyKey);
  localStorage.setItem(LOCAL_WATCH_KEY, JSON.stringify([...current]));
}

export function isLocallyWatched(storyKey: string): boolean {
  return getLocalStoryWatches().includes(storyKey);
}
