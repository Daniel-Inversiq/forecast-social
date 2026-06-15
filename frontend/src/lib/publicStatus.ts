export type PublicStatusVisibility = {
  feed_exposure_label?: string;
  interaction_backs?: number;
  interaction_challenges?: number;
  thread_activity?: number;
  opposite_reads?: number;
};

export type PublicStatusMomentPayload = {
  id: number;
  status_type: string;
  label: string;
  headline: string;
  body?: string | null;
  username?: string | null;
  avatar_color?: string | null;
  market_title?: string | null;
  market_slug?: string | null;
  receipt_href?: string | null;
  visibility?: PublicStatusVisibility;
  days_early?: number | null;
  source_type?: string;
  source_id?: number;
  created_at?: string;
  validated_at?: string | null;
};

export type PublicStatusProfileBlock = {
  moments: PublicStatusMomentPayload[];
  early_calls: PublicStatusMomentPayload[];
  successful_challenges: PublicStatusMomentPayload[];
  most_visible_read: PublicStatusMomentPayload | null;
  best_resolved_conviction: PublicStatusMomentPayload | null;
  public_streak: { count: number; label: string } | null;
};

export const STATUS_LABEL_STYLES: Record<string, string> = {
  Early: "text-sky-200/90 bg-sky-500/10 border-sky-500/20",
  "Consensus breaker": "text-violet-200/90 bg-violet-500/10 border-violet-500/20",
  "Public read": "text-zinc-200/85 bg-zinc-500/10 border-zinc-500/18",
  "Called it": "text-emerald-200/90 bg-emerald-500/10 border-emerald-500/20",
  "Isolated but right": "text-amber-200/90 bg-amber-500/10 border-amber-500/20",
  "Challenge validated": "text-rose-200/85 bg-rose-500/10 border-rose-500/18",
  "High conviction": "text-emerald-200/85 bg-emerald-950/30 border-emerald-500/22",
};

export function visibilityCopy(v?: PublicStatusVisibility): string | null {
  if (!v) return null;
  const parts: string[] = [];
  if (v.interaction_backs != null && v.interaction_backs > 0) {
    parts.push(`${v.interaction_backs} backed`);
  }
  if (v.interaction_challenges != null && v.interaction_challenges > 0) {
    parts.push(`${v.interaction_challenges} challenged`);
  }
  if (v.thread_activity != null && v.thread_activity > 1) {
    parts.push(`${v.thread_activity} thread posts`);
  }
  if (v.opposite_reads != null && v.opposite_reads > 0) {
    parts.push(`${v.opposite_reads} responded`);
  }
  if (parts.length) return parts.join(" · ");
  return v.feed_exposure_label ?? null;
}
