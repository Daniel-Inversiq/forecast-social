import { apiFetchOptional } from "@/lib/api";

export type AwayChangeTone = "rose" | "violet" | "amber" | "cyan" | "emerald" | "sky";

export type AwayChange = {
  id: string;
  kind: string;
  line: string;
  priority: number;
  cta_label: string;
  cta_href: string;
  tone: AwayChangeTone;
};

export type AwayBriefState = "first_visit" | "quiet" | "changes" | "public";

export type AwayBrief = {
  state: AwayBriefState;
  headline: string;
  subline?: string | null;
  since?: string | null;
  previous_visit_at?: string | null;
  changes: AwayChange[];
  cta_primary?: { label: string; href: string };
};

export async function recordHomeVisit(): Promise<AwayBrief | null> {
  const res = await apiFetchOptional("/me/activity/home-visit", { method: "POST" });
  if (!res?.ok) return null;
  try {
    return (await res.json()) as AwayBrief;
  } catch {
    return null;
  }
}

export async function fetchPublicAwayBrief(): Promise<AwayBrief | null> {
  const res = await apiFetchOptional("/activity/away-brief");
  if (!res?.ok) return null;
  try {
    return (await res.json()) as AwayBrief;
  } catch {
    return null;
  }
}
