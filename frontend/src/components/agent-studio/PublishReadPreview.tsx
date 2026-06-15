"use client";

import { Avatar } from "@/components/feed/shared";
import {
  formatAuthorTrustRankLine,
  formatConvictionLine,
  getConvictionLevel,
} from "@/components/public-reads/publicReadEnrichment";
import { ForecastThesisLine } from "@/components/forecast/ForecastThesisLine";
import { formatPublicReadThesis } from "@/components/public-reads/publicReadEnrichment";
import { PublicReadPotentialImpact } from "@/components/public-reads/PublicReadParts";
import type { PublicRead, PublicReadSide } from "@/components/public-reads/types";

type PublishReadPreviewProps = {
  authorName: string;
  authorAvatar?: string;
  authorTrustTier: string;
  authorRankLabel?: string;
  title: string;
  marketOrEvent: string;
  probability: number;
  side: PublicReadSide;
  thesis: string;
  consensus?: number;
};

export function PublishReadPreview({
  authorName,
  authorAvatar,
  authorTrustTier,
  authorRankLabel,
  title,
  marketOrEvent,
  probability,
  side,
  thesis,
  consensus = 41,
}: PublishReadPreviewProps) {
  const conviction = getConvictionLevel(probability);
  const previewRead = {
    id: "preview",
    authorId: "preview",
    authorName,
    authorHandle: "preview",
    authorAvatar,
    authorTrustTier,
    authorCredibility: 0,
    authorRankLabel,
    title: title || "Forecast title",
    marketOrNarrative: marketOrEvent || "Market / event",
    side,
    probability,
    thesis: thesis || "Thesis preview will appear here once you draft your read.",
    category: "Macro" as const,
    status: "open" as const,
    createdAt: new Date().toISOString(),
    consensusAtPost: consensus,
    currentConsensus: consensus,
    backersCount: 0,
    challengersCount: 0,
    publicReadsCount: 0,
    tags: [],
  } satisfies PublicRead;

  const sideTone = side === "YES" ? "text-emerald-300" : "text-rose-300";

  return (
    <div className="rounded-xl border border-zinc-800/90 bg-zinc-950/80 overflow-hidden shadow-lg shadow-violet-950/20">
      <div className="px-3 py-2 border-b border-zinc-800/80 bg-zinc-900/50">
        <p className="text-[9px] uppercase tracking-wider text-violet-400/90 font-medium">
          Public read preview
        </p>
      </div>
      <div className="p-3.5 space-y-3">
        <div className="flex gap-2.5">
          <Avatar name={authorName} color={authorAvatar} size="md" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-zinc-50 truncate">{authorName}</p>
            <p className="text-[10px] font-medium text-violet-200/90 tabular-nums">
              {formatAuthorTrustRankLine(previewRead)}
            </p>
          </div>
        </div>

        <div>
          <p className="text-[11px] text-zinc-400 leading-snug">
            {marketOrEvent || "Market / event"}
          </p>
          <p className="text-sm font-semibold text-zinc-100 mt-1 leading-snug">
            {title || "Forecast title"}
          </p>
          <ForecastThesisLine
            thesis={formatPublicReadThesis(previewRead)}
            className="mt-1"
          />
        </div>

        <div className="flex flex-wrap items-end gap-x-4 gap-y-1">
          <p className={`text-xl font-bold tabular-nums leading-none ${sideTone}`}>
            {formatConvictionLine(probability, side)}
          </p>
          <div className="text-[10px] text-zinc-500">
            <span className="uppercase tracking-wider text-zinc-600 block text-[9px]">Consensus</span>
            <span className="tabular-nums text-zinc-300 font-medium">{consensus}%</span>
          </div>
        </div>

        {conviction && (
          <p className={`text-xs font-medium -mt-1 ${conviction.toneClass}`}>{conviction.label}</p>
        )}

        <PublicReadPotentialImpact read={previewRead} compact />
      </div>
    </div>
  );
}
