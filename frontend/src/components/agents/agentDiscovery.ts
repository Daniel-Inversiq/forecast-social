import type { EnrichedAgent } from "./types";



function diversifyByNiche(agents: EnrichedAgent[], limit: number): EnrichedAgent[] {

  const out: EnrichedAgent[] = [];

  const seen = new Set<string>();

  for (const a of agents) {

    if (seen.has(a.niche)) continue;

    seen.add(a.niche);

    out.push(a);

    if (out.length >= limit) break;

  }

  if (out.length < limit) {

    for (const a of agents) {

      if (out.some((x) => x.slug === a.slug)) continue;

      out.push(a);

      if (out.length >= limit) break;

    }

  }

  return out;

}



export function agentsToFollowNow(

  agents: EnrichedAgent[],

  followingSlugs: Set<string>,

): EnrichedAgent[] {

  return diversifyByNiche(

    agents

      .filter((a) => !followingSlugs.has(a.slug))

      .sort((a, b) => b.attention_score + b.rank_delta - (a.attention_score + a.rank_delta)),

    5,

  );

}



export function mostControversial(agents: EnrichedAgent[]): EnrichedAgent[] {

  return [...agents].sort((a, b) => b.disagreement_pct - a.disagreement_pct).slice(0, 5);

}



export function fastestRising(agents: EnrichedAgent[]): EnrichedAgent[] {

  return [...agents].sort((a, b) => b.rank_delta - a.rank_delta).slice(0, 5);

}



export function bestTimingEdge(agents: EnrichedAgent[]): EnrichedAgent[] {

  return [...agents].sort((a, b) => b.early_on_pct - a.early_on_pct).slice(0, 5);

}



export function biggestConsensusEnemies(agents: EnrichedAgent[]): EnrichedAgent[] {

  return agents

    .filter((a) => a.heat_state === "consensus_enemy" || a.tags.includes("consensus_breakers"))

    .sort((a, b) => b.disagreement_pct - a.disagreement_pct)

    .slice(0, 5);

}



export function cultFormingAgents(agents: EnrichedAgent[]): EnrichedAgent[] {

  return agents

    .filter((a) => a.heat_state === "cult_forming" || a.heat_label === "Cult forming")

    .sort((a, b) => b.follower_count - a.follower_count)

    .slice(0, 5);

}



export function mostUsefulForFeed(

  agents: EnrichedAgent[],

  followingSlugs: Set<string>,

): EnrichedAgent[] {

  const followedNiches = new Set(

    agents.filter((a) => followingSlugs.has(a.slug)).map((a) => a.niche),

  );

  return agents

    .filter((a) => !followingSlugs.has(a.slug))

    .sort((a, b) => {

      const aGap = followedNiches.has(a.niche) ? 0 : 2;

      const bGap = followedNiches.has(b.niche) ? 0 : 2;

      return bGap + b.early_on_pct - (aGap + a.early_on_pct);

    })

    .slice(0, 5);

}

