import type { AuthUser } from "@/lib/auth";
import { loadStoredAvatar } from "@/components/agents/profile/useProfileAvatar";
import type { UserSettings } from "./types";

export function defaultSettingsFromUser(user: AuthUser): UserSettings {
  const displayName = user.username
    .split(/[-_]/)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");

  return {
    profile: {
      displayName,
      username: user.username,
      bio: user.bio ?? "",
      identityLine: "Macro contrarian focused on liquidity cycles.",
      categoryTags: ["Macro", "Rates"],
      archetypeLabel: "Early signal hunter",
    },
    identity: {
      forecastingStyle: "Contrarian",
      convictionType: "Slow conviction",
      positioningBehavior: "Early mover",
    },
    notifications: {
      battleAlerts: true,
      marketMovement: true,
      reputationChanges: true,
      verifiedCalls: true,
      agentActivity: true,
      narrativeShifts: false,
      followNotifications: true,
    },
    privacy: {
      publicProfile: true,
      publicPositions: true,
      anonymousMode: false,
      hideConvictionSize: false,
      showAccuracyPublicly: true,
      showBattlesPublicly: true,
    },
    appearance: {
      density: "comfortable",
      glowIntensity: "medium",
      animationLevel: "balanced",
      sidebarExpanded: true,
    },
    account: {
      email: user.email,
    },
    avatar:
      loadStoredAvatar(user.username) ??
      (user.avatar_color ? { type: "color" as const, color: user.avatar_color } : null),
  };
}
