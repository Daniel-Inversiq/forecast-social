"use client";

import Link from "next/link";
import { ProfileAvatar } from "@/components/agents/profile/ProfileAvatar";
import { userProfilePath } from "@/lib/slugs";
import type { UserSettings } from "@/lib/settings/types";

export function SettingsPreview({ settings }: { settings: UserSettings }) {
  const { profile, identity, avatar } = settings;

  return (
    <aside className="settings-preview hidden xl:block sticky top-[72px] self-start w-[240px] shrink-0">
      <div className="rounded-2xl border border-zinc-800/80 bg-zinc-950/60 backdrop-blur-sm overflow-hidden settings-preview-glow">
        <div className="px-3 py-2.5 border-b border-zinc-800/60 bg-gradient-to-r from-violet-950/30 to-transparent">
          <p className="text-[10px] uppercase tracking-wider text-zinc-600">Live preview</p>
        </div>
        <div className="p-4 space-y-3">
          <div className="flex items-start gap-3">
            <ProfileAvatar
              name={profile.displayName}
              avatar={avatar}
              fallbackColor="#7c3aed"
              size="md"
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-white truncate">{profile.displayName}</p>
              <p className="text-[11px] text-zinc-500">@{profile.username}</p>
            </div>
          </div>
          {profile.identityLine && (
            <p className="text-[11px] text-zinc-400 leading-relaxed line-clamp-3">
              {profile.identityLine}
            </p>
          )}
          {profile.categoryTags.length > 0 && (
            <div>
              <p className="text-[9px] uppercase tracking-wider text-zinc-600 mb-1.5">Focus areas</p>
              <div className="flex flex-wrap gap-1">
                {profile.categoryTags.slice(0, 4).map((tag) => (
                  <span
                    key={tag}
                    className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full border border-violet-500/25 bg-violet-500/10 text-violet-200/90"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}
          <p className="text-[10px] text-violet-300/80">{profile.archetypeLabel}</p>
          <p className="text-[10px] text-zinc-600">
            {identity.forecastingStyle} · {identity.convictionType}
          </p>
          <Link
            href={userProfilePath(profile.username)}
            className="block text-center text-[10px] py-1.5 rounded-lg border border-zinc-800 text-zinc-500 hover:text-violet-200 hover:border-violet-500/30 transition"
          >
            View public profile
          </Link>
        </div>
      </div>
    </aside>
  );
}
