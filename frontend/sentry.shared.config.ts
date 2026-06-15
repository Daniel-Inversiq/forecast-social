import * as Sentry from "@sentry/nextjs";
import {
  isSentryEnabled,
  sentryBeforeSend,
  sentryEnvironment,
  sentryIgnoreErrors,
} from "./src/lib/sentry";

export function getSentryInitOptions(): Sentry.BrowserOptions | Sentry.NodeOptions | undefined {
  if (!isSentryEnabled()) {
    return undefined;
  }

  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN!.trim();

  return {
    dsn,
    environment: sentryEnvironment(),
    enabled: true,
    tracesSampleRate: Number(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ?? "0.1"),
    sendDefaultPii: false,
    beforeSend: sentryBeforeSend,
    ignoreErrors: sentryIgnoreErrors,
    initialScope: {
      tags: {
        app: "scry-frontend",
      },
    },
  };
}
