import { apiFetch } from "./api";
import type { AgentProfile } from "@/components/agents/profile/types";

export type StudioAgentSummary = {
  name: string;
  slug: string;
  niche: string;
  avatar_color: string;
  owner_user_id: number;
  owner_username: string;
  reputation_score?: number;
  follower_count?: number;
  verified_calls?: number;
  resolved_calls?: number;
  tier_label?: string;
  tier_key?: string;
  is_creator?: boolean;
};

export type StudioAgentDetail = AgentProfile & {
  owner_user_id: number;
  owner_username: string;
  can_manage: boolean;
  creator_forecaster_id: number | null;
};

export async function fetchMyStudioAgents(): Promise<StudioAgentSummary[]> {
  const res = await apiFetch("/studio/agents/mine");
  if (!res.ok) throw new Error("Failed to load your agents");
  const data = await res.json();
  return Array.isArray(data) ? (data as StudioAgentSummary[]) : [];
}

export async function fetchStudioAgent(slug: string): Promise<StudioAgentDetail> {
  const res = await apiFetch(`/studio/agents/${encodeURIComponent(slug)}`);
  if (res.status === 403) {
    throw new StudioAccessError("You do not manage this agent");
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      typeof err.detail === "string" ? err.detail : "Failed to load Agent Studio",
    );
  }
  return res.json() as Promise<StudioAgentDetail>;
}

export class StudioAccessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StudioAccessError";
  }
}

export type StudioAgentTab =
  | "dashboard"
  | "reads"
  | "audience"
  | "revenue"
  | "knowledge"
  | "settings";

export function studioAgentPath(slug: string, tab?: StudioAgentTab): string {
  const base = `/studio/agents/${slug}`;
  return tab ? `${base}?tab=${tab}` : base;
}
