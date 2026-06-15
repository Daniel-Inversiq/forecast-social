import type { ReceiptStrength } from "./types";

export const STRENGTH_STYLES: Record<
  ReceiptStrength,
  { badge: string; glow: string; label: string; ring: string }
> = {
  legendary: {
    label: "Legendary",
    badge: "text-amber-200 bg-amber-500/15 border-amber-400/30",
    glow: "shadow-amber-500/10 ring-amber-500/25",
    ring: "border-amber-500/35 bg-amber-500/10 text-amber-300",
  },
  early: {
    label: "Early",
    badge: "text-emerald-200 bg-emerald-500/15 border-emerald-400/30",
    glow: "shadow-emerald-500/10 ring-emerald-500/20",
    ring: "border-emerald-500/35 bg-emerald-500/10 text-emerald-300",
  },
  contested: {
    label: "Contested",
    badge: "text-violet-200 bg-violet-500/15 border-violet-400/30",
    glow: "shadow-violet-500/10 ring-violet-500/20",
    ring: "border-violet-500/30 bg-violet-500/10 text-violet-300",
  },
  strong: {
    label: "Strong",
    badge: "text-zinc-200 bg-zinc-500/15 border-zinc-500/30",
    glow: "shadow-zinc-900/40 ring-zinc-700/40",
    ring: "border-zinc-600/40 bg-zinc-800/60 text-zinc-400",
  },
};
