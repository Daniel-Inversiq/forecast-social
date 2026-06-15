"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/context/AuthProvider";
import { ACCOUNT_NAV, PRIMARY_NAV } from "@/lib/slugs";
import { pathnameMatchesNav } from "@/lib/nav";
import { clearOnboardingLocal, resetOnboarding } from "@/lib/onboarding";
import { OnboardingBadge } from "@/components/OnboardingBadge";

function navLinkClass(isActive: boolean) {
  return `text-sm px-3 py-1.5 rounded-full whitespace-nowrap font-medium transition-[color,background-color] duration-200 ${
    isActive
      ? "text-zinc-50 bg-zinc-800/90 ring-1 ring-zinc-600/60"
      : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/50"
  }`;
}

const menuItemClass = (isActive: boolean) =>
  `block w-full text-left px-3 py-2 text-sm transition ${
    isActive
      ? "text-white bg-zinc-800/80"
      : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/40"
  }`;

export function AppNav({
  active,
  mobileMenuOnly = false,
}: {
  active: string;
  /** @deprecated Compact centered layout removed */
  compact?: boolean;
  /** Hamburger + sheet only — for mobile header when bottom nav is primary */
  mobileMenuOnly?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [resetting, setResetting] = useState(false);

  function isNavActive(label: string, href: string) {
    const pathMatch = pathnameMatchesNav(pathname, label, href);
    if (label === "Agents") return pathMatch;
    return active === label || pathMatch;
  }

  function isAccountActive(label: string, href: string) {
    return active === label || pathnameMatchesNav(pathname, label, href);
  }

  async function handleResetOnboarding() {
    setResetting(true);
    try {
      await resetOnboarding();
    } catch {
      clearOnboardingLocal();
    }
    router.push("/onboarding");
    setResetting(false);
  }

  return (
    <div className="flex items-center gap-1.5 min-w-0">
      <button
        type="button"
        onClick={() => setMobileOpen((open) => !open)}
        aria-expanded={mobileOpen}
        aria-label="Open navigation menu"
        className="lg:hidden shrink-0 p-2 -m-1 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800/60 transition scry-tap-target"
      >
        <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
          <path
            fillRule="evenodd"
            d="M2.75 5.5A.75.75 0 013.5 4.75h13a.75.75 0 010 1.5h-13A.75.75 0 012.75 5.5zm0 4.5a.75.75 0 01.75-.75h13a.75.75 0 010 1.5h-13a.75.75 0 01-.75-.75zm0 4.5a.75.75 0 01.75-.75h13a.75.75 0 010 1.5h-13a.75.75 0 01-.75-.75z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-[60] bg-black/50 scry-backdrop-dismiss"
          onClick={() => setMobileOpen(false)}
          aria-hidden
        />
      )}

      {mobileOpen && (
        <nav
          className="lg:hidden fixed top-[var(--scry-header-h)] left-0 right-0 z-[70] border-b border-zinc-800 bg-zinc-950/98 backdrop-blur-md px-4 py-3 max-h-[min(75vh,100dvh-8rem)] overflow-y-auto shadow-xl shadow-black/40 pb-[max(1rem,env(safe-area-inset-bottom))]"
          aria-label="Mobile navigation"
        >
          <div className="flex flex-col gap-0.5">
            {PRIMARY_NAV.map(({ label, href }) => (
              <Link
                key={label}
                href={href}
                onClick={() => setMobileOpen(false)}
                className={navLinkClass(isNavActive(label, href))}
              >
                {label}
              </Link>
            ))}
            {user && (
              <>
                <p className="text-[10px] uppercase tracking-wider text-zinc-700 px-2.5 pt-3 pb-1">
                  Account
                </p>
                {ACCOUNT_NAV.map(({ label, href }) => (
                  <Link
                    key={label}
                    href={href}
                    onClick={() => setMobileOpen(false)}
                    className={menuItemClass(isAccountActive(label, href))}
                  >
                    {label}
                  </Link>
                ))}
              </>
            )}
            <button
              type="button"
              disabled={resetting}
              onClick={() => {
                setMobileOpen(false);
                handleResetOnboarding();
              }}
              className={`${menuItemClass(false)} disabled:opacity-50 disabled:cursor-not-allowed mt-2`}
            >
              {resetting ? "Resetting…" : "Reset onboarding"}
            </button>
          </div>
        </nav>
      )}

      {!mobileMenuOnly && (
        <nav
          className="hidden lg:flex items-center gap-1 min-w-0"
          aria-label="Primary navigation"
        >
          {PRIMARY_NAV.map(({ label, href }) => (
            <Link key={label} href={href} className={navLinkClass(isNavActive(label, href))}>
              {label}
            </Link>
          ))}
        </nav>
      )}
      {!mobileMenuOnly && <OnboardingBadge />}
    </div>
  );
}
