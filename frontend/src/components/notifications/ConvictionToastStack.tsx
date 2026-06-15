"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CONVICTION_EVENT_META,
  TOAST_DURATION_MS,
  markConvictionEventRead,
  markConvictionToastShown,
  sortToastQueue,
  type ConvictionEvent,
  type ConvictionPriority,
} from "@/lib/convictionEvents";

function toastDuration(priority: ConvictionPriority): number {
  if (priority === "critical") return TOAST_DURATION_MS.critical;
  if (priority === "important") return TOAST_DURATION_MS.important;
  return 0;
}

function ConvictionToastCard({ event }: { event: ConvictionEvent }) {
  const meta = CONVICTION_EVENT_META[event.type];
  const color = meta?.colorClass ?? "border-zinc-600/70 text-zinc-200";
  const isCritical = event.priority === "critical";

  return (
    <article
      className={`pointer-events-auto rounded-xl border bg-zinc-950/96 backdrop-blur-md transition hover:border-zinc-700/90 ${
        isCritical
          ? "border-zinc-700/90 p-4 shadow-[0_0_40px_-8px_rgba(139,92,246,0.55),0_0_24px_-12px_rgba(244,63,94,0.35)] ring-1 ring-violet-500/25"
          : "border-zinc-800/90 p-3 shadow-2xl shadow-black/40"
      }`}
      role="status"
      aria-live="assertive"
    >
      <div className="flex items-center gap-2">
        <span
          className={`uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full border ${color} ${
            isCritical ? "text-[10px]" : "text-[9px]"
          }`}
        >
          {meta?.label ?? "Event"}
        </span>
        <span className={`text-zinc-500 ml-auto ${isCritical ? "text-[11px]" : "text-[10px]"}`}>
          {isCritical ? "Critical" : "Important"}
        </span>
      </div>
      <p className={`mt-2 font-semibold text-zinc-100 leading-snug ${isCritical ? "text-base" : "text-sm"}`}>
        {event.title}
      </p>
      <p className={`mt-1 text-zinc-400 leading-relaxed ${isCritical ? "text-[12px]" : "text-[11px]"}`}>
        {event.body}
      </p>
      {event.impact ? (
        <p
          className={`mt-2 font-medium tabular-nums ${
            isCritical ? "text-[12px] text-violet-200" : "text-[11px] text-violet-300/90"
          }`}
        >
          {event.impact}
        </p>
      ) : null}
    </article>
  );
}

export function ConvictionToastStack({ events }: { events: ConvictionEvent[] }) {
  const [current, setCurrent] = useState<ConvictionEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentRef = useRef<ConvictionEvent | null>(null);
  const deferredRef = useRef<ConvictionEvent[]>([]);

  const pending = useMemo(() => sortToastQueue(events), [events]);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const finishCurrent = useCallback(() => {
    const active = currentRef.current;
    if (active) {
      markConvictionToastShown(active.id);
    }
    currentRef.current = null;
    setCurrent(null);
    setVisible(false);
  }, []);

  const showEvent = useCallback(
    (event: ConvictionEvent) => {
      clearTimer();
      currentRef.current = event;
      setCurrent(event);
      setVisible(true);
      timerRef.current = setTimeout(() => {
        finishCurrent();
      }, toastDuration(event.priority));
    },
    [clearTimer, finishCurrent],
  );

  const pickNext = useCallback((): ConvictionEvent | null => {
    const deferred = deferredRef.current.filter((event) => !event.toastShown);
    deferredRef.current = [];
    const merged = [...deferred, ...pending];
    const seen = new Set<string>();
    for (const event of merged) {
      if (seen.has(event.id) || event.toastShown) continue;
      seen.add(event.id);
      return event;
    }
    return null;
  }, [pending]);

  useEffect(() => {
    if (currentRef.current) {
      const active = currentRef.current;
      const incomingCritical = pending.find(
        (event) => event.priority === "critical" && event.id !== active.id,
      );
      if (incomingCritical && active.priority !== "critical") {
        deferredRef.current = [active, ...deferredRef.current.filter((e) => e.id !== active.id)];
        clearTimer();
        currentRef.current = null;
        setVisible(false);
        showEvent(incomingCritical);
      }
      return;
    }

    const next = pickNext();
    if (next) showEvent(next);
  }, [pending, pickNext, showEvent, clearTimer]);

  useEffect(() => {
    if (!current && !visible) {
      const next = pickNext();
      if (next) showEvent(next);
    }
  }, [current, visible, pickNext, showEvent]);

  useEffect(() => () => clearTimer(), [clearTimer]);

  if (!current || !visible) return null;

  return (
    <div className="fixed right-3 bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))] z-[120] w-[min(92vw,380px)] pointer-events-none">
      <Link
        href={current.href}
        onClick={() => {
          markConvictionEventRead(current.id);
          markConvictionToastShown(current.id);
        }}
        className="block"
      >
        <ConvictionToastCard event={current} />
      </Link>
    </div>
  );
}
