import { sparklinePoints } from "@/components/feed/motion";

/** Tiny multi-bar conviction history */
export function MiniConvictionGraph({ seed }: { seed: string }) {
  const pts = sparklinePoints(seed, 10);
  const max = Math.max(...pts, 0.01);

  return (
    <div className="space-y-0.5">
      <p className="text-[8px] uppercase tracking-wider text-zinc-600">Conviction curve</p>
      <div className="flex items-end gap-0.5 h-6">
        {pts.map((v, i) => (
          <div
            key={i}
            className="flex-1 rounded-sm bg-gradient-to-t from-violet-600/50 to-violet-400/70 opacity-80"
            style={{ height: `${Math.max(12, (v / max) * 100)}%` }}
          />
        ))}
      </div>
    </div>
  );
}
