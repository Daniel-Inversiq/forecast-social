export function NarrativeChip({
  label,
  compact = false,
  tone = "sky",
}: {
  label: string;
  compact?: boolean;
  tone?: "sky" | "violet" | "amber" | "emerald";
}) {
  const tones: Record<string, string> = {
    sky: "text-sky-300/90 bg-sky-500/8 border-sky-500/20",
    violet: "text-violet-300/90 bg-violet-500/8 border-violet-500/20",
    amber: "text-amber-300/90 bg-amber-500/8 border-amber-500/20",
    emerald: "text-emerald-300/90 bg-emerald-500/8 border-emerald-500/20",
  };

  return (
    <span
      className={`inline-flex max-w-full items-center border rounded-full truncate ${
        compact ? "text-[8px] px-1.5 py-0" : "text-[9px] px-2 py-0.5"
      } ${tones[tone] ?? tones.sky}`}
      title={label}
    >
      {label}
    </span>
  );
}
