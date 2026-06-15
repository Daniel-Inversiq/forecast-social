"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { usePublicReads } from "./PublicReadsProvider";
import { profileMetrics, readsForAuthor } from "./publicReadEnrichment";
import { PublicReadCard } from "./PublicReadCard";
import type { PublicRead } from "./types";

type ProfileReadFilter = "open" | "resolved" | "challenged" | "backed";

const FILTERS: { key: ProfileReadFilter; label: string }[] = [
  { key: "open", label: "Open Reads" },
  { key: "resolved", label: "Resolved Reads" },
  { key: "challenged", label: "Challenged Reads" },
  { key: "backed", label: "Backed Reads" },
];

export function ProfilePublicReadsSection({
  authorIdOrHandle,
  authorName,
}: {
  authorIdOrHandle: string;
  authorName: string;
}) {
  const { reads } = usePublicReads();
  const [filter, setFilter] = useState<ProfileReadFilter>("open");

  const authorReads = useMemo(
    () => readsForAuthor(reads, authorIdOrHandle),
    [reads, authorIdOrHandle],
  );

  const metrics = useMemo(
    () => profileMetrics(reads, authorIdOrHandle),
    [reads, authorIdOrHandle],
  );

  const filtered = useMemo(() => {
    switch (filter) {
      case "resolved":
        return authorReads.filter((r) => r.status === "resolved");
      case "challenged":
        return authorReads.filter(
          (r) => r.status === "challenged" || r.challengersCount > 0,
        );
      case "backed":
        return authorReads.filter((r) => r.backersCount > 0 || r.status === "backed");
      default:
        return authorReads.filter((r) => r.status !== "resolved");
    }
  }, [authorReads, filter]);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-zinc-100">Public Reads</h2>
        <p className="text-[11px] text-zinc-500 mt-0.5">
          On-record forecasts by {authorName} — live conviction before receipts.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          { label: "Posted", value: metrics.posted },
          { label: "Backed", value: metrics.backed },
          { label: "Challenges", value: metrics.challenges },
          { label: "Resolved", value: metrics.resolved },
        ].map((m) => (
          <div
            key={m.label}
            className="rounded-lg border border-zinc-800/70 bg-zinc-900/40 px-2.5 py-2"
          >
            <p className="text-[8px] uppercase tracking-wider text-zinc-600">{m.label}</p>
            <p className="text-sm font-semibold text-white tabular-nums">{m.value}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-1 overflow-x-auto feed-scroll-x scrollbar-none">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={`shrink-0 px-2.5 py-1 text-[11px] rounded-lg border transition ${
              filter === f.key
                ? "profile-tab-active text-white border-transparent"
                : "border-zinc-800/90 text-zinc-500 hover:border-violet-500/30"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="py-8 text-center border border-dashed border-zinc-800 rounded-xl">
          <p className="text-sm text-zinc-200 font-medium">No reads yet</p>
          <p className="text-[11px] text-zinc-500 mt-1 mb-3">
            Public reads show this agent&apos;s thesis before outcomes settle. That is where trust starts.
          </p>
          <Link href="/reads" className="text-[11px] text-violet-400 hover:text-violet-300">
            Publish First Read →
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((read: PublicRead) => (
            <PublicReadCard key={read.id} read={read} />
          ))}
        </div>
      )}
    </div>
  );
}
