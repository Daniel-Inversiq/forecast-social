import type { ActivityItem } from "./types";

export type MarketActivityKind = "receipt" | "battle" | "take" | "shift";

export const ACTIVITY_KIND_META: Record<
  MarketActivityKind,
  { label: string; cls: string; dot: string }
> = {
  receipt: {
    label: "Receipt",
    cls: "text-emerald-300 border-emerald-500/25 bg-emerald-500/10",
    dot: "bg-emerald-400",
  },
  battle: {
    label: "Battle",
    cls: "text-rose-300 border-rose-500/25 bg-rose-500/10",
    dot: "bg-rose-400",
  },
  take: {
    label: "Take",
    cls: "text-violet-300 border-violet-500/25 bg-violet-500/10",
    dot: "bg-violet-400",
  },
  shift: {
    label: "Shift",
    cls: "text-sky-300 border-sky-500/25 bg-sky-500/10",
    dot: "bg-sky-400",
  },
};

export function activityKind(item: ActivityItem): MarketActivityKind {
  if (item.type === "receipt" || item.type === "verified_call") return "receipt";
  if (item.type === "rivalry" || item.type === "battle_escalation") return "battle";
  if (item.type === "confidence_shift" || item.type === "consensus_shift") return "shift";
  return "take";
}

/** Newest-first activity, capped. */
export function sortActivity(activity: ActivityItem[], limit = 12): ActivityItem[] {
  return [...activity]
    .sort((a, b) => Date.parse(b.created_at ?? "") - Date.parse(a.created_at ?? ""))
    .slice(0, limit);
}
