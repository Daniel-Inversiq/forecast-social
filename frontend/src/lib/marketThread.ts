import { apiFetch } from "@/lib/api";

export type ThreadStance = "yes" | "no" | "neutral";
export type ThreadPostType = "thesis" | "counter-thesis" | "update" | "evidence" | "question";

export type MarketThreadPost = {
  id: number;
  market_id: number;
  body: string;
  stance: ThreadStance;
  user_probability?: number | null;
  post_type: ThreadPostType;
  status: string;
  created_at?: string | null;
  updated_at?: string | null;
  user: {
    id: number;
    username: string;
    avatar_color?: string | null;
    reputation_score?: number | null;
    wallet_verified?: boolean | null;
  };
  market?: { id: number; title: string; status: string };
};

export type MarketThreadResponse = {
  market_id: number;
  archived: boolean;
  resolved_at?: string | null;
  post_count: number;
  can_post: boolean;
  posts: MarketThreadPost[];
  highlights: {
    top_thesis: MarketThreadPost | null;
    top_counter: MarketThreadPost | null;
  };
};

export type ThreadPostPayload = {
  body: string;
  stance?: ThreadStance;
  post_type?: ThreadPostType;
  user_probability?: number;
};

export class MarketThreadAuthError extends Error {
  constructor() {
    super("AUTH_REQUIRED");
    this.name = "MarketThreadAuthError";
  }
}

export async function fetchMarketThread(slug: string): Promise<MarketThreadResponse> {
  const res = await apiFetch(`/markets/${slug}/thread`, {}, true);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function postMarketThread(
  slug: string,
  payload: ThreadPostPayload,
): Promise<MarketThreadPost> {
  const res = await apiFetch(`/markets/${slug}/thread`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (res.status === 401) throw new MarketThreadAuthError();
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { detail?: string }).detail ?? `HTTP ${res.status}`);
  }
  return res.json();
}

export async function removeMarketThreadPost(postId: number): Promise<void> {
  const res = await apiFetch(`/markets/thread/posts/${postId}`, { method: "DELETE" });
  if (res.status === 401) throw new MarketThreadAuthError();
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}
