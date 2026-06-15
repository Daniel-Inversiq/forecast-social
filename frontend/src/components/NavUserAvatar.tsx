"use client";

import { initials } from "@/components/feed/shared";
import { getPresetAvatar } from "@/components/agents/profile/presetAvatars";
import { PresetAvatarIcon } from "@/components/agents/profile/PresetAvatarIcon";
import { useProfileAvatar, type StoredProfileAvatar } from "@/components/agents/profile/useProfileAvatar";

const baseClass =
  "h-8 w-8 rounded-full flex items-center justify-center text-xs font-semibold text-white ring-2 ring-zinc-900/80 overflow-hidden shrink-0";

function NavAvatarInner({
  name,
  avatar,
  fallbackColor,
}: {
  name: string;
  avatar: StoredProfileAvatar | null;
  fallbackColor: string;
}) {
  if (avatar?.type === "upload") {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={avatar.dataUrl} alt="" className="h-full w-full object-cover" />
    );
  }

  if (avatar?.type === "preset") {
    const preset = getPresetAvatar(avatar.presetId);
    if (preset) {
      return (
        <>
          <div className={`absolute inset-0 bg-gradient-to-br ${preset.gradient}`} />
          <div className="absolute inset-0 flex items-center justify-center">
            <PresetAvatarIcon icon={preset.icon} className="h-4 w-4" />
          </div>
        </>
      );
    }
  }

  const color = avatar?.type === "color" ? avatar.color : fallbackColor;
  return initials(name);
}

/** Compact header avatar — same stored avatar as profile hero (upload / preset / color). */
export function NavUserAvatar({
  username,
  name,
  fallbackColor = "#7c3aed",
  className = "",
}: {
  username: string;
  name: string;
  fallbackColor?: string;
  className?: string;
}) {
  const { avatar } = useProfileAvatar(username, fallbackColor);

  const color = avatar?.type === "color" ? avatar.color : fallbackColor;
  const isInitials =
    !avatar || avatar.type === "color" || (avatar.type === "preset" && !getPresetAvatar(avatar.presetId));

  return (
    <div
      className={`${baseClass} relative ${className}`}
      style={isInitials ? { backgroundColor: color } : undefined}
    >
      <NavAvatarInner name={name} avatar={avatar} fallbackColor={fallbackColor} />
    </div>
  );
}
