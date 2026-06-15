"use client";

import { useEffect, useRef, useState } from "react";

export function AnimatedCounter({
  value,
  className = "",
  duration = 420,
}: {
  value: number;
  className?: string;
  duration?: number;
}) {
  const [display, setDisplay] = useState(value);
  const prev = useRef(value);
  const frame = useRef<number | undefined>(undefined);

  useEffect(() => {
    const from = prev.current;
    const to = value;
    if (from === to) return;

    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - t) ** 3;
      setDisplay(Math.round(from + (to - from) * eased));
      if (t < 1) frame.current = requestAnimationFrame(tick);
      else prev.current = to;
    };

    frame.current = requestAnimationFrame(tick);
    return () => {
      if (frame.current) cancelAnimationFrame(frame.current);
    };
  }, [value, duration]);

  useEffect(() => {
    prev.current = value;
    setDisplay(value);
  }, []);

  return (
    <span className={`tabular-nums transition-colors duration-300 ${className}`} data-value={display}>
      {display}
    </span>
  );
}
