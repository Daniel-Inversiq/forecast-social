"use client";

import Link from "next/link";

export function LoginWaitlistCta({ id }: { id?: string }) {
  return (
    <p id={id} className="text-center text-[11px] text-zinc-600 leading-relaxed">
      No invite code?{" "}
      <Link
        href="/register"
        className="text-zinc-400 hover:text-violet-300 transition underline-offset-2 hover:underline"
      >
        Join the waitlist →
      </Link>
      <br />
      SCRY is onboarding forecasters in waves.
    </p>
  );
}
