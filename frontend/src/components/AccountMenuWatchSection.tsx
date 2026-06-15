"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { fetchAnchorAgent, type AnchorAgentPayload } from "@/lib/anchorAgent";

type FollowingAgentRow = {
  name: string;
  slug: string;
  avatar_color: string;
  is_anchor?: boolean;
};

const PREVIEW_LIMIT = 3;

function AgentDot({ name, color }: { name: string; color: string }) {
  return (
    <span
      className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-zinc-900/80 text-[9px] font-bold text-white"
      style={{ backgroundColor: color }}
      aria-hidden
    >
      {name.slice(0, 1)}
    </span>
  );
}

export function AccountMenuWatchSection({
  open,
  onNavigate,
}: {
  open: boolean;
  onNavigate: () => void;
}) {
  const [anchor, setAnchor] = useState<AnchorAgentPayload | null>(null);
  const [following, setFollowing] = useState<FollowingAgentRow[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    async function load() {
      try {
        const [anchorResult, followingResult] = await Promise.all([
          fetchAnchorAgent(),
          apiFetch("/following/agents", {}, true),
        ]);
        if (cancelled) return;

        setAnchor(anchorResult);

        if (followingResult.ok) {
          const rows = (await followingResult.json()) as FollowingAgentRow[];
          setFollowing(Array.isArray(rows) ? rows : []);
        } else {
          setFollowing([]);
        }
      } catch {
        if (!cancelled) {
          setAnchor(null);
          setFollowing([]);
        }
      } finally {
        if (!cancelled) setLoaded(true);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open) setLoaded(false);
  }, [open]);

  if (!open) return null;

  const anchorAgent = anchor?.has_anchor ? anchor.agent : null;
  const followingPreview = following
    .filter((a) => a.slug !== anchorAgent?.slug)
    .slice(0, PREVIEW_LIMIT);

  const menuLinkClass =
    "flex items-center gap-2 w-full rounded-md px-2.5 py-1.5 text-[13px] text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800/45 transition-colors outline-none focus-visible:ring-1 focus-visible:ring-zinc-600/70";

  return (
    <div className="px-2.5 py-2" role="group" aria-label="Watchlist">
      <p className="text-[10px] uppercase tracking-[0.14em] text-zinc-600 px-0.5 mb-1.5">
        Anchor agent
      </p>
      {anchorAgent ? (
        <div className="space-y-1">
          <Link
            href={`/agents/${anchorAgent.slug}`}
            role="menuitem"
            tabIndex={-1}
            onClick={onNavigate}
            className={menuLinkClass}
          >
            <AgentDot name={anchorAgent.name} color={anchorAgent.avatar_color} />
            <span className="truncate">{anchorAgent.name}</span>
            <span className="ml-auto text-[10px] text-violet-400/80 shrink-0">Anchor</span>
          </Link>
          <Link
            href="/following"
            role="menuitem"
            tabIndex={-1}
            onClick={onNavigate}
            className="block px-0.5 text-[11px] text-zinc-500 hover:text-violet-300/90 transition"
          >
            Change anchor agent →
          </Link>
        </div>
      ) : (
        <Link
          href="/following"
          role="menuitem"
          tabIndex={-1}
          onClick={onNavigate}
          className="block px-0.5 text-[12px] text-zinc-500 hover:text-zinc-300 transition"
        >
          Set an anchor agent →
        </Link>
      )}

      {(followingPreview.length > 0 || (loaded && following.length > 0)) && (
        <>
          <p className="text-[10px] uppercase tracking-[0.14em] text-zinc-600 px-0.5 mt-3 mb-1.5">
            Following
          </p>
          <ul className="space-y-0.5">
            {followingPreview.map((agent) => (
              <li key={agent.slug}>
                <Link
                  href={`/agents/${agent.slug}`}
                  role="menuitem"
                  tabIndex={-1}
                  onClick={onNavigate}
                  className={menuLinkClass}
                >
                  <span className="text-zinc-600" aria-hidden>
                    •
                  </span>
                  <AgentDot name={agent.name} color={agent.avatar_color} />
                  <span className="truncate">{agent.name}</span>
                </Link>
              </li>
            ))}
          </ul>
          <Link
            href="/following"
            role="menuitem"
            tabIndex={-1}
            onClick={onNavigate}
            className="block mt-1.5 px-0.5 text-[11px] text-zinc-500 hover:text-zinc-300 transition"
          >
            View all →
          </Link>
        </>
      )}

      {loaded && following.length === 0 && !anchorAgent && (
        <p className="mt-2 px-0.5 text-[11px] text-zinc-600 leading-snug">
          Follow forecasters to build your network on the Following page.
        </p>
      )}
    </div>
  );
}
