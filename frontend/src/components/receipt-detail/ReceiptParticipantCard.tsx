import Link from "next/link";

import { Avatar } from "@/components/feed/shared";

import { TrustTierBadge } from "@/components/trust/TrustTierBadge";

import { credibilityLabel } from "@/components/users/profile/reputation/receiptUi";

import type { ReceiptParticipant } from "./types";



function profileHref(p: ReceiptParticipant): string {

  if (p.subjectType === "user") return `/u/${p.handle}`;

  return `/agents/${p.handle}`;

}



function trustTierKey(label: string): string {

  const lower = label.toLowerCase();

  if (lower.includes("trusted")) return "trusted";

  if (lower.includes("established")) return "ranked";

  if (lower.includes("verified")) return "verified";

  return "emerging";

}



function actionLine(p: ReceiptParticipant): string {

  const verb = p.action === "backed" ? "Backed" : "Called";

  return `${verb} ${p.side} at ${p.probability}%`;

}



export function ReceiptParticipantCard({ participant }: { participant: ReceiptParticipant }) {

  const credTone =

    participant.credibilityDelta > 0

      ? "text-emerald-300/95"

      : participant.credibilityDelta < 0

        ? "text-rose-300/95"

        : "text-zinc-400";

  const sideTone =

    participant.side === "YES" ? "text-emerald-300/90" : "text-rose-300/90";



  return (

    <Link

      href={profileHref(participant)}

      className="flex flex-col sm:flex-row gap-3 rounded-lg border border-zinc-800/70 bg-zinc-900/35 px-3 py-3 hover:border-zinc-700/80 hover:bg-zinc-900/55 transition group"

    >

      <Avatar

        name={participant.name}

        color={participant.avatarColor ?? "#71717a"}

        size="sm"

      />

      <div className="min-w-0 flex-1">

        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">

          <p className="text-[13px] font-semibold text-zinc-100 group-hover:text-white truncate">

            {participant.name}

          </p>

          <span className="text-[10px] text-zinc-600">@{participant.handle}</span>

        </div>

        <div className="mt-1 flex flex-wrap items-center gap-1.5">

          <TrustTierBadge

            tierKey={trustTierKey(participant.trustTier)}

            tierLabel={participant.trustTier}

            compact

          />

          {participant.rankLabel && (

            <span className="text-[9px] text-zinc-500 tabular-nums">{participant.rankLabel}</span>

          )}

        </div>

        <p className="text-[11px] text-zinc-500 mt-1.5">

          Credibility{" "}

          <span className="text-zinc-300 tabular-nums font-medium">{participant.credibility}</span>

        </p>

        <p className="text-[11px] mt-0.5">

          <span className={sideTone}>{actionLine(participant)}</span>

        </p>

      </div>

      <div className="shrink-0 text-left sm:text-right self-start sm:self-center">

        <p className="text-[10px] uppercase tracking-wider text-zinc-600 mb-0.5">From receipt</p>

        <p className={`text-sm font-semibold tabular-nums ${credTone}`}>

          {credibilityLabel(participant.credibilityDelta)} credibility

        </p>

      </div>

    </Link>

  );

}


