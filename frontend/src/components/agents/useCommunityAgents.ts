"use client";

import { useEffect, useMemo, useState } from "react";
import { enrichAgents } from "@/components/agents/agentEnrichment";
import type { EnrichedAgent, ForecasterBase } from "@/components/agents/types";
import { fetchForecasterDiscovery, type ForecasterCard } from "@/lib/creatorForecaster";

function cardToBase(card: ForecasterCard): ForecasterBase {
  return {
    name: card.name,
    slug: card.slug,
    niche: card.niche,
    conviction_style: card.conviction_style,
    personality_tagline: card.personality_tagline,
    avatar_color: card.avatar_color,
    streak: 0,
    accuracy_score: 0,
    follower_count: card.follower_count,
    reputation_score: card.reputation_score,
    tier_label: card.tier_label,
    reputation_velocity: card.reputation_velocity,
    reputation_trend: card.reputation_trend as ForecasterBase["reputation_trend"],
    status: "active",
  };
}

function dedupeCards(cards: ForecasterCard[]): ForecasterCard[] {
  const seen = new Set<string>();
  return cards.filter((c) => {
    if (seen.has(c.slug)) return false;
    seen.add(c.slug);
    return true;
  });
}

export function useCommunityAgents() {
  const [loading, setLoading] = useState(true);
  const [community, setCommunity] = useState<EnrichedAgent[]>([]);
  const [rising, setRising] = useState<EnrichedAgent[]>([]);
  const [mostFollowed, setMostFollowed] = useState<EnrichedAgent[]>([]);
  const [newest, setNewest] = useState<EnrichedAgent[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const data = await fetchForecasterDiscovery();
        if (cancelled) return;

        const allCreator = dedupeCards([
          ...data.sections.trending,
          ...data.sections.rising,
          ...data.sections.newest,
          ...data.sections.most_followed,
          ...data.creator_forecasters,
        ]);

        setCommunity(enrichAgents(allCreator.map(cardToBase), []));
        setRising(enrichAgents(data.sections.rising.map(cardToBase), []));
        setMostFollowed(enrichAgents(data.sections.most_followed.map(cardToBase), []));
        setNewest(enrichAgents(data.sections.newest.map(cardToBase), []));
      } catch {
        if (!cancelled) {
          setCommunity([]);
          setRising([]);
          setMostFollowed([]);
          setNewest([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const byTab = useMemo(
    () => ({
      community,
      rising,
      most_followed: mostFollowed,
      new_voices: newest,
    }),
    [community, rising, mostFollowed, newest],
  );

  return { loading, byTab };
}
