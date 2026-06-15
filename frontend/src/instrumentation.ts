import type * as Sentry from "@sentry/nextjs";
import { isSentryEnabled } from "@/lib/sentry";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}

export const onRequestError: typeof Sentry.captureRequestError = async (...args) => {
  if (!isSentryEnabled()) return;
  const Sentry = await import("@sentry/nextjs");
  return Sentry.captureRequestError(...args);
};
