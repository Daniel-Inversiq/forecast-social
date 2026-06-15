"use client";

import * as Sentry from "@sentry/nextjs";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/context/AuthProvider";
import { isSentryEnabled, sentryEnvironment } from "@/lib/sentry";

/** Attach route + user context for client-side Sentry events. */
export function SentryUserSync() {
  const { user } = useAuth();
  const pathname = usePathname();

  useEffect(() => {
    if (!isSentryEnabled()) return;

    Sentry.setTag("environment", sentryEnvironment());

    if (user) {
      Sentry.setUser({ id: String(user.id), username: user.username });
    } else {
      Sentry.setUser(null);
    }
  }, [user]);

  useEffect(() => {
    if (!isSentryEnabled() || !pathname) return;
    Sentry.setTag("route", pathname);
  }, [pathname]);

  return null;
}
