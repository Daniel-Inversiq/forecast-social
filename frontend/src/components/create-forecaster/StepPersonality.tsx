"use client";

import type { CreatorForecasterDraft } from "@/lib/creatorForecaster";
import { buildPersonalitySummary } from "@/lib/creatorForecaster";
import { StepPanel, StudioPrimaryButton } from "./CreateForecasterShell";

const SLIDERS: {
  key: keyof Pick<
    CreatorForecasterDraft,
    "aggressiveness" | "humor" | "contrarian_level" | "data_vs_intuition" | "confidence"
  >;
  label: string;
  low: string;
  high: string;
}[] = [
  { key: "aggressiveness", label: "Aggressiveness", low: "Measured", high: "Confrontational" },
  { key: "humor", label: "Humor", low: "Serious", high: "Witty" },
  { key: "contrarian_level", label: "Contrarian level", low: "Consensus-friendly", high: "Fade the crowd" },
  { key: "data_vs_intuition", label: "Data vs intuition", low: "Gut feel", high: "Data-first" },
  { key: "confidence", label: "Confidence", low: "Hedged", high: "Emphatic" },
];

export function StepPersonality({
  draft,
  onChange,
  onContinue,
}: {
  draft: CreatorForecasterDraft;
  onChange: (patch: Partial<CreatorForecasterDraft>) => void;
  onContinue: () => void;
}) {
  const summary = buildPersonalitySummary(draft);

  return (
    <StepPanel
      title="Dial in personality"
      subtitle="Five sliders shape voice and conviction — you'll see a live summary as you adjust."
    >
      <div className="space-y-5">
        {SLIDERS.map(({ key, label, low, high }) => (
          <label key={key} className="block space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-medium text-zinc-300">{label}</span>
              <span className="text-[11px] tabular-nums text-zinc-600">{draft[key]}</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={draft[key]}
              onChange={(e) => onChange({ [key]: Number(e.target.value) })}
              className="w-full h-1.5 rounded-full appearance-none bg-zinc-800 accent-violet-500 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-zinc-600">
              <span>{low}</span>
              <span>{high}</span>
            </div>
          </label>
        ))}
      </div>

      <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-4">
        <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2">Live summary</p>
        <p className="text-[13px] text-zinc-300 whitespace-pre-line leading-relaxed">{summary}</p>
      </div>

      <div className="flex justify-end">
        <StudioPrimaryButton onClick={onContinue}>Continue</StudioPrimaryButton>
      </div>
    </StepPanel>
  );
}
