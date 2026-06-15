"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthProvider";
import { fetchOngoingStories } from "@/lib/ongoingStories";

/** Loads ongoing-story keys for arc headers without rendering the hero stories section. */
export function useOngoingStoryKeys() {
  const { user } = useAuth();
  const [activeStoryKeys, setActiveStoryKeys] = useState<string[]>([]);

  const refresh = useCallback(async () => {
    try {
      const data = await fetchOngoingStories(6);
      if (data?.active_story_keys) {
        setActiveStoryKeys(data.active_story_keys);
      }
    } catch {
      /* feed still works without story keys */
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh, user]);

  return { activeStoryKeys, refresh };
}
