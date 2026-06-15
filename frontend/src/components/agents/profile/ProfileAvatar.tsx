"use client";

import { initials } from "@/components/feed/shared";
import { getPresetAvatar } from "./presetAvatars";
import { PresetAvatarIcon } from "./PresetAvatarIcon";
import type { StoredProfileAvatar } from "./useProfileAvatar";

export function ProfileAvatar({
  name,
  avatar,
  fallbackColor,
  size = "lg",
  showGlow = true,
}: {
  name: string;
  avatar: StoredProfileAvatar | null;
  fallbackColor?: string;
  size?: "md" | "lg" | "xl";
  showGlow?: boolean;
}) {
  const dim =
    size === "xl"
      ? "h-28 w-28 sm:h-32 sm:w-32 text-2xl sm:text-3xl"
      : size === "lg"
        ? "h-20 w-20 sm:h-24 sm:w-24 text-xl sm:text-2xl"
        : "h-14 w-14 text-base";

  const inner = () => {
    if (avatar?.type === "upload") {
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={avatar.dataUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
      );
    }
    if (avatar?.type === "preset") {
      const preset = getPresetAvatar(avatar.presetId);
      if (preset) {
        return (
          <>
            <div className={`absolute inset-0 bg-gradient-to-br ${preset.gradient}`} />
            <div className="absolute inset-0 flex items-center justify-center">
              <PresetAvatarIcon icon={preset.icon} className="h-10 w-10 sm:h-12 sm:w-12" />
            </div>
          </>
        );
      }
    }
    const color =
      avatar?.type === "color" ? avatar.color : fallbackColor;
    return (
      <span
        className={`absolute inset-0 flex items-center justify-center font-semibold text-white ${color ? "" : "bg-violet-600"}`}
        style={color ? { backgroundColor: color } : undefined}
      >
        {initials(name)}
      </span>
    );
  };

  return (
    <div className={`relative shrink-0 ${showGlow ? "profile-avatar-glow-wrap" : ""}`}>
      {showGlow && <div className="profile-avatar-glow absolute -inset-3 rounded-3xl pointer-events-none" aria-hidden />}
      <div
        className={`${dim} relative rounded-2xl ring-4 ring-zinc-950/90 shadow-2xl shadow-violet-950/50 overflow-hidden`}
      >
        {inner()}
      </div>
      <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 z-[1]">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-35" />
        <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500 border-2 border-zinc-950" />
      </span>
    </div>
  );
}
