"use client";

import { PanelShell } from "@/components/feed/shared";
import type { BeliefReceipt } from "./types";

export function BeliefResolution({ receipts }: { receipts: BeliefReceipt[] }) {
  if (!receipts.length) {
    return (
      <PanelShell title="Belief resolution" subtitle="Receipts accumulate against this thesis">
        <p className="text-[11px] text-zinc-600 p-3">No receipts linked yet.</p>
      </PanelShell>
    );
  }

  return (
    <PanelShell title="Belief resolution" subtitle="Credibility updates from receipts">
      <ul className="p-3 space-y-2">
        {receipts.map((r) => (
          <li
            key={r.id}
            className="flex items-center justify-between gap-2 rounded-lg border border-zinc-800/70 bg-zinc-900/30 px-3 py-2"
          >
            <span className="text-[11px] text-zinc-300">{r.title}</span>
            <span
              className={`text-[11px] font-semibold tabular-nums shrink-0 ${
                r.delta >= 0 ? "text-emerald-400/90" : "text-rose-400/90"
              }`}
            >
              {r.delta >= 0 ? "+" : ""}
              {r.delta}
            </span>
          </li>
        ))}
      </ul>
    </PanelShell>
  );
}
