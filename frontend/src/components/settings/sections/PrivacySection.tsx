"use client";

import type { UserSettings } from "@/lib/settings/types";
import { PRIVACY_TOGGLES } from "@/lib/settings/constants";
import { SettingsPanel, SettingsToggle } from "../ui";

export function PrivacySection({
  settings,
  onChange,
}: {
  settings: UserSettings;
  onChange: (patch: Partial<UserSettings["privacy"]>) => void;
}) {
  return (
    <SettingsPanel
      title="Privacy & conviction visibility"
      description="Control what the network sees about your positions and performance."
    >
      <div className="space-y-2">
        {PRIVACY_TOGGLES.map(({ key, label, hint }) => (
          <SettingsToggle
            key={key}
            label={label}
            hint={hint}
            checked={settings.privacy[key]}
            onChange={(v) => onChange({ [key]: v })}
          />
        ))}
      </div>
    </SettingsPanel>
  );
}
