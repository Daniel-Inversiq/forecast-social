import type { EnrichedAgentProfile } from "@/components/agents/profile/types";
import type { ForecasterBase } from "@/components/agents/types";
import { toUserProfileShape } from "@/components/compare/compareStats";
import { getProfileScryReceipts } from "@/components/users/profile/reputation/receiptData";
import { AGENT_ROSTER } from "@/lib/agentRoster";
import { getResolvedReceipts, resolveCurrentCredibility } from "@/lib/credibility";
import { resolveTrustTier } from "@/lib/trust";

const RECENT_COMPARE_KEY = "scry-recent-compares";
const RECENT_MAX = 8;

const RIVALRY_LABELS = [
  "Macro timing split",
  "Fed path divergence",
  "AI acceleration dispute",
  "Rates repricing war",
  "Election volatility clash",
  "Consensus break standoff",
  "Recession timing split",
  "Crypto reflexivity feud",
];

export type SuggestedRival = {
  slug: string;
  name: string;
  avatarColor?: string;
  credibility: number;
  trustTierKey: string;
  trustTierLabel: string;
  descriptor: string;
  recordVsCurrent: string;
  rivalryLabel: string;
};

export type CompareAgentOption = {
  slug: string;
  name: string;
  avatarColor?: string;
  credibility: number;
  trustTierKey: string;
  trustTierLabel: string;
  descriptor: string;
  niche: string;
};

function hash(s: string): number {
  return s.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
}

function pick<T>(arr: T[], seed: string, offset = 0): T {
  return arr[(hash(seed) + offset) % arr.length];
}

export function comparePath(currentSlug: string, otherSlug: string): string {
  return `/compare/${encodeURIComponent(currentSlug)}/${encodeURIComponent(otherSlug)}`;
}

export function battlePath(slugA: string, slugB: string): string {
  return `/battles/${[slugA, slugB].sort().join("-")}`;
}

export function estimateAgentCredibility(agent: Pick<ForecasterBase, "slug" | "reputation_score" | "accuracy_score" | "streak" | "follower_count">): number {
  const receipts = getProfileScryReceipts(
    toUserProfileShape(agent as EnrichedAgentProfile),
    null,
  );
  if (getResolvedReceipts(receipts).length > 0) {
    return resolveCurrentCredibility(receipts, agent.reputation_score);
  }
  if (agent.reputation_score != null) return Math.round(agent.reputation_score);
  const h = hash(agent.slug);
  return Math.round(
    (agent.accuracy_score ?? 70) * 0.55 +
      (agent.streak ?? 0) * 2.2 +
      (h % 12) +
      Math.min(120, Math.floor((agent.follower_count ?? 0) / 400)),
  );
}

function trustForCredibility(slug: string, credibility: number, resolvedCalls = 20): {
  trustTierKey: string;
  trustTierLabel: string;
} {
  const t = resolveTrustTier({
    resolvedCalls,
    credibility,
    accountAgeDays: 30 + (hash(slug) % 200),
  });
  return { trustTierKey: t.tierKey, trustTierLabel: t.tierLabel };
}

function recordVsRival(currentSlug: string, rivalSlug: string): string {
  const h = hash(`${currentSlug}:vs:${rivalSlug}`);
  const winsCurrent = 3 + (h % 9);
  const winsRival = 2 + ((h * 7) % 8);
  return `${winsCurrent}–${winsRival}`;
}

function rosterEntry(slug: string) {
  return AGENT_ROSTER.find((a) => a.slug === slug);
}

function agentToOption(agent: ForecasterBase): CompareAgentOption {
  const credibility = estimateAgentCredibility(agent);
  const trust = trustForCredibility(agent.slug, credibility, 12 + (hash(agent.slug) % 80));
  return {
    slug: agent.slug,
    name: agent.name,
    avatarColor: agent.avatar_color,
    credibility,
    trustTierKey: agent.tier_key ?? trust.trustTierKey,
    trustTierLabel: agent.tier_label ?? trust.trustTierLabel,
    descriptor: agent.personality_tagline || agent.conviction_style || agent.niche,
    niche: agent.niche,
  };
}

export function forecasterListToCompareOptions(agents: ForecasterBase[]): CompareAgentOption[] {
  return agents
    .filter((a) => a.slug)
    .map(agentToOption)
    .sort((a, b) => b.credibility - a.credibility);
}

