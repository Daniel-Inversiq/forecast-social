import { apiFetch } from "@/lib/api";
import type { ReputationMark } from "@/lib/reputation";

export async function patchAgentFeaturedMilestones(
  slug: string,
  keys: string[],
): Promise<{
  featured_milestone_keys: string[];
  featured_reputation_marks: ReputationMark[];
}> {
  const res = await apiFetch(`/agents/${encodeURIComponent(slug)}/featured-milestones`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ keys }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      (err as { detail?: { errors?: string[] } }).detail?.errors?.join(", ") ??
        "Failed to update featured marks",
    );
  }
  return res.json();
}

export async function patchUserFeaturedMilestones(
  keys: string[],
): Promise<{
  featured_milestone_keys: string[];
  featured_reputation_marks: ReputationMark[];
}> {
  const res = await apiFetch("/users/me/featured-milestones", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ keys }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      (err as { detail?: { errors?: string[] } }).detail?.errors?.join(", ") ??
        "Failed to update featured marks",
    );
  }
  return res.json();
}
