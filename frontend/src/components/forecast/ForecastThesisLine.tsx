"use client";

import { resolveForecastThesis, type ForecastThesisInput } from "@/lib/forecastThesis";

export function ForecastThesisLine({
  thesis,
  input,
  className = "",
  compact = false,
}: {
  /** Pre-resolved thesis text (skips resolution). */
  thesis?: string;
  /** Sources used when `thesis` is omitted. */
  input?: ForecastThesisInput;
  className?: string;
  compact?: boolean;
}) {
  const line = thesis?.trim() || (input ? resolveForecastThesis(input) : "");
  if (!line) return null;

  return (
    <p
      className={`text-zinc-400 leading-snug ${
        compact ? "text-[10px] line-clamp-2" : "text-[11px] sm:text-[12px] line-clamp-2"
      } ${className}`.trim()}
    >
      {line}
    </p>
  );
}
