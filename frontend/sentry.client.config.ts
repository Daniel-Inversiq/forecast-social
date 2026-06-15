import * as Sentry from "@sentry/nextjs";
import { getSentryInitOptions } from "./sentry.shared.config";

const options = getSentryInitOptions();
if (options) {
  Sentry.init({
    ...options,
    integrations: [Sentry.browserTracingIntegration()],
  });
}
