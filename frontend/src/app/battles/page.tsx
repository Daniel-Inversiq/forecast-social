"use client";



import Link from "next/link";

import { useEffect, useMemo, useState } from "react";

import { FeedShell } from "@/components/feed/FeedShell";

import { HeatPill, LiveDot } from "@/components/feed/shared";

import { ActiveClashesSection } from "@/components/battles/ActiveClashesSection";

import { BattlesFilterBar } from "@/components/battles/BattlesFilterBar";

import { BattlesHero } from "@/components/battles/BattlesHero";

import { BattleWarFeed } from "@/components/battles/BattleWarFeed";

import { OpenFrontsStrip } from "@/components/battles/OpenFrontsStrip";

import {

  enrichBattle,

  filterBattles,

  filterBattlesByTheater,

  sortBattles,

  theaterShortLabel,

} from "@/components/battles/battleEnrichment";

import { FALLBACK_BATTLES } from "@/components/battles/fallbackData";

import type { Battle, BattleFilterKey, BattleSortKey } from "@/components/battles/types";

import { BeliefsSubNav } from "@/components/beliefs/BeliefsSubNav";

import { API_BASE } from "@/lib/api";



const API_URL = `${API_BASE}/battles`;



export default function BattlesPage() {

  const [raw, setRaw] = useState<Battle[] | null>(null);

  const [loading, setLoading] = useState(true);

  const [usingFallback, setUsingFallback] = useState(false);

  const [filter, setFilter] = useState<BattleFilterKey>("all");

  const [sort, setSort] = useState<BattleSortKey>("contested");

  const [query, setQuery] = useState("");

  const [theaterSlug, setTheaterSlug] = useState<string | null>(null);



  useEffect(() => {

    async function load() {

      setLoading(true);

      try {

        const res = await fetch(API_URL);

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const json = await res.json();

        if (!Array.isArray(json) || json.length === 0) throw new Error("Empty");

        setRaw(json);

        setUsingFallback(false);

      } catch {

        setRaw(FALLBACK_BATTLES);

        setUsingFallback(true);

      } finally {

        setLoading(false);

      }

    }

    load();

  }, []);



  const enriched = useMemo(

    () => (raw ?? FALLBACK_BATTLES).map((b, i) => enrichBattle(b, i)),

    [raw],

  );



  const activeClashes = useMemo(() => {

    const byCategory = filterBattles(enriched, filter, query);

    const byTheater = filterBattlesByTheater(byCategory, theaterSlug);

    return sortBattles(byTheater, sort);

  }, [enriched, filter, query, theaterSlug, sort]);



  const theaterLabel = useMemo(() => {

    if (!theaterSlug) return null;

    const b = enriched.find((x) => x.market_slug === theaterSlug);

    return b ? theaterShortLabel(b.contested_market) : null;

  }, [enriched, theaterSlug]);



  return (

    <FeedShell activeNav="Battles" hideCategoryNav>

      <BeliefsSubNav active="battles" />

      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">

        <div className="flex items-center gap-2 min-w-0">

          <LiveDot color="rose" />

          <p className="text-[11px] text-zinc-500 truncate">

            The fight card · every clash settles in reputation

          </p>

          <HeatPill tone="rose" pulse>

            Live

          </HeatPill>

        </div>

        <div className="flex items-center gap-2 shrink-0">

          {usingFallback && !loading && (

            <span className="text-[10px] text-zinc-600">Demo battles — API offline</span>

          )}

          <Link

            href="/"

            className="text-[10px] text-rose-400/90 hover:text-rose-300 border border-rose-500/25 px-2 py-0.5 rounded-full bg-rose-500/5 transition"

          >

            Conviction feed →

          </Link>

        </div>

      </div>



      <section className="feed-top-signal mb-3">

        <BattlesHero battles={enriched} />

      </section>



      <OpenFrontsStrip

        battles={enriched}

        activeSlug={theaterSlug}

        onSelect={setTheaterSlug}

      />



      <BattlesFilterBar

        filter={filter}

        onFilterChange={setFilter}

        query={query}

        onQueryChange={setQuery}

      />



      <ActiveClashesSection

        battles={activeClashes}

        loading={loading}

        sort={sort}

        onSortChange={setSort}

        theaterLabel={theaterLabel}

      />



      <BattleWarFeed battles={activeClashes.length > 0 ? activeClashes : enriched} />

    </FeedShell>

  );

}

