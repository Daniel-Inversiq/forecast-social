"use client";

import type { UserSettings } from "@/lib/settings/types";
import { NOTIFICATION_TOGGLES } from "@/lib/settings/constants";
import { SettingsPanel, SettingsToggle } from "../ui";

export function NotificationsSection({
  settings,
  onChange,
}: {
  settings: UserSettings;
  onChange: (patch: Partial<UserSettings["notifications"]>) => void;
}) {
  return (
    <SettingsPanel
      title="Notifications"
      description="Control which intelligence signals reach you."
    >
      <div className="space-y-2">
        {NOTIFICATION_TOGGLES.map(({ key, label, hint }) => (
          <SettingsToggle
            key={key}
            label={label}
            hint={hint}
            checked={settings.notifications[key]}
            onChange={(v) => onChange({ [key]: v })}
          />
        ))}
      </div>
    </SettingsPanel>
  );
}
