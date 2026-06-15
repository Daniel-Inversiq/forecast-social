"use client";

import { useEffect, type ReactNode } from "react";
import { getConvictionLevel, formatConvictionLine } from "./publicReadEnrichment";
import type { PublicReadSide } from "./types";

export function ReadModalShell({
  open,
  onClose,
  title,
  subtitle,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="relative w-full sm:max-w-lg max-h-[92dvh] overflow-y-auto overscroll-contain rounded-t-xl sm:rounded-xl border border-zinc-800 bg-zinc-950 shadow-2xl shadow-violet-950/30 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="sticky top-0 z-10 px-4 py-3 border-b border-zinc-800/90 bg-zinc-950/95 backdrop-blur-md">
          <h2 className="text-sm font-semibold text-white">{title}</h2>
          {subtitle && <p className="text-[11px] text-zinc-500 mt-0.5">{subtitle}</p>}
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

/** @deprecated Use ConvictionField for publish flows */
export function ProbabilityField({
  value,
  onChange,
  label,
  required,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  required?: boolean;
}) {
  return (
    <ConvictionField
      value={value}
      onChange={onChange}
      side="YES"
      label={label}
      required={required}
      showSideInSummary={false}
    />
  );
}

export function ConvictionField({
  value,
  onChange,
  side,
  label = "Conviction",
  required,
  showSideInSummary = true,
}: {
  value: string;
  onChange: (v: string) => void;
  side: PublicReadSide;
  label?: string;
  required?: boolean;
  showSideInSummary?: boolean;
}) {
  const prob = Number(value);
  const conviction = Number.isFinite(prob) ? getConvictionLevel(prob) : null;
  const summary =
    showSideInSummary && value && prob >= 1 && prob <= 99
      ? formatConvictionLine(prob, side)
      : value
        ? `${value}%`
        : "—";

  return (
    <div className="block">
      <span className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</span>
      <div className="mt-1 flex items-center gap-2">
        <input
          type="number"
          min={1}
          max={99}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          className="scry-tap-target flex-1 min-h-[44px] rounded-lg border border-zinc-700/80 bg-zinc-900/80 px-3 py-2 text-sm text-zinc-100 tabular-nums focus:outline-none focus:border-violet-500/50"
        />
        <span
          className={`shrink-0 text-sm font-bold tabular-nums ${
            side === "YES" ? "text-emerald-300" : "text-rose-300"
          }`}
        >
          {summary}
        </span>
      </div>
      {conviction && (
        <p className={`mt-1.5 text-xs font-medium ${conviction.toneClass}`}>{conviction.label}</p>
      )}
      {prob >= 1 && prob < 51 && (
        <p className="mt-1.5 text-[10px] text-zinc-600">Conviction labels apply at 51% and above.</p>
      )}
    </div>
  );
}

export const READ_CATEGORIES = [
  "Macro",
  "AI",
  "Crypto",
  "Politics",
  "Sports",
  "Markets",
  "Climate",
  "Culture",
] as const;
