"use client";

import type { ReactNode } from "react";

export function IntelligenceDeskShell({
  title,
  subtitle,
  children,
  className = "",
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`mb-4 rounded-xl border border-amber-500/15 bg-zinc-950/60 overflow-hidden relative ${className}`}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-amber-950/12 via-transparent to-zinc-950 pointer-events-none" />
      <div className="relative px-3 sm:px-4 py-3 border-b border-amber-500/10">
        <p className="text-[9px] uppercase tracking-[0.3em] text-amber-400/75 font-mono mb-1">
          Intelligence Access
        </p>
        <h2 className="text-sm font-semibold text-white">{title}</h2>
        {subtitle && <p className="text-[10px] text-zinc-600 mt-0.5">{subtitle}</p>}
      </div>
      <div className="relative p-3 sm:p-4">{children}</div>
    </section>
  );
}
