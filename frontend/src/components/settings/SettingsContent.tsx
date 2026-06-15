"use client";

import type { SettingsSectionId, UserSettings } from "@/lib/settings/types";
import type { StoredProfileAvatar } from "@/components/agents/profile/useProfileAvatar";
import { AccountSection } from "./sections/AccountSection";
import { AppearanceSection } from "./sections/AppearanceSection";
import { ComingSoonSection } from "./sections/ComingSoonSection";
import { IdentitySection } from "./sections/IdentitySection";
import { NotificationsSection } from "./sections/NotificationsSection";
import { PrivacySection } from "./sections/PrivacySection";
import { ProfileSection } from "./sections/ProfileSection";
import { WalletSection } from "./sections/WalletSection";

export function SettingsContent({
  section,
  settings,
  onProfileChange,
  onIdentityChange,
  onNotificationsChange,
  onPrivacyChange,
  onAppearanceChange,
  onAccountChange,
  onAvatarChange,
}: {
  section: SettingsSectionId;
  settings: UserSettings;
  onProfileChange: (patch: Partial<UserSettings["profile"]>) => void;
  onIdentityChange: (patch: Partial<UserSettings["identity"]>) => void;
  onNotificationsChange: (patch: Partial<UserSettings["notifications"]>) => void;
  onPrivacyChange: (patch: Partial<UserSettings["privacy"]>) => void;
  onAppearanceChange: (patch: Partial<UserSettings["appearance"]>) => void;
  onAccountChange: (patch: Partial<UserSettings["account"]>) => void;
  onAvatarChange: (avatar: StoredProfileAvatar) => void;
}) {
  switch (section) {
    case "profile":
      return (
        <ProfileSection
          settings={settings}
          onProfileChange={onProfileChange}
          onAvatarChange={onAvatarChange}
        />
      );
    case "identity":
      return <IdentitySection settings={settings} onChange={onIdentityChange} />;
    case "notifications":
      return (
        <NotificationsSection settings={settings} onChange={onNotificationsChange} />
      );
    case "privacy":
      return <PrivacySection settings={settings} onChange={onPrivacyChange} />;
    case "appearance":
      return <AppearanceSection settings={settings} onChange={onAppearanceChange} />;
    case "account":
      return <AccountSection settings={settings} onAccountChange={onAccountChange} />;
    case "wallet":
      return <WalletSection />;
    case "agents":
      return (
        <ComingSoonSection
          title="Custom agents"
          description="Create and manage AI forecasting personas tied to your identity."
          features={[
            "Create custom agents",
            "Persona management",
            "AI forecasting style",
            "Agent publishing",
          ]}
        />
      );
    default:
      return null;
  }
}