export function getSuggestedRivals(
  profile: EnrichedAgentProfile,
  allAgents: ForecasterBase[] = [],
): SuggestedRival[] {
  const seen = new Set<string>([profile.slug]);
  const rivals: SuggestedRival[] = [];

  function pushRival(input: {
    slug: string;
    name: string;
    avatarColor?: string;
    credibility?: number;
    rivalryLabel?: string;
    recordVsCurrent?: string;
  }) {
    if (seen.has(input.slug)) return;
    seen.add(input.slug);
    const roster = rosterEntry(input.slug);
    const fromList = allAgents.find((a) => a.slug === input.slug);
    const credibility =
      input.credibility ??
      (fromList ? estimateAgentCredibility(fromList) : 90 + (hash(input.slug) % 750));
    const trust = trustForCredibility(input.slug, credibility, profile.resolved_calls);
    rivals.push({
      slug: input.slug,
      name: input.name,
      avatarColor: input.avatarColor ?? roster?.avatar_color ?? fromList?.avatar_color,
      credibility,
      trustTierKey: fromList?.tier_key ?? trust.trustTierKey,
      trustTierLabel: fromList?.tier_label ?? trust.trustTierLabel,
      descriptor:
        roster?.personality_tagline ??
        fromList?.personality_tagline ??
        fromList?.niche ??
        roster?.niche ??
        "Forecaster",
      recordVsCurrent: input.recordVsCurrent ?? recordVsRival(profile.slug, input.slug),
      rivalryLabel:
        input.rivalryLabel ??
        pick(RIVALRY_LABELS, profile.slug + input.slug),
    });
  }

  for (const b of profile.battles) {
    pushRival({
      slug: b.rivalSlug,
      name: b.rival,
      rivalryLabel: b.market.length > 48 ? pick(RIVALRY_LABELS, b.market) : b.market,
      recordVsCurrent:
        b.status === "won"
          ? recordVsRival(profile.slug, b.rivalSlug)
          : b.status === "lost"
            ? (() => {
                const [a, c] = recordVsRival(profile.slug, b.rivalSlug).split("–").map(Number);
                return `${Math.max(0, c)}–${a}`;
              })()
            : recordVsRival(profile.slug, b.rivalSlug),
    });
  }

  if (profile.top_disagreement.slug !== profile.slug) {
    pushRival({
      slug: profile.top_disagreement.slug,
      name: profile.top_disagreement.name,
      rivalryLabel: profile.top_disagreement.market,
    });
  }

  const rosterPool = AGENT_ROSTER.filter((a) => a.slug !== profile.slug);
  const sameNiche = rosterPool.filter((a) => a.niche === profile.niche);
  const pool = [...sameNiche, ...rosterPool].filter(
    (a, i, arr) => arr.findIndex((x) => x.slug === a.slug) === i,
  );

  for (let i = 0; rivals.length < 5 && i < pool.length; i++) {
    const entry = pick(pool, profile.slug, i);
    pushRival({
      slug: entry.slug,
      name: entry.name,
      avatarColor: entry.avatar_color,
    });
  }

  for (const a of allAgents) {
    if (rivals.length >= 6) break;
    if (a.slug === profile.slug) continue;
    if (a.niche === profile.niche || (a.reputation_score ?? 0) > 400) {
      pushRival({
        slug: a.slug,
        name: a.name,
        avatarColor: a.avatar_color,
        credibility: estimateAgentCredibility(a),
      });
    }
  }

  return rivals.slice(0, 6);
}

export function filterCompareOptions(
  options: CompareAgentOption[],
  query: string,
  excludeSlug: string,
): CompareAgentOption[] {
  const q = query.trim().toLowerCase();
  return options.filter((a) => {
    if (a.slug === excludeSlug) return false;
    if (!q) return true;
    return (
      a.name.toLowerCase().includes(q) ||
      a.slug.toLowerCase().includes(q) ||
      a.niche.toLowerCase().includes(q) ||
      a.descriptor.toLowerCase().includes(q)
    );
  });
}

export function getRecentCompareSlugs(currentSlug: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(RECENT_COMPARE_KEY);
    if (!raw) return [];
    const entries: string[] = JSON.parse(raw);
    const out: string[] = [];
    for (const entry of entries) {
      const [a, b] = entry.split(":");
      if (a === currentSlug && b !== currentSlug) out.push(b);
      else if (b === currentSlug && a !== currentSlug) out.push(a);
    }
    return [...new Set(out)].slice(0, 5);
  } catch {
    return [];
  }
}

export function pushRecentCompare(slugA: string, slugB: string): void {
  if (typeof window === "undefined") return;
  const pair = `${slugA}:${slugB}`;
  try {
    const raw = localStorage.getItem(RECENT_COMPARE_KEY);
    const prev: string[] = raw ? JSON.parse(raw) : [];
    const next = [pair, ...prev.filter((p) => p !== pair)].slice(0, RECENT_MAX);
    localStorage.setItem(RECENT_COMPARE_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

export function topCompareFallbacks(
  options: CompareAgentOption[],
  excludeSlug: string,
  limit = 6,
): CompareAgentOption[] {
  return options.filter((a) => a.slug !== excludeSlug).slice(0, limit);
}
