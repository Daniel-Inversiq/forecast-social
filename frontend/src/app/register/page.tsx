"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { LoginNetworkPanel } from "@/components/auth/LoginNetworkPanel";
import { ScryLogo } from "@/components/brand/ScryLogo";
import { LiveDot } from "@/components/feed/shared";
import {
  WAITLIST_FOUNDING_BENEFITS,
  WAITLIST_NETWORK_STATUS,
} from "@/lib/loginNetworkSignals";

function TerminalBackdrop() {
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
      <div className="absolute inset-0 onboarding-glow-violet opacity-80" />
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[480px] rounded-full bg-violet-600/10 blur-[120px]" />
      <div className="absolute bottom-0 right-0 w-[420px] h-[420px] rounded-full bg-fuchsia-600/6 blur-[100px]" />
    </div>
  );
}

function buildLoginHref(next: string, inviteCode: string | null, refSlug: string | null) {
  const params = new URLSearchParams();
  if (next !== "/") params.set("next", next);
  if (inviteCode) params.set("invite", inviteCode);
  if (refSlug) params.set("ref", refSlug);
  const qs = params.toString();
  return qs ? `/login?${qs}` : "/login";
}

function WaitlistForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [joined, setJoined] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const next = searchParams.get("next") || "/";
  const inviteCode = searchParams.get("invite");
  const refSlug = searchParams.get("ref");
  const loginHref = buildLoginHref(next, inviteCode, refSlug);

  useEffect(() => {
    if (inviteCode || refSlug) {
      router.replace(loginHref);
    }
  }, [inviteCode, refSlug, loginHref, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 400));
    setJoined(true);
    setSubmitting(false);
  }

  if (inviteCode || refSlug) {
    return (
      <div className="min-h-screen bg-[var(--scry-bg-base)] flex items-center justify-center text-zinc-500 text-sm">
        Redirecting…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--scry-bg-base)] text-zinc-100 flex flex-col relative">
      <TerminalBackdrop />

      <header className="relative z-10 border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <ScryLogo size="md" />
          <Link href={loginHref} className="text-sm text-zinc-400 hover:text-white transition">
            Sign in
          </Link>
        </div>
      </header>

      <main className="relative z-10 flex-1 px-4 sm:px-6 py-8 sm:py-10 lg:py-12">
        <div className="max-w-7xl mx-auto lg:grid lg:grid-cols-[minmax(480px,500px)_minmax(0,1fr)] lg:gap-12 xl:gap-16 lg:items-start">
          <div className="w-full max-w-[480px] sm:max-w-[500px] mx-auto lg:mx-0">
            <div className="text-center lg:text-left mb-5">
              <h1 className="text-[2.25rem] sm:text-[3rem] lg:text-[3.5rem] font-semibold text-white tracking-[-0.03em] leading-[1.08]">
                Join the SCRY waitlist
              </h1>
              <p className="mt-2 text-xl sm:text-2xl text-zinc-300 font-medium tracking-tight">
                The network is already moving.
              </p>
              <p className="mt-4 text-sm sm:text-[15px] text-zinc-500 leading-relaxed max-w-md mx-auto lg:mx-0">
                SCRY is onboarding forecasters in waves.
                <br />
                Forecasts become receipts.
                <br />
                Receipts become credibility.
              </p>
            </div>

            <div className="rounded-xl border border-zinc-800/60 bg-zinc-950/40 px-4 py-3.5 mb-4">
              <div className="flex items-center gap-2 mb-2.5">
                <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-400/90">
                  <LiveDot />
                  Live
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-600">
                  Network status
                </span>
              </div>
              <ul className="space-y-1.5">
                {WAITLIST_NETWORK_STATUS.map((line) => (
                  <li
                    key={line}
                    className="flex items-center gap-2 text-[12px] text-zinc-400 font-mono"
                  >
                    <span className="h-1 w-1 rounded-full bg-rose-400/80 shrink-0 animate-pulse" />
                    {line}
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-xl border border-zinc-800/50 bg-zinc-950/30 px-4 py-3.5 mb-5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500 mb-2.5">
                Founding members receive:
              </p>
              <ul className="space-y-1.5">
                {WAITLIST_FOUNDING_BENEFITS.map((benefit) => (
                  <li key={benefit} className="flex items-start gap-2 text-[12px] text-zinc-400">
                    <span className="text-violet-400/70 shrink-0 mt-px">•</span>
                    {benefit}
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-xl border border-zinc-800/70 bg-zinc-950/50 p-5 sm:p-6 backdrop-blur-sm">
              {joined ? (
                <div className="text-center py-2">
                  <p className="text-sm font-medium text-emerald-200/90">
                    You&apos;re on the waitlist
                  </p>
                  <p className="text-[12px] text-zinc-500 mt-2 leading-relaxed">
                    We&apos;ll reach out when the next forecaster wave opens.
                    <br />
                    Your spot is reserved for{" "}
                    <span className="text-zinc-400 font-mono">{email}</span>.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-3">
                  <div>
                    <label htmlFor="waitlist-email" className="sr-only">
                      Email address
                    </label>
                    <input
                      id="waitlist-email"
                      type="email"
                      autoComplete="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-lg bg-zinc-900/80 border border-zinc-800/90 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/30"
                      placeholder="Email address"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-2.5 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 transition shadow-[0_0_28px_-12px_rgba(139,92,246,0.45)] disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {submitting ? "Joining…" : "Join waitlist"}
                  </button>
                </form>
              )}

              <p className="mt-4 text-center text-[12px] text-zinc-600">
                Already have an invite?{" "}
                <Link
                  href={loginHref}
                  className="text-zinc-400 hover:text-violet-300 transition underline-offset-2 hover:underline"
                >
                  Sign in →
                </Link>
              </p>
            </div>

            <div className="mt-4 lg:hidden">
              <LoginNetworkPanel compact sections={["battle"]} />
            </div>
          </div>

          <div className="hidden lg:block lg:sticky lg:top-14 w-full max-w-[440px] xl:max-w-[480px] lg:justify-self-end">
            <LoginNetworkPanel sections={["battle", "activity"]} />
          </div>
        </div>
      </main>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-zinc-500 text-sm">
          Loading…
        </div>
      }
    >
      <WaitlistForm />
    </Suspense>
  );
}
