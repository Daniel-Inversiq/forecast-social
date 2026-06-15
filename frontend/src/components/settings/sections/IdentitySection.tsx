"use client";

import type { UserSettings } from "@/lib/settings/types";
import {
  CONVICTION_TYPE_OPTIONS,
  FORECASTING_STYLE_OPTIONS,
  POSITIONING_BEHAVIOR_OPTIONS,
} from "@/lib/settings/constants";
import { SettingsField, SettingsPanel, SettingsRow, SettingsSelect } from "../ui";

export function IdentitySection({
  settings,
  onChange,
}: {
  settings: UserSettings;
  onChange: (patch: Partial<UserSettings["identity"]>) => void;
}) {
  const { identity } = settings;

  return (
    <SettingsPanel
      title="Forecasting identity"
      description="Shapes profile labels, recommendations, and feed personalization."
      badge="Personalization"
    >
      <SettingsRow>
        <SettingsField label="Forecasting style" hint="Primary read on markets">
          <SettingsSelect
            value={identity.forecastingStyle}
            onChange={(forecastingStyle) => onChange({ forecastingStyle })}
            options={FORECASTING_STYLE_OPTIONS}
          />
        </SettingsField>
        <SettingsField label="Conviction type">
          <SettingsSelect
            value={identity.convictionType}
            onChange={(convictionType) => onChange({ convictionType })}
            options={CONVICTION_TYPE_OPTIONS}
          />
        </SettingsField>
      </SettingsRow>
      <SettingsField label="Positioning behavior" hint="How you size and time entries">
        <SettingsSelect
          value={identity.positioningBehavior}
          onChange={(positioningBehavior) => onChange({ positioningBehavior })}
          options={POSITIONING_BEHAVIOR_OPTIONS}
        />
      </SettingsField>
    </SettingsPanel>
  );
}
