export { beliefsEnabled } from "@/lib/featureFlags";

export {
  enrichBelief,
  filterBeliefs,
  sortBeliefs,
  rankBeliefsByType,
  getBeliefBySlug,
  getBattleBeliefLink,
  beliefPath,
} from "@/components/beliefs/beliefEnrichment";

export { FALLBACK_BELIEFS, AGENT_BELIEF_PORTFOLIOS } from "@/components/beliefs/fallbackData";

export type {
  Belief,
  EnrichedBelief,
  AgentBeliefPortfolioEntry,
  BeliefRankingTypeKey,
} from "@/components/beliefs/types";
