"use client";

import type { PublicRead, StudioReadLifecycleStage } from "@/components/public-reads/types";

const STAGES: { key: StudioReadLifecycleStage; label: string }[] = [
  { key: "draft", label: "Draft" },
  { key: "published", label: "Published" },
  { key: "backing", label: "Backers" },
  { key: "resolution", label: "Resolution" },
  { key: "receipt", label: "Receipt" },
];

function resolveStage(read: PublicRead): StudioReadLifecycleStage {
  if (read.studioLifecycle === "receipt" || read.receiptId) return "receipt";
  if (read.status === "resolved") return "receipt";
  if (read.status === "resolving") return "resolution";
  if (read.backersCount > 0 || read.challengersCount > 0 || read.status === "backed" || read.status === "challenged") {
    return "backing";
  }
  return read.studioLifecycle ?? "published";
}

export function StudioReadLifecycle({ read, compact }: { read: PublicRead; compact?: boolean }) {
  const current = resolveStage(read);
  const idx = STAGES.findIndex((s) => s.key === current);

  return (
    <div className={`${compact ? "py-1.5" : "py-2.5"} overflow-x-auto feed-scroll-x scrollbar-none`}>
      <div className="flex items-center gap-0.5 min-w-max">
        {STAGES.map((stage, i) => {
          const done = i < idx;
          const active = i === idx;
          return (
            <div key={stage.key} className="flex items-center">
              <span
                className={`text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                  active
                    ? "border-violet-500/50 bg-violet-500/15 text-violet-200"
                    : done
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300/80"
                      : "border-zinc-800 text-zinc-600"
                }`}
              >
                {stage.label}
              </span>
              {i < STAGES.length - 1 && (
                <span className={`mx-0.5 text-[10px] ${done ? "text-emerald-500/50" : "text-zinc-700"}`}>
                  →
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
