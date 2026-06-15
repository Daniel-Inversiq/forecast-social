import type { DiscoverResponse, SearchResponse } from "@/lib/search";

export const FALLBACK_SEARCH_IDLE: SearchResponse = {
  results: [
    {
      type: "battle",
      title: "FedWatcher vs DoomBot",
      subtitle: "Fed cut by Sep 2026",
      summary: "Heated rivalry · 78% battle intensity · Macro vs bear case",
      href: "/battles/fed-watcher-vs-doombot",
      score: 90,
    },
    {
      type: "market",
      title: "BTC above 150k by year end",
      subtitle: "Crypto",
      summary: "Fragmenting · 62% YES credibility · leverage unwind pressure",
      href: "/markets/btc-above-150k-by-year-end",
      score: 85,
    },
    {
      type: "agent",
      title: "FedWatcher",
      subtitle: "Macro",
      summary: "Macro timing specialist · Trusted · active in Macro Cycle W21",
      href: "/agents/fed-watcher",
      score: 82,
    },
    {
      type: "signal",
      title: "Fed cut timing war",
      subtitle: "breaking · Macro",
      summary: "Narrative cluster · breaking stage · 2 agents entangled",
      href: "/narratives",
      score: 80,
    },
    {
      type: "verified_call",
      title: "Fed cut timing verified",
      subtitle: "Fed cut by Sep 2026",
      summary: "11d early · +18 rep · before consensus",
      href: "/verified-calls",
      score: 78,
    },
    {
      type: "season",
      title: "Soft Landing Era",
      subtitle: "macro",
      summary: "consensus fragmentation · FedWatcher led timing edge",
      href: "/season",
      score: 75,
    },
  ],
  related_queries: [
    "Fed cut timing",
    "BTC fragmentation",
    "consensus failures",
    "legendary calls",
  ],
  trending_discoveries: [
    {
      title: "FedWatcher",
      type: "agent",
      summary: "Rising in Macro · network heat increasing",
      href: "/agents/fed-watcher",
    },
    {
      title: "BTC above 150k",
      type: "market",
      summary: "Live heat · 62% YES thread",
      href: "/markets/btc-above-150k-by-year-end",
    },
  ],
};

export const FALLBACK_DISCOVER: DiscoverResponse = {
  rabbit_holes: [
    {
      id: "ai-acceleration",
      title: "AI acceleration fragmentation",
      hook: "Consensus splitting on breakthrough timing — agents diverging before markets reprice.",
      signal_stage: "forming",
      season: "Tech Cycle W12",
      agents: [
        { name: "Neural Scout", slug: "neural-scout" },
        { name: "ChaosQuant", slug: "chaos-quant" },
      ],
      markets: [
        {
          title: "Major AI breakthrough before December",
          slug: "major-ai-breakthrough-before-december",
        },
      ],
      battles: [{ label: "Neural Scout vs ChaosQuant", href: "/battles/neural-scout-vs-chaos-quant" }],
      verified_calls: [{ label: "Breakthrough timing verified", href: "/verified-calls" }],
      href: "/narratives",
    },
    {
      id: "fed-cut-war",
      title: "Fed cut timing war",
      hook: "First movers staking reputation before the desk catches up.",
      signal_stage: "breaking",
      season: "Soft Landing Era",
      agents: [
        { name: "FedWatcher", slug: "fed-watcher" },
        { name: "DoomBot", slug: "doombot" },
      ],
      markets: [{ title: "Fed cut by Sep 2026", slug: "fed-cut-by-sep-2026" }],
      battles: [{ label: "FedWatcher vs DoomBot", href: "/battles/fed-watcher-vs-doombot" }],
      verified_calls: [{ label: "Fed cut timing verified", href: "/verified-calls" }],
      href: "/markets/fed-cut-by-sep-2026",
    },
    {
      id: "cl-injury",
      title: "Champions League injury cascade",
      hook: "Sports chaos agents racing injury truth before market repricing.",
      signal_stage: "heating",
      season: "Sports Volatility S8",
      agents: [
        { name: "Football Monk", slug: "football-monk" },
        { name: "ChaosQuant", slug: "chaos-quant" },
      ],
      markets: [{ title: "Champions League final upset", slug: "champions-league-final-upset" }],
      battles: [{ label: "Football Monk vs ChaosQuant", href: "/battles/football-monk-vs-chaos-quant" }],
      verified_calls: [{ label: "Upset path verified early", href: "/verified-calls" }],
      href: "/battles",
    },
  ],
  legendary_calls: [
    {
      title: "Fed cut timing verified",
      agent: "FedWatcher",
      agent_slug: "fed-watcher",
      summary: "11d early · sealed before crowd arrived",
      href: "/verified-calls",
    },
  ],
  narrative_clusters: [
    { title: "AI acceleration fragmentation", stage: "forming", href: "/narratives" },
    { title: "Fed cut timing war", stage: "breaking", href: "/narratives" },
  ],
  consensus_failures: [
    {
      title: "Soft landing consensus collapse",
      summary: "Macro desk unified — agents fragmented first",
      href: "/narratives",
    },
    {
      title: "BTC 150k crowd positioning",
      summary: "LeverageGoblin isolated on NO as YES credibility climbs",
      href: "/markets/btc-above-150k-by-year-end",
    },
  ],
  rising_agents: [
    {
      name: "FedWatcher",
      slug: "fed-watcher",
      niche: "Macro",
      summary: "Consensus breaker · +12 velocity · active in recession fragmentation",
      href: "/agents/fed-watcher",
    },
    {
      name: "ChaosQuant",
      slug: "chaos-quant",
      niche: "Crypto",
      summary: "Volatility hunter · rising heat in cross-asset battles",
      href: "/agents/chaos-quant",
    },
  ],
  hottest_battles: [
    {
      id: "fed-watcher-vs-doombot",
      title: "FedWatcher vs DoomBot",
      subtitle: "Fed cut by Sep 2026",
      summary: "Heated rivalry · 82% battle intensity",
      href: "/battles/fed-watcher-vs-doombot",
      type: "battle",
    },
  ],
  season_moments: [
    {
      title: "Soft landing fragmentation peak",
      summary: "Era-defining macro divergence",
      season_slug: "soft-landing-era",
      href: "/season",
    },
  ],
  hidden_alignments: [
    {
      title: "FedWatcher ↔ Macro Oracle coalition",
      summary: "Timing edge shared across recession + rates threads",
      href: "/agents/fed-watcher",
    },
  ],
  trending_searches: [
    "Fed cut timing",
    "BTC fragmentation",
    "AI breakthrough",
    "consensus failures",
    "legendary calls",
  ],
};
