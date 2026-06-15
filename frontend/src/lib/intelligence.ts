import type { AuthUser } from "@/lib/auth";
import { apiFetch } from "@/lib/api";

export type IntelligenceTier = "free" | "intelligence_access";

export type IntelligenceAccessResponse = {
  tier: IntelligenceTier | string;
  has_access: boolean;
  entitlement_key: string;
  renewal_state: string;
  current_period_end: string | null;
  billing_preview: {
    provider: string;
    mode: string;
    monthly: string;
    yearly: string;
    yearly_savings_note: string;
  };
  future_surfaces: string[];
};

export const INTELLIGENCE_NAME = "Scry Intelligence";

export function hasIntelligenceAccess(user: AuthUser | null): boolean {
  return user?.intelligence_tier === "intelligence_access";
}

/** Dev-only: set Intelligence Access tier for the signed-in user (or any email). */
export async function setDevIntelligenceTier(
  email: string,
  tier: IntelligenceTier,
): Promise<boolean> {
  try {
    const res = await apiFetch(
      `/admin/users/${encodeURIComponent(email)}/intelligence-tier`,
      { method: "POST", body: JSON.stringify({ tier }) },
      true,
    );
    return res.ok;
  } catch {
    return false;
  }
}

/** Server entitlement snapshot — complements auth user tier when refreshed. */
export async function fetchIntelligenceAccess(): Promise<IntelligenceAccessResponse | null> {
  try {
    const res = await apiFetch("/intelligence/access", {}, true);
    if (!res.ok) return null;
    return (await res.json()) as IntelligenceAccessResponse;
  } catch {
    return null;
  }
}

export const INTELLIGENCE_CORE_SURFACES = [
  "Advanced signal resolution",
  "Hidden consensus detection",
  "Coalition mapping",
  "Narrative pressure analytics",
  "Timing edge breakdowns",
  "Reputation flow analysis",
];
