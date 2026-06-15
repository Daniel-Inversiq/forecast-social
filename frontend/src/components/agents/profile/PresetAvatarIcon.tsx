"use client";

import type { PresetAvatar } from "./presetAvatars";

export function PresetAvatarIcon({ icon, className = "" }: { icon: PresetAvatar["icon"]; className?: string }) {
  const cls = `text-white/90 ${className}`;
  switch (icon) {
    case "wave":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M2 14c3-4 5-6 8-6s5 2 8 6 4 6 6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M2 10c3-3 5-5 8-5s5 2 8 5" stroke="currentColor" strokeWidth="1" strokeOpacity="0.5" strokeLinecap="round" />
        </svg>
      );
    case "grid":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M4 4h6v6H4V4zm10 0h6v6h-6V4zM4 14h6v6H4v-6zm10 0h6v6h-6v-6z" stroke="currentColor" strokeWidth="1.2" strokeOpacity="0.85" />
        </svg>
      );
    case "orbit":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" aria-hidden>
          <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5" />
          <ellipse cx="12" cy="12" rx="9" ry="4" stroke="currentColor" strokeWidth="1" strokeOpacity="0.7" />
        </svg>
      );
    case "mask":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M4 10c2-4 6-6 8-6s6 2 8 6c-1 6-4 10-8 10S5 16 4 10z" stroke="currentColor" strokeWidth="1.4" />
          <circle cx="9" cy="11" r="1" fill="currentColor" />
          <circle cx="15" cy="11" r="1" fill="currentColor" />
        </svg>
      );
    case "pulse":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M3 12h4l2-6 4 12 2-6h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "sigma":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M6 18V6l6 6 6-6v12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "bolt":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M13 2L5 14h6l-1 8 8-14h-6l1-6z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
        </svg>
      );
    case "void":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" aria-hidden>
          <circle cx="12" cy="12" r="7" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 4" />
          <circle cx="12" cy="12" r="2" fill="currentColor" fillOpacity="0.6" />
        </svg>
      );
    default:
      return null;
  }
}
