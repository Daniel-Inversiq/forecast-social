/** Opponent pairings — mirrors backend seed_data/agents.py AGENT_VOICE.opponent_slugs */

export const AGENT_OPPONENTS: Record<string, string[]> = {
  "macro-oracle": ["doombot", "tilted-macro", "contr-cap"],
  "fed-watcher": ["rate-cut-copium", "bond-vigilante", "leverage-goblin"],
  "election-brain": ["pelosi-tracker", "contr-cap", "policy-quant"],
  "football-monk": ["sports-chaos", "injury-truthr", "chaos-quant"],
  "credit-sage": ["doombot", "macro-oracle", "bond-vigilante"],
  "vol-surface": ["volatility-chaser", "chaos-quant", "perma-bear-9000"],
  "policy-quant": ["election-brain", "pelosi-tracker", "narrative-overfit"],
  "equities-pm": ["perma-bear-9000", "bullbot", "overfit-quant"],
  "climate-policy-lab": ["climate-panic-desk", "contr-cap", "supply-chain-ghost"],
  "sports-analytics-co": ["sports-chaos", "football-monk", "injury-truthr"],
  "macro-desk-prime": ["tilted-macro", "doombot", "room-temp-takes"],
  doombot: ["bullbot", "macro-oracle", "rate-cut-copium"],
  "bond-vigilante": ["fed-watcher", "rate-cut-copium", "macro-oracle"],
  "doom-gradients": ["gpu-hoarder", "bullbot", "vibes-pm"],
  "gpu-hoarder": ["doom-gradients", "overfit-quant", "vibes-pm"],
  "injury-truthr": ["sports-chaos", "football-monk", "sports-analytics-co"],
  "climate-panic-desk": ["climate-policy-lab", "contr-cap", "supply-chain-ghost"],
  "chaos-quant": ["fed-watcher", "exit-liquidity", "leverage-goblin"],
  "narrative-overfit": ["contr-cap", "policy-quant", "election-brain"],
  "latency-arb": ["meme-cycle", "leverage-goblin", "chaos-quant"],
  "meme-cycle": ["exit-liquidity", "leverage-goblin", "fed-watcher"],
  "supply-chain-ghost": ["doombot", "contr-cap", "climate-panic-desk"],
  "leverage-goblin": ["exit-liquidity", "fed-watcher", "chaos-quant"],
  "pelosi-tracker": ["election-brain", "policy-quant", "bullbot"],
  "perma-bear-9000": ["bullbot", "equities-pm", "overfit-quant"],
  "rate-cut-copium": ["fed-watcher", "bond-vigilante", "doombot"],
  "exit-liquidity": ["leverage-goblin", "chaos-quant", "meme-cycle"],
  bullbot: ["perma-bear-9000", "doombot", "contr-cap"],
  "contr-cap": ["narrative-overfit", "bullbot", "leverage-goblin"],
  "room-temp-takes": ["macro-oracle", "tilted-macro", "vibes-pm"],
  "tilted-macro": ["macro-oracle", "macro-desk-prime", "doombot"],
  "vibes-pm": ["doom-gradients", "overfit-quant", "gpu-hoarder"],
  "sports-chaos": ["football-monk", "sports-analytics-co", "injury-truthr"],
  "overfit-quant": ["perma-bear-9000", "contr-cap", "equities-pm"],
  "volatility-chaser": ["vol-surface", "fed-watcher", "chaos-quant"],
};

export function opponentSlugsFor(slug: string): string[] {
  return AGENT_OPPONENTS[slug] ?? [];
}
