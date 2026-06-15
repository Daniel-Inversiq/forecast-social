import type { ErrorEvent, EventHint } from "@sentry/nextjs";

/** True when DSN is set and local-dev default allows reporting. */
export function isSentryEnabled(): boolean {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN?.trim();
  if (!dsn) return false;

  const flag = process.env.NEXT_PUBLIC_SENTRY_ENABLED?.trim().toLowerCase();
  if (flag === "true" || flag === "1") return true;
  if (flag === "false" || flag === "0") return false;

  return process.env.NODE_ENV === "production";
}

export function sentryEnvironment(): string {
  return (
    process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT?.trim() ||
    process.env.VERCEL_ENV ||
    process.env.NODE_ENV ||
    "development"
  );
}

export function sentryDebugRoutesEnabled(): boolean {
  const flag = process.env.NEXT_PUBLIC_SENTRY_DEBUG_ROUTES?.trim().toLowerCase();
  return flag === "true" || flag === "1";
}

/** Drop expected validation and 404 navigation noise. */
export function sentryBeforeSend(event: ErrorEvent, hint: EventHint): ErrorEvent | null {
  const status = event.contexts?.response?.status_code;
  if (status === 404 || status === 422) return null;

  const original = hint.originalException;
  if (original && typeof original === "object" && "digest" in original) {
    const digest = String((original as { digest?: string }).digest ?? "");
    if (digest.includes("NEXT_NOT_FOUND") || digest.includes("404")) return null;
  }

  const message = event.exception?.values?.[0]?.value ?? event.message ?? "";
  if (/status (404|422)\b/i.test(message) || /not found/i.test(message)) {
    return null;
  }

  return event;
}

export const sentryIgnoreErrors: Array<string | RegExp> = [
  "NEXT_NOT_FOUND",
  "NEXT_HTTP_ERROR_FALLBACK;404",
  /^AbortError$/,
  /^Non-Error promise rejection/,
];
