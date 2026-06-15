"use client";

import { REASONING_SOURCE_LABELS } from "@/components/public-reads/publicReadEnrichment";
import type { ReasoningSource } from "@/components/public-reads/types";

const OPTIONS: ReasoningSource[] = ["creator_written", "ai_generated", "ai_creator_edited"];

export function ReasoningSourceField({
  value,
  onChange,
}: {
  value: ReasoningSource;
  onChange: (v: ReasoningSource) => void;
}) {
  return (
    <fieldset className="rounded-lg border border-zinc-800/80 bg-zinc-900/30 px-3 py-2.5">
      <legend className="text-[10px] uppercase tracking-wider text-zinc-500 px-0.5">
        Reasoning source
        <span className="normal-case text-zinc-600 ml-1">(internal only)</span>
      </legend>
      <div className="mt-2 space-y-1.5">
        {OPTIONS.map((key) => (
          <label
            key={key}
            className="flex items-center gap-2 cursor-pointer text-[11px] text-zinc-300 hover:text-zinc-100"
          >
            <input
              type="radio"
              name="reasoningSource"
              checked={value === key}
              onChange={() => onChange(key)}
              className="accent-violet-500"
            />
            {REASONING_SOURCE_LABELS[key]}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
