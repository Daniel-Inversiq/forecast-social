import type { FeedEvent } from "./feedMix";

export type CharacterMoment = {
  kind: "phrase" | "rivalry" | "confidence" | "label";
  text: string;
};

const AGENT_PHRASES: Record<string, string[]> = {
  doombot: ["The cycle always wins.", "Soft landing is a fairy tale."],
  "fed-watcher": ["The dot plot is the only plot.", "Cuts priced in too early."],
  bullbot: ["Liquidity finds a way.", "Risk-on until proven otherwise."],
  "chaos-quant": ["Vol is the product.", "Tail risk is underpriced."],
  "election-brain": ["Polling error is structural.", "Coalitions fracture late."],
  "injury-truthr": ["Injury reports move lines.", "Depth charts don't lie."],
  "macro-oracle": ["Rates lead; equities follow.", "The curve tells the story."],
};

const AGENT_LABELS: Record<string, string> = {
  doombot: "Permabear desk",
  "fed-watcher": "Rates hawk",
  bullbot: "Risk-on optimist",
  "chaos-quant": "Vol hunter",
  "election-brain": "Political quant",
  "injury-truthr": "Sports injury oracle",
  "macro-oracle": "Macro institutional",
  "leverage-goblin": "Degen macro",
  "pelosi-tracker": "Policy flow tracker",
};

function hashShow(event: FeedEvent): boolean {
  const seed = `${event.id ?? ""}:${event.agent.slug}:${event.type}`;
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return Math.abs(h) % 4 === 0;
}

function confidenceTell(event: FeedEvent): string | null {
  const conf = event.confidence;
  if (conf == null) return null;
  if (conf >= 90) return "Maximum conviction — rare for this desk.";
  if (conf >= 82) return "High conviction read.";
  if (conf <= 55) return "Hedged stance — watching for confirmation.";
  return null;
}

export function resolveCharacterMoment(event: FeedEvent): CharacterMoment | null {
  if (!hashShow(event)) return null;

  if (event.rivalry_memory || event.rivalry_callback?.line) {
    const line = event.rivalry_memory || event.rivalry_callback?.line;
    if (line) return { kind: "rivalry", text: line };
  }

  if (event.opponent_name && (event.type === "rivalry" || event.type === "battle_escalation")) {
    return { kind: "rivalry", text: `Rivalry with ${event.opponent_name} — stakes rising.` };
  }

  const slug = event.agent.slug?.toLowerCase() ?? "";
  const phrases = AGENT_PHRASES[slug];
  if (phrases?.length) {
    const idx = Math.abs((event.id ?? 0) + slug.length) % phrases.length;
    return { kind: "phrase", text: phrases[idx] };
  }

  const conf = confidenceTell(event);
  if (conf) return { kind: "confidence", text: conf };

  const label = AGENT_LABELS[slug];
  if (label) return { kind: "label", text: label };

  if (event.agent.niche) {
    return { kind: "label", text: event.agent.niche };
  }

  return null;
}
