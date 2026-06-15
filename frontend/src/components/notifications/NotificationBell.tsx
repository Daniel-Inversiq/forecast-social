"use client";

import Link from "next/link";
import { useNotifications } from "@/context/NotificationsProvider";

type NotificationBellProps = {
  className?: string;
  iconClassName?: string;
  badgeClassName?: string;
};

export function NotificationBell({
  className = "scry-tap-target relative p-2 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800/60 transition shrink-0",
  iconClassName = "w-[18px] h-[18px]",
  badgeClassName = "absolute top-1 right-1 h-3.5 min-w-3.5 px-0.5 flex items-center justify-center rounded-full bg-violet-500 text-[8px] font-bold text-white",
}: NotificationBellProps) {
  const { unreadCount } = useNotifications();

  const label =
    unreadCount > 0
      ? `Activity, ${unreadCount} unread`
      : "Activity";

  return (
    <Link href="/notifications" className={className} aria-label={label}>
      <svg className={iconClassName} viewBox="0 0 20 20" fill="currentColor" aria-hidden>
        <path d="M10 2a5 5 0 00-5 5v2.5c0 .92-.37 1.8-1.03 2.45L3.1 13.4A.75.75 0 003.75 14.5h12.5a.75.75 0 00.65-1.1l-.87-.95A3.47 3.47 0 0115 9.5V7a5 5 0 00-5-5zm0 14a2.5 2.5 0 002.45-2h-4.9A2.5 2.5 0 0010 16z" />
      </svg>
      {unreadCount > 0 && (
        <span className={badgeClassName} aria-hidden>
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      )}
    </Link>
  );
}
