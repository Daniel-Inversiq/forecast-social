"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { LoginBelowFold } from "@/components/auth/LoginBelowFold";
import { LoginInviteBadge } from "@/components/auth/LoginInviteBadge";
import { LoginNetworkPanel } from "@/components/auth/LoginNetworkPanel";
import { LoginWaitlistCta } from "@/components/auth/LoginWaitlistCta";
import { ScryLogo } from "@/components/brand/ScryLogo";
import { LiveDot } from "@/components/feed/shared";
import { WalletConnectButton } from "@/components/wallet/WalletConnectButton";
import { useAuth } from "@/context/AuthProvider";
import { getPostAuthDestination } from "@/lib/authRedirect";
import { LOGIN_LIVE_FEED } from "@/lib/loginNetworkSignals";

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

function NetworkSignalStrip() {
  const highlights = LOGIN_LIVE_FEED.slice(0, 3);

  return (
    <div className="mb-3 -mx-1 overflow-x-auto scrollbar-none">
      <div className="flex flex-wrap justify-center lg:justify-start gap-x-4 gap-y-1.5 px-1">
        {highlights.map((item) => (
          <span
            key={item.label}
            className="inline-flex items-center gap-1.5 text-[11px] text-zinc-400 whitespace-nowrap"
          >
            <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-rose-400/80">
              <LiveDot color="rose" />
              Live
            </span>
            <span className="font-mono">{item.label}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const next = searchParams.get("next") || "/";
  const inviteCode = searchParams.get("invite");
  const refSlug = searchParams.get("ref");
  const hasInvite = Boolean(inviteCode || refSlug);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const user = await login(email.trim(), password);
      router.replace(getPostAuthDestination(user, next));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[var(--scry-bg-base)] text-zinc-100 flex flex-col relative">
      <TerminalBackdrop />

      <header className="relative z-10 border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <ScryLogo size="md" />
          {hasInvite ? (
            <span className="text-xs font-medium text-amber-400/80 tracking-wide">
              Invite active
            </span>
          ) : (
            <Link
              href="/register"
              className="text-sm text-zinc-500 hover:text-zinc-300 transition"
            >
              Join waitlist
            </Link>
          )}
        </div>
      </header>

      <main className="relative z-10 flex-1 px-4 sm:px-6 py-8 sm:py-10 lg:py-12">
        <div className="max-w-7xl mx-auto lg:grid lg:grid-cols-[minmax(480px,500px)_minmax(0,1fr)] lg:gap-12 xl:gap-16 lg:items-start">
          <div className="w-full max-w-[480px] sm:max-w-[500px] mx-auto lg:mx-0">
            <div className="text-center lg:text-left mb-3">
              <h1 className="text-[2.5rem] sm:text-[3.25rem] lg:text-[4rem] font-semibold text-white tracking-[-0.03em] leading-[1.05]">
                The network is moving.
              </h1>
              <p className="mt-2 text-xl sm:text-2xl text-zinc-300 font-medium tracking-tight">
                Your record moves with it.
              </p>
              <p className="mt-3 text-sm sm:text-base text-zinc-500 font-medium tracking-wide uppercase">
                Forecasts become receipts · Receipts become credibility
              </p>
            </div>

            <NetworkSignalStrip />

            <div className="mb-3 lg:hidden">
              <LoginNetworkPanel compact sections={["activity"]} />
            </div>

            <div className="rounded-xl border border-zinc-800/70 bg-zinc-950/50 p-5 sm:p-6 backdrop-blur-sm">
              {hasInvite && (
                <LoginInviteBadge inviteCode={inviteCode} refSlug={refSlug} />
              )}

              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-600 text-center mb-3.5">
                Sign in to your record
              </p>

              <form onSubmit={handleSubmit} className="space-y-3">
                <div>
                  <label htmlFor="email" className="block text-xs font-medium text-zinc-500 mb-1">
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg bg-zinc-900/80 border border-zinc-800/90 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/30"
                    placeholder="you@example.com"
                  />
                </div>
                <div>
                  <label
                    htmlFor="password"
                    className="block text-xs font-medium text-zinc-500 mb-1"
                  >
                    Password
                  </label>
                  <input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg bg-zinc-900/80 border border-zinc-800/90 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/30"
                    placeholder="••••••••"
                  />
                </div>

                {error && (
                  <p className="text-xs text-rose-400/90 text-center">{error}</p>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-2.5 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 transition shadow-[0_0_28px_-12px_rgba(139,92,246,0.45)] disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {submitting ? "Signing in…" : "Sign in"}
                </button>
              </form>

              <WalletConnectButton mode="login" variant="loginEntry" className="mt-4" />

              {hasInvite && (
                <p className="mt-3.5 text-center text-xs text-zinc-500">
                  Your invite is active — sign in to enter the network.
                </p>
              )}
            </div>

            <LoginBelowFold showFoundingBenefits={!hasInvite} />

            <div className="mt-4 lg:hidden">
              <LoginNetworkPanel compact sections={["battle", "forecasters"]} />
            </div>

            {!hasInvite && (
              <div className="mt-4">
                <LoginWaitlistCta id="network-waitlist" />
              </div>
            )}
          </div>

          <div className="hidden lg:block lg:sticky lg:top-14 w-full max-w-[440px] xl:max-w-[480px] lg:justify-self-end">
            <LoginNetworkPanel />
          </div>
        </div>
      </main>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-zinc-500 text-sm">
          Loading…
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
