"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { FeedShell } from "@/components/feed/FeedShell";
import { ReceiptDetailView } from "@/components/receipt-detail/ReceiptDetailView";
import { resolveReceiptDetail } from "@/components/receipt-detail/receiptDetailData";
import type { ReceiptDetail } from "@/components/receipt-detail/types";
import { normalizeReceiptRouteId } from "@/lib/receiptIds";

export default function ReceiptDetailPage() {
  const params = useParams();
  const routeId = normalizeReceiptRouteId(String(params.receipt_id ?? ""));
  const [detail, setDetail] = useState<ReceiptDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const resolved = await resolveReceiptDetail(routeId);
        if (!cancelled) {
          if (!resolved) setError("Receipt not found");
          else setDetail(resolved);
        }
      } catch {
        if (!cancelled) setError("Could not load receipt");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [routeId]);

  return (
    <FeedShell>
      <div className="max-w-xl mx-auto space-y-4 pb-10 receipt-detail-page">
        <nav className="flex items-center gap-2 text-[10px] text-zinc-600 px-0.5">
          <Link href="/" className="hover:text-zinc-400 transition">
            Feed
          </Link>
          <span aria-hidden>/</span>
          <Link href="/verified-calls" className="hover:text-zinc-400 transition">
            Receipts
          </Link>
          <span aria-hidden>/</span>
          <span className="text-zinc-500 font-mono truncate">
            {detail ? `#${detail.displayNumber}` : routeId}
          </span>
        </nav>

        {loading && (
          <div
            className="h-96 rounded-xl border border-zinc-800/70 bg-zinc-900/40 animate-pulse"
            aria-label="Loading receipt"
          />
        )}

        {!loading && error && (
          <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-6 text-center">
            <p className="text-sm text-rose-300/90">{error}</p>
            <Link
              href="/verified-calls"
              className="inline-block mt-3 text-[11px] text-zinc-500 hover:text-zinc-300"
            >
              Browse receipts →
            </Link>
          </div>
        )}

        {!loading && detail && <ReceiptDetailView detail={detail} />}
      </div>
    </FeedShell>
  );
}
