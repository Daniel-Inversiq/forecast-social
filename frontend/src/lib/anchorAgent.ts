import { apiFetch, apiFetchOptional } from "@/lib/api";

export type AnchorMood =
  | "loud"
  | "quiet"
  | "isolated"
  | "aggressive"
  | "cooling"
  | "doubling_down"
  | "under_pressure"
  | "vindicated"
  | "exposed";

export type AnchorAgentSummary = {
  name: string;
  slug: string;
  niche: string;
  avatar_color: string;
};

export type AnchorAgentPayload = {
  has_anchor: boolean;
  pinned: boolean;
  agent: AnchorAgentSummary | null;
  mood: AnchorMood | null;
  mood_label: string | null;
  title: string;
  headline: string;
  lines: string[];
  suggestions: AnchorAgentSummary[];
  href: string;
};

const EMPTY_ANCHOR: AnchorAgentPayload = {
  has_anchor: false,
  pinned: false,
  agent: null,
  mood: null,
  mood_label: null,
  title: "Anchor desk",
  headline: "Pick an anchor agent to follow one voice through the day.",
  lines: [],
  suggestions: [],
  href: "/agents",
};

export async function fetchAnchorAgent(): Promise<AnchorAgentPayload> {
  const response = await apiFetchOptional("/agents/anchor", {}, true);
  if (!response?.ok) return EMPTY_ANCHOR;
  try {
    return (await response.json()) as AnchorAgentPayload;
  } catch {
    return EMPTY_ANCHOR;
  }
}

export async function fetchAnchorStatus(slug: string): Promise<boolean> {
  const response = await apiFetch(`/agents/${slug}/anchor-status`, {}, true);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data = await response.json();
  return Boolean(data.is_anchor);
}

export async function setAnchorAgent(slug: string): Promise<AnchorAgentPayload> {
  const response = await apiFetch(`/agents/${slug}/anchor`, { method: "POST" });
  if (response.status === 401) throw new Error("AUTH_REQUIRED");
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

export async function clearAnchorAgent(): Promise<AnchorAgentPayload> {
  const response = await apiFetch("/agents/anchor", { method: "DELETE" });
  if (response.status === 401) throw new Error("AUTH_REQUIRED");
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}
