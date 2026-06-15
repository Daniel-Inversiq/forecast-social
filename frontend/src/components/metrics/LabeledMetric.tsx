"use client";

/** Value-first metric cell — users should never guess what a number means. */
export function LabeledMetric({
  value,
  label,
  accent = "text-white",
  size = "md",
  hint,
  className = "",
}: {
  value: string;
  label: string;
  accent?: string;
  size?: "sm" | "md" | "lg";
  /** Optional tertiary context (e.g. time window) */
  hint?: string;
  className?: string;
}) {
  const valueClass =
    size === "lg"
      ? "text-lg sm:text-xl"
      : size === "sm"
        ? "text-sm"
        : "text-base sm:text-lg";

  return (
    <div className={`text-center min-w-0 ${className}`}>
      <p className={`${valueClass} font-semibold tabular-nums leading-none ${accent}`}>{value}</p>
      <p className="text-[10px] text-zinc-500 leading-snug mt-1">{label}</p>
      {hint ? (
        <p className="text-[9px] text-zinc-600 leading-snug mt-0.5 line-clamp-1">{hint}</p>
      ) : null}
    </div>
  );
}
