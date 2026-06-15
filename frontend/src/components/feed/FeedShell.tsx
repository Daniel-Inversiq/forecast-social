"use client";



import { ScryLogo } from "@/components/brand/ScryLogo";

import { AppNav } from "@/components/AppNav";

import { AuthHeader } from "@/components/AuthHeader";

import { useSearch } from "@/components/search/SearchProvider";

import { FEED_SHELL_MAX } from "@/lib/slugs";

import { MobileBottomNav } from "@/components/layout/MobileBottomNav";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import Link from "next/link";
import { CategoryNav } from "./CategoryNav";



function SearchTrigger({ className = "" }: { className?: string }) {

  const { openSearch } = useSearch();

  return (

    <button

      type="button"

      onClick={openSearch}

      className={`relative w-full h-8 pl-8 pr-12 text-left text-[11px] rounded-lg bg-zinc-900/80 border border-zinc-800/90 text-zinc-500 hover:text-zinc-400 hover:border-violet-500/30 focus:outline-none focus:border-violet-500/40 focus:ring-1 focus:ring-violet-500/20 transition ${className}`}

      aria-label="Open universal search"

    >

      <svg

        className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-600"

        viewBox="0 0 20 20"

        fill="currentColor"

        aria-hidden

      >

        <path

          fillRule="evenodd"

          d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z"

          clipRule="evenodd"

        />

      </svg>

      <span className="truncate">Search agents, markets, battles...</span>

      <kbd className="absolute right-2 top-1/2 -translate-y-1/2 hidden sm:inline text-[8px] text-zinc-600 border border-zinc-800 px-1 py-0.5 rounded font-mono">

        ⌘K

      </kbd>

    </button>

  );

}



export function FeedShell({

  children,

  activeNav = "Feed",

  activeCategory,

  onCategoryChange,

  liveCount,

  hideCategoryNav = false,

  headerExtra,

}: {

  children: React.ReactNode;

  activeNav?: string;

  activeCategory?: string;

  onCategoryChange?: (key: string) => void;

  liveCount?: number;

  /** Agents and other pages reuse the header without market category chips */

  hideCategoryNav?: boolean;

  headerExtra?: React.ReactNode;

}) {

  const { openSearch } = useSearch();

  const hasCategoryNav =
    !hideCategoryNav && activeCategory != null && onCategoryChange != null;

  return (

    <div
      className={`min-h-screen text-zinc-100 feed-shell-atmosphere scry-shell${
        hasCategoryNav ? " scry-shell--with-category-nav" : ""
      }`}
    >

      <header className="scry-site-header border-b border-zinc-700/50 scry-surface-section backdrop-blur-md supports-[backdrop-filter]:bg-[color-mix(in_srgb,var(--scry-bg-section)_88%,transparent)]">

        <div className={`${FEED_SHELL_MAX} mx-auto px-3 sm:px-5 lg:px-6`}>

          <div className="flex items-center gap-3 sm:gap-4 h-12 sm:h-[52px]">

            <div className="flex items-center min-w-0 shrink-0">
              <ScryLogo size="nav" className="shrink-0" />
              <div className="hidden lg:block ml-5 sm:ml-6">
                <AppNav active={activeNav} />
              </div>
              <div className="lg:hidden ml-3">
                <AppNav active={activeNav} mobileMenuOnly />
              </div>
            </div>

            <div className="flex-1 min-w-0" aria-hidden />

            <div className="hidden lg:flex items-center flex-1 max-w-[280px] xl:max-w-[340px] mx-1">

              <SearchTrigger />

            </div>

            <button

              type="button"

              onClick={openSearch}

              className="scry-tap-target lg:hidden p-2 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800/60 transition shrink-0"

              aria-label="Search"

            >

              <svg className="w-[18px] h-[18px]" viewBox="0 0 20 20" fill="currentColor" aria-hidden>

                <path

                  fillRule="evenodd"

                  d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z"

                  clipRule="evenodd"

                />

              </svg>

            </button>

            <NotificationBell />

            <AuthHeader activeNav={activeNav} />

          </div>

          {!hideCategoryNav && activeCategory != null && onCategoryChange != null && (

            <div className="hidden md:block">

              <CategoryNav active={activeCategory} onSelect={onCategoryChange} liveCount={liveCount} />

            </div>

          )}

          {headerExtra}

        </div>

        {!hideCategoryNav && activeCategory != null && onCategoryChange != null && (

          <div className="md:hidden border-t border-zinc-800/50">

            <div className={`${FEED_SHELL_MAX} mx-auto px-3 sm:px-5`}>

              <CategoryNav active={activeCategory} onSelect={onCategoryChange} liveCount={liveCount} />

            </div>

          </div>

        )}

      </header>

      <div className="scry-header-spacer" aria-hidden />

      <div className={`${FEED_SHELL_MAX} mx-auto px-3 sm:px-5 lg:px-6 scry-main-pad`}>{children}</div>

      <footer className="border-t border-zinc-800/60 bg-zinc-950/80">
        <div className={`${FEED_SHELL_MAX} mx-auto px-3 sm:px-5 lg:px-6 py-3`}>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-[10px] text-zinc-600">
              Forecasts are opinions, not financial advice.
            </p>
            <nav className="flex items-center gap-3 text-[11px] text-zinc-500">
              <Link href="/terms" className="hover:text-zinc-300 transition">
                Terms
              </Link>
              <Link href="/privacy" className="hover:text-zinc-300 transition">
                Privacy
              </Link>
              <Link href="/risk" className="hover:text-zinc-300 transition">
                Risk Disclosure
              </Link>
            </nav>
          </div>
        </div>
      </footer>

      <MobileBottomNav activeNav={activeNav} />

    </div>

  );

}


