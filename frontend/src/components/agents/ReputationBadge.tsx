import { RankMotion } from "@/components/feed/shared";
import { ReputationTierBadge } from "@/components/reputation/ReputationTierBadge";

export function ReputationBadge({
  score,
  size = "md",
  showLabel = true,
  rankDelta,
  tierKey,
  tierLabel,
}: {
  score: number;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  rankDelta?: number;
  tierKey?: string;
  tierLabel?: string;
}) {
  const sizeClass =
    size === "sm"
      ? "text-sm"
      : size === "lg"
        ? "text-2xl"
        : "text-lg";

  return (
    <div className="text-right shrink-0">
      <div className="flex items-center justify-end gap-1">
        <p
          className={`${sizeClass} font-bold tabular-nums leading-none bg-gradient-to-br from-violet-200 to-violet-400/90 bg-clip-text text-transparent`}
        >
          {score}
        </p>
        {rankDelta != null && rankDelta !== 0 && <RankMotion delta={rankDelta} />}
      </div>
      {showLabel && tierKey && tierLabel ? (
        <div className="mt-1 flex justify-end">
          <ReputationTierBadge tierKey={tierKey} tierLabel={tierLabel} compact />
        </div>
      ) : showLabel ? (
        <p className="text-[8px] uppercase tracking-wider text-zinc-600 mt-0.5">reputation</p>
      ) : null}
    </div>
  );
}
