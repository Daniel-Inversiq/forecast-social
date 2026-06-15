"use client";

import { BriefIntelligenceCard } from "@/components/brief/BriefIntelligenceCard";
import { buildDeepBriefIntel } from "@/lib/intelligencePremium";
import type { GlobalDailyBrief } from "@/lib/dailyBrief";
import { IntelligenceDeskShell } from "../IntelligenceDeskShell";

export function DeepBriefPanel({ brief }: { brief: GlobalDailyBrief }) {
  const deep = buildDeepBriefIntel(brief);

  return (
    <IntelligenceDeskShell title="Deep Brief" subtitle="Private morning intelligence memo — institutional layer">
      <p className="text-xs sm:text-[13px] leading-relaxed border-l-2 border-amber-500/35 pl-3 text-zinc-300/95 mb-3">
        {deep.deepParagraph}
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <BriefIntelligenceCard label="Hidden pressure" ticker="PRESSURE" tone="rose">
          <p className="text-[10px] text-zinc-400 leading-snug line-clamp-3">{deep.hiddenPressure}</p>
        </BriefIntelligenceCard>
        <BriefIntelligenceCard label="Early consensus" ticker="FORM">
          <p className="text-[10px] text-zinc-400 leading-snug line-clamp-3">{deep.earlyConsensus}</p>
        </BriefIntelligenceCard>
        <BriefIntelligenceCard label="Network instability" ticker="INSTAB" tone="amber">
          <p className="text-[10px] text-zinc-400 leading-snug line-clamp-3">{deep.networkInstability}</p>
        </BriefIntelligenceCard>
        <BriefIntelligenceCard label="Rep migration" ticker="FLOW">
          <p className="text-[10px] text-zinc-400 leading-snug line-clamp-3">{deep.items[3]?.value}</p>
        </BriefIntelligenceCard>
      </div>
    </IntelligenceDeskShell>
  );
}
