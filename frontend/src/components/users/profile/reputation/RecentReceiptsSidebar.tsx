"use client";

import Link from "next/link";
import { formatTimeAgo, PanelShell } from "@/components/feed/shared";
import { receiptDetailPath } from "@/lib/receiptIds";
import { countResolvedReceipts } from "@/lib/profileSectionState";
import type { ScryReceipt } from "./types";
import { credibilityLabel, outcomeIcon, outcomeTone, shortTitle } from "./receiptUi";

export function RecentReceiptsSidebar({ receipts }: { receipts: ScryReceipt[] }) {
  if (countResolvedReceipts(receipts) === 0) {
    return null;
  }

  const recent = receipts
    .filter((r) => r.outcome !== "pending" && r.resolvedAt)
    .slice(0, 5);

  return (
    <PanelShell title="Recent receipts" subtitle="On-record proof" headerClass="!py-1.5">
      <ul className="p-2 space-y-2">
        {recent.map((r) => {
          const tone = outcomeTone(r.outcome);
          return (
            <li key={r.id} className="border-b border-zinc-800/50 last:border-0 pb-2">
              <Link
                href={receiptDetailPath(r.id)}
                className="block group rounded-lg hover:bg-zinc-900/50 px-1 py-0.5 -mx-1 transition"
              >
                <div className="flex items-start gap-2">
                  <span className={`text-sm font-semibold ${tone.icon}`}>
                    {outcomeIcon(r.outcome)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] text-zinc-300 font-medium line-clamp-2 group-hover:text-white">
                      {shortTitle(r.forecastTitle, 40)}
                    </p>
                    <p
                      className={`text-[10px] tabular-nums mt-0.5 ${
                        r.credibilityDelta >= 0 ? "text-emerald-400/90" : "text-rose-400/90"
                      }`}
                    >
                      {credibilityLabel(r.credibilityDelta)} credibility
                    </p>
                    <p className="text-[9px] text-zinc-600">
                      Resolved {r.resolvedAt ? formatTimeAgo(r.resolvedAt) : "—"}
                    </p>
                  </div>
                  <span className="text-[9px] text-violet-400/80 shrink-0 opacity-70 group-hover:opacity-100">
                    View →
                  </span>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </PanelShell>
  );
}
