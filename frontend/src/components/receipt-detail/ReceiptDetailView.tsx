"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Avatar } from "@/components/feed/shared";
import { receiptDetailPath } from "@/lib/receiptIds";
import { credibilityLabel } from "@/components/users/profile/reputation/receiptUi";
import { BetaDisclosure } from "@/components/trust/BetaDisclosure";
import type { ReceiptDetail } from "./types";
import { ReceiptParticipantCard } from "./ReceiptParticipantCard";
import { ReceiptTimelineSection } from "./ReceiptTimelineSection";
import {
  ReceiptConvictionNetworkSection,
  ReceiptCredibilityDistributionSection,
  ReceiptForecasterMoreSection,
  ReceiptVerdictHero,
} from "./ReceiptVerdictHero";
import { filterRelatedByForecaster, forecasterFirstName } from "./receiptVerdict";

function ReceiptSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="receipt-proof-section">
      <div className="receipt-proof-divider" aria-hidden />
      <h2 className="receipt-proof-section-title">{title}</h2>
      {children}
    </section>
  );
}

function ProofRow({
  label,
  value,
  valueClassName = "text-zinc-100",
}: {
  label: string;
  value: ReactNode;
  valueClassName?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5 border-b border-zinc-800/40 last:border-0">
      <span className="text-[11px] text-zinc-500 shrink-0">{label}</span>
      <span className={`text-[12px] font-medium text-right tabular-nums min-w-0 ${valueClassName}`}>
        {value}
      </span>
    </div>
  );
}

function formatShortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function profileHref(detail: ReceiptDetail): string {
  return detail.forecaster.subjectType === "user"
    ? `/u/${detail.forecaster.slug}`
    : `/agents/${detail.forecaster.slug}`;
}

export function ReceiptDetailView({ detail }: { detail: ReceiptDetail }) {
  const cred =
    detail.credibilityDelta > 0
      ? "text-emerald-300/95"
      : detail.credibilityDelta < 0
        ? "text-rose-300/95"
        : "text-zinc-400";

  const forecasterRelated = filterRelatedByForecaster(detail);
  const detailWithRelated: ReceiptDetail = { ...detail, related: forecasterRelated };
  const firstName = forecasterFirstName(detail.forecaster.name);

  return (
    <article className="receipt-proof-document rounded-xl border border-zinc-800/90 bg-zinc-950/95 overflow-hidden shadow-[0_0_0_1px_rgba(0,0,0,0.4)]">
      <ReceiptVerdictHero detail={detail} />

      <div className="px-4 sm:px-5 py-4 sm:py-5 space-y-1">
        <ReceiptSection title="Conviction network">
          <ReceiptConvictionNetworkSection detail={detail} />
        </ReceiptSection>

        <ReceiptSection title="Credibility distribution">
          <ReceiptCredibilityDistributionSection detail={detail} />
        </ReceiptSection>

        <ReceiptSection title="Forecast record">
          <div className="mt-2 space-y-2">
            <ProofRow
              label="Forecaster"
              value={
                <Link
                  href={profileHref(detail)}
                  className="inline-flex items-center gap-1.5 text-amber-100/90 hover:text-amber-50 transition pointer-events-auto"
                >
                  <Avatar
                    name={detail.forecaster.name}
                    color={detail.forecaster.avatarColor}
                    size="xs"
                  />
                  {detail.forecaster.name}
                </Link>
              }
              valueClassName=""
            />
            <ProofRow label="Called probability" value={`${detail.calledProbability}%`} />
            <ProofRow label="Network consensus at call" value={`${detail.consensusAtCall}%`} />
            <ProofRow
              label="Side"
              value={
                <span
                  className={
                    detail.side === "YES" ? "text-emerald-300/90" : "text-rose-300/90"
                  }
                >
                  {detail.side}
                </span>
              }
            />
            <ProofRow label="Went on record" value={formatShortDate(detail.calledAt)} />
            <ProofRow
              label="Resolved"
              value={detail.resolvedAt ? formatShortDate(detail.resolvedAt) : "—"}
            />
          </div>
        </ReceiptSection>

        <ReceiptSection title="Original thesis">
          <blockquote className="mt-2 text-[14px] sm:text-[15px] text-zinc-200 leading-relaxed whitespace-pre-wrap border-l-[3px] border-violet-500/40 bg-violet-950/15 rounded-r-lg pl-4 pr-3 py-3">
            {detail.reasoning}
          </blockquote>
        </ReceiptSection>

        <ReceiptSection title="Credibility impact">
          <div className="mt-2 rounded-lg border border-zinc-800/70 bg-zinc-900/40 px-3 py-2.5">
            <p className={`text-2xl font-bold tabular-nums ${cred}`}>
              {credibilityLabel(detail.credibilityImpact.earned)} credibility
            </p>
            <p className="mt-2 text-[12px] text-zinc-400 leading-relaxed">
              <span className="text-zinc-500">Reason: </span>
              {detail.credibilityImpact.reason}
            </p>
          </div>
        </ReceiptSection>

        {detail.backers.length > 0 && (
          <ReceiptSection title="Backed this forecast">
            <div className="mt-2 space-y-2">
              {detail.backers.map((p) => (
                <ReceiptParticipantCard key={p.id} participant={p} />
              ))}
            </div>
          </ReceiptSection>
        )}

        {detail.challengers.length > 0 && (
          <ReceiptSection title="Challenged this forecast">
            <div className="mt-2 space-y-2">
              {detail.challengers.map((p) => (
                <ReceiptParticipantCard key={p.id} participant={p} />
              ))}
            </div>
          </ReceiptSection>
        )}

        {detail.timeline.length > 0 && (
          <ReceiptSection title="Receipt timeline">
            <ReceiptTimelineSection events={detail.timeline} />
          </ReceiptSection>
        )}

        {forecasterRelated.length > 0 && (
          <ReceiptSection title={`More receipts from ${firstName}`}>
            <ReceiptForecasterMoreSection detail={detailWithRelated} />
          </ReceiptSection>
        )}
      </div>

      <footer className="border-t border-zinc-800/80 px-4 sm:px-5 py-3 bg-zinc-950/80">
        <BetaDisclosure tone="muted" className="mb-2" />
        <p className="text-center text-[10px] text-zinc-600">
          Permanent public verdict ·{" "}
          <Link href={profileHref(detail)} className="text-zinc-500 hover:text-zinc-400">
            {detail.forecaster.name}
          </Link>
        </p>
      </footer>
    </article>
  );
}
