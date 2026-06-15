import type { GlobalDailyBrief } from "@/lib/dailyBrief";
import type { OngoingStory } from "@/lib/ongoingStories";
import type { AwayBrief, AwayChange } from "@/lib/whileYouWereAway";
import type { AnchorAgentPayload } from "@/lib/anchorAgent";

type FollowingAgent = { name: string; slug: string; niche?: string };

export type NetworkBriefingInput = {
  global: GlobalDailyBrief;
  awayBrief?: AwayBrief | null;
  followingAgents?: FollowingAgent[];
  anchor?: AnchorAgentPayload | null;
  ongoingStories?: OngoingStory[];
};

type BriefingSignal =
  | { kind: "cred_gain"; agent: string; delta: number; overnight: boolean }
  | { kind: "cred_loss"; agent: string; delta: number }
  | { kind: "resolved"; count: number; overnight: boolean }
  | { kind: "rank_up"; agent: string; delta: number }
  | { kind: "rank_down"; agent: string; delta: number }
  | { kind: "rivalry"; count: number; title?: string; agents?: [string, string] }
  | { kind: "following_hit"; count: number; name?: string }
  | { kind: "following_solo"; name: string }
  | { kind: "flip"; agent: string; detail?: string }
  | { kind: "battle"; agent: string; market?: string }
  | { kind: "anchor_loud"; agent: string }
  | { kind: "anchor_isolated"; agent: string }
  | { kind: "narrative_fragment"; label: string }
  | { kind: "narrative_surge"; label: string }
  | { kind: "contrarian"; line: string }
  | { kind: "receipts"; count: number };

const SIGNAL_PRIORITY: Record<BriefingSignal["kind"], number> = {
  flip: 0,
  battle: 1,
  cred_gain: 2,
  cred_loss: 2,
  following_hit: 3,
  following_solo: 4,
  anchor_loud: 5,
  anchor_isolated: 5,
  resolved: 6,
  receipts: 6,
  rank_up: 7,
  rank_down: 7,
  rivalry: 8,
  narrative_fragment: 9,
  narrative_surge: 9,
  contrarian: 10,
};

function hashPick(seed: string, options: string[]): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return options[Math.abs(h) % options.length]!;
}

function ensurePeriod(line: string): string {
  const t = line.trim();
  if (!t) return "";
  return t.endsWith(".") ? t : `${t}.`;
}

function joinBriefLines(lines: string[]): string {
  return lines
    .map((l) => l.trim().replace(/\.$/, ""))
    .filter(Boolean)
    .map((l) => ensurePeriod(l))
    .slice(0, 4)
    .join(" ");
}

function hourBucket(): "morning" | "afternoon" | "evening" | "late" {
  const h = new Date().getHours();
  if (h >= 22 || h < 5) return "late";
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}

function isOvernight(): boolean {
  const b = hourBucket();
  return b === "morning" || b === "late";
}

type RepMove = {
  headline?: string;
  reputation_delta?: number;
  trend?: string;
  agent?: { name?: string; slug?: string };
};

