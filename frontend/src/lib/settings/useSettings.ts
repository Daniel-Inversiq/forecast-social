"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { AuthUser } from "@/lib/auth";
import type { StoredProfileAvatar } from "@/components/agents/profile/useProfileAvatar";
import { loadStoredAvatar } from "@/components/agents/profile/useProfileAvatar";
import { notifyProfileAvatarChanged, saveStoredAvatar } from "@/lib/avatar";
import { loadUserSettings, saveUserSettings } from "./storage";
import type { SettingsSectionId, UserSettings } from "./types";

function settingsEqual(a: UserSettings, b: UserSettings): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function useSettings(user: AuthUser | null) {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [saved, setSaved] = useState<UserSettings | null>(null);
  const [activeSection, setActiveSection] = useState<SettingsSectionId>("profile");
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    if (!user) {
      setSettings(null);
      setSaved(null);
      return;
    }
    const loaded = loadUserSettings(user);
    setSettings(loaded);
    setSaved(loaded);
  }, [user]);

  const dirty = useMemo(
    () => settings !== null && saved !== null && !settingsEqual(settings, saved),
    [settings, saved],
  );

  const updateSettings = useCallback((patch: Partial<UserSettings>) => {
    setSettings((prev) => (prev ? { ...prev, ...patch } : prev));
  }, []);

  const updateProfile = useCallback(
    (patch: Partial<UserSettings["profile"]>) => {
      setSettings((prev) =>
        prev ? { ...prev, profile: { ...prev.profile, ...patch } } : prev,
      );
    },
    [],
  );

  const updateIdentity = useCallback(
    (patch: Partial<UserSettings["identity"]>) => {
      setSettings((prev) =>
        prev ? { ...prev, identity: { ...prev.identity, ...patch } } : prev,
      );
    },
    [],
  );

  const updateNotifications = useCallback(
    (patch: Partial<UserSettings["notifications"]>) => {
      setSettings((prev) =>
        prev ? { ...prev, notifications: { ...prev.notifications, ...patch } } : prev,
      );
    },
    [],
  );

  const updatePrivacy = useCallback(
    (patch: Partial<UserSettings["privacy"]>) => {
      setSettings((prev) =>
        prev ? { ...prev, privacy: { ...prev.privacy, ...patch } } : prev,
      );
    },
    [],
  );

  const updateAppearance = useCallback(
    (patch: Partial<UserSettings["appearance"]>) => {
      setSettings((prev) =>
        prev ? { ...prev, appearance: { ...prev.appearance, ...patch } } : prev,
      );
    },
    [],
  );

  const updateAccount = useCallback(
    (patch: Partial<UserSettings["account"]>) => {
      setSettings((prev) =>
        prev ? { ...prev, account: { ...prev.account, ...patch } } : prev,
      );
    },
    [],
  );

  const setAvatar = useCallback(
    (avatar: StoredProfileAvatar | null) => {
      if (!user) return;
      setSettings((prev) => (prev ? { ...prev, avatar } : prev));
      saveStoredAvatar(user.username, avatar);
      notifyProfileAvatarChanged(user.username, avatar);
    },
    [user],
  );

  const discard = useCallback(() => {
    if (!saved || !user) return;
    setSettings(saved);
    const storedAvatar = loadStoredAvatar(user.username);
    if (storedAvatar) setAvatar(storedAvatar);
  }, [saved, user, setAvatar]);

  const save = useCallback(async () => {
    if (!settings || !user || !dirty) return;
    setSaving(true);
    await new Promise((r) => setTimeout(r, 380));
    saveUserSettings(user.username, settings);
    setSaved(settings);
    setSaving(false);
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 2400);
  }, [settings, user, dirty]);

  return {
    settings,
    dirty,
    saving,
    savedFlash,
    activeSection,
    setActiveSection,
    updateSettings,
    updateProfile,
    updateIdentity,
    updateNotifications,
    updatePrivacy,
    updateAppearance,
    updateAccount,
    setAvatar,
    discard,
    save,
  };
}
