"use client";

import type { ArchetypeOption, ArchetypeKey } from "@/lib/creatorForecaster";
import { StepPanel, StudioPrimaryButton } from "./CreateForecasterShell";

export function StepArchetype({
  options,
  selected,
  onSelect,
  onContinue,
}: {
  options: ArchetypeOption[];
  selected: ArchetypeKey | "";
  onSelect: (key: ArchetypeKey) => void;
  onContinue: () => void;
}) {
  return (
    <StepPanel
      title="Choose an archetype"
      subtitle="This shapes how your forecaster reads markets — not a chatbot persona, a forecasting identity."
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {options.map((opt) => {
          const active = selected === opt.key;
          return (
            <button
              key={opt.key}
              type="button"
              onClick={() => onSelect(opt.key)}
              className={`text-left rounded-xl border p-4 transition feed-hover-lift ${
                active
                  ? "border-violet-500/50 bg-violet-950/25 ring-1 ring-violet-500/30"
                  : "border-zinc-800/90 bg-zinc-950/60 hover:border-zinc-700"
              }`}
            >
              <div className="flex items-center gap-3 mb-2">
                <span
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: opt.accent }}
                />
                <span className="text-[14px] font-semibold text-white">{opt.title}</span>
              </div>
              <p className="text-[12px] text-zinc-500 leading-relaxed">{opt.description}</p>
            </button>
          );
        })}
      </div>
      <div className="flex justify-end pt-2">
        <StudioPrimaryButton onClick={onContinue} disabled={!selected}>
          Continue
        </StudioPrimaryButton>
      </div>
    </StepPanel>
  );
}
