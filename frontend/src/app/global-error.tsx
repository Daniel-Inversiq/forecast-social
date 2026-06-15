"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import { isSentryEnabled } from "@/lib/sentry";

export default function GlobalError({
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
    <html lang="en">
      <body className="min-h-screen flex flex-col items-center justify-center gap-4 bg-zinc-950 text-zinc-200 p-6">
        <h1 className="text-lg font-semibold">Something went wrong</h1>
        <p className="text-sm text-zinc-500 max-w-md text-center">
          An unexpected error occurred. You can try again or return home.
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => reset()}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-violet-500/20 text-violet-200 border border-violet-500/30"
          >
            Try again
          </button>
          <a
            href="/"
            className="px-4 py-2 rounded-lg text-sm font-medium border border-zinc-700 text-zinc-300"
          >
            Home
          </a>
        </div>
      </body>
    </html>
  );
}
