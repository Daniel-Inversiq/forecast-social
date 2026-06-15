"use client";



import Link from "next/link";

import { useState } from "react";

import { HeatPill } from "@/components/feed/shared";

import { beliefsEnabled } from "@/lib/featureFlags";
import { receiptDetailPath } from "@/lib/receiptIds";

import { ForecastThesisLine } from "@/components/forecast/ForecastThesisLine";
import {

  daysUntilResolution,

  formatPublicReadThesis,

  STATUS_LABELS,

  STATUS_STYLES,

} from "./publicReadEnrichment";

import {

  BackPublicReadModal,

  ChallengePublicReadModal,

} from "./PublicReadModals";

import {

  PublicReadActionBar,

  PublicReadAuthorBlock,

  PublicReadConsensusBlock,

  PublicReadPotentialImpact,

  PublicReadProbabilityBlock,

} from "./PublicReadParts";

import { useForecasterSubscriptions } from "@/context/ForecasterSubscriptionsProvider";
import { canAccessRead } from "@/lib/forecasterSubscriptions";
import { LockedPublicReadTeaser } from "@/components/subscriptions/LockedPublicReadTeaser";
import { SubscriptionBadge } from "@/components/subscriptions/SubscriptionBadge";
import { PublicReadPositionBlock } from "./PublicReadPositionBlock";
import type { PublicRead } from "./types";



export function PublicReadCard({

  read,

  compact = false,

  onSubscribe,

}: {

  read: PublicRead;

  compact?: boolean;

  onSubscribe?: () => void;

}) {

  const [backOpen, setBackOpen] = useState(false);

  const [challengeOpen, setChallengeOpen] = useState(false);

  const [following, setFollowing] = useState(false);

  const { getTier } = useForecasterSubscriptions();

  const tier = getTier(read.authorHandle);

  const locked =
    read.visibility === "subscriber_only" && !canAccessRead(read, tier);



  const daysLeft = daysUntilResolution(read);

  const resolved = read.status === "resolved";

  const scanThesis = formatPublicReadThesis(read);



  if (locked) {

    return <LockedPublicReadTeaser read={read} compact={compact} onSubscribe={onSubscribe} />;

  }



  return (

    <>

      <article

        className={`public-read-card rounded-xl border border-zinc-800/80 bg-zinc-950/90 overflow-hidden feed-hover-lift ${

          read.status === "challenged" ? "border-rose-500/20 shadow-[0_0_24px_-8px_rgba(244,63,94,0.15)]" : ""

        } ${compact ? "p-3" : "p-3.5 sm:p-4"}`}

      >

        <div className="flex items-start justify-between gap-2 mb-3">

          <div className="min-w-0 flex-1">

            <PublicReadAuthorBlock read={read} compact={compact} showHandle={!compact} />

          </div>

          <div className="flex flex-col items-end gap-1 shrink-0">

            {read.visibility === "subscriber_only" && (

              <SubscriptionBadge variant="subscriber_only" />

            )}

            {read.tags.includes("early-signal") && (

              <SubscriptionBadge variant="early_signal" />

            )}

            {read.tags.includes("desk") && (

              <SubscriptionBadge variant="private_desk" />

            )}

            <span

              className={`text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-md border ${STATUS_STYLES[read.status]}`}

            >

              {STATUS_LABELS[read.status]}

            </span>

          </div>

        </div>



        <Link href="/reads" className="block group mb-2.5">

          <h3

            className={`font-medium text-zinc-300 group-hover:text-zinc-100 transition leading-snug ${

              compact ? "text-xs" : "text-sm sm:text-base"

            }`}

          >

            {read.title}

          </h3>

          <ForecastThesisLine thesis={scanThesis} compact={compact} className="mt-1 mb-0.5" />

          {!compact && beliefsEnabled() && read.beliefTitle && read.beliefSlug && (
            <Link
              href={`/beliefs/${read.beliefSlug}`}
              className="inline-block mt-1 text-[10px] text-amber-400/80 hover:text-amber-300 border border-amber-500/20 rounded px-1.5 py-0.5 bg-amber-500/5"
              onClick={(e) => e.stopPropagation()}
            >
              {read.beliefTitle}
            </Link>
          )}

          {!compact && (
            <p className="text-[10px] text-zinc-600 mt-0.5">{read.marketOrNarrative}</p>
          )}

        </Link>



        <div className="flex flex-wrap items-start gap-4 mb-2.5">

          <PublicReadProbabilityBlock read={read} compact={compact} />

          <PublicReadConsensusBlock read={read} compact={compact} />

          {daysLeft != null && daysLeft > 0 && !resolved && (

            <HeatPill tone="amber">{daysLeft}d to resolve</HeatPill>

          )}

        </div>



        {read.publishedByAgent && !compact && (

          <p className="mb-2 text-[10px] text-violet-400/80 font-medium">Published by agent</p>

        )}



        <PublicReadPositionBlock read={read} />



        {!compact && !resolved && (

          <div className="mb-2.5">

            <PublicReadPotentialImpact read={read} />

          </div>

        )}



        <div className="flex flex-wrap gap-2 text-[10px] text-zinc-600 tabular-nums mb-2.5">

          <span>{read.backersCount} backers</span>

          <span>·</span>

          <span>{read.challengersCount} challengers</span>

          {read.credibilityAtStake != null && read.credibilityAtStake > 0 && (

            <>

              <span>·</span>

              <span className="text-violet-400/80">{read.credibilityAtStake} cred at stake</span>

            </>

          )}

        </div>



        {resolved && read.receiptId && (

          <Link

            href={receiptDetailPath(read.receiptId)}

            className="mb-2.5 inline-flex text-[11px] text-violet-400 hover:text-violet-300 font-medium"

          >

            View Receipt →

          </Link>

        )}



        <PublicReadActionBar

          read={read}

          resolved={resolved}

          following={following}

          onBack={() => setBackOpen(true)}

          onChallenge={() => setChallengeOpen(true)}

          onFollowToggle={() => setFollowing((f) => !f)}

          compact={compact}

        />

      </article>



      <BackPublicReadModal read={read} open={backOpen} onClose={() => setBackOpen(false)} />

      <ChallengePublicReadModal read={read} open={challengeOpen} onClose={() => setChallengeOpen(false)} />

    </>

  );

}

