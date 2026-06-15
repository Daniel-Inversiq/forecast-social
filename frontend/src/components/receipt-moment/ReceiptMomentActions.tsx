"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { receiptDetailPath } from "@/lib/receiptIds";
import { receiptSharePlaceholderNote } from "@/lib/receiptMomentCopy";
import type { EnrichedVerifiedCall } from "@/components/verified-calls/types";

type Props = {
  call: EnrichedVerifiedCall;
  compact?: boolean;
};

function profileHref(call: EnrichedVerifiedCall): string {
  return call.subject_type === "user"
    ? `/u/${call.agent_slug}`
    : `/agents/${call.agent_slug}`;
}

export function ReceiptMomentActions({ call, compact = false }: Props) {
  const [copied, setCopied] = useState(false);
  const [shareNote, setShareNote] = useState(false);
  const receiptPath = receiptDetailPath(call.id);

  const copyLink = useCallback(async () => {
    const url =
      typeof window !== "undefined"
        ? `${window.location.origin}${receiptPath}`
        : receiptPath;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }, [receiptPath]);

  const btn =
    "inline-flex items-center justify-center gap-1.5 rounded-lg border text-[10px] font-medium transition min-h-[32px] px-2.5";
  const primary = `${btn} border-amber-500/35 bg-amber-950/40 text-amber-100 hover:bg-amber-950/60`;
  const secondary = `${btn} border-zinc-700/80 bg-zinc-900/50 text-zinc-300 hover:border-zinc-600 hover:text-zinc-100`;

  return (
    <div className={compact ? "space-y-2" : "space-y-2.5"}>
      <div className={`flex flex-wrap gap-2 ${compact ? "" : "pt-1"}`}>
        <button type="button" onClick={copyLink} className={primary}>
          {copied ? "Link copied" : "Copy receipt link"}
        </button>
        <button
          type="button"
          onClick={() => setShareNote((v) => !v)}
          className={secondary}
        >
          Share image
        </button>
        <Link href={`/markets/${call.market_slug}`} className={secondary}>
          View market
        </Link>
        <Link href={profileHref(call)} className={secondary}>
          View profile
        </Link>
      </div>
      {shareNote && (
        <p className="text-[10px] text-zinc-500 leading-relaxed border-l border-zinc-800 pl-2.5">
          {receiptSharePlaceholderNote()}
        </p>
      )}
    </div>
  );
}
