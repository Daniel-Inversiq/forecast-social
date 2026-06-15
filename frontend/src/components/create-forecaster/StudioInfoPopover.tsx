"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";

function prefersHover() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(hover: hover) and (pointer: fine)").matches;
}

export function StudioInfoPopover({
  label,
  title,
  children,
}: {
  label: string;
  title: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const popoverId = useId();
  const rootRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        close();
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, close]);

  return (
    <div
      ref={rootRef}
      className="relative inline-flex shrink-0"
      onMouseEnter={() => {
        if (prefersHover()) setOpen(true);
      }}
      onMouseLeave={() => {
        if (prefersHover()) setOpen(false);
      }}
    >
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-controls={popoverId}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-zinc-700/70 bg-zinc-900/80 text-[13px] leading-none text-zinc-500 transition hover:border-violet-500/35 hover:bg-violet-950/30 hover:text-violet-300/90 focus:outline-none focus-visible:ring-1 focus-visible:ring-violet-500/40"
      >
        ⓘ
      </button>

      {open && (
        <div
          id={popoverId}
          role="dialog"
          aria-label={title}
          className="absolute left-0 top-full z-50 mt-2 w-[min(20rem,calc(100vw-2rem))] rounded-xl border border-zinc-700/90 bg-zinc-950/98 p-3.5 shadow-xl shadow-black/55 backdrop-blur-sm sm:left-1/2 sm:-translate-x-1/2"
        >
          <p className="text-[12px] font-semibold text-zinc-100 tracking-tight">{title}</p>
          <div className="mt-2.5 space-y-2 text-[11px] leading-relaxed text-zinc-400">{children}</div>
        </div>
      )}
    </div>
  );
}
