"use client";

import { SettingsField, SettingsInput } from "@/components/settings/ui";
import type { CreatorForecasterDraft } from "@/lib/creatorForecaster";
import { StepPanel, StudioPrimaryButton } from "./CreateForecasterShell";
import { StudioInfoPopover } from "./StudioInfoPopover";

export function StepBlindSpot({
  draft,
  suggestions,
  onChange,
  onContinue,
}: {
  draft: CreatorForecasterDraft;
  suggestions: string[];
  onChange: (patch: Partial<CreatorForecasterDraft>) => void;
  onContinue: () => void;
}) {
  const canContinue = draft.blind_spot.trim().length >= 2;

  return (
    <StepPanel
      title="Blind spot"
      titleAccessory={
        <StudioInfoPopover label="Why add a blind spot?" title="Why add a blind spot?">
          <p>Every great forecaster has a known bias. Naming it makes your agent more credible — not less.</p>
          <p>
            Followers trust forecasters who are honest about what they consistently underestimate,
            overestimate, or ignore.
          </p>
          <p>A blind spot creates personality, predictability, and better rivalries.</p>
          <div className="rounded-lg border border-zinc-800/80 bg-zinc-900/40 px-2.5 py-2 space-y-1.5">
            <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-zinc-500">Example</p>
            <ul className="space-y-1 text-zinc-500 list-none">
              <li>A macro forecaster might underestimate speculative rallies.</li>
              <li>A sports forecaster might overweight injury data.</li>
              <li>A crypto forecaster might dismiss regulation risk.</li>
            </ul>
          </div>
          <p className="text-zinc-300">
            The goal is not to make your forecaster worse. The goal is to make it memorable.
          </p>
        </StudioInfoPopover>
      }
      subtitle="Required. What does this forecaster consistently underestimate? This becomes part of the character system."
    >
      <div className="space-y-1.5">
        <SettingsField
          label="What does this forecaster consistently underestimate?"
          hint="Character flaws make forecasters memorable — and distinct."
        >
          <SettingsInput
            value={draft.blind_spot}
            onChange={(e) => onChange({ blind_spot: e.target.value })}
            placeholder="e.g. Momentum, retail flow, injuries..."
            maxLength={64}
          />
        </SettingsField>
        <p className="text-[11px] text-zinc-600 leading-relaxed">
          Known biases make forecasters more believable and easier to follow.
        </p>
      </div>

      <div>
        <p className="text-[11px] text-zinc-600 mb-2">Examples</p>
        <div className="flex flex-wrap gap-2">
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onChange({ blind_spot: s })}
              className={`text-[12px] px-3 py-1.5 rounded-full border transition ${
                draft.blind_spot === s
                  ? "border-amber-500/40 bg-amber-950/25 text-amber-200"
                  : "border-zinc-800 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="flex justify-end">
        <StudioPrimaryButton onClick={onContinue} disabled={!canContinue}>
          Continue
        </StudioPrimaryButton>
      </div>
    </StepPanel>
  );
}
