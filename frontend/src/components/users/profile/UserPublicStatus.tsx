"use client";

import Link from "next/link";
import {
  STATUS_LABEL_STYLES,
  visibilityCopy,
  type PublicStatusMomentPayload,
  type PublicStatusProfileBlock,
} from "@/lib/publicStatus";
import { formatTimeAgo } from "@/components/feed/shared";

function StatusMomentRow({ moment }: { moment: PublicStatusMomentPayload }) {
  const labelStyle = STATUS_LABEL_STYLES[moment.label] ?? STATUS_LABEL_STYLES["Public read"];
  const visibility = visibilityCopy(moment.visibility);

  return (
    <div className="rounded-lg border border-zinc-800/70 bg-zinc-900/35 px-3 py-2.5">
      <div className="flex items-center gap-2 flex-wrap mb-1">
        <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded border ${labelStyle}`}>
          {moment.label}
        </span>
        {moment.days_early != null && moment.days_early > 0 && (
          <span className="text-[9px] text-sky-300/70 tabular-nums">{moment.days_early}d early</span>
        )}
        {moment.validated_at && (
          <span className="text-[9px] text-zinc-600 ml-auto tabular-nums">
            {formatTimeAgo(moment.validated_at)}
          </span>
        )}
      </div>
      <p className="text-[12px] text-zinc-200 leading-snug">{moment.headline.replace(/^@\S+\s/, "")}</p>
      {moment.market_title && (
        <p className="text-[10px] text-zinc-500 mt-1 truncate">{moment.market_title}</p>
      )}
      {visibility && <p className="text-[9px] text-zinc-600 mt-1">{visibility}</p>}
      {moment.receipt_href && (
        <Link
          href={moment.receipt_href}
          className="inline-block text-[10px] text-emerald-400/85 hover:text-emerald-300 mt-1.5"
        >
          View receipt →
        </Link>
      )}
    </div>
  );
}

export function UserPublicStatus({ block }: { block: PublicStatusProfileBlock | null | undefined }) {
  if (!block?.moments?.length) return null;

  return (
    <div className="rounded-xl border border-zinc-800/85 bg-zinc-950/90 p-4 feed-hover-lift">
      <div className="flex items-center justify-between gap-2 mb-3">
        <p className="text-[9px] uppercase tracking-wider text-zinc-600">Public status</p>
        {block.public_streak && (
          <span className="text-[9px] text-violet-300/80 border border-violet-500/20 px-1.5 py-0.5 rounded">
            {block.public_streak.label}
          </span>
        )}
      </div>

      <div className="space-y-2">
        {block.moments.slice(0, 4).map((m) => (
          <StatusMomentRow key={m.id} moment={m} />
        ))}
      </div>

      {(block.early_calls.length > 0 || block.successful_challenges.length > 0) && (
        <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-zinc-800/60">
          {block.early_calls[0] && (
            <div>
              <p className="text-[8px] uppercase tracking-wider text-zinc-600 mb-1">Early call</p>
              <p className="text-[10px] text-zinc-400 line-clamp-2">
                {block.early_calls[0].headline.replace(/^@\S+\s/, "")}
              </p>
            </div>
          )}
          {block.successful_challenges[0] && (
            <div>
              <p className="text-[8px] uppercase tracking-wider text-zinc-600 mb-1">Challenge</p>
              <p className="text-[10px] text-zinc-400 line-clamp-2">
                {block.successful_challenges[0].headline.replace(/^@\S+\s/, "")}
              </p>
            </div>
          )}
        </div>
      )}

      {block.most_visible_read && (
        <p className="text-[10px] text-zinc-500 mt-3 pt-2 border-t border-zinc-800/50">
          Most visible read:{" "}
          <span className="text-zinc-400">
            {block.most_visible_read.headline.replace(/^@\S+\s/, "")}
          </span>
        </p>
      )}
    </div>
  );
}
