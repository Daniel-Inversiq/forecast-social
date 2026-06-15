"use client";

import { useState } from "react";
import { SettingsContent } from "@/components/settings/SettingsContent";
import { SettingsSaveBar } from "@/components/settings/SettingsSaveBar";
import type { StoredProfileAvatar } from "@/components/agents/profile/useProfileAvatar";
import type { SettingsSectionId, UserSettings } from "@/lib/settings/types";

const SECTIONS: { id: SettingsSectionId; label: string }[] = [
  { id: "profile", label: "Profile & avatar" },
  { id: "identity", label: "Conviction identity" },
  { id: "notifications", label: "Notifications" },
  { id: "privacy", label: "Privacy" },
  { id: "appearance", label: "Appearance" },
  { id: "account", label: "Account" },
  { id: "wallet", label: "Wallet" },
];

export function SettingsPageLayout({
  settings,
  dirty,
  saving,
  savedFlash,
  onProfileChange,
  onIdentityChange,
  onNotificationsChange,
  onPrivacyChange,
  onAppearanceChange,
  onAccountChange,
  onAvatarChange,
  onSave,
  onDiscard,
}: {
  settings: UserSettings;
  dirty: boolean;
  saving: boolean;
  savedFlash: boolean;
  onProfileChange: (patch: Partial<UserSettings["profile"]>) => void;
  onIdentityChange: (patch: Partial<UserSettings["identity"]>) => void;
  onNotificationsChange: (patch: Partial<UserSettings["notifications"]>) => void;
  onPrivacyChange: (patch: Partial<UserSettings["privacy"]>) => void;
  onAppearanceChange: (patch: Partial<UserSettings["appearance"]>) => void;
  onAccountChange: (patch: Partial<UserSettings["account"]>) => void;
  onAvatarChange: (avatar: StoredProfileAvatar) => void;
  onSave: () => void;
  onDiscard: () => void;
}) {
  const [section, setSection] = useState<SettingsSectionId>("profile");

  return (
    <div className="rounded-xl border border-zinc-800/60 bg-zinc-950/40 overflow-hidden">
      <div className="px-4 py-3 border-b border-zinc-800/60 bg-zinc-950/80">
        <p className="text-[10px] uppercase tracking-[0.18em] text-zinc-600">Account settings</p>
        <p className="text-[12px] text-zinc-500 mt-1">
          Private account controls — separate from your public forecasting identity.
        </p>
      </div>

      <div className="flex flex-col lg:flex-row min-h-[420px]">
        <nav className="lg:w-44 shrink-0 border-b lg:border-b-0 lg:border-r border-zinc-800/60 p-2 flex lg:flex-col gap-1 overflow-x-auto feed-scroll-x">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSection(s.id)}
              className={`shrink-0 text-left text-[11px] px-3 py-2 rounded-lg transition whitespace-nowrap ${
                section === s.id
                  ? "bg-zinc-900/80 text-zinc-200 border border-zinc-700/60"
                  : "text-zinc-600 hover:text-zinc-400 border border-transparent"
              }`}
            >
              {s.label}
            </button>
          ))}
        </nav>

        <div className="flex-1 p-4 sm:p-5 min-w-0">
          <SettingsContent
            section={section}
            settings={settings}
            onProfileChange={onProfileChange}
            onIdentityChange={onIdentityChange}
            onNotificationsChange={onNotificationsChange}
            onPrivacyChange={onPrivacyChange}
            onAppearanceChange={onAppearanceChange}
            onAccountChange={onAccountChange}
            onAvatarChange={onAvatarChange}
          />
        </div>
      </div>

      <SettingsSaveBar
        dirty={dirty}
        saving={saving}
        savedFlash={savedFlash}
        onSave={onSave}
        onDiscard={onDiscard}
      />
    </div>
  );
}
