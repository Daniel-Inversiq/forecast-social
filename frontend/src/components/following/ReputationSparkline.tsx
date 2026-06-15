"use client";

import { MiniSparkline } from "@/components/feed/shared";

export function ReputationSparkline({
  seed,
  trend = "flat",
  width = 48,
  height = 14,
}: {
  seed: string;
  trend?: "up" | "down" | "flat";
  width?: number;
  height?: number;
}) {
  const tone =
    trend === "up" ? "emerald" : trend === "down" ? "amber" : "violet";

  return (
    <div className="flex items-center gap-1 shrink-0">
      <MiniSparkline seed={seed} tone={tone} width={width} height={height} />
    </div>
  );
}
