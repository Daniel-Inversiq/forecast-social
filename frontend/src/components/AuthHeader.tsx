"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { NavFeaturedReputationMarks } from "@/components/milestones/NavFeaturedReputationMarks";
import { WalletIdentityChip } from "@/components/wallet/WalletIdentityChip";
import { AccountMenu } from "@/components/AccountMenu";
import { NavUserAvatar } from "@/components/NavUserAvatar";
import { useAuth } from "@/context/AuthProvider";
import { apiFetch } from "@/lib/api";
import { userProfilePath } from "@/lib/slugs";
import { hasVerifiedWallet } from "@/lib/wallet/identity";
import { useUserFeaturedMarks } from "@/lib/useUserFeaturedMarks";

export function AuthHeader({ activeNav }: { activeNav?: string } = {}) {
  const { user, loading } = useAuth();
  const { marks: featuredMarks } = useUserFeaturedMarks(user?.username);
  const [hasCapitalBalance, setHasCapitalBalance] = useState(false);

  useEffect(() => {
    if (!user) return;
    const t = window.setTimeout(async () => {
      try {
        const res = await apiFetch("/me/conviction-balance");
        if (!res.ok) return;
        const data = (await res.json()) as {
          available_balance: number;
          locked_balance: number;
          total_exposure: number;
        };
        if ((data.available_balance ?? 0) > 0 || (data.locked_balance ?? 0) > 0 || (data.total_exposure ?? 0) > 0) {
          setHasCapitalBalance(true);
        }
      } catch {
        /* ignore */
      }
    }, 0);
    return () => clearTimeout(t);
  }, [user]);

  if (loading) {
    return <div className="h-8 w-20 rounded-lg bg-zinc-800/60 animate-pulse" />;
  }

  if (!user) {
    return (
      <div className="flex items-center gap-1.5 sm:gap-2">
        <Link
          href="/login"
          className="text-xs sm:text-sm text-zinc-500 hover:text-white transition px-2.5 sm:px-3 py-1.5 rounded-lg border border-zinc-800 hover:border-zinc-600"
        >
          Sign in
        </Link>
        <Link
          href="/register"
          className="hidden sm:inline text-sm font-medium text-zinc-950 bg-white hover:bg-zinc-200 transition px-3 py-1.5 rounded-lg"
        >
          Join waitlist
        </Link>
      </div>
    );
  }

  const hasCapital = hasVerifiedWallet(user) || hasCapitalBalance;

  return (
    <div className="flex items-center gap-1.5 sm:gap-2">
      <div className="flex items-center rounded-lg hover:bg-zinc-800/60 transition">
        <Link
          href={userProfilePath(user.username)}
          className="flex items-center gap-2 px-1.5 py-1 -mx-0.5 cursor-pointer group"
          aria-label={`View @${user.username} profile`}
        >
          <NavUserAvatar
            username={user.username}
            name={user.username}
            fallbackColor={user.avatar_color ?? "#7c3aed"}
            className="group-hover:ring-zinc-700/80 transition"
          />
          <span className="flex items-center gap-1.5 min-w-0">
            <span className="text-sm text-zinc-300 hidden sm:inline group-hover:text-white transition truncate">
              @{user.username}
            </span>
            {featuredMarks.length > 0 && (
              <NavFeaturedReputationMarks marks={featuredMarks} limit={2} />
            )}
          </span>
          <span className="hidden md:inline-flex">
            <WalletIdentityChip identity={user} compact showChain={false} />
          </span>
        </Link>
        <AccountMenu activeNav={activeNav} />
      </div>
      <Link
        href="/premium"
        className={`hidden xl:inline text-[11px] px-2 py-1 rounded-lg border transition ${
          activeNav === "Premium"
            ? "text-amber-200 border-amber-500/35 bg-amber-500/10"
            : "text-zinc-500 border-zinc-800 hover:text-amber-200 hover:border-amber-500/30"
        }`}
      >
        Premium
      </Link>
      {hasCapital && (
        <Link
          href="/me/conviction"
          className="hidden xl:inline text-[11px] px-2 py-1 rounded-lg border border-violet-500/25 text-violet-200 bg-violet-500/8 hover:bg-violet-500/14 transition"
        >
          Capital
        </Link>
      )}
    </div>
  );
}
