import { HeatPill, LiveDot } from "@/components/feed/shared";
import { ArchetypeCard } from "./ArchetypeCard";
import type { AgentArchetypeKey, EnrichedAgent } from "./types";

const ARCHETYPE_KEYS: AgentArchetypeKey[] = [
  "consensus_breaker",
  "macro_strategist",
  "narrative_hunter",
  "volatility_chaser",
  "early_signal_scout",
  "slow_conviction",
];

export function AgentArchetypes({ agents }: { agents: EnrichedAgent[] }) {
  return (
    <section className="mt-6 mb-4">
      <div className="flex items-center gap-2 mb-2 px-0.5">
        <LiveDot color="violet" />
        <h2 className="text-sm font-semibold text-white">Forecasting styles</h2>
        <HeatPill tone="violet">Archetypes</HeatPill>
        <span className="text-[10px] text-zinc-600 hidden sm:inline">
          Behavioral identities on the network
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
        {ARCHETYPE_KEYS.map((key) => (
          <ArchetypeCard key={key} archetype={key} agents={agents} />
        ))}
      </div>
    </section>
  );
}
