"use client";

import Link from "next/link";
import { FeedShell } from "@/components/feed/FeedShell";
import { useProfileAvatar } from "@/components/agents/profile/useProfileAvatar";
import { SettingsPageLayout } from "@/components/settings/SettingsPageLayout";
import { useAuth } from "@/context/AuthProvider";
import { useSettings } from "@/lib/settings/useSettings";

export default function SettingsPage() {
  const { user, loading: authLoading } = useAuth();
  const settingsState = useSettings(user);
  const { setAvatar } = useProfileAvatar(user?.username ?? "", user?.avatar_color ?? undefined);

  if (authLoading) {
    return (
      <FeedShell activeNav="Settings" hideCategoryNav>
        <div className="max-w-3xl mx-auto py-16 flex justify-center">
          <div className="h-8 w-48 rounded-lg bg-zinc-800/60 animate-pulse" />
        </div>
      </FeedShell>
    );
  }

  if (!user) {
    return (
      <FeedShell activeNav="Settings" hideCategoryNav>
        <div className="max-w-lg mx-auto py-16 text-center space-y-4">
          <p className="text-zinc-400 text-sm">Sign in to manage your account settings.</p>
          <Link
            href={`/login?next=${encodeURIComponent("/settings")}`}
            className="inline-flex text-sm font-medium text-white bg-violet-600 hover:bg-violet-500 px-4 py-2 rounded-xl transition"
          >
            Sign in
          </Link>
        </div>
      </FeedShell>
    );
  }

  const settings = settingsState.settings;

  return (
    <FeedShell activeNav="Settings" hideCategoryNav>
      <div className="max-w-3xl mx-auto pb-24">
        <header className="mb-4 px-0.5">
          <p className="text-[10px] uppercase tracking-[0.18em] text-zinc-600">Settings</p>
          <h1 className="text-xl sm:text-2xl font-semibold text-white tracking-tight mt-1">
            Manage your SCRY account
          </h1>
          <p className="text-[12px] text-zinc-500 mt-1">
            Profile, privacy, notifications, and wallet — kept separate from your public profile.
          </p>
        </header>

        {settings ? (
          <SettingsPageLayout
            settings={settings}
            dirty={settingsState.dirty}
            saving={settingsState.saving}
            savedFlash={settingsState.savedFlash}
            onProfileChange={settingsState.updateProfile}
            onIdentityChange={settingsState.updateIdentity}
            onNotificationsChange={settingsState.updateNotifications}
            onPrivacyChange={settingsState.updatePrivacy}
            onAppearanceChange={settingsState.updateAppearance}
            onAccountChange={settingsState.updateAccount}
            onAvatarChange={setAvatar}
            onSave={settingsState.save}
            onDiscard={settingsState.discard}
          />
        ) : (
          <div className="py-16 flex flex-col items-center gap-3">
            <div className="h-8 w-8 rounded-full border-2 border-violet-500/30 border-t-violet-400 animate-spin" />
            <p className="text-zinc-500 text-sm">Loading settings…</p>
          </div>
        )}
      </div>
    </FeedShell>
  );
}
