"use client";



import { useCallback, useEffect, useState } from "react";

import {

  loadStoredAvatar,

  notifyProfileAvatarChanged,

  PROFILE_AVATAR_CHANGED_EVENT,

  saveStoredAvatar,

  type ProfileAvatarChangedDetail,

  type StoredProfileAvatar,

} from "@/lib/avatar";



export type { StoredProfileAvatar } from "@/lib/avatar";

export { loadStoredAvatar } from "@/lib/avatar";



export function useProfileAvatar(slug: string, fallbackColor?: string) {

  const [avatar, setAvatar] = useState<StoredProfileAvatar | null>(null);



  useEffect(() => {

    const stored = loadStoredAvatar(slug);

    if (stored) {

      setAvatar(stored);

      return;

    }

    if (fallbackColor) setAvatar({ type: "color", color: fallbackColor });

  }, [slug, fallbackColor]);



  useEffect(() => {

    if (typeof window === "undefined") return;

    function onAvatarChanged(event: Event) {

      const { slug: changedSlug, avatar: next } = (event as CustomEvent<ProfileAvatarChangedDetail>)

        .detail;

      if (changedSlug !== slug) return;

      setAvatar(next);

    }

    window.addEventListener(PROFILE_AVATAR_CHANGED_EVENT, onAvatarChanged);

    return () => window.removeEventListener(PROFILE_AVATAR_CHANGED_EVENT, onAvatarChanged);

  }, [slug]);



  const persist = useCallback(

    (next: StoredProfileAvatar | null) => {

      setAvatar(next);

      saveStoredAvatar(slug, next);

      notifyProfileAvatarChanged(slug, next);

    },

    [slug],

  );



  return { avatar, setAvatar: persist };

}

