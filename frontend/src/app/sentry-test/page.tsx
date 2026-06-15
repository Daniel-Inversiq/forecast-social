import { notFound } from "next/navigation";
import { isSentryEnabled, sentryDebugRoutesEnabled } from "@/lib/sentry";
import { SentryTestClient } from "./SentryTestClient";

export default function SentryTestPage() {
  if (!isSentryEnabled() || !sentryDebugRoutesEnabled()) {
    notFound();
  }
  return <SentryTestClient />;
}
