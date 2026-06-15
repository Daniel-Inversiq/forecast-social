"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { useAuth } from "@/context/AuthProvider";
import {
  MOBILE_BOTTOM_NAV,
  MOBILE_MORE_NAV,
  resolveMobileNavActive,
} from "@/lib/mobileNav";
import { pathnameMatchesNav } from "@/lib/nav";
import { ACCOUNT_NAV } from "@/lib/slugs";

function moreNavActive(pathname: string, activeNav: string, label: string, href: string) {
  if (activeNav === label) return true;
  return pathnameMatchesNav(pathname, label, href);
}

function NavIcon({ name, active }: { name: string; active: boolean }) {
  const opacity = active ? 1 : 0.5;
  const icons: Record<string, ReactNode> = {
    feed: (
      <path
        d="M3.5 4.5h13v11h-13V4.5zm2 2v7h9v-7h-9zm1.5 1.5h6v1h-6v-1z"
        fill="currentColor"
        opacity={opacity}
      />
    ),
    agents: (
      <path
        d="M10 3a3.25 3.25 0 100 6.5 3.25 3.25 0 000-6.5zM4.5 15.25a5.5 5.5 0 1111 0v.75H4.5v-.75z"
        fill="currentColor"
        opacity={opacity}
      />
    ),
    battles: (
      <path
        d="M4.5 5.5L8 9l-3.5 3.5L5.5 13 9 8.5 5.5 5l-1-1zm11 0l1 1L13 8.5 16.5 12 15 13.5 11.5 10 15 6.5l1-1zM10 11.5l1.5 1.5L10 14.5 8.5 13 10 11.5z"
        fill="currentColor"
        opacity={opacity}
      />
    ),
    markets: (
      <path
        d="M4 14V8l3-4 3 3 3-5 3 7v5H4zm1.5-1h9v-3.2L11.5 6 9 8.5 6.5 5.5 5.5 12V13z"
        fill="currentColor"
        opacity={opacity}
      />
    ),
    receipts: (
      <path
        d="M5 2.5h10V17l-2-1.2-1.7 1.2-1.3-1-1.3 1-1.7-1.2L5 17V2.5zm2.6 7.1l1.7 1.7 3.4-3.6-1.05-1.05-2.35 2.5-.65-.6L7.6 9.6z"
        fill="currentColor"
        opacity={opacity}
      />
    ),
    rankings: (
      <path
        d="M5 14.5V9h2.5v5.5H5zm4.25 0V5.5h2.5v9h-2.5zM13.5 14.5V11H16v3.5h-2.5z"
        fill="currentColor"
        opacity={opacity}
      />
    ),
  };
  return (
    <svg className="w-5 h-5" viewBox="0 0 20 20" aria-hidden>
      {icons[name] ?? icons.feed}
    </svg>
  );
}

