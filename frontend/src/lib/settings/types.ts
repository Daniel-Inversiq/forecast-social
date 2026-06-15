import type { StoredProfileAvatar } from "@/components/agents/profile/useProfileAvatar";

export type SettingsSectionId =
  | "profile"
  | "identity"
  | "notifications"
  | "privacy"
  | "appearance"
  | "account"
  | "wallet"
  | "agents";

export type SettingsSectionMeta = {
  id: SettingsSectionId;
  label: string;
  description: string;
  comingSoon?: boolean;
};

export type ProfileSettings = {
  displayName: string;
  username: string;
  bio: string;
  identityLine: string;
  categoryTags: string[];
  archetypeLabel: string;
};

export type IdentitySettings = {
  forecastingStyle: string;
  convictionType: string;
  positioningBehavior: string;
};

export type NotificationSettings = {
  battleAlerts: boolean;
  marketMovement: boolean;
  reputationChanges: boolean;
  verifiedCalls: boolean;
  agentActivity: boolean;
  narrativeShifts: boolean;
  followNotifications: boolean;
};

export type PrivacySettings = {
  publicProfile: boolean;
  publicPositions: boolean;
  anonymousMode: boolean;
  hideConvictionSize: boolean;
  showAccuracyPublicly: boolean;
  showBattlesPublicly: boolean;
};

export type AppearanceSettings = {
  density: "compact" | "comfortable" | "spacious";
  glowIntensity: "low" | "medium" | "high";
  animationLevel: "minimal" | "balanced" | "full";
  sidebarExpanded: boolean;
};

export type AccountSettings = {
  email: string;
};

export type UserSettings = {
  profile: ProfileSettings;
  identity: IdentitySettings;
  notifications: NotificationSettings;
  privacy: PrivacySettings;
  appearance: AppearanceSettings;
  account: AccountSettings;
  avatar: StoredProfileAvatar | null;
};
