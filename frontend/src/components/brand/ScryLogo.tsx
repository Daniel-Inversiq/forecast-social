import Link from "next/link";
import { APP_NAME } from "@/lib/brand";

/** Original transparent SCRY eye mark — use asset as provided */
const SCRY_EYE_MARK_SRC = "/scry-eye-mark.png";

const SIZE = {
  /** Primary navbar mark — authoritative, still within fixed header height */
  nav: {
    text: "text-[18px] leading-none",
    weight: "",
    tracking: "",
    wordmark: "scry-logo-wordmark--nav",
    showEyeMark: true,
    eyeMarkClass: "h-[19px] w-[19px]",
    gap: "gap-2.5",
  },
  sm: {
    text: "text-[15px] leading-none",
    weight: "font-bold",
    tracking: "tracking-[0.02em]",
    wordmark: "",
  },
  md: {
    text: "text-base leading-none",
    weight: "font-bold",
    tracking: "tracking-[0.02em]",
    wordmark: "",
  },
  lg: {
    text: "text-[1.35rem] leading-none",
    weight: "font-bold",
    tracking: "tracking-[0.02em]",
    wordmark: "",
  },
} as const;

export function ScryLogo({
  href = "/",
  size = "sm",
  className = "",
}: {
  href?: string;
  size?: keyof typeof SIZE;
  className?: string;
  /** @deprecated Pulse dot removed — typographic mark only */
  showPulse?: boolean;
}) {
  const s = SIZE[size];

  const showEyeMark = "showEyeMark" in s && s.showEyeMark;

  const inner = (
    <span
      className={`scry-logo inline-flex items-center min-h-[1.25rem] ${"gap" in s ? s.gap : ""} ${s.weight} ${s.text} ${s.tracking} text-white ${className}`.trim()}
    >
      {showEyeMark && (
        <img
          src={SCRY_EYE_MARK_SRC}
          alt=""
          width={19}
          height={19}
          decoding="async"
          className={`scry-logo-mark shrink-0 object-contain ${"eyeMarkClass" in s ? s.eyeMarkClass : ""}`}
          aria-hidden
        />
      )}
      <span className={`scry-logo-wordmark ${s.wordmark}`.trim()}>{APP_NAME}</span>
    </span>
  );

  if (!href) return inner;

  return (
    <Link
      href={href}
      className="scry-logo-link shrink-0 inline-flex items-center outline-none"
    >
      {inner}
    </Link>
  );
}
