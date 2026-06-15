"use client";

import { useState } from "react";

export function MobileIntelRail({
  title,
  subtitle,
  defaultOpen = false,
  priority = "normal",
  children,
}: {
  title: string;
  subtitle?: string;
  defaultOpen?: boolean;
  /** high = open by default on mobile */
  priority?: "high" | "normal" | "low";
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen || priority === "high");

  return (
    <section className="lg:hidden scry-intel-rail rounded-xl border border-zinc-800/70 bg-zinc-950/80 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="scry-tap-target w-full flex items-center gap-3 px-3 py-2.5 text-left transition hover:bg-zinc-900/50"
        aria-expanded={open}
      >
        <span
          className={`shrink-0 w-1 h-8 rounded-full ${
            priority === "high" ? "bg-violet-500/70" : "bg-zinc-700/80"
          }`}
          aria-hidden
        />
        <span className="flex-1 min-w-0">
          <span className="block text-[11px] font-semibold text-zinc-200 tracking-tight">{title}</span>
          {subtitle && (
            <span className="block text-[10px] text-zinc-600 truncate mt-0.5">{subtitle}</span>
          )}
        </span>
        <svg
          className={`w-4 h-4 text-zinc-600 shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.94a.75.75 0 111.08 1.04l-4.24 4.5a.75.75 0 01-1.08 0l-4.24-4.5a.75.75 0 01.02-1.06z"
            clipRule="evenodd"
          />
        </svg>
      </button>
      <div
        className={`scry-intel-rail-panel grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="overflow-hidden min-h-0">
          <div className="px-3 pb-3 pt-0 border-t border-zinc-800/50">{children}</div>
        </div>
      </div>
    </section>
  );
}

export function PageIntelGrid({
  children,
  sidebar,
  sidebarPriority = "normal",
  sidebarTitle = "Intelligence rail",
  sidebarSubtitle,
}: {
  children: React.ReactNode;
  sidebar?: React.ReactNode;
  sidebarPriority?: "high" | "normal" | "low";
  sidebarTitle?: string;
  sidebarSubtitle?: string;
}) {
  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[minmax(0,1fr)_340px] lg:gap-4 xl:gap-5 min-w-0">
      <main className="min-w-0">{children}</main>
      {sidebar && (
        <>
          <aside className="hidden lg:block min-w-0 sticky top-[52px] max-h-[calc(100dvh-4rem)] overflow-y-auto scrollbar-none">
            {sidebar}
          </aside>
          <div className="lg:hidden mt-3 min-w-0">
            <MobileIntelRail
              title={sidebarTitle}
              subtitle={sidebarSubtitle}
              priority={sidebarPriority}
            >
              {sidebar}
            </MobileIntelRail>
          </div>
        </>
      )}
    </div>
  );
}
