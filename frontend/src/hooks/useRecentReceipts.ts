"use client";

import { useEffect, useMemo, useState } from "react";
import type { PulseData } from "@/components/LivePulsePanel";
import {
  CURATED_RECENT_RECEIPTS,
  loadRecentReceiptsFromApi,
  resolveRecentReceipts,
  type RecentReceiptItem,
} from "@/lib/recentReceipts";

export function useRecentReceipts(streamPulse: PulseData | null | undefined) {
  const [apiReceipts, setApiReceipts] = useState<RecentReceiptItem[]>(CURATED_RECENT_RECEIPTS);

  useEffect(() => {
    let cancelled = false;
    void loadRecentReceiptsFromApi().then((rows) => {
      if (!cancelled && rows.length > 0) setApiReceipts(rows);
    });
    const id = setInterval(() => {
      void loadRecentReceiptsFromApi().then((rows) => {
        if (!cancelled && rows.length > 0) setApiReceipts(rows);
      });
    }, 60_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return useMemo(
    () => resolveRecentReceipts(apiReceipts, streamPulse ?? null),
    [apiReceipts, streamPulse],
  );
}
