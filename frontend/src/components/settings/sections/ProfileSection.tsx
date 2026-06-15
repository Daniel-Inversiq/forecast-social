"use client";

import type { UserSettings } from "@/lib/settings/types";
import { ARCHETYPE_OPTIONS, CATEGORY_TAG_OPTIONS } from "@/lib/settings/constants";
import { AvatarPickerGrid } from "../AvatarPickerGrid";
import {
  SettingsChipSelect,
  SettingsDivider,
  SettingsField,
  SettingsInput,
  SettingsPanel,
  SettingsRow,
  SettingsSelect,
  SettingsTextarea,
} from "../ui";
import type { StoredProfileAvatar } from "@/components/agents/profile/useProfileAvatar";

export function ProfileSection({
  settings,
  onProfileChange,
  onAvatarChange,
}: {
  settings: UserSettings;
  onProfileChange: (patch: Partial<UserSettings["profile"]>) => void;
  onAvatarChange: (avatar: StoredProfileAvatar) => void;
}) {
  const { profile, avatar } = settings;

  return (
    <div className="space-y-5">
      <SettingsPanel
        title="Forecasting identity"
        description="How you appear on your public profile and across the intelligence network."
      >
        <SettingsRow>
          <SettingsField label="Display name">
            <SettingsInput
              value={profile.displayName}
              onChange={(e) => onProfileChange({ displayName: e.target.value })}
              placeholder="Macro Oracle"
            />
          </SettingsField>
          <SettingsField label="Username" hint="Used in @handle and profile URL">
            <SettingsInput
              value={profile.username}
              onChange={(e) =>
                onProfileChange({ username: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, "") })
              }
              placeholder="macro_oracle"
            />
          </SettingsField>
        </SettingsRow>

        <SettingsField label="Bio">
          <SettingsTextarea
            value={profile.bio}
            onChange={(e) => onProfileChange({ bio: e.target.value })}
            placeholder="Short public bio for your forecasting identity…"
          />
        </SettingsField>

        <SettingsField
          label="Forecasting identity line"
          hint="One-line thesis shown on your profile hero"
        >
          <SettingsTextarea
            value={profile.identityLine}
            onChange={(e) => onProfileChange({ identityLine: e.target.value })}
            placeholder="Macro contrarian focused on liquidity cycles."
            className="min-h-[64px]"
          />
        </SettingsField>

        <SettingsDivider />

        <SettingsChipSelect
          label="Category tags"
          options={CATEGORY_TAG_OPTIONS}
          selected={profile.categoryTags}
          onChange={(categoryTags) => onProfileChange({ categoryTags })}
        />

        <SettingsField label="Archetype label">
          <SettingsSelect
            value={profile.archetypeLabel}
            onChange={(archetypeLabel) => onProfileChange({ archetypeLabel })}
            options={ARCHETYPE_OPTIONS}
          />
        </SettingsField>
      </SettingsPanel>

      <SettingsPanel title="Avatar" description="Custom upload or premium preset orbs.">
        <AvatarPickerGrid
          current={avatar}
          onSelect={onAvatarChange}
          previewName={profile.displayName || profile.username}
        />
      </SettingsPanel>
    </div>
  );
}
