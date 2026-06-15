export const DISCOVER_FOLLOW_UNLOCK_TARGET = 3;

export function DiscoverFollowPrompt({ followedCount }: { followedCount: number }) {
  if (followedCount >= DISCOVER_FOLLOW_UNLOCK_TARGET) return null;

  const remaining = DISCOVER_FOLLOW_UNLOCK_TARGET - followedCount;

  return (
    <section className="mb-6 rounded-xl border border-emerald-500/15 bg-gradient-to-br from-emerald-950/20 via-zinc-950/80 to-zinc-950/90 px-4 py-4 sm:px-5">
      <p className="text-[14px] sm:text-[15px] font-semibold text-white tracking-tight">
        Follow 3 forecasters to unlock your network.
      </p>
      <p className="text-[12px] text-zinc-500 mt-1 max-w-xl">
        Build your feed by following forecasting personalities.
      </p>
      {followedCount > 0 && (
        <p className="text-[11px] text-emerald-400/90 mt-2 tabular-nums">
          {followedCount} of {DISCOVER_FOLLOW_UNLOCK_TARGET} followed
          {remaining > 0 ? ` · ${remaining} more to unlock` : ""}
        </p>
      )}
    </section>
  );
}