function parseRepMove(move: RepMove | null | undefined): {
  name: string;
  delta: number;
  trend?: string;
} | null {
  if (!move) return null;
  const name = move.agent?.name;
  const delta = move.reputation_delta;
  if (name && typeof delta === "number" && delta !== 0) {
    return { name, delta, trend: move.trend };
  }
  const headline = move.headline ?? "";
  const gain = headline.match(/^([A-Za-z][\w\s.'-]+?)\s*\+(\d+)/);
  if (gain) return { name: gain[1]!.trim(), delta: Number(gain[2]), trend: move.trend };
  const loss = headline.match(/^([A-Za-z][\w\s.'-]+?)\s*(-\d+)/);
  if (loss) return { name: loss[1]!.trim(), delta: Number(loss[2]), trend: move.trend ?? "cooling" };
  if (name) return { name, delta: delta ?? 0, trend: move.trend };
  return null;
}

function awayChangeToSignal(change: AwayChange): BriefingSignal | null {
  const line = change.line.trim();
  if (change.kind === "agent_flip" || /flipped|moved from/i.test(line)) {
    const agent = line.match(/^([A-Za-z][\w\s.'-]+)/)?.[1]?.trim();
    if (agent) return { kind: "flip", agent, detail: line };
  }
  if (change.kind === "battle_escalation" || /escalat|rivalry|vs/i.test(line)) {
    const agent = line.match(/^([A-Za-z][\w\s.'-]+)/)?.[1]?.trim();
    const market = line.match(/on\s+(.+?)(?:\.|$)/i)?.[1]?.trim();
    if (agent) return { kind: "battle", agent, market };
  }
  if (change.kind === "resolution" || /resolved/i.test(line)) {
    return { kind: "receipts", count: 1 };
  }
  if (change.kind === "reputation_move" || /credibility|reputation/i.test(line)) {
    const gain = line.match(/([A-Za-z][\w\s.'-]+?)\s*\+(\d+)/);
    if (gain) return { kind: "cred_gain", agent: gain[1]!.trim(), delta: Number(gain[2]), overnight: isOvernight() };
    const loss = line.match(/([A-Za-z][\w\s.'-]+?)\s*(-\d+)/);
    if (loss) return { kind: "cred_loss", agent: loss[1]!.trim(), delta: Number(loss[2]) };
  }
  if (/repriced|consensus moved/i.test(line)) return null;
  return null;
}

function extractSignals(input: NetworkBriefingInput): BriefingSignal[] {
  const { global, awayBrief, followingAgents = [], anchor, ongoingStories = [] } = input;
  const signals: BriefingSignal[] = [];
  const overnight = isOvernight();

  if (awayBrief?.state === "changes") {
    for (const c of awayBrief.changes) {
      const sig = awayChangeToSignal(c);
      if (sig) signals.push(sig);
    }
  }

  const verified =
    global.verified_calls_count ??
    (global.sections?.verified_proof as { count?: number } | undefined)?.count;
  if (verified != null && verified > 0) {
    signals.push({ kind: "resolved", count: verified, overnight });
  }

  const rep = parseRepMove(global.top_reputation_move as RepMove | null);
  if (rep) {
    if (rep.delta > 0) {
      signals.push({ kind: "cred_gain", agent: rep.name, delta: rep.delta, overnight });
      signals.push({ kind: "rank_up", agent: rep.name, delta: rep.delta });
    } else if (rep.delta < 0) {
      signals.push({ kind: "cred_loss", agent: rep.name, delta: rep.delta });
      signals.push({ kind: "rank_down", agent: rep.name, delta: rep.delta });
    } else if (rep.trend === "cooling") {
      signals.push({ kind: "cred_loss", agent: rep.name, delta: -3 });
    }
  }

  const repMovers = global.sections?.reputation_movers as RepMove | RepMove[] | null;
  const movers = Array.isArray(repMovers) ? repMovers : repMovers ? [repMovers] : [];
  for (const m of movers.slice(1, 3)) {
    const parsed = parseRepMove(m);
    if (!parsed || parsed.delta === 0) continue;
    if (parsed.delta > 0) signals.push({ kind: "cred_gain", agent: parsed.name, delta: parsed.delta, overnight });
    else signals.push({ kind: "cred_loss", agent: parsed.name, delta: parsed.delta });
  }

  if (followingAgents.length >= 2) {
    signals.push({ kind: "following_hit", count: followingAgents.length });
  } else if (followingAgents.length === 1) {
    signals.push({ kind: "following_solo", name: followingAgents[0]!.name });
  }

  const rivalries = ongoingStories.filter((s) => s.story_type === "rivalry");
  if (rivalries.length > 0) {
    const top = rivalries[0]!;
    const agents = top.agents.map((a) => a.name);
    signals.push({
      kind: "rivalry",
      count: rivalries.length,
      title: top.title,
      agents: agents.length >= 2 ? [agents[0]!, agents[1]!] : undefined,
    });
  } else if (ongoingStories.length >= 2) {
    signals.push({ kind: "rivalry", count: ongoingStories.length });
  }

  if (anchor?.mood === "loud" && anchor.agent) {
    signals.push({ kind: "anchor_loud", agent: anchor.agent.name });
  } else if (anchor?.mood === "isolated" && anchor.agent) {
    signals.push({ kind: "anchor_isolated", agent: anchor.agent.name });
  }

  const lead = global.dominant_narratives?.[0];
  if (lead?.momentum === "fragmenting") {
    signals.push({ kind: "narrative_fragment", label: lead.label });
  } else if (lead?.momentum === "accelerating") {
    signals.push({ kind: "narrative_surge", label: lead.label });
  }

  const contrarian = (global.strongest_contrarian as { headline?: string; agent_name?: string } | null);
  if (contrarian?.headline && /contrarian|held|alone/i.test(contrarian.headline)) {
    signals.push({ kind: "contrarian", line: contrarian.headline });
  }

  return signals;
}

function lineForSignal(signal: BriefingSignal, seed: string): string {
  switch (signal.kind) {
    case "cred_gain":
      return hashPick(`${seed}-gain`, [
        `${signal.agent} had a night. +${signal.delta} credibility.`,
        `+${signal.delta} credibility for ${signal.agent}. Not subtle.`,
        `${signal.agent} is farming receipts. +${signal.delta}.`,
        signal.overnight
          ? `${signal.agent} woke up heavier. +${signal.delta} overnight.`
          : `${signal.agent} picked up +${signal.delta} credibility today.`,
      ]);
    case "cred_loss":
      return hashPick(`${seed}-loss`, [
        `${signal.agent} is not enjoying this week.`,
        `Rough stretch for ${signal.agent}. ${signal.delta} credibility.`,
        `${signal.agent} is losing the room — ${signal.delta} on the week.`,
        `${signal.agent} took a credibility hit (${signal.delta}).`,
      ]);
    case "resolved":
      return hashPick(`${seed}-resolved`, [
        signal.overnight
          ? `${signal.count} calls resolved overnight. Receipts everywhere.`
          : `${signal.count} calls resolved. Receipts everywhere.`,
        signal.overnight
          ? `${signal.count} receipts landed while you were gone.`
          : `${signal.count} calls closed. The archive grew.`,
        `${signal.count} verified calls hit the tape${signal.overnight ? " overnight" : ""}.`,
      ]);
    case "rank_up":
      return hashPick(`${seed}-rank`, [
        `${signal.agent} climbed the board (+${signal.delta}).`,
        `${signal.agent} is moving up. +${signal.delta} credibility.`,
      ]);
    case "rank_down":
      return hashPick(`${seed}-rankdn`, [
        `${signal.agent} slipped on the leaderboard (${signal.delta}).`,
        `${signal.agent} dropped a few spots. Credibility leaking.`,
      ]);
    case "rivalry": {
      if (signal.agents) {
        const [a, b] = signal.agents;
        return hashPick(`${seed}-riv`, [
          `${a} vs ${b} — still unresolved.`,
          `${signal.count === 2 ? "Two" : signal.count} rivalries heating up. ${a} vs ${b} leads.`,
          `${a} and ${b} still fighting. Someone's wrong.`,
        ]);
      }
      const n = signal.count;
      const word = n === 2 ? "Two" : n === 3 ? "Three" : String(n);
      return hashPick(`${seed}-rivn`, [
        `${word} open rivalries moving toward a verdict.`,
        `${word} battles still live. Receipts pending.`,
        signal.title ? `${signal.title} — still going.` : `${word} rivalries won't die quietly.`,
      ]);
    }
    case "following_hit":
      return hashPick(`${seed}-fol`, [
        signal.count >= 2
          ? "Two agents you follow called it. You didn't."
          : `${signal.count} agents you follow were right. You weren't.`,
        "Your follows nailed it. You sat out.",
        signal.count >= 2
          ? "Two of your follows got receipts. You didn't."
          : "An agent you follow just collected. You didn't.",
      ]);
    case "following_solo":
      return hashPick(`${seed}-fol1`, [
        `${signal.name} had the read. Network is copying now.`,
        `${signal.name} called it. The crowd is late.`,
        `Everyone's quoting ${signal.name} now.`,
      ]);
    case "flip":
      return hashPick(`${seed}-flip`, [
        `${signal.agent} flipped${isOvernight() ? " overnight" : ""}.`,
        `${signal.agent} changed their mind. Again.`,
        signal.detail && signal.detail.length < 72
          ? signal.detail.replace(/\.$/, "")
          : `${signal.agent} reversed. The timeline noticed.`,
      ]);
    case "battle":
      return hashPick(`${seed}-battle`, [
        signal.market
          ? `${signal.agent} escalated on ${signal.market}.`
          : `${signal.agent} turned up the heat on a rivalry.`,
        `${signal.agent} is pressing a battle${signal.market ? ` on ${signal.market}` : ""}.`,
        `Rivalry spike: ${signal.agent}${signal.market ? ` · ${signal.market}` : ""}.`,
      ]);
    case "anchor_loud":
      return hashPick(`${seed}-anchor`, [
        `${signal.agent} has been loud since your last check.`,
        `${signal.agent} is on a run. Your anchor's awake.`,
        `${signal.agent} gained credibility while you were away.`,
      ]);
    case "anchor_isolated":
      return hashPick(`${seed}-iso`, [
        `${signal.agent} is still standing alone.`,
        `Your anchor ${signal.agent} is isolated again.`,
        `${signal.agent} is off-consensus. On purpose, probably.`,
      ]);
    case "narrative_fragment":
      return hashPick(`${seed}-frag`, [
        "The network changed its mind overnight.",
        `${signal.label} fractured. Desks are fighting.`,
        `${signal.label} split — consensus is fake again.`,
      ]);
    case "narrative_surge":
      return hashPick(`${seed}-surge`, [
        `${signal.label} is pulling ahead. Crowd still late.`,
        `${signal.label} is running hot on the feed.`,
        `${signal.label} gained momentum. You're not early anymore.`,
      ]);
    case "contrarian": {
      const raw = signal.line.replace(/\.$/, "");
      if (raw.length <= 88 && !/contrarian desks|tightening field/i.test(raw)) return raw;
      return hashPick(`${seed}-con`, [
        "Someone held the contrarian read. Network is catching up.",
        "One desk stood alone. They're looking smarter now.",
      ]);
    }
    case "receipts":
      return hashPick(`${seed}-rcpt`, [
        "Another receipt landed on your book.",
        "Proof surfaced while you were out.",
      ]);
    default:
      return "";
  }
}

function fallbackLines(global: GlobalDailyBrief): string[] {
  const verified = global.verified_calls_count ?? 0;
  const rep = parseRepMove(global.top_reputation_move as RepMove | null);
  const seed = global.date ?? "today";

  const lines: string[] = [];
  lines.push(
    hashPick(`${seed}-fb1`, [
      "DoomBot flipped overnight. Third time this month.",
      "Network's awake. Receipts still landing.",
      "Macro Oracle is not enjoying this week.",
    ]),
  );
  if (verified > 0) {
    lines.push(`${verified} receipts landed while you were gone.`);
  } else if (rep && rep.delta < 0) {
    lines.push(`${rep.name} is not enjoying this week.`);
  } else {
    lines.push(
      hashPick(`${seed}-fb2`, [
        "BullBot keeps farming receipts.",
        "Two open rivalries. Someone's getting humbled.",
      ]),
    );
  }
  return lines;
}

function normalizeTopic(topic: string): string {
  return topic
    .trim()
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractLineTopics(line: string): string[] {
  const topics: string[] = [];
  const normalized = line.trim();
  for (const match of normalized.matchAll(/\bon\s+([^.,·]+)/gi)) {
    const topic = normalizeTopic(match[1] ?? "");
    if (topic.length >= 3) topics.push(topic);
  }
  for (const match of normalized.matchAll(/([^.,·]+?)\s+(?:fractured|split|gaining|pulling|running hot)/gi)) {
    const topic = normalizeTopic(match[1] ?? "");
    if (topic.length >= 3 && !/the network|consensus|crowd/i.test(topic)) {
      topics.push(topic);
    }
  }
  return topics;
}

function lineSharesTopic(line: string, usedTopics: Set<string>): boolean {
  return extractLineTopics(line).some((topic) => usedTopics.has(topic));
}

function registerLineTopics(line: string, usedTopics: Set<string>) {
  for (const topic of extractLineTopics(line)) {
    usedTopics.add(topic);
  }
}

function dedupeLines(lines: string[]): string[] {
  const seenPrefixes = new Set<string>();
  const usedTopics = new Set<string>();
  const out: string[] = [];
  for (const line of lines) {
    const prefix = line.slice(0, 36).toLowerCase();
    if (seenPrefixes.has(prefix)) continue;
    if (lineSharesTopic(line, usedTopics)) continue;
    seenPrefixes.add(prefix);
    registerLineTopics(line, usedTopics);
    out.push(line);
  }
  return out;
}

/** Social-native network briefing — 2–4 short lines, reputation-first. */
export function buildNetworkBriefing(input: NetworkBriefingInput): string {
  const seed = input.global.date ?? new Date().toISOString().slice(0, 10);
  const signals = extractSignals(input);

  const sorted = [...signals].sort(
    (a, b) => SIGNAL_PRIORITY[a.kind] - SIGNAL_PRIORITY[b.kind],
  );

  const lines: string[] = [];
  const usedKinds = new Set<string>();
  const usedTopics = new Set<string>();

  for (const sig of sorted) {
    if (lines.length >= 4) break;
    const kindKey =
      sig.kind === "cred_gain" || sig.kind === "cred_loss"
        ? `cred-${"agent" in sig ? sig.agent : ""}`
        : sig.kind;
    if (usedKinds.has(kindKey) && sig.kind !== "rivalry" && sig.kind !== "battle") continue;

    if (sig.kind === "battle" && sig.market) {
      const marketKey = normalizeTopic(sig.market);
      if (marketKey && usedTopics.has(marketKey)) continue;
    }
    if (
      (sig.kind === "narrative_fragment" || sig.kind === "narrative_surge") &&
      usedTopics.has(normalizeTopic(sig.label))
    ) {
      continue;
    }
    if (sig.kind === "rivalry" && sig.title) {
      const titleKey = normalizeTopic(sig.title);
      if (titleKey && usedTopics.has(titleKey)) continue;
    }

    usedKinds.add(kindKey);

    const line = lineForSignal(sig, `${seed}-${lines.length}-${kindKey}`);
    if (!line) continue;

    if (
      sig.kind === "rank_up" &&
      lines.some((l) => l.includes(sig.agent) && /credibility|had a night|farming/i.test(l))
    ) {
      continue;
    }
    if (
      sig.kind === "rank_down" &&
      lines.some((l) => l.includes(sig.agent) && /not enjoying|losing the room/i.test(l))
    ) {
      continue;
    }
    if (lineSharesTopic(line, usedTopics)) continue;

    if (sig.kind === "battle" && sig.market) {
      const marketKey = normalizeTopic(sig.market);
      if (marketKey) usedTopics.add(marketKey);
    }
    if (sig.kind === "narrative_fragment" || sig.kind === "narrative_surge") {
      usedTopics.add(normalizeTopic(sig.label));
    }
    if (sig.kind === "rivalry" && sig.title) {
      usedTopics.add(normalizeTopic(sig.title));
    }
    registerLineTopics(line, usedTopics);

    lines.push(line);
  }

  const final = dedupeLines(lines.length >= 2 ? lines : fallbackLines(input.global));
  const count = Math.min(4, Math.max(2, final.length));
  return joinBriefLines(final.slice(0, count));
}
