import { apiFetch } from "@/lib/api";

export async function fetchFollowStatus(slug: string): Promise<boolean> {
  const response = await apiFetch(`/agents/${slug}/follow-status`, {}, true);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data = await response.json();
  return Boolean(data.following);
}

export async function followAgent(slug: string): Promise<void> {
  const response = await apiFetch(`/agents/${slug}/follow`, { method: "POST" });
  if (response.status === 401) {
    throw new Error("AUTH_REQUIRED");
  }
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
}

export async function unfollowAgent(slug: string): Promise<void> {
  const response = await apiFetch(`/agents/${slug}/unfollow`, { method: "POST" });
  if (response.status === 401) {
    throw new Error("AUTH_REQUIRED");
  }
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
}
