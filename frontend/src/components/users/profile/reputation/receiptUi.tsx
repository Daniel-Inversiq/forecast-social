import { formatTimeAgo } from "@/components/feed/shared";
import type { ScryReceipt, ScryReceiptOutcome } from "./types";

export function outcomeIcon(outcome: ScryReceiptOutcome): string {
  if (outcome === "correct") return "✓";
  if (outcome === "missed") return "✕";
  return "◷";
}

export function outcomeLabel(outcome: ScryReceiptOutcome): string {
  if (outcome === "correct") return "Correct";
  if (outcome === "missed") return "Missed";
  return "Pending";
}

export function outcomeTone(outcome: ScryReceiptOutcome): {
  icon: string;
  border: string;
  text: string;
} {
  if (outcome === "correct") {
    return {
      icon: "text-emerald-400",
      border: "border-emerald-500/25 hover:border-emerald-500/40",
      text: "text-emerald-300/90",
    };
  }
  if (outcome === "missed") {
    return {
      icon: "text-rose-400",
      border: "border-rose-500/25 hover:border-rose-500/40",
      text: "text-rose-300/90",
    };
  }
  return {
    icon: "text-amber-400",
    border: "border-amber-500/25 hover:border-amber-500/35",
    text: "text-amber-300/90",
  };
}

export function formatReceiptTiming(calledAt: string, resolvedAt: string | null): string {
  const called = formatTimeAgo(calledAt);
  if (!resolvedAt) return `Called ${called}`;
  const resolved = formatTimeAgo(resolvedAt);
  return `Called ${called} · Resolved ${resolved}`;
}

export function credibilityLabel(delta: number): string {
  if (delta === 0) return "Pending";
  const sign = delta > 0 ? "+" : "";
  return `${sign}${delta}`;
}

export function shortTitle(title: string, max = 48): string {
  if (title.length <= max) return title;
  return `${title.slice(0, max - 1)}…`;
}
