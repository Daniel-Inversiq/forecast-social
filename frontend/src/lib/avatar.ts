export type StoredProfileAvatar =
  | { type: "preset"; presetId: string }
  | { type: "upload"; dataUrl: string }
  | { type: "color"; color: string };

const STORAGE_PREFIX = "scry-profile-avatar:";

function storageKey(slug: string) {
  return `${STORAGE_PREFIX}${slug}`;
}

export function loadStoredAvatar(slug: string): StoredProfileAvatar | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(storageKey(slug));
    if (!raw) return null;
    return JSON.parse(raw) as StoredProfileAvatar;
  } catch {
    return null;
  }
}

export function saveStoredAvatar(slug: string, avatar: StoredProfileAvatar | null) {
  if (typeof window === "undefined") return;
  if (!avatar) {
    localStorage.removeItem(storageKey(slug));
    return;
  }
  localStorage.setItem(storageKey(slug), JSON.stringify(avatar));
}

export const PROFILE_AVATAR_CHANGED_EVENT = "scry-profile-avatar-changed";

export type ProfileAvatarChangedDetail = {
  slug: string;
  avatar: StoredProfileAvatar | null;
};

/** Data URL for custom uploads; null for presets, colors, or missing avatar. */
export function avatarUrlFromStored(avatar: StoredProfileAvatar | null | undefined): string | null {
  if (avatar?.type === "upload") return avatar.dataUrl;
  return null;
}

export function notifyProfileAvatarChanged(slug: string, avatar: StoredProfileAvatar | null) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<ProfileAvatarChangedDetail>(PROFILE_AVATAR_CHANGED_EVENT, {
      detail: { slug, avatar },
    }),
  );
}