export function MobileBottomNav({ activeNav }: { activeNav: string }) {
  const pathname = usePathname();
  const { user } = useAuth();
  const [moreOpen, setMoreOpen] = useState(false);
  const resolved = resolveMobileNavActive(activeNav);
  const moreActive = resolved === "More";
  const showMore = MOBILE_MORE_NAV.length > 0;

  function isActive(label: string, href: string) {
    if (resolved === label) return true;
    return pathnameMatchesNav(pathname, label, href);
  }

  return (
    <>
      {moreOpen && showMore && (
        <button
          type="button"
          className="lg:hidden fixed inset-0 z-[55] bg-black/60 scry-backdrop-dismiss"
          aria-label="Close menu"
          onClick={() => setMoreOpen(false)}
        />
      )}

      {moreOpen && showMore && (
        <nav
          className="lg:hidden fixed bottom-[calc(3.25rem+env(safe-area-inset-bottom,0px))] left-3 right-3 z-[56] rounded-xl border border-zinc-800/90 bg-zinc-950/98 backdrop-blur-xl shadow-2xl shadow-black/50 p-2 scry-more-sheet"
          aria-label="More"
        >
          <p className="text-[9px] uppercase tracking-[0.14em] text-zinc-600 font-semibold px-2.5 py-1.5">
            Explore
          </p>
          <div className="grid grid-cols-2 gap-0.5">
            {MOBILE_MORE_NAV.map(({ label, href }) => (
              <Link
                key={label}
                href={href}
                onClick={() => setMoreOpen(false)}
                className={`scry-tap-target text-left text-[12px] px-3 py-2.5 rounded-lg transition ${
                  moreNavActive(pathname, activeNav, label, href)
                    ? "text-white bg-zinc-800/90 ring-1 ring-zinc-600/50"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/80"
                }`}
              >
                {label}
              </Link>
            ))}
          </div>
          {user && (
            <>
              <p className="text-[9px] uppercase tracking-[0.14em] text-zinc-600 font-semibold px-2.5 pt-3 pb-1">
                Account
              </p>
              <div className="grid grid-cols-2 gap-0.5">
                {ACCOUNT_NAV.map(({ label, href }) => (
                  <Link
                    key={label}
                    href={href}
                    onClick={() => setMoreOpen(false)}
                    className={`scry-tap-target text-left text-[12px] px-3 py-2.5 rounded-lg transition ${
                      moreNavActive(pathname, activeNav, label, href)
                        ? "text-white bg-zinc-800/90 ring-1 ring-zinc-600/50"
                        : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/80"
                    }`}
                  >
                    {label}
                  </Link>
                ))}
              </div>
            </>
          )}
        </nav>
      )}

      <nav
        className="lg:hidden fixed bottom-0 inset-x-0 z-50 border-t border-zinc-800/80 bg-zinc-950/95 backdrop-blur-xl scry-bottom-nav"
        aria-label="Mobile primary navigation"
      >
        <div
          className={`flex items-stretch justify-around mx-auto px-0.5 pt-1 pb-[max(0.35rem,env(safe-area-inset-bottom))] ${
            showMore ? "max-w-lg" : "max-w-md"
          }`}
        >
          {MOBILE_BOTTOM_NAV.map(({ label, href, icon }) => {
            const active = isActive(label, href);
            return (
              <Link
                key={label}
                href={href}
                className={`scry-bottom-nav-item relative flex flex-col items-center justify-center gap-0.5 min-w-[3rem] py-1.5 px-0.5 rounded-lg transition ${
                  active
                    ? "text-white scry-bottom-nav-item--active"
                    : "text-zinc-500 active:text-zinc-300"
                }`}
                aria-current={active ? "page" : undefined}
              >
                <NavIcon name={icon} active={active} />
                <span className="text-[9px] font-medium tracking-tight">{label}</span>
              </Link>
            );
          })}
          {showMore && (
            <button
              type="button"
              onClick={() => setMoreOpen((o) => !o)}
              className={`scry-bottom-nav-item flex flex-col items-center justify-center gap-0.5 min-w-[3rem] py-1.5 px-0.5 rounded-lg transition ${
                moreActive || moreOpen
                  ? "text-white scry-bottom-nav-item--active"
                  : "text-zinc-500 active:text-zinc-300"
              }`}
              aria-expanded={moreOpen}
              aria-label="More"
            >
              <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                <path
                  fillRule="evenodd"
                  d="M3 9.25A.75.75 0 013.75 8.5h12.5a.75.75 0 010 1.5H3.75A.75.75 0 013 9.25zm0 4.5a.75.75 0 01.75-.75h12.5a.75.75 0 010 1.5H3.75a.75.75 0 01-.75-.75zm0-9a.75.75 0 01.75-.75h12.5a.75.75 0 010 1.5H3.75A.75.75 0 013 4.75z"
                  clipRule="evenodd"
                  opacity={moreActive || moreOpen ? 1 : 0.5}
                />
              </svg>
              <span className="text-[9px] font-medium tracking-tight">More</span>
            </button>
          )}
        </div>
      </nav>
    </>
  );
}
