"use client";

import { Avatar } from "@/components/feed/shared";
import { SettingsField, SettingsInput, SettingsTextarea } from "@/components/settings/ui";
import type { CreatorForecasterDraft, DomainFocus } from "@/lib/creatorForecaster";
import { slugifyUsername } from "@/lib/creatorForecaster";
import { StepPanel, StudioPrimaryButton } from "./CreateForecasterShell";

const AVATAR_PALETTE = [
  "#ef4444",
  "#f97316",
  "#10b981",
  "#06b6d4",
  "#6366f1",
  "#8b5cf6",
  "#a855f7",
  "#f43f5e",
];

export function StepIdentity({
  draft,
  domainOptions,
  onChange,
  onContinue,
}: {
  draft: CreatorForecasterDraft;
  domainOptions: DomainFocus[];
  onChange: (patch: Partial<CreatorForecasterDraft>) => void;
  onContinue: () => void;
}) {
  const canContinue =
    draft.display_name.trim().length >= 2 &&
    draft.username.trim().length >= 3 &&
    draft.domain_focus !== "";

  function handleDisplayName(name: string) {
    const patch: Partial<CreatorForecasterDraft> = { display_name: name };
    if (!draft.username || draft.username === slugifyUsername(draft.display_name)) {
      patch.username = slugifyUsername(name);
    }
    onChange(patch);
  }

  return (
    <StepPanel
      title="Identity"
      subtitle="Public name, handle, and niche. This is what followers see on SCRY."
    >
      <div className="flex items-center gap-4 mb-2">
        <Avatar
          name={draft.display_name || "?"}
          color={draft.avatar_color}
          size="lg"
        />
        <div className="flex flex-wrap gap-2">
          {AVATAR_PALETTE.map((color) => (
            <button
              key={color}
              type="button"
              aria-label={`Avatar color ${color}`}
              onClick={() => onChange({ avatar_color: color })}
              className={`w-7 h-7 rounded-full border-2 transition ${
                draft.avatar_color === color ? "border-white scale-110" : "border-transparent"
              }`}
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <SettingsField label="Display name" hint="The name on your public profile">
          <SettingsInput
            value={draft.display_name}
            onChange={(e) => handleDisplayName(e.target.value)}
            placeholder="e.g. Volatility Vince"
            maxLength={48}
          />
        </SettingsField>

        <SettingsField label="Username" hint="Public handle — becomes your profile URL">
          <SettingsInput
            value={draft.username}
            onChange={(e) =>
              onChange({ username: slugifyUsername(e.target.value) })
            }
            placeholder="volatility-vince"
            maxLength={32}
          />
        </SettingsField>

        <SettingsField label="Short bio" hint="One or two lines — forecasting angle, not a résumé">
          <SettingsTextarea
            value={draft.short_bio}
            onChange={(e) => onChange({ short_bio: e.target.value })}
            placeholder="Fade macro consensus. Long vol, short narrative."
            maxLength={160}
            rows={3}
          />
        </SettingsField>

        <SettingsField label="Domain focus">
          <div className="flex flex-wrap gap-2">
            {domainOptions.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => onChange({ domain_focus: d })}
                className={`text-[12px] px-3 py-1.5 rounded-full border transition ${
                  draft.domain_focus === d
                    ? "border-violet-500/50 bg-violet-950/30 text-violet-200"
                    : "border-zinc-800 text-zinc-400 hover:border-zinc-600"
                }`}
              >
                {d}
              </button>
            ))}
          </div>
        </SettingsField>
      </div>

      <div className="flex justify-end">
        <StudioPrimaryButton onClick={onContinue} disabled={!canContinue}>
          Continue
        </StudioPrimaryButton>
      </div>
    </StepPanel>
  );
}
