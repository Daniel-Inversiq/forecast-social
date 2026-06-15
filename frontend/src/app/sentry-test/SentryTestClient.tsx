"use client";

import * as Sentry from "@sentry/nextjs";
import { useState } from "react";

export function SentryTestClient() {
  const [lastEventId, setLastEventId] = useState<string | null>(null);

  function sendMessage() {
    const eventId = Sentry.captureMessage("SCRY Sentry frontend test event", "info");
    setLastEventId(eventId ?? "sent");
  }

  function throwClientError() {
    throw new Error("SCRY Sentry frontend test exception");
  }

  return (
    <main className="max-w-lg mx-auto py-16 px-6 space-y-6">
      <h1 className="text-xl font-semibold text-white">Sentry test</h1>
      <p className="text-sm text-zinc-500">
        Use these actions to verify events appear in your Sentry project. This page is hidden unless
        debug routes are enabled.
      </p>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={sendMessage}
          className="px-4 py-2 rounded-lg text-sm bg-violet-500/20 text-violet-200 border border-violet-500/30"
        >
          Send test message
        </button>
        <button
          type="button"
          onClick={throwClientError}
          className="px-4 py-2 rounded-lg text-sm border border-zinc-700 text-zinc-300"
        >
          Throw client error
        </button>
      </div>
      {lastEventId && (
        <p className="text-xs text-zinc-500 font-mono">Last event id: {lastEventId}</p>
      )}
    </main>
  );
}
