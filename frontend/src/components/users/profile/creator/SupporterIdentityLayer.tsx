"use client";

import Link from "next/link";
import { formatRelativeTime } from "@/lib/relativeTime";
import type { SupporterIdentity, SupporterIdentityRoster } from "@/lib/subscriberIdentity";
import { SUPPORTER_IDENTITY_TAGLINE } from "@/lib/subscriberIdentity";
import { CreatorDashboardSection } from "./CreatorDashboardSection";
import { SupporterIdentityCard } from "./SupporterIdentityCard";

function SupporterList({
  supporters,
  metaFor,
}: {
  supporters: SupporterIdentity[];
  metaFor?: (s: SupporterIdentity) => string;
}) {
  if (supporters.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-zinc-800 bg-zinc-950/40 p-4 text-center">
        <p className="text-[12px] text-zinc-200 font-medium">No supporters yet</p>
        <p className="text-[11px] text-zinc-500 mt-1 mb-2">
          Supporters belong here. They matter because recurring backing proves your signal quality.
        </p>
        <Link href="/reads" className="text-[11px] text-violet-400 hover:text-violet-300">
          Publish High Conviction Reads →
        </Link>
      </div>
    );
  }
  return (
    <ul className="space-y-1.5">
      {supporters.map((s) => (
        <SupporterIdentityCard key={s.id} supporter={s} meta={metaFor?.(s)} />
      ))}
    </ul>
  );
}

function IdentitySubsection({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="pt-3 first:pt-0 border-t border-zinc-800/60 first:border-t-0">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-0.5">
        {title}
      </p>
      {hint && <p className="text-[10px] text-zinc-600 mb-2">{hint}</p>}
      {children}
    </div>
  );
}

export function SupporterIdentityLayer({
  roster,
  variant = "default",
}: {
  roster: SupporterIdentityRoster;
  /** Agent Studio uses creator-facing copy (no billing terms). */
  variant?: "default" | "studio";
}) {
  const longestLabel = variant === "studio" ? "Supporter since" : "Subscriber since";
  const longestMeta = (s: SupporterIdentity) =>
    variant === "studio"
      ? `Supporting since ${formatRelativeTime(s.subscribedAt)}`
      : `Subscriber since ${formatRelativeTime(s.subscribedAt)}`;

  return (
    <CreatorDashboardSection
      title="Supporter identity"
      hint={SUPPORTER_IDENTITY_TAGLINE}
      accent="violet"
    >
      <IdentitySubsection
        title={variant === "studio" ? "Recent supporters" : "Recent subscribers"}
        hint="Latest people funding your intelligence"
      >
        <ul className="space-y-1.5">
          {roster.recent.map((s) => (
            <SupporterIdentityCard
              key={s.id}
              supporter={s}
              meta={`Joined ${formatRelativeTime(s.subscribedAt)}`}
            />
          ))}
        </ul>
      </IdentitySubsection>

      <IdentitySubsection title="Newest supporters">
        <SupporterList
          supporters={roster.newest}
          metaFor={(s) => `Supporting since ${formatRelativeTime(s.subscribedAt)}`}
        />
      </IdentitySubsection>

      <IdentitySubsection title="Highest credibility supporters">
        <SupporterList
          supporters={roster.highestCredibility}
          metaFor={(s) => `Credibility ${s.credibility.toLocaleString()}`}
        />
      </IdentitySubsection>

      <IdentitySubsection title="Top-ranked supporters">
        <SupporterList supporters={roster.topRanked} metaFor={(s) => s.rankLabel} />
      </IdentitySubsection>

      <IdentitySubsection title="Most active supporters">
        <SupporterList
          supporters={roster.mostActive}
          metaFor={(s) => `${s.activityScore} intelligence interactions this month`}
        />
      </IdentitySubsection>

      <IdentitySubsection title={longestLabel} hint="Longest-running supporters of your desk">
        <SupporterList supporters={roster.subscriberSince} metaFor={longestMeta} />
      </IdentitySubsection>
    </CreatorDashboardSection>
  );
}
