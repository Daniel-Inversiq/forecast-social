"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import type { ReputationMark } from "@/lib/reputation";

export const FEATURED_MARKS_UPDATED_EVENT = "scry:featured-marks-updated";

export function dispatchFeaturedMarksUpdated() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(FEATURED_MARKS_UPDATED_EVENT));
  }
}

export function useUserFeaturedMarks(username: string | undefined) {
  const [marks, setMarks] = useState<ReputationMark[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!username) {
      setMarks([]);
      return;
    }
    setLoading(true);
    try {
      const res = await apiFetch(`/users/${encodeURIComponent(username)}`, {}, false);
      if (!res.ok) {
        setMarks([]);
        return;
      }
      const data = (await res.json()) as { featured_reputation_marks?: ReputationMark[] };
      setMarks(data.featured_reputation_marks ?? []);
    } catch {
      setMarks([]);
    } finally {
      setLoading(false);
    }
  }, [username]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const onUpdate = () => {
      void load();
    };
    window.addEventListener(FEATURED_MARKS_UPDATED_EVENT, onUpdate);
    return () => window.removeEventListener(FEATURED_MARKS_UPDATED_EVENT, onUpdate);
  }, [load]);

  return { marks, loading, refresh: load };
}
