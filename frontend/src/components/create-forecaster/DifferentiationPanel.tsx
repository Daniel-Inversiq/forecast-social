"use client";

import type { DifferentiationResult } from "@/lib/creatorForecaster";
import { differentiationInterpretation } from "@/lib/previewLaunchIntel";

const LEVEL_STYLES: Record<
  DifferentiationResult["level"],
  { border: string; bg: string; badge: string; score: string }
> = {
  distinct: {
    border: "border-emerald-500/35",
    bg: "bg-emerald-950/20",
    badge: "text-emerald-300",
    score: "text-emerald-200",
  },
  some_overlap: {
    border: "border-sky-500/30",
    bg: "bg-sky-950/15",
    badge: "text-sky-300",
    score: "text-sky-200",
  },
  too_close: {
    border: "border-amber-500/40",
    bg: "bg-amber-950/15",
    badge: "text-amber-300",
    score: "text-amber-200",
  },
  clone_risk: {
    border: "border-rose-500/40",
    bg: "bg-rose-950/15",
    badge: "text-rose-300",
    score: "text-rose-200",
  },
};

function levelHeadline(result: DifferentiationResult): string {
  const diff = result.differentiation_score;
  const name = result.closest_match.name;
  switch (result.level) {
    case "distinct":
      return `Distinct: ${diff}/100`;
    case "some_overlap":
      return `Some overlap with ${name}`;
    case "too_close":
      return `Too close to ${name}`;
    case "clone_risk":
      return `Clone risk: too similar to ${name}`;
    default:
      return `Differentiation: ${diff}/100`;
  }
}

export function DifferentiationPanel({
  result,
  loading,
  compact,
  hero,
}: {
  result: DifferentiationResult | null;
  loading?: boolean;
  compact?: boolean;
  hero?: boolean;
}) {
  if (loading) {
    return (
      <p className="text-[13px] text-zinc-500 animate-pulse">Checking differentiation…</p>
    );
  }
  if (!result) return null;

  const style = LEVEL_STYLES[result.level];
  const diff = result.differentiation_score;
  const sim = result.similarity_score;
  const interpretation = differentiationInterpretation(diff);

  if (hero) {
    return (
      <div
        className={`rounded-xl border p-5 sm:p-6 space-y-4 ${style.border} ${style.bg} shadow-lg shadow-black/20`}
      >
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500 mb-2">
              Distinctiveness
            </p>
            <div className="flex items-baseline gap-2">
              <span className={`text-5xl sm:text-6xl font-bold tabular-nums tracking-tight ${style.score}`}>
                {diff}
              </span>
              <span className="text-xl text-zinc-500 font-medium pb-1">/ 100</span>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Similarity</p>
            <p className="text-2xl font-semibold tabular-nums text-zinc-400">
              {sim}
              <span className="text-sm font-normal text-zinc-600"> / 100</span>
            </p>
          </div>
        </div>

        <div className="space-y-1">
          <p className={`text-[13px] font-semibold uppercase tracking-wide ${style.badge}`}>
            {interpretation.label}
          </p>
          <p className="text-[14px] text-zinc-200 leading-relaxed">&ldquo;{interpretation.message}&rdquo;</p>
        </div>

        {result.overlap_reasons.length > 0 && (
          <div>
            <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1.5">Overlap signals</p>
            <ul className="text-[12px] text-zinc-400 space-y-1 list-disc list-inside">
              {result.overlap_reasons.slice(0, 3).map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </div>
        )}

        {result.improvement_suggestions.length > 0 && diff < 75 && (
          <div>
            <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1.5">Sharpen before launch</p>
            <ul className="text-[12px] text-zinc-300/90 space-y-1 list-disc list-inside">
              {result.improvement_suggestions.slice(0, 2).map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          </div>
        )}

        {result.level === "clone_risk" && (
          <p className="text-[12px] text-rose-300/90">
            Publishing is blocked until you edit setup and regenerate preview.
          </p>
        )}
        {result.level === "too_close" && result.can_publish && (
          <p className="text-[12px] text-amber-200/80">
            You can publish with a warning — consider sharpening the niche first.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className={`rounded-xl border p-4 space-y-3 ${style.border} ${style.bg}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className={`text-[14px] font-medium ${style.badge}`}>{levelHeadline(result)}</p>
        <p className="text-[11px] text-zinc-500 tabular-nums">
          Similarity {result.similarity_score}/100
        </p>
      </div>

      <p className="text-[13px] text-zinc-300 leading-relaxed">{result.message}</p>

      {result.overlap_reasons.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1.5">Why</p>
          <ul className="text-[12px] text-zinc-400 space-y-1 list-disc list-inside">
            {result.overlap_reasons.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </div>
      )}

      {result.improvement_suggestions.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1.5">
            {compact ? "Tips" : "Make it more distinct"}
          </p>
          <ul className="text-[12px] text-zinc-300/90 space-y-1 list-disc list-inside">
            {result.improvement_suggestions.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
      )}

      {result.level === "clone_risk" && (
        <p className="text-[12px] text-rose-300/90">
          Publishing is blocked until you edit setup and regenerate preview.
        </p>
      )}
      {result.level === "too_close" && result.can_publish && (
        <p className="text-[12px] text-amber-200/80">
          You can publish with a warning — consider sharpening the niche first.
        </p>
      )}
    </div>
  );
}
