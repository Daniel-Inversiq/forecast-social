import type { AuthUser } from "@/lib/auth";
import { defaultSettingsFromUser } from "./defaults";
import type { UserSettings } from "./types";

const STORAGE_PREFIX = "scry-settings:";

function storageKey(username: string) {
  return `${STORAGE_PREFIX}${username}`;
}

export function loadUserSettings(user: AuthUser): UserSettings {
  const defaults = defaultSettingsFromUser(user);
  if (typeof window === "undefined") return defaults;

  try {
    const raw = localStorage.getItem(storageKey(user.username));
    if (!raw) return defaults;
    const stored = JSON.parse(raw) as Partial<UserSettings>;
    return {
      ...defaults,
      ...stored,
      profile: { ...defaults.profile, ...stored.profile },
      identity: { ...defaults.identity, ...stored.identity },
      notifications: { ...defaults.notifications, ...stored.notifications },
      privacy: { ...defaults.privacy, ...stored.privacy },
      appearance: { ...defaults.appearance, ...stored.appearance },
      account: { ...defaults.account, ...stored.account, email: user.email },
      avatar: stored.avatar ?? defaults.avatar,
    };
  } catch {
    return defaults;
  }
}

export function saveUserSettings(username: string, settings: UserSettings): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(storageKey(username), JSON.stringify(settings));
}
