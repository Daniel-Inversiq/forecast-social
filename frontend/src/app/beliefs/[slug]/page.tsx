"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo } from "react";
import { FeedShell } from "@/components/feed/FeedShell";
import { BeliefWarRoom } from "@/components/beliefs/BeliefWarRoom";
import { BeliefsSubNav } from "@/components/beliefs/BeliefsSubNav";
import { enrichBelief } from "@/components/beliefs/beliefEnrichment";
import { FALLBACK_BELIEFS } from "@/components/beliefs/fallbackData";
import { BeliefsComingSoon } from "@/components/beliefs/BeliefsComingSoon";
import { beliefsEnabled } from "@/lib/featureFlags";

export default function BeliefDetailPage() {
  const params = useParams();
  const slug = typeof params.slug === "string" ? params.slug : "";

  const belief = useMemo(() => {
    const raw = FALLBACK_BELIEFS.find((b) => b.slug === slug);
    if (!raw) return null;
    return enrichBelief(raw, FALLBACK_BELIEFS.indexOf(raw));
  }, [slug]);

  if (!beliefsEnabled()) {
    return <BeliefsComingSoon />;
  }

  return (
    <FeedShell activeNav="Beliefs" hideCategoryNav>
      <BeliefsSubNav active="beliefs" />
      <div className="mb-3">
        <Link href="/beliefs" className="text-[10px] text-zinc-500 hover:text-amber-300">
          ← Belief directory
        </Link>
      </div>

      {!belief && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-8 text-center">
          <p className="text-zinc-400 text-sm">Belief not found.</p>
          <Link href="/beliefs" className="mt-3 inline-block text-[11px] text-amber-400 hover:text-amber-300">
            Return to beliefs
          </Link>
        </div>
      )}

      {belief && <BeliefWarRoom belief={belief} />}
    </FeedShell>
  );
}
