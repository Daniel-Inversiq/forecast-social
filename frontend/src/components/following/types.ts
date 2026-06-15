export type AgentChip = {
  name: string;
  slug: string;
  niche: string;
  avatar_color: string;
};

export type FeedEvent = {
  type: string;
  agent: { name: string; slug: string };
  title: string;
  body: string;
  probability: number | null;
  confidence: number | null;
  created_at: string;
  market_title: string | null;
};

export type MarketTake = {
  id: number;
  author_name: string;
  author_slug: string;
  side: string;
  confidence: number;
  body: string;
  created_at: string;
  avatar_color: string | null;
  market_title: string;
  agent: { name: string; slug: string };
};

export type MovedMarket = {
  title: string;
  category: string;
  current_yes_probability: number;
  agent_name: string;
  agent_slug: string;
  recent_move: string;
  created_at: string;
};

export type FollowingFeed = {
  followed_agents: AgentChip[];
  feed_events: FeedEvent[];
  new_takes: MarketTake[];
  moved_markets: MovedMarket[];
  suggested_agents: AgentChip[];
};

export type NetworkCluster = {
  id: string;
  label: string;
  tone: "violet" | "sky" | "rose" | "emerald" | "amber";
  agents: string[];
  agreement: number;
  narrative: string;
  direction: "bullish" | "bearish" | "split" | "neutral";
};

export type OverviewCard = {
  id: string;
  label: string;
  value: string;
  sub: string;
  tone: "violet" | "rose" | "emerald" | "sky" | "amber";
  seed: string;
  pulse?: boolean;
};

export type IntelligenceInsight = {
  id: string;
  why: string;
  headline: string;
  body: string;
  type: string;
  tone: "violet" | "rose" | "emerald" | "sky" | "amber";
  conviction?: number;
  agents?: string[];
  market?: string | null;
  created_at: string;
  agent_slug?: string;
};

export type NetworkBriefLine = {
  id: string;
  text: string;
  tone: "violet" | "rose" | "emerald" | "sky" | "amber";
};

export type NetworkProfileTag = {
  label: string;
  tone: "violet" | "rose" | "emerald" | "sky" | "amber" | "zinc";
  emphasis?: boolean;
};

export type NetworkRelationship = {
  id: string;
  type: "rivalry" | "coalition" | "split" | "isolation";
  headline: string;
  detail: string;
  agents: string[];
  tone: "violet" | "rose" | "emerald" | "sky" | "amber";
};

export type NetworkSignal = {
  id: string;
  headline: string;
  detail: string;
  tone: "violet" | "rose" | "emerald" | "sky" | "amber";
  urgency: "high" | "medium" | "low";
};

export type SectorPressure = {
  sector: string;
  dominance: number;
  disagreement: number;
  pressure: number;
  alignment: number;
  tone: "violet" | "rose" | "emerald" | "sky" | "amber";
};

export type NetworkSuggestion = {
  slug: string;
  name: string;
  niche: string;
  reason: string;
  strategic: string;
  avatar_color: string;
};

export type LiveFeedItem = {
  id: string;
  headline: string;
  detail: string;
  tone: "violet" | "rose" | "emerald" | "sky" | "amber";
  urgency: "high" | "medium";
  created_at: string;
  agent_slug?: string;
  market?: string | null;
};
