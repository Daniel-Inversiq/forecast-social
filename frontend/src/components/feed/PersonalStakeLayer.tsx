"use client";



import Link from "next/link";

import { useEffect, useMemo, useState } from "react";

import { useAuth } from "@/context/AuthProvider";

import { enrichActive } from "@/components/positions/positionEnrichment";

import type { ActivePosition, PositionsPayload } from "@/components/positions/types";

import { apiFetch } from "@/lib/api";

import { buildPersonalStakeCards, type PersonalStakeCard } from "@/lib/personalStake";



const KIND_ACCENT: Record<PersonalStakeCard["kind"], string> = {

  resolving_soon: "personal-stake-card--soon",

  under_pressure: "personal-stake-card--pressure",

  high_conviction: "personal-stake-card--conviction",

};



function StakeCard({ card }: { card: PersonalStakeCard }) {

  return (

    <Link

      href={card.href}

      className={`personal-stake-card block rounded-lg border bg-zinc-950/85 px-3 py-2.5 transition hover:bg-zinc-900/70 ${KIND_ACCENT[card.kind]}`}

    >

      <div className="flex items-start gap-2 min-w-0">

        <span className="text-sm leading-none mt-0.5 shrink-0" aria-hidden>

          {card.icon}

        </span>

        <div className="min-w-0 flex-1">

          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 mb-0.5">

            <h3 className="text-[13px] font-semibold text-white leading-snug truncate">

              {card.marketTitle}

            </h3>

            <span className="text-[9px] uppercase tracking-wider text-zinc-500 shrink-0">

              {card.kindLabel}

            </span>

          </div>

          <p className="text-[11px] text-violet-200/90 font-medium tabular-nums mb-1">

            {card.primaryLine}

          </p>

          <ul className="space-y-0.5">

            {card.secondaryLines.slice(0, 2).map((line) => (

              <li key={line} className="text-[10px] text-zinc-400 leading-snug">

                {line}

              </li>

            ))}

          </ul>

          {card.openLoops.length > 0 && (

            <div className="flex flex-wrap gap-1 mt-1.5">

              {card.openLoops.slice(0, 3).map((signal) => (

                <span

                  key={signal}

                  className="text-[9px] font-medium uppercase tracking-wide px-1.5 py-0.5 rounded border border-zinc-700/80 bg-zinc-900/80 text-zinc-400"

                >

                  {signal}

                </span>

              ))}

            </div>

          )}

        </div>

      </div>

    </Link>

  );

}



export function PersonalStakeLayer() {

  const { user } = useAuth();

  const [payload, setPayload] = useState<PositionsPayload | null>(null);

  const [loading, setLoading] = useState(false);



  useEffect(() => {

    if (!user) {

      setPayload(null);

      return;

    }

    let cancelled = false;

    let timedOut = false;



    async function load() {

      setLoading(true);

      try {

        const res = await apiFetch("/me/positions");

        if (cancelled || timedOut) return;

        if (!res.ok) {

          if (process.env.NODE_ENV !== "production") {

            console.error("[PersonalStakeLayer] /me/positions", `HTTP ${res.status}`);

          }

          return;

        }

        const data = (await res.json()) as PositionsPayload;

        if (!cancelled) setPayload(data);

      } catch (err) {

        if (!cancelled && process.env.NODE_ENV !== "production") {

          console.error("[PersonalStakeLayer] /me/positions failed", err);

        }

      } finally {

        if (!cancelled && !timedOut) setLoading(false);

      }

    }



    const timeoutId = setTimeout(() => {

      if (cancelled) return;

      timedOut = true;

      if (process.env.NODE_ENV !== "production") {

        console.error("[PersonalStakeLayer] load timeout");

      }

      setLoading(false);

    }, 8_000);



    void load();

    return () => {

      cancelled = true;

      clearTimeout(timeoutId);

    };

  }, [user]);



  const cards = useMemo(() => {

    const active = payload?.active_positions ?? [];

    const enriched = active.map((p: ActivePosition) => enrichActive(p));

    return buildPersonalStakeCards(enriched);

  }, [payload]);



  if (!user || loading || !cards.length) {

    return null;

  }



  return (

    <section className="personal-stake-layer rounded-xl border border-violet-500/28 bg-gradient-to-br from-violet-950/30 via-zinc-950/98 to-zinc-950/98 overflow-hidden feed-fade-in">

      <div className="personal-stake-layer__glow pointer-events-none" aria-hidden />

      <div className="relative px-3.5 pt-3 pb-1.5 border-b border-violet-500/12">

        <div className="flex items-center justify-between gap-2">

          <div>

            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-violet-300/90">

              Your conviction

            </p>

            <p className="text-[10px] text-zinc-500 mt-0.5">Active calls on your desk</p>

          </div>

          <Link

            href="/me/positions"

            className="text-[10px] text-violet-400/85 hover:text-violet-300 shrink-0"

          >

            All conviction →

          </Link>

        </div>

      </div>

      <div className="relative px-2.5 pb-2.5 pt-1.5 space-y-1.5">

        {cards.slice(0, 2).map((card) => (

          <StakeCard key={card.positionId} card={card} />

        ))}

      </div>

    </section>

  );

}


