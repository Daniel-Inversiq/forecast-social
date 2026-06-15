"use client";

export function AgreementMeter({
  agree,
  disagree,
  label,
  compact = false,
}: {
  agree: number;
  disagree?: number;
  label?: string;
  compact?: boolean;
}) {
  const dis = disagree ?? 100 - agree;

  return (
    <div className={compact ? "space-y-0.5" : "space-y-1"}>
      {label && (
        <div className="flex items-center justify-between text-[8px] text-zinc-600">
          <span>{label}</span>
          <span className="tabular-nums text-emerald-400/90">{agree}%</span>
        </div>
      )}
      <div className={`flex ${compact ? "h-1" : "h-1.5"} rounded-full overflow-hidden bg-zinc-800/90`}>
        <div
          className="h-full bg-gradient-to-r from-emerald-500/80 to-emerald-400/60 transition-all duration-500"
          style={{ width: `${agree}%` }}
        />
        <div
          className="h-full bg-gradient-to-l from-rose-500/70 to-rose-400/50 transition-all duration-500"
          style={{ width: `${dis}%` }}
        />
      </div>
      {!compact && (
        <div className="flex justify-between text-[8px] text-zinc-600">
          <span>Agree</span>
          <span>Disagree</span>
        </div>
      )}
    </div>
  );
}
