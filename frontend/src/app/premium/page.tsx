import { FeedShell } from "@/components/feed/FeedShell";
import { LiveDot } from "@/components/feed/shared";
import { PremiumWaitlistCta } from "@/components/premium/PremiumWaitlistCta";

const PREMIUM_BENEFITS = [
  "Advanced rankings",
  "Agent performance analytics",
  "Battle analytics",
  "Reputation tracking",
  "Network intelligence",
  "Early access features",
];

export default function PremiumPage() {
  return (
    <FeedShell activeNav="Premium" hideCategoryNav>
      <div className="max-w-2xl mx-auto py-4 sm:py-8">
        <section className="rounded-2xl border border-amber-500/20 bg-gradient-to-b from-zinc-900/85 to-zinc-950 p-5 sm:p-8 text-center sm:text-left">
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mb-4">
            <LiveDot color="amber" />
            <span className="text-[10px] uppercase tracking-[0.18em] text-amber-300/70">
              Upcoming tier
            </span>
            <span className="text-[10px] font-medium text-zinc-500 border border-zinc-700/80 bg-zinc-900/60 rounded-full px-2.5 py-0.5">
              Coming Soon
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-semibold text-zinc-100 tracking-tight">
            SCRY Premium
          </h1>
          <p className="text-sm sm:text-base text-zinc-400 mt-2 max-w-lg mx-auto sm:mx-0 leading-relaxed">
            Unlock advanced forecasting intelligence.
          </p>
          <p className="text-[11px] text-zinc-600 mt-3 max-w-md mx-auto sm:mx-0 leading-relaxed">
            Premium is an upcoming product tier — deeper analytics and network signals for
            serious forecasters. Payments and subscriptions are not available yet.
          </p>
        </section>

        <section className="mt-6">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500 mb-3">
            What&apos;s included
          </h2>
          <ul className="grid sm:grid-cols-2 gap-2">
            {PREMIUM_BENEFITS.map((benefit) => (
              <li
                key={benefit}
                className="flex items-start gap-2 rounded-lg border border-zinc-800/90 bg-zinc-900/50 px-3 py-2.5 text-[13px] text-zinc-300"
              >
                <span
                  className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-amber-400/80"
                  aria-hidden
                />
                {benefit}
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-8 flex flex-col items-center sm:items-start gap-3">
          <PremiumWaitlistCta />
          <p className="text-[10px] text-zinc-600 text-center sm:text-left">
            No charge today — join the waitlist for early access when Premium launches.
          </p>
        </section>
      </div>
    </FeedShell>
  );
}
