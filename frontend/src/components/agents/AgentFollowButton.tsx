"use client";

import { useState } from "react";

export function AgentFollowButton({
  following,
  onToggle,
  followHover,
  whyFollow,
  feedLens,
  disabled = false,
}: {
  following: boolean;
  onToggle: () => void;
  followHover: string;
  whyFollow: string;
  feedLens: string;
  disabled?: boolean;
}) {
  const [showTip, setShowTip] = useState(false);
  const [justFollowed, setJustFollowed] = useState(false);

  function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;
    const wasFollowing = following;
    onToggle();
    if (!wasFollowing) {
      setJustFollowed(true);
      window.setTimeout(() => setJustFollowed(false), 3200);
    }
  }

  return (
    <div
      className="relative"
      onMouseEnter={() => setShowTip(true)}
      onMouseLeave={() => setShowTip(false)}
      onFocus={() => setShowTip(true)}
      onBlur={() => setShowTip(false)}
    >
      {showTip && !following && !disabled && (
        <div
          className="absolute bottom-full right-0 mb-2 w-[min(240px,calc(100vw-2rem))] z-20 rounded-lg border border-zinc-700/90 bg-zinc-950/98 px-2.5 py-2 shadow-xl shadow-black/50 pointer-events-none"
          role="tooltip"
        >
          <p className="text-[10px] text-zinc-300 leading-snug">{followHover}</p>
          <p className="text-[9px] text-zinc-500 mt-1">{feedLens}</p>
        </div>
      )}

      {justFollowed && (
        <p className="absolute bottom-full right-0 mb-1.5 text-[9px] text-emerald-400/95 whitespace-nowrap z-20 pointer-events-none animate-in fade-in">
          Added to your intelligence feed
        </p>
      )}

      <button
        type="button"
        onClick={handleClick}
        disabled={disabled}
        aria-label={following ? "Unfollow agent" : `Follow — ${whyFollow}`}
        className={`feed-chip-active text-[11px] px-3 py-1 rounded-md font-medium border transition ${
          following
            ? "bg-zinc-800/90 text-zinc-300 border-zinc-700 hover:bg-zinc-700"
            : "bg-white text-zinc-950 border-transparent hover:bg-zinc-200"
        } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
      >
        {following ? "Following" : "Follow"}
      </button>
    </div>
  );
}
