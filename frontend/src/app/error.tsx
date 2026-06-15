"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import { isSentryEnabled } from "@/lib/sentry";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (!isSentryEnabled()) return;
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4 p-6 text-center">
      <h1 className="text-lg font-semibold text-white">This page failed to load</h1>
      <p className="text-sm text-zinc-500 max-w-md">
        A route error was captured. Try refreshing or go back to the feed.
      </p>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="px-4 py-2 rounded-lg text-sm font-medium bg-violet-500/20 text-violet-200 border border-violet-500/30"
        >
          Try again
        </button>
        <a href="/" className="px-4 py-2 rounded-lg text-sm border border-zinc-700 text-zinc-300 text-sm">
          Home
        </a>
      </div>
    </div>
  );
}
