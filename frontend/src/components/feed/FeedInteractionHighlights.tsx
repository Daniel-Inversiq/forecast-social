"use client";

import type { FeedInteractionSummary } from "@/lib/feedInteractions";

function challengeLine(
  username: string,
  probability: number | null | undefined,
  thesis: string | null | undefined,
): string {
  const odds = probability != null ? ` at ${Math.round(probability)}%` : "";
  const quote = thesis
    ? `: '${thesis.length > 100 ? `${thesis.slice(0, 97)}…` : thesis}'`
    : "";
  return `@${username} challenges${odds}${quote}`;
}

export function FeedInteractionHighlights({
  summary,
}: {
  summary: FeedInteractionSummary | undefined;
}) {
  if (!summary) return null;

  const { counts, top_challenge, top_back, avg_back_probability, user_interaction } = summary;
  const hasActivity = counts.backs > 0 || counts.challenges > 0 || user_interaction;

  if (!hasActivity) {
    return (
      <p
        className="text-[9px] text-zinc-600 pt-2 border-t border-zinc-800/35"
        onClick={(e) => e.stopPropagation()}
      >
        No public reads yet — back or challenge to go on record.
      </p>
    );
  }

  return (
    <div
      className="space-y-1 pt-2 border-t border-zinc-800/35"
      onClick={(e) => e.stopPropagation()}
    >
      {top_challenge && (
        <p className="text-[10px] text-rose-200/85 leading-snug">
          {challengeLine(
            top_challenge.user.username,
            top_challenge.user_probability,
            top_challenge.thesis_text,
          )}
        </p>
      )}
      {counts.backs > 0 && (
        <p className="text-[10px] text-emerald-200/75 leading-snug">
          {counts.backs} user{counts.backs === 1 ? "" : "s"} backing consensus
          {avg_back_probability != null && (
            <span className="text-zinc-500">
              {" "}
              · avg read {Math.round(avg_back_probability)}%
            </span>
          )}
        </p>
      )}
      {top_back?.thesis_text && !top_challenge && (
        <p className="text-[10px] text-emerald-200/70 leading-snug line-clamp-2">
          @{top_back.user.username} backs
          {top_back.user_probability != null && ` at ${Math.round(top_back.user_probability)}%`}
          : &ldquo;{top_back.thesis_text}&rdquo;
        </p>
      )}
      {user_interaction && (
        <p className="text-[10px] text-violet-200/80">
          Your read:{" "}
          <span className="capitalize">{user_interaction.interaction_type}</span>
          {user_interaction.user_probability != null && (
            <span> · {Math.round(user_interaction.user_probability)}%</span>
          )}
          {user_interaction.thesis_text && (
            <span className="text-zinc-500"> · {user_interaction.thesis_text.slice(0, 80)}</span>
          )}
        </p>
      )}
    </div>
  );
}

export function FeedInteractionStats({
  summary,
}: {
  summary: FeedInteractionSummary | undefined;
}) {
  if (!summary) return null;
  const { counts, avg_challenge_probability } = summary;
  if (counts.backs === 0 && counts.challenges === 0) return null;

  const parts: string[] = [];
  if (counts.backs > 0) parts.push(`${counts.backs} backed`);
  if (counts.challenges > 0) parts.push(`${counts.challenges} challenged`);
  if (avg_challenge_probability != null && counts.challenges > 0) {
    parts.push(`avg challenge odds ${Math.round(avg_challenge_probability)}%`);
  }

  return (
    <span className="text-[9px] text-zinc-600 tabular-nums">{parts.join(" · ")}</span>
  );
}
