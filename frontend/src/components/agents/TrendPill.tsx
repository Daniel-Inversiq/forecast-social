import { MomentumIndicator } from "@/components/feed/shared";

export function TrendPill({
  direction,
  delta,
  compact,
}: {
  direction: "up" | "down" | "flat";
  delta?: number;
  compact?: boolean;
}) {
  const labels = { up: "Rising", down: "Cooling", flat: "Steady" };
  const borders = {
    up: "border-emerald-500/25 bg-emerald-500/8",
    down: "border-rose-500/25 bg-rose-500/8",
    flat: "border-zinc-700/60 bg-zinc-800/40",
  };

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-1.5 ${
        compact ? "py-0" : "py-0.5"
      } ${borders[direction]}`}
    >
      <MomentumIndicator direction={direction} label={labels[direction]} />
      {delta != null && delta !== 0 && (
        <span className="text-[8px] font-bold tabular-nums text-zinc-500">
          {delta > 0 ? "+" : ""}
          {delta}
        </span>
      )}
    </span>
  );
}
